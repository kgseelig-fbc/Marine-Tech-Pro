// Auth gating tests — the middleware ordering in server.js is load-bearing
// (public routes -> css/icons static -> requireAuth -> admin routes ->
// protected static) and exactly the kind of thing that regresses silently.
//
// Run with: npm test

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3971;
const BASE = `http://127.0.0.1:${PORT}`;
let child;
let dataDir;

function get(p, opts = {}) {
    return fetch(BASE + p, { redirect: 'manual', ...opts });
}
function postJson(p, body, opts = {}) {
    const { headers, ...rest } = opts;
    return fetch(BASE + p, {
        method: 'POST',
        redirect: 'manual',
        ...rest,
        // Merge headers last so callers can add a cookie/origin without
        // dropping Content-Type (which would break body parsing).
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: JSON.stringify(body)
    });
}

before(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtp-test-'));
    child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
        env: {
            ...process.env,
            PORT: String(PORT),
            DATA_DIR: dataDir,
            SESSION_SECRET: 'test-secret-not-for-production',
            ADMIN_CODE: 'test-break-glass-code',
            ANTHROPIC_API_KEY: '',
            INITIAL_ADMIN_EMAILS: 'boss@example.com'
        },
        stdio: 'ignore'
    });
    // Wait for the server to answer.
    const deadline = Date.now() + 15000;
    for (;;) {
        try {
            const r = await fetch(BASE + '/api/health');
            if (r.ok) break;
        } catch (_) { /* not up yet */ }
        if (Date.now() > deadline) throw new Error('server did not start');
        await new Promise(r => setTimeout(r, 150));
    }
});

after(() => {
    if (child) child.kill('SIGKILL');
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('public routes', () => {
    test('/api/health is public', async () => {
        const r = await get('/api/health');
        assert.equal(r.status, 200);
        const body = await r.json();
        assert.equal(body.status, 'ok');
    });

    test('manifest.json is public (PWA installability)', async () => {
        const r = await get('/manifest.json');
        assert.equal(r.status, 200);
    });

    test('service worker is public and served from root scope', async () => {
        const r = await get('/sw.js');
        assert.equal(r.status, 200);
        assert.match(r.headers.get('content-type') || '', /javascript/);
    });

    test('landing/privacy/terms are public', async () => {
        for (const p of ['/landing', '/privacy', '/terms']) {
            const r = await get(p);
            assert.equal(r.status, 200, `${p} should be public`);
        }
    });

    test('css is public so the login page renders', async () => {
        const r = await get('/css/styles.css');
        assert.equal(r.status, 200);
    });
});

describe('auth gating', () => {
    test('protected page redirects anonymous users to /login', async () => {
        const r = await get('/');
        assert.equal(r.status, 302);
        assert.equal(r.headers.get('location'), '/login');
    });

    test('protected data file is NOT served anonymously', async () => {
        const r = await get('/js/diagnosticTrees.js');
        assert.equal(r.status, 302, 'diagnostic data must require auth');
    });

    test('API returns 401 JSON (not a redirect) when signed out', async () => {
        const r = await get('/api/me/feedback');
        assert.equal(r.status, 401);
        const body = await r.json();
        assert.equal(body.success, false);
    });

    test('admin API returns 403 for anonymous callers', async () => {
        const r = await get('/api/admin/users');
        assert.ok(r.status === 401 || r.status === 403, `got ${r.status}`);
    });

    test('unknown API path 401s anonymously (does not leak existence)', async () => {
        const r = await get('/api/does-not-exist');
        assert.equal(r.status, 401);
    });

    test('unknown API path returns JSON 404 for an authenticated caller', async () => {
        const login = await postJson('/api/auth/admin-code', { code: 'test-break-glass-code' });
        const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
        const r = await get('/api/does-not-exist', { headers: { cookie } });
        assert.equal(r.status, 404);
        assert.match(r.headers.get('content-type') || '', /json/);
    });
});

describe('signup and roles', () => {
    test('local signup with a bootstrap-admin email lands in pending, NOT admin', async () => {
        // Local email ownership is unverified — matching INITIAL_ADMIN_EMAILS
        // must never grant admin, or anyone who knows the address is an admin.
        const r = await postJson('/api/auth/signup', {
            email: 'boss@example.com',
            password: 'a-long-enough-password'
        });
        assert.equal(r.status, 200);
        const body = await r.json();
        assert.equal(body.success, true);
        assert.equal(body.role, 'pending');
    });

    test('duplicate signup is rejected across providers', async () => {
        const r = await postJson('/api/auth/signup', {
            email: 'boss@example.com',
            password: 'another-long-password'
        });
        assert.equal(r.status, 409);
    });

    test('pending user cannot reach the app or admin APIs', async () => {
        const login = await postJson('/api/auth/login', {
            email: 'boss@example.com',
            password: 'a-long-enough-password'
        });
        assert.equal(login.status, 200);
        const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
        assert.ok(cookie, 'expected a session cookie');

        const home = await get('/', { headers: { cookie } });
        assert.equal(home.status, 302);
        assert.equal(home.headers.get('location'), '/pending');

        const admin = await get('/api/admin/users', { headers: { cookie } });
        assert.equal(admin.status, 403);
    });

    test('wrong password is rejected', async () => {
        const r = await postJson('/api/auth/login', {
            email: 'boss@example.com',
            password: 'definitely-wrong-password'
        });
        assert.equal(r.status, 401);
    });
});

describe('break-glass admin', () => {
    test('wrong code is rejected', async () => {
        const r = await postJson('/api/auth/admin-code', { code: 'not-the-code' });
        assert.equal(r.status, 401);
    });

    test('correct code grants an admin session', async () => {
        const r = await postJson('/api/auth/admin-code', { code: 'test-break-glass-code' });
        assert.equal(r.status, 200);
        const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
        const users = await get('/api/admin/users', { headers: { cookie } });
        assert.equal(users.status, 200);
        const body = await users.json();
        assert.equal(body.success, true);
    });
});

describe('CSRF and method hardening', () => {
    test('GET /logout does not destroy the session (it confirms)', async () => {
        const login = await postJson('/api/auth/admin-code', { code: 'test-break-glass-code' });
        const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

        const r = await get('/logout', { headers: { cookie } });
        assert.equal(r.status, 200, 'GET /logout should render a confirmation page');

        // Session must still be alive.
        const still = await get('/api/admin/users', { headers: { cookie } });
        assert.equal(still.status, 200, 'GET /logout must not log the user out');
    });

    test('cross-origin POST is rejected', async () => {
        const r = await postJson('/api/auth/login',
            { email: 'boss@example.com', password: 'a-long-enough-password' },
            { headers: { origin: 'https://evil.example.com' } }
        );
        assert.equal(r.status, 403);
    });

    test('beacon rejects non-allowlisted kinds, including forged server errors', async () => {
        const login = await postJson('/api/auth/admin-code', { code: 'test-break-glass-code' });
        const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

        const forged = await postJson('/api/event', { kind: 'error', data: { fake: true } }, { headers: { cookie } });
        assert.equal(forged.status, 400, "client must not be able to log kind 'error'");

        const ok = await postJson('/api/event', { kind: 'tree_start', data: { tree: 'engine_no_start' } }, { headers: { cookie } });
        assert.equal(ok.status, 200);
    });
});

describe('regressions caught in review', () => {
    // pending.html's Sign out is the only exit from that dead-end screen, and
    // /js/common.js is behind requireAuth (pending users get a 302), so the
    // page must not depend on it.
    test('pending.html logout does not depend on the auth-gated common.js', () => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'pending.html'), 'utf8');
        assert.ok(!/src="\/js\/common\.js/.test(html),
            'pending.html must not load /js/common.js — it 302s for pending users');
        assert.match(html, /fetch\('\/api\/logout'/,
            'pending.html needs its own inline logout implementation');
    });

    test('form-style logout redirects (does not dump JSON into the browser)', async () => {
        const login = await postJson('/api/auth/admin-code', { code: 'test-break-glass-code' });
        const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
        const r = await fetch(BASE + '/api/logout', {
            method: 'POST',
            headers: {
                cookie,
                accept: 'text/html,application/xhtml+xml',
                'content-type': 'application/x-www-form-urlencoded'
            },
            body: '',
            redirect: 'manual'
        });
        assert.equal(r.status, 303, 'form post should 303 to /login, not return JSON');
        assert.equal(r.headers.get('location'), '/login');
    });

    // A long max-age on the unversioned data files would keep a corrected
    // fault code out of a tech's hands for up to a day.
    test('data files are served revalidating, not long-cached', async () => {
        const login = await postJson('/api/auth/admin-code', { code: 'test-break-glass-code' });
        const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
        const r = await get('/js/faultcodes.js', { headers: { cookie } });
        assert.equal(r.status, 200);
        const cc = r.headers.get('cache-control') || '';
        assert.match(cc, /no-cache/, `expected revalidation, got "${cc}"`);
        assert.ok(!/max-age=\d{3,}/.test(cc), `unexpected long max-age: "${cc}"`);
        assert.match(cc, /private/, 'auth-gated assets should be private');
    });

    test('service worker never caches a redirected (auth) response', () => {
        const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
        assert.match(sw, /res\.redirected/,
            'sw.js must reject redirected responses or it caches /login under asset URLs');
    });

    test('4xx errors do not log as kind "error" (admin panel noise)', async () => {
        const login = await postJson('/api/auth/admin-code', { code: 'test-break-glass-code' });
        const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

        const before = await get('/api/admin/overview', { headers: { cookie } });
        const errsBefore = (await before.json()).errors.length;

        // Malformed JSON -> body-parser 400 -> error middleware.
        await fetch(BASE + '/api/feedback', {
            method: 'POST',
            headers: { cookie, 'content-type': 'application/json' },
            body: '{ this is not json',
            redirect: 'manual'
        });

        const after = await get('/api/admin/overview', { headers: { cookie } });
        const errsAfter = (await after.json()).errors.length;
        assert.equal(errsAfter, errsBefore, 'a client 400 must not appear in the admin error panel');
    });

    test('break-glass session survives a normal request after being stripped', async () => {
        // Regression guard: revoking must not destroy req.session mid-request.
        const login = await postJson('/api/auth/admin-code', { code: 'test-break-glass-code' });
        const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
        for (let i = 0; i < 3; i++) {
            const r = await get('/api/me', { headers: { cookie } });
            assert.equal(r.status, 200, 'repeated requests must not 500');
        }
    });
});

describe('AI endpoint', () => {
    test('returns 503 when no API key is configured (not a 500)', async () => {
        const login = await postJson('/api/auth/admin-code', { code: 'test-break-glass-code' });
        const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
        const r = await postJson('/api/ask', { question: 'why is my engine hot' }, { headers: { cookie } });
        assert.equal(r.status, 503);
    });
});
