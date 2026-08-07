const express = require('express');
const compression = require('compression');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const datastore = require('./lib/db');
const auth = require('./lib/auth');

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const ADMIN_CODE = auth.ADMIN_CODE;
const FBC_HUB_URL = process.env.FBC_HUB_URL || 'https://freedomboatclub.ai';

// Hosts accepted as same-origin by the CSRF guard, beyond the request's own
// (proxy-aware) host. Derived from BASE_URL, which already names the canonical
// public origin for the OAuth callback.
const ALLOWED_ORIGIN_HOSTS = new Set(
    [process.env.BASE_URL]
        .filter(Boolean)
        .map(u => { try { return new URL(u).host; } catch (_) { return null; } })
        .filter(Boolean)
);

// Determine session secret
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
    sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn('WARNING: No SESSION_SECRET environment variable set. Using a randomly generated secret. Sessions will not persist across server restarts.');
}

// Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"]
        }
    }
}));

// Gzip responses — diagnosticTrees.js alone is ~268 KB raw, ~56 KB compressed,
// and techs load it over marina cell/WiFi.
app.use(compression());

// Global API rate limiter: 1000 requests per 15 minutes per IP.
// Scoped to /api only — static assets and page loads are not counted, and the
// tighter per-endpoint limiters (login, ask, feedback, beacon) remain the real
// control. /api/health is exempt so platform monitoring can never be throttled.
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Try again in a few minutes.' },
    skip: (req) => req.originalUrl === '/api/health'
});
app.use('/api', globalLimiter);

// Reject state-changing API calls that declare a foreign origin (see
// requireSameOrigin below). Applies to every /api mutation in one place.
app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    return requireSameOrigin(req, res, next);
});

// Auth rate limiters: 5 FAILED attempts per 15 minutes per IP, one instance
// per endpoint so signup, login, and admin-code don't share a counter.
// Successful requests don't count — several techs signing in from the same
// shop/marina NAT must not lock each other out.
function makeAuthLimiter() {
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        skipSuccessfulRequests: true,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Too many attempts. Please try again later.' }
    });
}
const signupLimiter = makeAuthLimiter();
const loginLimiter = makeAuthLimiter();
const adminCodeLimiter = makeAuthLimiter();

// Parse form/JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session config — persists to SQLite on the same volume as the app DB so
// sessions survive redeploys and don't leak memory.
app.use(session({
    store: new SqliteStore({
        client: datastore.db,
        expired: { clear: true, intervalMs: 15 * 60 * 1000 }
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        httpOnly: true,
        // 'auto' sets Secure whenever the connection is HTTPS (honouring
        // X-Forwarded-Proto, since trust proxy + proxy:true are set). Safer
        // than keying the flag off NODE_ENV, which an operator can forget.
        secure: 'auto',
        sameSite: 'lax'
    },
    proxy: true
}));

// Passport (for Google OAuth) — no session use; we write our own session fields.
app.use(auth.passport.initialize());

// Loads req.user from session (or break-glass).
app.use(auth.loadUser);

// Helpers
function reqMeta(req) {
    return {
        session_id: req.sessionID ? req.sessionID.slice(0, 16) : null,
        ip: req.ip,
        ua: req.get('user-agent') || null,
        user_id: req.user && req.user.id ? req.user.id : null
    };
}

// Defence-in-depth CSRF guard for state-changing requests: SameSite=Lax is
// the primary control, this rejects anything that declares a foreign origin.
// Requests with no Origin/Referer at all (curl, older clients) are allowed —
// browsers always send at least one on cross-site form posts and fetches.
function requireSameOrigin(req, res, next) {
    const origin = req.get('origin') || req.get('referer');
    if (!origin) return next();

    // Compare against the proxy-aware host (and the configured public origin),
    // not the raw Host header — a fronting proxy that rewrites Host would
    // otherwise 403 every state-changing request in the app at once.
    const selfHost = req.get('x-forwarded-host') || req.get('host');

    let host;
    try {
        host = new URL(origin).host;
    } catch (_) {
        // Unparseable or "null" (sandboxed iframe / opaque origin): fail closed.
        console.warn(`Cross-origin reject: unparseable origin "${origin}" on ${req.method} ${req.originalUrl}`);
        return res.status(403).json({ success: false, message: 'Cross-origin request rejected.' });
    }
    if (host === selfHost || ALLOWED_ORIGIN_HOSTS.has(host)) return next();

    console.warn(`Cross-origin reject: origin=${host} self=${selfHost} on ${req.method} ${req.originalUrl}`);
    return res.status(403).json({ success: false, message: 'Cross-origin request rejected.' });
}

function landingFor(user) {
    if (!user) return '/login';
    if (user.role === 'pending') return '/pending';
    if (user.role === 'denied') return '/login?error=denied';
    // Admins land on the main app like any other user — they can jump to /admin from the UI.
    return '/';
}

// --- PUBLIC ROUTES (no auth required) ---

// Health / version — public so monitoring can hit it.
const BUILD_SHA = (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'dev').slice(0, 7);
const BUILD_TIME = new Date().toISOString();
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', build: BUILD_SHA, startedAt: BUILD_TIME });
});

// Public landing / legal pages — required for Google OAuth production verification
// and usable as the shared homepage/privacy/terms across all FBC internal tools.
app.get('/landing', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});
app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

// PWA manifest must be public: browsers fetch <link rel="manifest"> WITHOUT
// credentials, so behind requireAuth it 302s to /login and the app becomes
// uninstallable. It contains nothing sensitive.
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// Service worker must be public and served from the root so its scope covers
// the whole app. It never caches /api responses (see public/sw.js).
app.get('/sw.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// Login page
app.get('/login', (req, res) => {
    // Denied users: destroy the session and render the page, otherwise
    // landingFor() sends them back to /login in an infinite redirect loop.
    if (req.user && req.user.role === 'denied') {
        return req.session.destroy(() => {
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
        });
    }
    if (req.user) return res.redirect(landingFor(req.user));
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Pending-approval page
app.get('/pending', (req, res) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.role !== 'pending') return res.redirect(landingFor(req.user));
    res.sendFile(path.join(__dirname, 'public', 'pending.html'));
});

// Feature flags & basic identity for the login page
app.get('/api/auth/config', (req, res) => {
    res.json({
        googleEnabled: auth.googleConfigured,
        adminCodeEnabled: !!ADMIN_CODE
    });
});

// Who am I? (used by login page to auto-redirect, and by pending page)
app.get('/api/me', (req, res) => {
    if (!req.user) return res.json({ authenticated: false });
    res.json({
        authenticated: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            display_name: req.user.display_name,
            role: req.user.role,
            breakglass: !!req.user.breakglass,
            provider: req.user.provider
        }
    });
});

// Local signup (email + password)
app.post('/api/auth/signup', signupLimiter, async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const display_name = String(req.body.display_name || '').trim().slice(0, 100) || null;
    const meta = reqMeta(req);

    if (!auth.isEmail(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (!auth.isStrongEnoughPassword(password)) {
        return res.status(400).json({ success: false, message: 'Password must be at least 10 characters.' });
    }
    // Check across ALL providers, not just 'local' — otherwise the same email
    // can hold two independent identities (e.g. a denied Google user
    // re-registering locally, or someone claiming an existing user's email).
    if (datastore.getUserByEmail(email)) {
        datastore.logEvent('signup_dup', { ...meta, data: { email } });
        return res.status(409).json({ success: false, message: 'An account with that email already exists. Try signing in.' });
    }
    try {
        const user = datastore.createLocalUser({
            email,
            password_hash: await auth.hashPassword(password),
            display_name
        });
        req.session.regenerate((err) => {
            if (err) {
                datastore.logEvent('error', { ...meta, data: { where: 'regenerate_signup', msg: err.message } });
                return res.status(500).json({ success: false, message: 'Session error' });
            }
            req.session.userId = user.id;
            datastore.touchUserLogin(user.id);
            datastore.logEvent('signup_ok', { session_id: meta.session_id, ip: req.ip, ua: meta.ua, user_id: user.id, data: { email, role: user.role } });
            return res.json({ success: true, redirect: landingFor(user), role: user.role });
        });
    } catch (err) {
        datastore.logEvent('error', { ...meta, data: { where: 'signup', msg: err.message } });
        return res.status(500).json({ success: false, message: 'Sign-up failed. Try again.' });
    }
});

// Local login (email + password)
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const meta = reqMeta(req);

    if (!auth.isEmail(email) || !password) {
        datastore.logEvent('login_fail', { ...meta, data: { reason: 'bad_input' } });
        return res.status(400).json({ success: false, message: 'Enter your email and password.' });
    }
    const user = datastore.getUserByProvider('local', email);
    let passwordOk = false;
    try {
        passwordOk = !!user && await auth.verifyPassword(password, user.password_hash);
    } catch (err) {
        datastore.logEvent('error', { ...meta, data: { where: 'login_verify', msg: err.message } });
        return res.status(500).json({ success: false, message: 'Login failed. Try again.' });
    }
    if (!passwordOk) {
        datastore.logEvent('login_fail', { ...meta, data: { email } });
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    req.session.regenerate((err) => {
        if (err) {
            datastore.logEvent('error', { ...meta, data: { where: 'regenerate_login', msg: err.message } });
            return res.status(500).json({ success: false, message: 'Session error' });
        }
        req.session.userId = user.id;
        datastore.touchUserLogin(user.id);
        datastore.logEvent('login_ok', { session_id: meta.session_id, ip: req.ip, ua: meta.ua, user_id: user.id });
        return res.json({ success: true, redirect: landingFor(user), role: user.role });
    });
});

// Admin break-glass (ADMIN_CODE only — no user row)
app.post('/api/auth/admin-code', adminCodeLimiter, (req, res) => {
    const code = String(req.body.code || '').trim();
    const meta = reqMeta(req);
    if (!ADMIN_CODE) {
        return res.status(503).json({ success: false, message: 'Admin break-glass not configured.' });
    }
    if (!auth.checkAdminCode(code)) {
        datastore.logEvent('login_fail', { ...meta, data: { reason: 'admin_code' } });
        return res.status(401).json({ success: false, message: 'Invalid admin access code.' });
    }
    req.session.regenerate((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Session error' });
        req.session.breakglass = true;
        // Stamp the code's tag so rotating ADMIN_CODE revokes this session.
        req.session.breakglassTag = auth.adminCodeTag();
        datastore.logEvent('login_ok_breakglass', { ...meta });
        return res.json({ success: true, redirect: '/admin' });
    });
});

// Google OAuth — start.
// A random `state` value is stored in the session and verified in the
// callback: without it an attacker can feed a victim a pre-baked callback
// URL and silently sign them into the attacker's account (login CSRF).
app.get('/auth/google', (req, res, next) => {
    if (!auth.googleConfigured) return res.redirect('/login?error=google_disabled');
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    req.session.save((err) => {
        if (err) return res.redirect('/login?error=session');
        return auth.passport.authenticate('google', {
            scope: ['profile', 'email'],
            session: false,
            prompt: 'select_account',
            state
        })(req, res, next);
    });
});

// Google OAuth — callback
app.get('/auth/google/callback',
    (req, res, next) => {
        if (!auth.googleConfigured) return res.redirect('/login?error=google_disabled');
        const expectedState = req.session ? req.session.oauthState : null;
        if (req.session) delete req.session.oauthState; // single use
        const gotState = typeof req.query.state === 'string' ? req.query.state : '';
        if (!expectedState || gotState !== expectedState) {
            datastore.logEvent('login_fail', { ...reqMeta(req), data: { reason: 'oauth_state' } });
            return res.redirect('/login?error=oauth');
        }
        auth.passport.authenticate('google', { session: false }, (err, user, info) => {
            const meta = reqMeta(req);
            if (err) {
                datastore.logEvent('error', { ...meta, data: { where: 'oauth_google', msg: err.message } });
                return res.redirect('/login?error=oauth');
            }
            if (!user) {
                datastore.logEvent('login_fail', { ...meta, data: { reason: (info && info.message) || 'oauth_reject' } });
                return res.redirect('/login?error=oauth');
            }
            req.session.regenerate((sErr) => {
                if (sErr) return res.redirect('/login?error=session');
                req.session.userId = user.id;
                datastore.touchUserLogin(user.id);
                datastore.logEvent('login_ok_google', {
                    session_id: req.sessionID ? req.sessionID.slice(0, 16) : null,
                    ip: req.ip,
                    ua: req.get('user-agent') || null,
                    user_id: user.id,
                    data: { email: user.email, role: user.role }
                });
                return res.redirect(landingFor(user));
            });
        })(req, res, next);
    }
);

// Logout — POST only. A GET that destroys the session is CSRF-able: with
// SameSite=Lax the cookie still rides top-level cross-site navigations, so a
// mere link could sign a tech out mid-job.
app.post('/api/logout', (req, res) => {
    const meta = reqMeta(req);
    datastore.logEvent('logout', meta);
    req.session.destroy(() => {
        // The no-JS confirmation page below posts a real form, which is a
        // top-level navigation — answer that with a redirect, or the browser
        // paints the JSON body as the document. 303 makes it a GET.
        if (req.accepts(['json', 'html']) === 'html') return res.redirect(303, '/login');
        res.json({ success: true, redirect: '/login' });
    });
});

// GET /logout is a confirmation page, not an action — the button POSTs.
app.get('/logout', (req, res) => {
    if (!req.user) return res.redirect('/login');
    res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign out — Marine Tech Pro</title>
<link rel="stylesheet" href="/css/styles.css"></head>
<body><div style="max-width:420px;margin:60px auto;padding:24px;text-align:center;">
<h2 style="margin-bottom:8px;">Sign out?</h2>
<p style="color:#5a6b7a;margin-bottom:24px;">You'll need to sign in again to use Marine Tech Pro.</p>
<form method="POST" action="/api/logout">
<button type="submit" style="padding:14px 28px;font-size:16px;font-weight:600;border:none;border-radius:10px;background:#0B2240;color:#fff;cursor:pointer;">Sign out</button>
</form>
<p style="margin-top:20px;"><a href="/" style="color:#5a6b7a;font-size:14px;">Cancel</a></p>
</div></body></html>`);
});

// --- SERVE TRULY PUBLIC STATIC ASSETS (CSS, icons only) ---
// These are non-sensitive and needed for the login page to render properly.
// Short cache so deploys pick up quickly on techs' phones.
// Everything revalidates. The domain data files (diagnosticTrees.js,
// faultcodes.js, engineSpecs.js) carry no content hash in their URL, so a
// long max-age would keep a corrected fault code or diagnostic step out of a
// tech's hands for up to a day — and would also defeat the service worker's
// background revalidation, which fetches through the HTTP cache.
// Offline speed comes from the service worker, not from HTTP staleness.
// `private` because these assets sit behind session auth.
const staticOpts = {
    setHeaders: (res, filePath) => {
        if (/\.(html|js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
        }
    }
};
app.use('/css', express.static(path.join(__dirname, 'public', 'css'), staticOpts));
app.use('/icons', express.static(path.join(__dirname, 'public', 'icons'), staticOpts));

// --- AUTH MIDDLEWARE (protects everything below) ---

const requireAuth = auth.requireAuth;
const requireAdmin = auth.requireAdmin;

app.use(requireAuth);

// --- ADMIN ROUTES (must come before the generic static handler) ---

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/overview', requireAdmin, (req, res) => {
    res.json({
        success: true,
        build: BUILD_SHA,
        startedAt: BUILD_TIME,
        hubUrl: FBC_HUB_URL,
        pendingCount: datastore.countPending(),
        newFeedbackCount: datastore.countNewFeedback(),
        summary: datastore.getSummary(),
        activity: datastore.getActivityByHour(48),
        topTrees: datastore.getTopTrees(12),
        recentAi: datastore.getRecentAi(25),
        recentEvents: datastore.getRecentEvents(40),
        errors: datastore.getErrors(25)
    });
});

// --- ADMIN USER MANAGEMENT ---

app.get('/api/admin/users', requireAdmin, (req, res) => {
    res.json({ success: true, users: datastore.listUsers({ limit: 500 }) });
});

app.post('/api/admin/users/:id/role', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const role = String(req.body.role || '').trim();
    if (!id || !datastore.ROLES.has(role)) {
        return res.status(400).json({ success: false, message: 'Invalid id or role' });
    }
    const target = datastore.getUserById(id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    // Guardrail: prevent break-glass admins (no user id) from demoting themselves — n/a.
    // Guardrail: a real admin cannot demote the LAST real admin (themselves included).
    if (target.role === 'admin' && role !== 'admin') {
        const adminCount = datastore.countAdmins();
        if (adminCount <= 1) {
            return res.status(409).json({ success: false, message: 'Cannot demote the last admin.' });
        }
    }

    const actorId = req.user && req.user.id ? req.user.id : null;
    const updated = datastore.setUserRole(id, role, actorId);
    datastore.logEvent('user_role_change', {
        ...reqMeta(req),
        data: { target_id: id, target_email: target.email, from: target.role, to: role }
    });
    res.json({ success: true, user: sanitizeUser(updated) });
});

function sanitizeUser(u) {
    if (!u) return null;
    const { password_hash, ...safe } = u;
    return safe;
}

app.post('/api/admin/users/:id/delete', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
    const target = datastore.getUserById(id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role === 'admin') {
        const adminCount = datastore.countAdmins();
        if (adminCount <= 1) {
            return res.status(409).json({ success: false, message: 'Cannot delete the last admin.' });
        }
    }
    datastore.deleteUser(id);
    datastore.logEvent('user_delete', { ...reqMeta(req), data: { target_id: id, target_email: target.email } });
    res.json({ success: true });
});

// --- FEEDBACK ---
// Authenticated techs can submit feedback (bug / feedback / enhancement).
const feedbackLimiter = rateLimit({ windowMs: 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false });
app.post('/api/feedback', feedbackLimiter, (req, res) => {
    const category = String(req.body.category || '').trim().toLowerCase();
    const message = String(req.body.message || '').trim();
    const ctx = req.body.context || {};
    if (!datastore.FEEDBACK_CATEGORIES.has(category)) {
        return res.status(400).json({ success: false, message: 'Invalid category.' });
    }
    if (!message || message.length < 3) {
        return res.status(400).json({ success: false, message: 'Please include a short description.' });
    }
    if (message.length > 4000) {
        return res.status(400).json({ success: false, message: 'Message too long (max 4000 chars).' });
    }
    const user = req.user || {};
    const id = datastore.insertFeedback({
        user_id: user.id || null,
        user_email: user.email || null,
        user_name: user.display_name || null,
        category,
        message,
        page_url: ctx.page_url || null,
        ctx_tree: ctx.tree || null,
        ctx_node: ctx.node || null,
        ua: req.get('user-agent') || null
    });
    datastore.logEvent('feedback_submit', { ...reqMeta(req), data: { id, category } });
    res.json({ success: true, id });
});

app.get('/api/admin/feedback', requireAdmin, (req, res) => {
    const status = req.query.status ? String(req.query.status) : null;
    res.json({ success: true, feedback: datastore.listFeedback({ status, limit: 200 }) });
});

app.post('/api/admin/feedback/:id/status', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const status = String(req.body.status || '').trim();
    if (!id || !datastore.FEEDBACK_STATUSES.has(status)) {
        return res.status(400).json({ success: false, message: 'Invalid id or status' });
    }
    try {
        const updated = datastore.setFeedbackStatus(id, status);
        datastore.logEvent('feedback_status_change', { ...reqMeta(req), data: { id, status } });
        res.json({ success: true, feedback: updated });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

app.post('/api/admin/feedback/:id/reply', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const reply = req.body.reply == null ? null : String(req.body.reply).trim();
    if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
    const updated = datastore.setFeedbackAdminReply(id, reply || null);
    datastore.logEvent('feedback_reply', { ...reqMeta(req), data: { id, has_reply: !!reply } });
    res.json({ success: true, feedback: updated });
});

app.post('/api/admin/feedback/:id/pin', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const flag = !!req.body.pin;
    if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
    const updated = datastore.setFeedbackKnownIssue(id, flag);
    datastore.logEvent('feedback_pin', { ...reqMeta(req), data: { id, pinned: flag } });
    res.json({ success: true, feedback: updated });
});

// --- USER-VISIBLE FEEDBACK STATUS ---
const feedbackReadLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
app.get('/api/me/feedback', feedbackReadLimiter, (req, res) => {
    const user = req.user;
    if (!user || !user.id) return res.json({ success: true, feedback: [] });
    res.json({ success: true, feedback: datastore.listFeedbackForUser(user.id) });
});

app.get('/api/known-issues', feedbackReadLimiter, (req, res) => {
    res.json({ success: true, issues: datastore.listKnownIssues() });
});

// --- CLIENT BEACON ---
// Small endpoint the frontend calls to log tree navigations and fault lookups.
// Authenticated only — no anonymous writes.
const beaconLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
app.post('/api/event', beaconLimiter, (req, res) => {
    const kind = (req.body.kind || '').toString().slice(0, 48);
    const data = req.body.data && typeof req.body.data === 'object' ? req.body.data : null;
    // NOTE: no 'error' here. Client-reported errors are logged as
    // 'client_error' so they can't be forged into the admin dashboard's
    // server-error panel (getErrors reads 'error'/'login_fail'/'ai_error').
    const ALLOWED = new Set([
        'tree_start', 'tree_complete', 'tree_resolve', 'fault_lookup',
        'spec_view', 'ai_open', 'ai_close', 'client_error'
    ]);
    if (!ALLOWED.has(kind)) return res.status(400).json({ success: false });
    datastore.logEvent(kind, { ...reqMeta(req), data });
    res.json({ success: true });
});

// --- PROTECTED STATIC FILES ---
// JS data files (diagnosticTrees.js, engineSpecs.js, faultcodes.js) and
// all other assets are only accessible after authentication.
app.use(express.static(path.join(__dirname, 'public'), staticOpts));

// Root serves index.html for everyone; admins reach /admin via the in-app link.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- ASK-A-TECH AI ENDPOINT ---

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
// Explicit budget: without these, the SDK defaults to a 10-minute timeout with
// 2 retries — a degraded upstream could hold a tech's phone connection ~30 min.
const anthropicClient = ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 60 * 1000, maxRetries: 1 })
    : null;

// Load knowledge base once at startup for grounding the model.
// A missing KB file must NOT take the whole app down — auth, diagnostics and
// fault-code lookup don't need it. On failure KB stays null and only
// /api/ask degrades to 503, mirroring the missing-API-key path.
function loadKB() {
    const dir = path.join(__dirname, 'public', 'js');
    try {
        const kb = {
            trees: fs.readFileSync(path.join(dir, 'diagnosticTrees.js'), 'utf8'),
            specs: fs.readFileSync(path.join(dir, 'engineSpecs.js'), 'utf8'),
            codes: fs.readFileSync(path.join(dir, 'faultcodes.js'), 'utf8')
        };
        // Optional Yamaha factory service manual corpus. Lives in kb/ rather
        // than public/js/ because no page loads it — it is prompt grounding
        // only, and shipping it to browsers wasted bandwidth.
        try {
            kb.yamahaManuals = fs.readFileSync(path.join(__dirname, 'kb', 'yamahaManuals.js'), 'utf8');
        } catch (e) {
            kb.yamahaManuals = '';
        }
        return kb;
    } catch (err) {
        console.error('FATAL-ish: knowledge base failed to load — /api/ask will return 503:', err.message);
        return null;
    }
}
const KB = loadKB();

const SYSTEM_INSTRUCTIONS = `You are Marine Tech Pro's AI assistant for Freedom Boat Club technicians working on Mercury and Yamaha 4-stroke outboards (115–300 HP) and boat systems.

Your job: answer diagnostic and repair questions from a tech in the field, on a phone, often next to a running engine. Be direct. Use short sentences and bulleted steps. Skip pleasantries.

Ground your answers in the knowledge base below (diagnostic trees, engine specs, fault codes). When the KB has a relevant tree or spec, cite it by name. When the KB does not cover a topic (e.g., fresh water, hydraulic steering purge, NMEA 2000, galvanic corrosion), answer from general marine-tech best practice and say so plainly.

Safety: if the question involves fuel, electrical, or running the engine out of water, lead with the one safety step that matters most. Do not pad with generic PPE reminders.

If the tech is currently inside a diagnostic tree (context will say so), relate your answer to where they are in that tree.

Format: plain text with short bullets. No markdown headers, no emoji, no preamble like "Great question."`;

const askLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Slow down — too many questions in a minute.' }
});

app.post('/api/ask', askLimiter, async (req, res) => {
    const meta = reqMeta(req);
    const started = Date.now();

    if (!anthropicClient) {
        datastore.logEvent('ai_error', { ...meta, data: { reason: 'no_api_key' } });
        return res.status(503).json({ success: false, message: 'AI assistant not configured (ANTHROPIC_API_KEY missing).' });
    }
    if (!KB) {
        datastore.logEvent('ai_error', { ...meta, data: { reason: 'no_kb' } });
        return res.status(503).json({ success: false, message: 'AI assistant unavailable (knowledge base failed to load).' });
    }
    const question = (req.body.question || '').toString().trim();
    if (!question) return res.status(400).json({ success: false, message: 'Question required.' });
    if (question.length > 2000) return res.status(400).json({ success: false, message: 'Question too long.' });

    // Bound client-supplied context: the frontend only sends known tree/node
    // ids, but a hostile client could stuff ~100 KB of prompt text in here.
    const rawCtx = req.body.context || {};
    const ctx = {
        tree: rawCtx.tree ? String(rawCtx.tree).slice(0, 120) : null,
        node: rawCtx.node ? String(rawCtx.node).slice(0, 120) : null
    };
    const ctxLine = ctx.tree
        ? `CURRENT CONTEXT: Tech is in diagnostic tree "${ctx.tree}" at node "${ctx.node || 'unknown'}".`
        : `CURRENT CONTEXT: Tech is browsing the app (no active diagnostic).`;

    try {
        const msg = await anthropicClient.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: [
                { type: 'text', text: SYSTEM_INSTRUCTIONS },
                {
                    type: 'text',
                    text: `KNOWLEDGE BASE — DIAGNOSTIC TREES:\n${KB.trees}\n\nKNOWLEDGE BASE — ENGINE SPECS:\n${KB.specs}\n\nKNOWLEDGE BASE — FAULT CODES:\n${KB.codes}${KB.yamahaManuals ? `\n\nKNOWLEDGE BASE — YAMAHA FACTORY SERVICE MANUAL REFERENCE (F115C, F150TR, F200TR/F225TR):\n${KB.yamahaManuals}` : ''}`,
                    // 1h TTL: field usage is bursty and sporadic — the default
                    // 5-minute TTL misses most reads and re-pays the ~100K-token
                    // cache write on nearly every question.
                    cache_control: { type: 'ephemeral', ttl: '1h' }
                }
            ],
            messages: [
                { role: 'user', content: `${ctxLine}\n\nQUESTION: ${question}` }
            ]
        });
        const answer = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        const usage = msg.usage || {};
        datastore.logAi({
            ...meta,
            question, answer,
            ctx_tree: ctx.tree || null,
            ctx_node: ctx.node || null,
            tokens_in: (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0),
            tokens_out: usage.output_tokens || 0,
            duration_ms: Date.now() - started,
            ok: true
        });
        res.json({ success: true, answer });
    } catch (err) {
        console.error('Ask error:', err.message);
        datastore.logAi({
            ...meta,
            question,
            ctx_tree: ctx.tree || null,
            ctx_node: ctx.node || null,
            duration_ms: Date.now() - started,
            ok: false,
            error: err.message
        });
        datastore.logEvent('ai_error', { ...meta, data: { msg: err.message, status: err.status || null } });
        // Map upstream status through instead of a blanket 500, so the client
        // backs off on rate limits and surfaces config problems to an admin.
        if (err.status === 429 || err.status === 529) {
            return res.status(429).json({ success: false, message: 'AI is busy right now — wait a moment and try again.' });
        }
        if (err.status === 401 || err.status === 403) {
            return res.status(503).json({ success: false, message: 'AI assistant is misconfigured. Tell an admin.' });
        }
        res.status(500).json({ success: false, message: 'AI request failed. Try again.' });
    }
});

// --- 404 + ERROR HANDLING (must be last) ---

// JSON 404 for API paths so fetch().json() callers get the standard shape.
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'Not found' });
});

// Terminal error handler. Without this, Express's default handler returns an
// HTML error page (with a stack trace when NODE_ENV isn't 'production') to
// clients that always parse JSON, and nothing lands in the events table that
// the admin dashboard's error panel reads.
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const isApi = (req.originalUrl || '').startsWith('/api/');
    const badBody = err.type === 'entity.parse.failed' || err.status === 400;
    const status = badBody ? 400 : (err.status && err.status < 500 ? err.status : 500);

    console.error(`Error ${status} on ${req.method} ${req.originalUrl}:`, err.message);
    // Only genuine server faults go in as kind 'error' — that's what the admin
    // dashboard's error panel reads. Client-caused 4xx (malformed JSON etc.)
    // log under a separate kind so they can't drown out real failures.
    datastore.logEvent(status >= 500 ? 'error' : 'bad_request', {
        ...reqMeta(req),
        data: { where: 'express', path: (req.originalUrl || '').slice(0, 200), msg: err.message, status }
    });

    if (isApi) {
        return res.status(status).json({
            success: false,
            message: badBody ? 'Malformed request body.' : 'Server error'
        });
    }
    res.status(status).type('text').send(badBody ? 'Bad request' : 'Server error');
});

// Last-resort process guards. These LOG and then EXIT — installing a listener
// that only logs would suppress Node's default crash behaviour and leave a
// process running in an undefined state while /api/health still answers "ok",
// so the platform never restarts it. Recording the event first means the
// admin dashboard's error panel shows why it went down.
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    try {
        datastore.logEvent('error', { data: { where: 'unhandledRejection', msg: String((reason && reason.message) || reason).slice(0, 500) } });
    } catch (_) {}
    shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    try {
        datastore.logEvent('error', { data: { where: 'uncaughtException', msg: err.message } });
    } catch (_) {}
    shutdown('uncaughtException', 1);
});

const server = app.listen(PORT, () => {
    console.log(`Marine Tech Pro running on port ${PORT}`);
    console.log(`DB at ${datastore.DB_PATH}`);
    if (!auth.googleConfigured) {
        console.warn('NOTE: Google SSO not configured (set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET).');
    }
    if (auth.INITIAL_ADMIN_EMAILS.length === 0) {
        console.warn('NOTE: INITIAL_ADMIN_EMAILS not set — first sign-in will land in the pending queue with no one to approve them.');
    } else {
        console.log(`INITIAL_ADMIN_EMAILS: ${auth.INITIAL_ADMIN_EMAILS.join(', ')}`);
    }
    if (!ADMIN_CODE) {
        console.warn('NOTE: ADMIN_CODE not set — break-glass admin login is disabled.');
    }
    if (!process.env.IP_HASH_SALT) {
        console.warn('NOTE: IP_HASH_SALT not set — audit-log IP hashes use a source-visible default salt.');
    }
    if (!KB) {
        console.warn('NOTE: knowledge base did not load — Ask-a-Tech will return 503.');
    }
    // Trim telemetry now and daily.
    datastore.startRetentionJob();
});

// Graceful shutdown: Railway sends SIGTERM on every redeploy. Drain in-flight
// requests (an /api/ask call can run tens of seconds) and close SQLite so the
// WAL is checkpointed instead of left for recovery on next boot.
// Sized to sit inside a typical platform SIGKILL grace window. Note the AI
// client's own budget (60s timeout, 1 retry) can exceed this: a tech's
// in-flight question may be cut short on redeploy. Raise DRAIN_TIMEOUT_MS if
// the platform grants a longer grace period.
const DRAIN_TIMEOUT_MS = Number(process.env.DRAIN_TIMEOUT_MS || 25000);

let shuttingDown = false;
function shutdown(signal, code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — draining connections…`);

    const closeDb = () => {
        try { datastore.db.close(); } catch (e) { console.warn('DB close failed:', e.message); }
    };

    // A timed-out drain is an expected outcome, not a crash — exit with the
    // caller's code so a clean redeploy isn't reported as a failure. Close
    // SQLite on this path too, so the WAL is checkpointed either way.
    const force = setTimeout(() => {
        console.warn('Drain timed out — exiting.');
        closeDb();
        process.exit(code);
    }, DRAIN_TIMEOUT_MS);
    force.unref();

    server.close(() => {
        closeDb();
        console.log('Shutdown complete.');
        process.exit(code);
    });
    // Don't let idle keep-alive sockets hold the drain open.
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
