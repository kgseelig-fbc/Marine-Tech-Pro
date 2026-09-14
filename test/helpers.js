// Shared harness for the integration suites.
//
// Every suite that talks to a real server spawns its own copy of server.js on
// a free port with a throw-away DATA_DIR, so the files can run in parallel
// (node --test runs them in separate processes) and a stale server from an
// earlier run can never be mistaken for the code under test: readiness
// requires /api/health to echo a per-spawn build marker, not just answer 200.
// stdout/stderr are captured, not discarded — when the child fails to start
// the error carries whatever it printed, and suites can assert on startup
// log lines (persisted-secret notices, the short-ADMIN_CODE warning).

const assert = require('node:assert');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const SERVER_JS = path.join(__dirname, '..', 'server.js');
const DEFAULT_ADMIN_CODE = 'test-break-glass-code';
const DEFAULT_SESSION_SECRET = 'test-secret-not-for-production';

// Environment the server reads. Each is cleared from the inherited env so a
// developer's shell (a real ANTHROPIC_API_KEY, a BASE_URL, INITIAL_ADMIN_EMAILS)
// cannot leak into the process under test; suites set what they need.
const SERVER_ENV_KEYS = [
    'PORT', 'DATA_DIR', 'SESSION_SECRET', 'IP_HASH_SALT', 'ADMIN_CODE', 'NODE_ENV',
    'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'FBC_HUB_URL', 'BASE_URL',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'INITIAL_ADMIN_EMAILS',
    'RETENTION_DAYS', 'DRAIN_TIMEOUT_MS', 'ASK_RATE_PER_MIN', 'SIGNUP_RATE_PER_HOUR',
    'GIT_SHA', 'RAILWAY_GIT_COMMIT_SHA'
];

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
    });
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// Spawns server.js and resolves once it answers /api/health with this spawn's
// build marker. `env` overrides the defaults below; pass DATA_DIR to reuse a
// directory across restarts (secret persistence, break-glass revocation).
// Set a key to '' to run the server with that variable effectively unset.
async function startServer(opts = {}) {
    // The free-port pick is a probe-then-listen race between suites running
    // in parallel; a collision shows up as the child dying on EADDRINUSE.
    for (let attempt = 1; ; attempt++) {
        try {
            return await spawnServer(opts);
        } catch (e) {
            if (attempt >= 3 || !/EADDRINUSE/.test(e.message)) throw e;
        }
    }
}

async function spawnServer({ env = {}, adminCode = DEFAULT_ADMIN_CODE } = {}) {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const dataDir = env.DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'mtp-test-'));
    const marker = crypto.randomBytes(8).toString('hex');

    const childEnv = { ...process.env };
    for (const k of SERVER_ENV_KEYS) delete childEnv[k];
    Object.assign(childEnv, {
        PORT: String(port),
        DATA_DIR: dataDir,
        SESSION_SECRET: DEFAULT_SESSION_SECRET,
        ADMIN_CODE: adminCode,
        ANTHROPIC_API_KEY: '',
        GIT_SHA: marker
    }, env);

    const child = spawn(process.execPath, [SERVER_JS], { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    let exited = null;
    const exitPromise = new Promise((resolve) => {
        child.once('exit', (code, signal) => { exited = { code, signal }; resolve(exited); });
    });

    const deadline = Date.now() + 15000;
    for (;;) {
        if (exited) {
            throw new Error(`server exited before it was ready (code ${exited.code}, signal ${exited.signal}):\n${out}`);
        }
        try {
            const r = await fetch(base + '/api/health');
            if (r.ok) {
                const body = await r.json();
                if (body.build === marker.slice(0, 7)) break;
                throw new Error(`something else answered /api/health on port ${port} (build ${body.build})`);
            }
        } catch (e) {
            if (/something else answered/.test(e.message)) throw e;
        }
        if (Date.now() > deadline) throw new Error(`server did not start within 15s:\n${out}`);
        await sleep(100);
    }

    return {
        base,
        port,
        dataDir,
        child,
        output: () => out,
        exited: () => exited,
        // Resolves once `re` appears in the captured output (log lines arrive
        // on the pipe a beat after the health check that proves the server is
        // up, so a synchronous read right after startServer() can race).
        waitForOutput: async (re, ms = 3000) => {
            const until = Date.now() + ms;
            while (!re.test(out)) {
                if (Date.now() > until) throw new Error(`"${re}" never appeared in server output:\n${out}`);
                await sleep(50);
            }
            return out;
        },
        // SIGTERM, then the exit status — the graceful path server.js runs on
        // every Railway redeploy. SIGKILL only if it has not exited in 10 s.
        stop: () => {
            if (exited) return Promise.resolve(exited);
            const killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 10000);
            child.kill('SIGTERM');
            return exitPromise.then((r) => { clearTimeout(killer); return r; });
        },
        rm: () => fs.rmSync(dataDir, { recursive: true, force: true })
    };
}

// --- fetch helpers ---------------------------------------------------------

// Lower-cases header names so a caller's `Cookie` can never coexist with a
// default `cookie` (undici rejects duplicate keys that differ only by case).
function mergeHeaders(...sources) {
    const out = {};
    for (const src of sources) {
        for (const [k, v] of Object.entries(src || {})) {
            if (v == null) continue;
            out[k.toLowerCase()] = v;
        }
    }
    return out;
}

// GET with redirects left unfollowed (the suites assert on 302 targets).
// opts.cookie is shorthand for a cookie header; opts.headers merges on top.
function get(base, p, opts = {}) {
    const { headers, cookie, ...rest } = opts;
    return fetch(base + p, {
        method: 'GET',
        redirect: 'manual',
        ...rest,
        headers: mergeHeaders(cookie ? { cookie } : null, headers)
    });
}

function postJson(base, p, body, opts = {}) {
    const { headers, cookie, ...rest } = opts;
    return fetch(base + p, {
        method: 'POST',
        redirect: 'manual',
        ...rest,
        // Content-Type first so a caller adding cookie/origin can't drop it
        // (which would break body parsing).
        headers: mergeHeaders({ 'content-type': 'application/json' }, cookie ? { cookie } : null, headers),
        body: JSON.stringify(body)
    });
}

// The session cookie(s) a response set, in `name=value; name2=value2` form.
function cookieOf(res) {
    const raw = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [res.headers.get('set-cookie')].filter(Boolean);
    return raw.map((c) => c.split(';')[0]).join('; ');
}

// Break-glass gives an admin session without paying a bcrypt hash.
async function breakGlass(base, code = DEFAULT_ADMIN_CODE) {
    const res = await postJson(base, '/api/auth/admin-code', { code });
    assert.equal(res.status, 200, `break-glass login failed: ${res.status} ${await res.text()}`);
    const cookie = cookieOf(res);
    assert.ok(cookie, 'break-glass login set no session cookie');
    return cookie;
}

async function signup(base, email, password, extra = {}) {
    const res = await postJson(base, '/api/auth/signup', { email, password, ...extra });
    return { res, cookie: cookieOf(res) };
}

async function login(base, email, password) {
    const res = await postJson(base, '/api/auth/login', { email, password });
    return { res, cookie: cookieOf(res) };
}

// Admin-side lookups used to build fixtures (user id by email, role change).
async function userIdByEmail(base, adminCookie, email) {
    const res = await get(base, '/api/admin/users', { cookie: adminCookie });
    assert.equal(res.status, 200, `listing users failed: ${res.status}`);
    const { users } = await res.json();
    const row = users.find((u) => u.email === email.toLowerCase());
    assert.ok(row, `no user with email ${email}`);
    return row.id;
}

async function setRole(base, adminCookie, id, role) {
    return postJson(base, `/api/admin/users/${id}/role`, { role }, { cookie: adminCookie });
}

// Sign up a local user and approve them as `role`. The signup cookie stays
// valid across the role change (loadUser re-reads the row on every request),
// so this costs one bcrypt hash and no login.
async function createApprovedUser(base, adminCookie, email, password, role = 'tech') {
    const { res, cookie } = await signup(base, email, password);
    assert.equal(res.status, 200, `signup for ${email} failed: ${res.status} ${await res.text()}`);
    const id = await userIdByEmail(base, adminCookie, email);
    const r = await setRole(base, adminCookie, id, role);
    assert.equal(r.status, 200, `promoting ${email} to ${role} failed: ${r.status}`);
    return { id, cookie };
}

// --- Anthropic mock ---------------------------------------------------------

// A stand-in for api.anthropic.com. The SDK honours ANTHROPIC_BASE_URL, so the
// real /api/ask handler can be pointed here and the request it sends asserted
// on. `setMode` picks the reply: 'ok', 'truncated', 'thinking-only',
// 'refusal', or an HTTP status ('429', '401', '500') for an API error.
function startMockAnthropic() {
    let mode = 'ok';
    let captured = null;
    let hits = 0;

    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            hits++;
            captured = { url: req.url, headers: req.headers, body: JSON.parse(body || '{}') };
            const send = (code, payload) => {
                res.writeHead(code, { 'content-type': 'application/json' });
                res.end(JSON.stringify(payload));
            };
            const base = {
                id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5',
                usage: { input_tokens: 12, output_tokens: 8, cache_read_input_tokens: 90000, cache_creation_input_tokens: 0 }
            };
            if (mode === 'ok') {
                return send(200, {
                    ...base,
                    // Sonnet 5 returns thinking blocks alongside text; the
                    // handler must pick out only the text.
                    content: [
                        { type: 'thinking', thinking: '' },
                        { type: 'text', text: 'Check the impeller.' }
                    ],
                    stop_reason: 'end_turn'
                });
            }
            if (mode === 'truncated') {
                return send(200, {
                    ...base,
                    content: [{ type: 'text', text: 'Check the impel' }],
                    stop_reason: 'max_tokens'
                });
            }
            if (mode === 'thinking-only') {
                // The whole budget went to thinking — no answer text at all.
                return send(200, { ...base, content: [{ type: 'thinking', thinking: '' }], stop_reason: 'max_tokens' });
            }
            if (mode === 'refusal') {
                return send(200, { ...base, content: [], stop_reason: 'refusal' });
            }
            const errType = { 429: 'rate_limit_error', 401: 'authentication_error', 500: 'api_error' }[mode];
            send(Number(mode), { type: 'error', error: { type: errType, message: 'mock' } });
        });
    });

    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({
                port,
                base: `http://127.0.0.1:${port}`,
                setMode: (m) => { mode = m; },
                captured: () => captured,
                hits: () => hits,
                resetHits: () => { hits = 0; },
                close: () => new Promise((r) => {
                    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
                    server.close(() => r());
                })
            });
        });
    });
}

module.exports = {
    DEFAULT_ADMIN_CODE,
    DEFAULT_SESSION_SECRET,
    startServer,
    freePort,
    sleep,
    get,
    postJson,
    cookieOf,
    breakGlass,
    signup,
    login,
    userIdByEmail,
    setRole,
    createApprovedUser,
    startMockAnthropic
};
