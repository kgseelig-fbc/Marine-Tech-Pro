const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const datastore = require('./lib/db');

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
const ACCESS_CODE = process.env.ACCESS_CODE || '';
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

// Session config
app.use(session({
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

// Helpers
function reqMeta(req) {
    return {
        session_id: req.sessionID ? req.sessionID.slice(0, 16) : null,
        ip: req.ip,
        ua: req.get('user-agent') || null
    };
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
    if (req.session.authenticated) return res.redirect(req.session.admin ? '/admin' : '/');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login API (with login-specific rate limiting)
app.post('/api/login', loginLimiter, (req, res) => {
    const password = (req.body.password || '').trim();
    const meta = reqMeta(req);

    if (!ACCESS_CODE && !ADMIN_CODE) {
        return res.json({ success: false, message: 'Server access code not configured' });
    }

    const isAdmin = !!ADMIN_CODE && password === ADMIN_CODE;
    const isTech  = !!ACCESS_CODE && password === ACCESS_CODE;

    if (isAdmin || isTech) {
        req.session.regenerate((err) => {
            if (err) {
                datastore.logEvent('error', { ...meta, data: { where: 'regenerate', msg: err.message } });
                return res.json({ success: false, message: 'Session error' });
            }
            req.session.authenticated = true;
            req.session.admin = isAdmin;
            datastore.logEvent(isAdmin ? 'login_ok_admin' : 'login_ok', { ...reqMeta(req) });
            return res.json({ success: true, admin: isAdmin, redirect: isAdmin ? '/admin' : '/' });
        });
    } else {
        datastore.logEvent('login_fail', { ...meta });
        res.json({ success: false, message: 'Invalid access code' });
    }
});

// Logout API
app.post('/api/logout', (req, res) => {
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

function requireAuth(req, res, next) {
    if (req.session.authenticated) return next();
    res.redirect('/login');
}
function requireAdmin(req, res, next) {
    if (req.session.authenticated && req.session.admin) return next();
    if (req.xhr || req.get('accept') === 'application/json') {
        return res.status(403).json({ success: false, message: 'Admin only' });
    }
    res.redirect('/login');
}

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
        summary: datastore.getSummary(),
        activity: datastore.getActivityByHour(48),
        topTrees: datastore.getTopTrees(12),
        recentAi: datastore.getRecentAi(25),
        recentEvents: datastore.getRecentEvents(40),
        errors: datastore.getErrors(25)
    });
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

// Root serves index.html (techs) or /admin for admins.
app.get('/', (req, res) => {
    if (req.session.admin) return res.redirect('/admin');
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
    if (!ADMIN_CODE) console.warn('WARNING: ADMIN_CODE not set — /admin dashboard unreachable.');
});
