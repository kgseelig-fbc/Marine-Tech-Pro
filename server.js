const express = require('express');
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
const ADMIN_CODE = process.env.ADMIN_CODE || '';
const FBC_HUB_URL = process.env.FBC_HUB_URL || 'https://freedomboatclub.ai';

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

// Global rate limiter: 100 requests per 15 minutes
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});
app.use(globalLimiter);

// Login-specific rate limiter: 5 attempts per 15 minutes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

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
        secure: process.env.NODE_ENV === 'production' ? true : false,
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

// Login page
app.get('/login', (req, res) => {
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
app.post('/api/auth/signup', loginLimiter, (req, res) => {
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
    if (datastore.getUserByProvider('local', email)) {
        datastore.logEvent('signup_dup', { ...meta, data: { email } });
        return res.status(409).json({ success: false, message: 'An account with that email already exists. Try signing in.' });
    }
    try {
        const user = datastore.createLocalUser({
            email,
            password_hash: auth.hashPassword(password),
            display_name,
            initialAdminEmails: auth.INITIAL_ADMIN_EMAILS
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
app.post('/api/auth/login', loginLimiter, (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const meta = reqMeta(req);

    if (!auth.isEmail(email) || !password) {
        datastore.logEvent('login_fail', { ...meta, data: { reason: 'bad_input' } });
        return res.status(400).json({ success: false, message: 'Enter your email and password.' });
    }
    const user = datastore.getUserByProvider('local', email);
    if (!user || !auth.verifyPassword(password, user.password_hash)) {
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
app.post('/api/auth/admin-code', loginLimiter, (req, res) => {
    const code = String(req.body.code || '').trim();
    const meta = reqMeta(req);
    if (!ADMIN_CODE) {
        return res.status(503).json({ success: false, message: 'Admin break-glass not configured.' });
    }
    if (code !== ADMIN_CODE) {
        datastore.logEvent('login_fail', { ...meta, data: { reason: 'admin_code' } });
        return res.status(401).json({ success: false, message: 'Invalid admin access code.' });
    }
    req.session.regenerate((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Session error' });
        req.session.breakglass = true;
        datastore.logEvent('login_ok_breakglass', { ...meta });
        return res.json({ success: true, redirect: '/admin' });
    });
});

// Google OAuth — start
app.get('/auth/google', (req, res, next) => {
    if (!auth.googleConfigured) return res.redirect('/login?error=google_disabled');
    return auth.passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false,
        prompt: 'select_account'
    })(req, res, next);
});

// Google OAuth — callback
app.get('/auth/google/callback',
    (req, res, next) => {
        if (!auth.googleConfigured) return res.redirect('/login?error=google_disabled');
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

// Logout
app.post('/api/logout', (req, res) => {
    const meta = reqMeta(req);
    datastore.logEvent('logout', meta);
    req.session.destroy(() => {
        res.redirect('/login');
    });
});
// GET logout for convenience (forms / plain links)
app.get('/logout', (req, res) => {
    const meta = reqMeta(req);
    datastore.logEvent('logout', meta);
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// --- SERVE TRULY PUBLIC STATIC ASSETS (CSS, icons only) ---
// These are non-sensitive and needed for the login page to render properly.
// Short cache so deploys pick up quickly on techs' phones.
const staticOpts = {
    setHeaders: (res, filePath) => {
        if (/\.(html|js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
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
        const adminCount = datastore.listUsers({ limit: 500 }).filter(u => u.role === 'admin').length;
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
        const adminCount = datastore.listUsers({ limit: 500 }).filter(u => u.role === 'admin').length;
        if (adminCount <= 1) {
            return res.status(409).json({ success: false, message: 'Cannot delete the last admin.' });
        }
    }
    datastore.deleteUser(id);
    datastore.logEvent('user_delete', { ...reqMeta(req), data: { target_id: id, target_email: target.email } });
    res.json({ success: true });
});

// --- CLIENT BEACON ---
// Small endpoint the frontend calls to log tree navigations and fault lookups.
// Authenticated only — no anonymous writes.
const beaconLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
app.post('/api/event', beaconLimiter, (req, res) => {
    const kind = (req.body.kind || '').toString().slice(0, 48);
    const data = req.body.data && typeof req.body.data === 'object' ? req.body.data : null;
    const ALLOWED = new Set([
        'tree_start', 'tree_complete', 'tree_resolve', 'fault_lookup',
        'spec_view', 'ai_open', 'ai_close', 'error'
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
const anthropicClient = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// Load knowledge base once at startup for grounding the model
function loadKB() {
    const dir = path.join(__dirname, 'public', 'js');
    return {
        trees: fs.readFileSync(path.join(dir, 'diagnosticTrees.js'), 'utf8'),
        specs: fs.readFileSync(path.join(dir, 'engineSpecs.js'), 'utf8'),
        codes: fs.readFileSync(path.join(dir, 'faultcodes.js'), 'utf8')
    };
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
    const question = (req.body.question || '').toString().trim();
    if (!question) return res.status(400).json({ success: false, message: 'Question required.' });
    if (question.length > 2000) return res.status(400).json({ success: false, message: 'Question too long.' });

    const ctx = req.body.context || {};
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
                    text: `KNOWLEDGE BASE — DIAGNOSTIC TREES:\n${KB.trees}\n\nKNOWLEDGE BASE — ENGINE SPECS:\n${KB.specs}\n\nKNOWLEDGE BASE — FAULT CODES:\n${KB.codes}`,
                    cache_control: { type: 'ephemeral' }
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
        datastore.logEvent('ai_error', { ...meta, data: { msg: err.message } });
        res.status(500).json({ success: false, message: 'AI request failed. Try again.' });
    }
});

app.listen(PORT, () => {
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
});
