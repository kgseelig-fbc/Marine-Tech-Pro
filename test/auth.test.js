// Auth gating tests — the middleware ordering in server.js is load-bearing
// (public routes -> css/icons static -> requireAuth -> admin routes ->
// protected static) and exactly the kind of thing that regresses silently.
//
// The main server is spawned once for the file (see test/helpers.js for the
// harness: free port, throw-away DATA_DIR, captured output). The signup-flood
// limit and the restart scenarios (persisted secrets, secret rotation,
// break-glass revocation) each get their own server further down.
//
// Cost model: bcrypt at cost 12 is ~250 ms per hash or compare, so sign-ups
// and password logins are kept to a minimum and fixtures are reused across
// describe blocks (which node:test runs in file order).
//
// Run with: npm test

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const H = require('./helpers');

const ADMIN_CODE = H.DEFAULT_ADMIN_CODE;
const BOSS = { email: 'boss@example.com', password: 'a-long-enough-password' };

let app;
const get = (p, opts) => H.get(app.base, p, opts);
const postJson = (p, body, opts) => H.postJson(app.base, p, body, opts);
const admin = () => H.breakGlass(app.base);

// Rows of kind 'error' in the admin error panel — the only kind a genuine
// server fault produces. Counting just that kind (rather than errors.length)
// keeps the assertion honest even when login_fail rows from neighbouring
// tests fill the panel.
async function serverErrorCount(adminCookie) {
    const r = await get('/api/admin/overview', { cookie: adminCookie });
    assert.equal(r.status, 200);
    return (await r.json()).errors.filter((e) => e.kind === 'error').length;
}

// Shared fixtures, created in file order below.
let tech;   // { id, cookie } — an approved local user
let other;  // { id, cookie } — a second approved local user

before(async () => {
    app = await H.startServer({
        env: {
            INITIAL_ADMIN_EMAILS: BOSS.email,
            // The signup limiter counts every attempt, successes included; this
            // file makes a dozen. The limit itself is tested in its own server.
            SIGNUP_RATE_PER_HOUR: '1000'
        }
    });
});

after(async () => {
    if (!app) return;
    const { code } = await app.stop();
    app.rm();
    assert.equal(code, 0, `server should exit 0 on SIGTERM:\n${app.output()}`);
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

    test('admin API returns exactly 401 for anonymous callers', async () => {
        // 401, not 403: requireAuth runs before requireAdmin, so "not signed
        // in" and "signed in but not admin" must stay distinguishable.
        const r = await get('/api/admin/users');
        assert.equal(r.status, 401);
    });

    test('unknown API path 401s anonymously (does not leak existence)', async () => {
        const r = await get('/api/does-not-exist');
        assert.equal(r.status, 401);
    });

    test('unknown API path returns JSON 404 for an authenticated caller', async () => {
        const cookie = await admin();
        const r = await get('/api/does-not-exist', { cookie });
        assert.equal(r.status, 404);
        assert.match(r.headers.get('content-type') || '', /json/);
    });
});

describe('signup and roles', () => {
    test('local signup with a bootstrap-admin email lands in pending, NOT admin', async () => {
        // Local email ownership is unverified — matching INITIAL_ADMIN_EMAILS
        // must never grant admin, or anyone who knows the address is an admin.
        const { res } = await H.signup(app.base, BOSS.email, BOSS.password);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.role, 'pending');
    });

    test('duplicate signup is rejected across providers', async () => {
        const { res } = await H.signup(app.base, BOSS.email, 'another-long-password');
        assert.equal(res.status, 409);
    });

    test('pending user cannot reach the app, its scripts, or admin APIs', async () => {
        const { res, cookie } = await H.login(app.base, BOSS.email, BOSS.password);
        assert.equal(res.status, 200);
        assert.ok(cookie, 'expected a session cookie');

        const home = await get('/', { cookie });
        assert.equal(home.status, 302);
        assert.equal(home.headers.get('location'), '/pending');

        // The premise pending.html's self-contained sign-out relies on: the
        // shared module is behind requireAuth and bounces pending users.
        const cjs = await get('/js/common.js', { cookie });
        assert.equal(cjs.status, 302);
        assert.equal(cjs.headers.get('location'), '/pending');

        const adminUsers = await get('/api/admin/users', { cookie });
        assert.equal(adminUsers.status, 403);
    });

    test('wrong password is rejected', async () => {
        const { res } = await H.login(app.base, BOSS.email, 'definitely-wrong-password');
        assert.equal(res.status, 401);
    });
});

describe('break-glass admin', () => {
    test('wrong code is rejected', async () => {
        const r = await postJson('/api/auth/admin-code', { code: 'not-the-code' });
        assert.equal(r.status, 401);
    });

    test('correct code grants an admin session', async () => {
        const r = await postJson('/api/auth/admin-code', { code: ADMIN_CODE });
        assert.equal(r.status, 200);
        const cookie = H.cookieOf(r);
        const users = await get('/api/admin/users', { cookie });
        assert.equal(users.status, 200);
        const body = await users.json();
        assert.equal(body.success, true);
    });

    test('user listing does not expose avatar_url', async () => {
        const cookie = await admin();
        const { users } = await (await get('/api/admin/users', { cookie })).json();
        assert.ok(users.length > 0, 'expected the boss signup to be listed');
        for (const u of users) {
            assert.ok(!('avatar_url' in u), 'avatar_url is not collected any more and must not be returned');
            assert.ok(!('password_hash' in u));
        }
    });
});

describe('CSRF and method hardening', () => {
    test('GET /logout does not destroy the session (it confirms)', async () => {
        const cookie = await admin();

        const r = await get('/logout', { cookie });
        assert.equal(r.status, 200, 'GET /logout should render a confirmation page');

        // Session must still be alive.
        const still = await get('/api/admin/users', { cookie });
        assert.equal(still.status, 200, 'GET /logout must not log the user out');
    });

    test('cross-origin POST is rejected', async () => {
        const r = await postJson('/api/auth/login', BOSS, { headers: { origin: 'https://evil.example.com' } });
        assert.equal(r.status, 403);
    });

    // Every browser fetch and form post carries an Origin, so the accept path
    // below is what production traffic actually exercises; a guard that
    // compared against the wrong host (req.hostname drops the port) would
    // 403 every state-changing request in the app while a no-header test
    // stayed green.
    test('same-origin Origin header is accepted (the browser path)', async () => {
        const r = await postJson('/api/auth/login', BOSS, { headers: { origin: app.base } });
        assert.equal(r.status, 200, `same-origin POST must not be rejected: ${await r.text()}`);
    });

    test('same-origin Referer alone is accepted; a foreign Referer alone is rejected', async () => {
        const ok = await postJson('/api/auth/login', BOSS, { headers: { referer: app.base + '/login' } });
        assert.equal(ok.status, 200);

        const bad = await postJson('/api/auth/login', BOSS, { headers: { referer: 'https://evil.example.com/x' } });
        assert.equal(bad.status, 403);
    });

    test('an opaque "null" Origin fails closed', async () => {
        const r = await postJson('/api/auth/login', BOSS, { headers: { origin: 'null' } });
        assert.equal(r.status, 403);
    });

    test('beacon rejects non-allowlisted kinds, including forged server errors', async () => {
        const cookie = await admin();

        const forged = await postJson('/api/event', { kind: 'error', data: { fake: true } }, { cookie });
        assert.equal(forged.status, 400, "client must not be able to log kind 'error'");

        const ok = await postJson('/api/event', { kind: 'tree_start', data: { tree: 'engine_no_start' } }, { cookie });
        assert.equal(ok.status, 200);
    });
});

describe('tech role', () => {
    // The role most likely to be misrouted: approved, signed in, not admin. A
    // route added below app.use(requireAuth) without requireAdmin would be
    // open to every tech and only this block would notice.
    before(async () => {
        const adminCookie = await admin();
        tech = await H.createApprovedUser(app.base, adminCookie, 'tech@example.com', 'tech-password-123');
    });

    test('an approved tech reaches the app and its data files', async () => {
        const me = await (await get('/api/me', { cookie: tech.cookie })).json();
        assert.equal(me.authenticated, true);
        assert.equal(me.user.role, 'tech');

        assert.equal((await get('/', { cookie: tech.cookie })).status, 200);
        assert.equal((await get('/js/diagnosticTrees.js', { cookie: tech.cookie })).status, 200);
    });

    test('admin pages send a tech back to the app, not to /login', async () => {
        for (const p of ['/admin', '/admin.html']) {
            const r = await get(p, { cookie: tech.cookie });
            assert.equal(r.status, 302, `${p} must not render for a tech`);
            assert.equal(r.headers.get('location'), '/', `${p} should bounce to the app`);
        }
    });

    test('admin APIs return exactly 403 for a tech', async () => {
        for (const p of ['/api/admin/users', '/api/admin/overview', '/api/admin/feedback']) {
            const r = await get(p, { cookie: tech.cookie });
            assert.equal(r.status, 403, `GET ${p} as a tech`);
        }
        const role = await postJson(`/api/admin/users/${tech.id}/role`, { role: 'admin' }, { cookie: tech.cookie });
        assert.equal(role.status, 403, 'a tech must not be able to change roles');
        const pin = await postJson('/api/admin/feedback/1/pin', { pin: true }, { cookie: tech.cookie });
        assert.equal(pin.status, 403);
    });

    test('/admin still renders for an admin, and /admin.html canonicalises to it', async () => {
        const cookie = await admin();
        const page = await get('/admin', { cookie });
        assert.equal(page.status, 200);
        assert.match(page.headers.get('content-type') || '', /html/);

        const raw = await get('/admin.html', { cookie });
        assert.equal(raw.status, 302);
        assert.equal(raw.headers.get('location'), '/admin');
    });
});

describe('sessions that point at a deleted user', () => {
    // Regression: loadUser used to session.destroy() here, which deletes
    // req.session synchronously; the login handler then dereferenced it and
    // the unhandled rejection took the whole process down. Only the FIRST
    // request with the stale cookie hits that path (the session is rewritten
    // without the user id afterwards), so each request kind gets its own
    // freshly deleted user.
    test('the first request with a stale cookie is answered, not a 5xx or a crash', async () => {
        const adminCookie = await admin();
        const stale = [];
        for (const n of [1, 2, 3]) {
            const email = `gone${n}@example.com`;
            const { res, cookie } = await H.signup(app.base, email, 'gone-password-123');
            assert.equal(res.status, 200);
            const id = await H.userIdByEmail(app.base, adminCookie, email);
            const del = await postJson(`/api/admin/users/${id}/delete`, {}, { cookie: adminCookie });
            assert.equal(del.status, 200);
            stale.push(cookie);
        }
        const errorsBefore = await serverErrorCount(adminCookie);

        // Login with another user's valid credentials — the crashing case.
        const login = await postJson('/api/auth/login', BOSS, { cookie: stale[0] });
        assert.ok(login.status < 500, `login with a stale cookie returned ${login.status}`);
        assert.equal(login.status, 200);

        const logout = await postJson('/api/logout', {}, { cookie: stale[1] });
        assert.ok(logout.status < 500, `logout with a stale cookie returned ${logout.status}`);

        const signup = await postJson('/api/auth/signup', { email: 'gone4@example.com', password: 'gone-password-123' }, { cookie: stale[2] });
        assert.equal(signup.status, 200, 'a stale session must not break signup (or leave an orphan row)');

        // Plain page loads with a stale cookie: 302 to /login, twice, not 500.
        const gone4Cookie = H.cookieOf(signup);
        const gone4Id = await H.userIdByEmail(app.base, adminCookie, 'gone4@example.com');
        assert.equal((await postJson(`/api/admin/users/${gone4Id}/delete`, {}, { cookie: adminCookie })).status, 200);
        for (let i = 0; i < 2; i++) {
            const r = await get('/', { cookie: gone4Cookie });
            assert.equal(r.status, 302);
            assert.equal(r.headers.get('location'), '/login');
        }

        // The process is still up and nothing landed in the error panel.
        assert.equal((await get('/api/health')).status, 200, 'server must survive a stale session');
        assert.equal(await serverErrorCount(adminCookie), errorsBefore, 'no server error should be logged');
    });
});

describe('feedback and admin management', () => {
    let adminCookie;
    let fid;      // tech's feedback id
    let otherFid; // other's feedback id

    before(async () => {
        adminCookie = await admin();
        other = await H.createApprovedUser(app.base, adminCookie, 'other@example.com', 'other-password-123');
    });

    test('a tech can submit feedback and sees only their own submissions', async () => {
        const r = await postJson('/api/feedback', {
            category: 'bug',
            message: 'Trim gauge reads backwards on the F150',
            context: { page_url: '/diagnose.html', tree: 'trim_steering', node: 'ts_start' }
        }, { cookie: tech.cookie });
        const text = await r.text();
        assert.equal(r.status, 200, text);
        const body = JSON.parse(text);
        assert.equal(body.success, true);
        assert.equal(typeof body.id, 'number');
        fid = body.id;

        const r2 = await postJson('/api/feedback', { category: 'enhancement', message: 'Add the F200 to specs' }, { cookie: other.cookie });
        assert.equal(r2.status, 200);
        otherFid = (await r2.json()).id;

        const mine = (await (await get('/api/me/feedback', { cookie: tech.cookie })).json()).feedback;
        assert.deepEqual(mine.map((f) => f.id), [fid], 'a tech must see exactly their own rows');
        assert.equal(mine[0].status, 'new');
        assert.equal(mine[0].ctx_tree, 'trim_steering');

        const theirs = (await (await get('/api/me/feedback', { cookie: other.cookie })).json()).feedback;
        assert.deepEqual(theirs.map((f) => f.id), [otherFid]);
    });

    test('feedback validation: bad category and short message are 400', async () => {
        assert.equal((await postJson('/api/feedback', { category: 'rant', message: 'long enough' }, { cookie: tech.cookie })).status, 400);
        assert.equal((await postJson('/api/feedback', { category: 'bug', message: 'x' }, { cookie: tech.cookie })).status, 400);
    });

    test('admins see every submission with the submitter attached', async () => {
        const r = await get('/api/admin/feedback', { cookie: adminCookie });
        assert.equal(r.status, 200);
        const { feedback } = await r.json();
        const row = feedback.find((f) => f.id === fid);
        assert.ok(row, 'tech feedback missing from the admin list');
        assert.equal(row.user_email, 'tech@example.com');
        assert.equal(row.user_id, tech.id);
        assert.equal(row.status, 'new');
        assert.ok(feedback.some((f) => f.id === otherFid));
    });

    test('status changes: resolving stamps resolved_at, reopening clears it', async () => {
        let r = await postJson(`/api/admin/feedback/${fid}/status`, { status: 'in_progress' }, { cookie: adminCookie });
        assert.equal(r.status, 200);
        let { feedback } = await r.json();
        assert.equal(feedback.id, fid);
        assert.equal(feedback.status, 'in_progress');
        assert.equal(feedback.resolved_at, null);

        r = await postJson(`/api/admin/feedback/${fid}/status`, { status: 'resolved' }, { cookie: adminCookie });
        assert.equal(r.status, 200);
        ({ feedback } = await r.json());
        assert.equal(feedback.status, 'resolved');
        assert.equal(typeof feedback.resolved_at, 'number');

        r = await postJson(`/api/admin/feedback/${fid}/status`, { status: 'in_progress' }, { cookie: adminCookie });
        ({ feedback } = await r.json());
        assert.equal(feedback.resolved_at, null, 'reopening must clear resolved_at');

        const bad = await postJson(`/api/admin/feedback/${fid}/status`, { status: 'done' }, { cookie: adminCookie });
        assert.equal(bad.status, 400);
    });

    test('an admin reply is saved and shown to the submitter', async () => {
        const r = await postJson(`/api/admin/feedback/${fid}/reply`, { reply: 'Fixed in the next data update.' }, { cookie: adminCookie });
        assert.equal(r.status, 200);
        const { feedback } = await r.json();
        assert.equal(feedback.admin_reply, 'Fixed in the next data update.');
        assert.equal(typeof feedback.admin_reply_at, 'number');

        const mine = (await (await get('/api/me/feedback', { cookie: tech.cookie })).json()).feedback;
        assert.equal(mine.find((f) => f.id === fid).admin_reply, 'Fixed in the next data update.');
    });

    test('/api/known-issues lists an item only while it is pinned', async () => {
        const ids = async () => (await (await get('/api/known-issues', { cookie: tech.cookie })).json()).issues.map((i) => i.id);
        assert.ok(!(await ids()).includes(fid), 'unpinned feedback must not be a known issue');

        const pin = await postJson(`/api/admin/feedback/${fid}/pin`, { pin: true }, { cookie: adminCookie });
        assert.equal(pin.status, 200);
        assert.equal((await pin.json()).feedback.is_known_issue, 1);
        assert.ok((await ids()).includes(fid));

        const mine = (await (await get('/api/me/feedback', { cookie: tech.cookie })).json()).feedback;
        assert.equal(mine.find((f) => f.id === fid).is_known_issue, 1);

        const unpin = await postJson(`/api/admin/feedback/${fid}/pin`, { pin: false }, { cookie: adminCookie });
        assert.equal((await unpin.json()).feedback.is_known_issue, 0);
        assert.ok(!(await ids()).includes(fid));
    });

    test('status/reply/pin on an unknown id are 404, not a hollow success', async () => {
        const cases = [
            ['status', { status: 'resolved' }],
            ['reply', { reply: 'hello' }],
            ['pin', { pin: true }]
        ];
        for (const [action, body] of cases) {
            const r = await postJson(`/api/admin/feedback/999999/${action}`, body, { cookie: adminCookie });
            assert.equal(r.status, 404, `${action} on a missing id`);
            const json = await r.json();
            assert.equal(json.success, false);
            assert.equal(json.message, 'Feedback not found');
        }
    });

    test('the last real admin cannot be demoted or deleted; a second admin unblocks it', async () => {
        // Break-glass has no user row, so it never counts. Promote the tech:
        // they are now the only admin in the table.
        let r = await H.setRole(app.base, adminCookie, tech.id, 'admin');
        assert.equal(r.status, 200);
        assert.equal((await r.json()).user.role, 'admin');

        r = await H.setRole(app.base, adminCookie, tech.id, 'tech');
        assert.equal(r.status, 409);
        assert.equal((await r.json()).message, 'Cannot demote the last admin.');

        r = await postJson(`/api/admin/users/${tech.id}/delete`, {}, { cookie: adminCookie });
        assert.equal(r.status, 409);
        assert.equal((await r.json()).message, 'Cannot delete the last admin.');
        assert.ok((await get('/api/me', { cookie: tech.cookie })).status === 200);

        const bossId = await H.userIdByEmail(app.base, adminCookie, BOSS.email);
        assert.equal((await H.setRole(app.base, adminCookie, bossId, 'admin')).status, 200);

        r = await H.setRole(app.base, adminCookie, tech.id, 'tech');
        assert.equal(r.status, 200, 'with two admins the demotion must go through');
        assert.equal((await r.json()).user.role, 'tech');
    });

    test('role change validation: bad role and unknown user', async () => {
        assert.equal((await H.setRole(app.base, adminCookie, tech.id, 'superuser')).status, 400);
        assert.equal((await H.setRole(app.base, adminCookie, 999999, 'tech')).status, 404);
    });

    test('deleting a user detaches their feedback instead of destroying it', async () => {
        const del = await postJson(`/api/admin/users/${other.id}/delete`, {}, { cookie: adminCookie });
        assert.equal(del.status, 200);

        const { feedback } = await (await get('/api/admin/feedback', { cookie: adminCookie })).json();
        const row = feedback.find((f) => f.id === otherFid);
        assert.ok(row, 'the bug report itself must survive the account deletion');
        assert.equal(row.user_email, null);
        assert.equal(row.user_name, null);
        assert.equal(row.user_id, null);
        assert.equal(row.message, 'Add the F200 to specs');

        const r = await get('/', { cookie: other.cookie });
        assert.equal(r.status, 302);
        assert.equal(r.headers.get('location'), '/login');
    });
});

describe('regressions caught in review', () => {
    // pending.html's Sign out is the only exit from that dead-end screen, and
    // /js/common.js is behind requireAuth (the 302 is asserted in 'pending
    // user cannot reach the app' above), so the page must not depend on it.
    test('pending.html logout does not depend on the auth-gated common.js', () => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'pending.html'), 'utf8');
        assert.ok(!/src="\/js\/common\.js/.test(html),
            'pending.html must not load /js/common.js — it 302s for pending users');
        assert.match(html, /fetch\('\/api\/logout'/,
            'pending.html needs its own inline logout implementation');
    });

    test('form-style logout redirects (does not dump JSON into the browser)', async () => {
        const cookie = await admin();
        const r = await fetch(app.base + '/api/logout', {
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
        const cookie = await admin();
        const r = await get('/js/faultcodes.js', { cookie });
        assert.equal(r.status, 200);
        const cc = r.headers.get('cache-control') || '';
        assert.match(cc, /no-cache/, `expected revalidation, got "${cc}"`);
        assert.ok(!/max-age=\d{3,}/.test(cc), `unexpected long max-age: "${cc}"`);
        assert.match(cc, /private/, 'auth-gated assets should be private');
    });

    test('4xx errors do not log as kind "error" (admin panel noise)', async () => {
        const cookie = await admin();
        const errsBefore = await serverErrorCount(cookie);

        // Malformed JSON -> body-parser 400 -> error middleware.
        const r = await fetch(app.base + '/api/feedback', {
            method: 'POST',
            headers: { cookie, 'content-type': 'application/json' },
            body: '{ this is not json',
            redirect: 'manual'
        });
        assert.equal(r.status, 400);
        assert.equal((await r.json()).message, 'Malformed request body.');

        assert.equal(await serverErrorCount(cookie), errsBefore, 'a client 400 must not appear in the admin error panel');
    });

    test('an oversized body is a 413 that says so, and is not a server error', async () => {
        const cookie = await admin();
        const errsBefore = await serverErrorCount(cookie);

        const r = await postJson('/api/feedback', { category: 'bug', message: 'x'.repeat(200 * 1024) }, { cookie });
        assert.equal(r.status, 413);
        const body = await r.json();
        assert.equal(body.success, false);
        assert.equal(body.message, 'Request too large.', 'a tech who pasted too much must not be told the server broke');

        assert.equal(await serverErrorCount(cookie), errsBefore, 'a 413 is the client\'s fault');
    });

    test('break-glass session survives a normal request after being stripped', async () => {
        // Regression guard: revoking must not destroy req.session mid-request.
        const cookie = await admin();
        for (let i = 0; i < 3; i++) {
            const r = await get('/api/me', { cookie });
            assert.equal(r.status, 200, 'repeated requests must not 500');
        }
    });
});

describe('AI endpoint', () => {
    test('returns 503 when no API key is configured (not a 500)', async () => {
        const cookie = await admin();
        const r = await postJson('/api/ask', { question: 'why is my engine hot' }, { cookie });
        assert.equal(r.status, 503);
    });
});

// --- Dedicated servers below: each scenario needs its own configuration. ---

describe('signup flood limit', () => {
    let s;
    before(async () => {
        s = await H.startServer({
            env: {
                SIGNUP_RATE_PER_HOUR: '3',
                // Also covers ALLOWED_ORIGIN_HOSTS: behind a proxy that rewrites
                // Host, BASE_URL is the origin browsers actually send.
                BASE_URL: 'https://app.example.test'
            }
        });
    });
    after(async () => {
        if (!s) return;
        const { code } = await s.stop();
        s.rm();
        assert.equal(code, 0, `server should exit 0 on SIGTERM:\n${s.output()}`);
    });

    test('failed sign-ups do not consume the budget (typos must not lock a marina out)', async () => {
        // Three failures first: a short password (400) and, after a real
        // signup below succeeds, a duplicate (409) — none of these may count.
        for (let i = 0; i < 2; i++) {
            const { res } = await H.signup(s.base, `typo${i}@example.com`, 'short');
            assert.equal(res.status, 400);
        }
        const first = await H.signup(s.base, 'flood1@example.com', 'flood-password-123');
        assert.equal(first.res.status, 200, 'a valid signup after failed attempts must still succeed');
        const dup = await H.signup(s.base, 'flood1@example.com', 'flood-password-123');
        assert.equal(dup.res.status, 409);
    });

    test('successful sign-ups count against the limit: the 4th from one IP is 429', async () => {
        // flood1 was created by the test above and counts as the first success.
        for (let i = 2; i <= 3; i++) {
            const { res } = await H.signup(s.base, `flood${i}@example.com`, 'flood-password-123');
            assert.equal(res.status, 200, `signup ${i} should succeed`);
        }
        const { res } = await H.signup(s.base, 'flood4@example.com', 'flood-password-123');
        assert.equal(res.status, 429, 'a successful signup must consume the budget (bcrypt + a pending row each)');
        const body = await res.json();
        assert.equal(body.success, false);
        assert.equal(body.message, 'Too many sign-ups from this network. Try again later.');
    });

    test('the BASE_URL origin is same-origin even when Host is the loopback address', async () => {
        const ok = await H.postJson(s.base, '/api/auth/admin-code', { code: ADMIN_CODE }, { headers: { origin: 'https://app.example.test' } });
        assert.equal(ok.status, 200);
        const bad = await H.postJson(s.base, '/api/auth/admin-code', { code: ADMIN_CODE }, { headers: { origin: 'https://other.example.test' } });
        assert.equal(bad.status, 403);
    });
});

describe('restarts: persisted secrets, secret rotation, break-glass revocation', () => {
    // One DATA_DIR reused across five short-lived servers, the way a Railway
    // volume outlives each deploy. Cookies minted by one process are replayed
    // against the next.
    let dataDir;
    let cookiePersisted; // break-glass session signed with the generated secret
    let cookieOld;       // break-glass session signed with SESSION_SECRET=old-secret

    before(() => { dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtp-restart-')); });
    after(() => { if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true }); });

    async function withServer(opts, fn) {
        const srv = await H.startServer({ ...opts, env: { DATA_DIR: dataDir, ...(opts.env || {}) } });
        try {
            return await fn(srv);
        } finally {
            const { code } = await srv.stop();
            assert.equal(code, 0, `server should exit 0 on SIGTERM:\n${srv.output()}`);
        }
    }

    test('SESSION_SECRET unset: a generated secret is persisted (0600) and a session survives a restart', async () => {
        await withServer({ env: { SESSION_SECRET: '' } }, async (a) => {
            await a.waitForOutput(/SESSION_SECRET not set — using the secret persisted at .*session-secret\./);
            await a.waitForOutput(/IP_HASH_SALT not set — using the salt persisted at .*ip-hash-salt\./);
            for (const name of ['session-secret', 'ip-hash-salt']) {
                const file = path.join(dataDir, name);
                assert.ok(fs.existsSync(file), `${name} should be persisted under DATA_DIR`);
                assert.equal(fs.statSync(file).mode & 0o777, 0o600, `${name} must be readable by the owner only`);
                assert.match(fs.readFileSync(file, 'utf8').trim(), /^[0-9a-f]{64}$/);
            }
            cookiePersisted = await H.breakGlass(a.base);
        });

        await withServer({ env: { SESSION_SECRET: '' } }, async (b) => {
            const me = await (await H.get(b.base, '/api/me', { cookie: cookiePersisted })).json();
            assert.equal(me.authenticated, true, 'a restart on the same volume must keep techs signed in');
            assert.equal(me.user.breakglass, true);
        });
    });

    test('SESSION_SECRET rotation: a comma-separated list keeps cookies signed by the old secret valid', async () => {
        await withServer({ env: { SESSION_SECRET: 'old-secret' } }, async (c) => {
            // Signed with a secret that is no longer in the list: anonymous.
            const me = await (await H.get(c.base, '/api/me', { cookie: cookiePersisted })).json();
            assert.equal(me.authenticated, false, 'a cookie signed by a secret not in the list must not verify');
            cookieOld = await H.breakGlass(c.base);
        });

        await withServer({ env: { SESSION_SECRET: 'new-secret,old-secret' } }, async (d) => {
            const me = await (await H.get(d.base, '/api/me', { cookie: cookieOld })).json();
            assert.equal(me.authenticated, true, 'prepending a new secret must not sign everyone out');
            assert.equal((await H.get(d.base, '/api/admin/users', { cookie: cookieOld })).status, 200);
        });
    });

    test('rotating ADMIN_CODE revokes existing break-glass sessions immediately (and a short code warns)', async () => {
        await withServer({ env: { SESSION_SECRET: 'new-secret,old-secret' }, adminCode: 'short' }, async (e) => {
            await e.waitForOutput(/WARNING: ADMIN_CODE is only 5 characters long/);

            // Same secret, same session row — only the code changed.
            const me = await (await H.get(e.base, '/api/me', { cookie: cookieOld })).json();
            assert.equal(me.authenticated, false, 'a break-glass session must die with the code that minted it');
            assert.equal((await H.get(e.base, '/api/admin/users', { cookie: cookieOld })).status, 401);

            // The stripped session keeps working as an anonymous one.
            const again = await H.get(e.base, '/api/me', { cookie: cookieOld });
            assert.equal(again.status, 200);
            assert.equal((await again.json()).authenticated, false);

            // Old code refused, new (short, but not disabled) code accepted.
            const old = await H.postJson(e.base, '/api/auth/admin-code', { code: ADMIN_CODE });
            assert.equal(old.status, 401);
            const fresh = await H.breakGlass(e.base, 'short');
            assert.equal((await H.get(e.base, '/api/admin/users', { cookie: fresh })).status, 200);
        });
    });
});
