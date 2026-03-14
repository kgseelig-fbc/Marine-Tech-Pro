const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_CODE = process.env.ACCESS_CODE || '';

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
            scriptSrc: ["'self'"],
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

// --- PUBLIC ROUTES (no auth required) ---

// Login page
app.get('/login', (req, res) => {
    if (req.session.authenticated) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login API (with login-specific rate limiting)
app.post('/api/login', loginLimiter, (req, res) => {
    const password = (req.body.password || '').trim();

    if (!ACCESS_CODE) {
        return res.json({ success: false, message: 'Server access code not configured' });
    }

    if (password === ACCESS_CODE) {
        // Regenerate session to prevent session fixation
        req.session.regenerate((err) => {
            if (err) {
                return res.json({ success: false, message: 'Session error' });
            }
            req.session.authenticated = true;
            return res.json({ success: true });
        });
    } else {
        res.json({ success: false, message: 'Invalid access code' });
    }
});

// Logout API
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// --- SERVE TRULY PUBLIC STATIC ASSETS (CSS, icons only) ---
// These are non-sensitive and needed for the login page to render properly.
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/icons', express.static(path.join(__dirname, 'public', 'icons')));

// --- AUTH MIDDLEWARE (protects everything below) ---

app.use((req, res, next) => {
    if (req.session.authenticated) return next();
    res.redirect('/login');
});

// --- PROTECTED STATIC FILES ---
// JS data files (diagnosticTrees.js, engineSpecs.js, faultcodes.js) and
// all other assets are only accessible after authentication.
app.use(express.static(path.join(__dirname, 'public')));

// Root serves index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Marine Tech Pro running on port ${PORT}`);
});
