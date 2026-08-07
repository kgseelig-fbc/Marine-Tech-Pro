const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const datastore = require('./db');

const ADMIN_CODE = process.env.ADMIN_CODE || '';

// Break-glass admin code handling.
//
// checkAdminCode compares in constant time (over SHA-256 digests, so the
// comparison length never leaks the secret's length).
//
// adminCodeTag is stamped into the session at break-glass login and
// re-checked on every request: rotating ADMIN_CODE therefore invalidates
// every existing break-glass session immediately, instead of leaving them
// live for up to the 8-hour cookie maxAge.
function sha256(s) {
    return crypto.createHash('sha256').update(String(s)).digest();
}

function checkAdminCode(candidate) {
    if (!ADMIN_CODE) return false;
    return crypto.timingSafeEqual(sha256(candidate), sha256(ADMIN_CODE));
}

function adminCodeTag() {
    if (!ADMIN_CODE) return null;
    return sha256(ADMIN_CODE).toString('hex').slice(0, 16);
}

const INITIAL_ADMIN_EMAILS = (process.env.INITIAL_ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const BASE_URL = (process.env.BASE_URL || '').replace(/\/+$/, '');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

const googleConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

if (googleConfigured) {
    const callbackURL = (BASE_URL ? BASE_URL : '') + '/auth/google/callback';
    passport.use(new GoogleStrategy({
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL,
        proxy: true
    }, (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails[0] && profile.emails[0].value;
            if (!email) return done(null, false, { message: 'Google account has no email' });
            const verified = profile.emails[0].verified;
            if (verified === false) return done(null, false, { message: 'Google email is not verified' });

            const user = datastore.upsertOauthUser({
                provider: 'google',
                provider_id: profile.id,
                email,
                display_name: profile.displayName || '',
                avatar_url: (profile.photos && profile.photos[0] && profile.photos[0].value) || null,
                initialAdminEmails: INITIAL_ADMIN_EMAILS
            });
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }));
}

// Async on purpose: bcryptjs is pure JS, so the sync API blocks the event
// loop for hundreds of ms per hash at cost 12, stalling every other request.
function hashPassword(pw) {
    return bcrypt.hash(pw, 12); // returns a Promise
}
async function verifyPassword(pw, hash) {
    if (!hash) return false;
    try { return await bcrypt.compare(pw, hash); } catch (_) { return false; }
}

// Middleware — loads req.user from session (or from break-glass flag).
function loadUser(req, res, next) {
    req.user = null;
    if (req.session && req.session.breakglass) {
        // Re-validate against the CURRENT admin code — a rotated or removed
        // ADMIN_CODE must kill existing break-glass sessions immediately.
        //
        // Strip the privilege in place rather than calling session.destroy():
        // express-session's destroy() deletes req.session before its store
        // callback runs, so any later middleware touching req.session (the
        // login/OAuth handlers all do) would throw on the very next request
        // after a code rotation.
        const tag = adminCodeTag();
        if (!tag || req.session.breakglassTag !== tag) {
            delete req.session.breakglass;
            delete req.session.breakglassTag;
            req.user = null;
            return next();
        }
        req.user = {
            id: null,
            role: 'admin',
            breakglass: true,
            email: 'admin (break-glass)',
            display_name: 'Admin (break-glass)',
            provider: 'breakglass'
        };
        return next();
    }
    if (req.session && req.session.userId) {
        const u = datastore.getUserById(req.session.userId);
        if (u) {
            req.user = u;
        } else {
            // Session points at a deleted user — drop the session.
            req.session.destroy(() => {});
        }
    }
    next();
}

function wantsJson(req) {
    return req.xhr
        || (req.get('accept') || '').indexOf('application/json') !== -1
        || (req.originalUrl || req.url || '').startsWith('/api/');
}

function requireAuth(req, res, next) {
    if (!req.user) {
        if (wantsJson(req)) return res.status(401).json({ success: false, message: 'Not signed in' });
        return res.redirect('/login');
    }
    if (req.user.role === 'pending') {
        if (wantsJson(req)) return res.status(403).json({ success: false, message: 'Account pending approval' });
        return res.redirect('/pending');
    }
    if (req.user.role === 'denied') {
        if (wantsJson(req)) return res.status(403).json({ success: false, message: 'Account denied' });
        // Force logout
        req.session.destroy(() => res.redirect('/login?error=denied'));
        return;
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        if (wantsJson(req)) return res.status(403).json({ success: false, message: 'Admin only' });
        return res.redirect('/login');
    }
    next();
}

function isEmail(s) {
    return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 200;
}
function isStrongEnoughPassword(pw) {
    return typeof pw === 'string' && pw.length >= 10 && pw.length <= 200;
}

module.exports = {
    passport,
    googleConfigured,
    INITIAL_ADMIN_EMAILS,
    ADMIN_CODE,
    checkAdminCode,
    adminCodeTag,
    hashPassword,
    verifyPassword,
    loadUser,
    requireAuth,
    requireAdmin,
    isEmail,
    isStrongEnoughPassword
};
