const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_CODE = process.env.ACCESS_CODE || '';

// Parse form/JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session config
app.use(session({
    secret: process.env.SESSION_SECRET || 'marine-tech-pro-secret-' + Date.now(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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

// Login API
app.post('/api/login', (req, res) => {
    const password = (req.body.password || '').trim();

    if (!ACCESS_CODE) {
        return res.json({ success: false, message: 'Server access code not configured' });
    }

    if (password.toLowerCase() === ACCESS_CODE.toLowerCase()) {
        req.session.authenticated = true;
        return res.json({ success: true });
    }

    res.json({ success: false, message: 'Invalid access code' });
});

// Logout API
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// --- AUTH MIDDLEWARE (protects everything below) ---

app.use((req, res, next) => {
    // Allow static assets (CSS, JS, icons) through without auth
    if (req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/icons/')) {
        return next();
    }
    if (req.session.authenticated) return next();
    res.redirect('/login');
});

// --- PROTECTED STATIC FILES ---
app.use(express.static(path.join(__dirname, 'public')));

// Root serves index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Marine Tech Pro running on port ${PORT}`);
});
