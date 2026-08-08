// Ask-a-Tech contract tests.
//
// These pin the exact request the app sends to the Anthropic API, so an SDK
// upgrade (or a refactor of the handler) can't silently change it. The value
// that matters most here is `cache_control.ttl: '1h'` on the knowledge-base
// block: the KB is ~370 KB, so if that breakpoint ever stops serializing, every
// question silently re-pays a ~100K-token cache write instead of reading it —
// a large cost regression with no error and no visible symptom.
//
// No API key and no network required: the SDK honours ANTHROPIC_BASE_URL, so
// the real handler is pointed at a local mock that records what it receives.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const APP_PORT = 3973;
const MOCK_PORT = 3974;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const ADMIN_CODE = 'test-break-glass-code';

let child;
let mock;
let dataDir;
let cookie = '';

// Set by each test before it calls /api/ask.
let mockMode = 'ok';
let captured = null;
let upstreamHits = 0;

function startMock() {
    return new Promise((resolve) => {
        mock = http.createServer((req, res) => {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
                upstreamHits++;
                captured = { url: req.url, headers: req.headers, body: JSON.parse(body || '{}') };
                const send = (code, payload) => {
                    res.writeHead(code, { 'content-type': 'application/json' });
                    res.end(JSON.stringify(payload));
                };
                const base = {
                    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5',
                    usage: { input_tokens: 12, output_tokens: 8, cache_read_input_tokens: 90000, cache_creation_input_tokens: 0 }
                };
                if (mockMode === 'ok') {
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
                if (mockMode === 'truncated') {
                    return send(200, {
                        ...base,
                        content: [{ type: 'text', text: 'Check the impel' }],
                        stop_reason: 'max_tokens'
                    });
                }
                if (mockMode === 'thinking-only') {
                    // The whole budget went to thinking — no answer text at all.
                    return send(200, { ...base, content: [{ type: 'thinking', thinking: '' }], stop_reason: 'max_tokens' });
                }
                if (mockMode === 'refusal') {
                    return send(200, { ...base, content: [], stop_reason: 'refusal' });
                }
                const errType = { 429: 'rate_limit_error', 401: 'authentication_error', 500: 'api_error' }[mockMode];
                send(Number(mockMode), { type: 'error', error: { type: errType, message: 'mock' } });
            });
        });
        mock.listen(MOCK_PORT, resolve);
    });
}

function ask(body, opts = {}) {
    return fetch(BASE + '/api/ask', {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers || {}) },
        body: JSON.stringify(body)
    });
}

before(async () => {
    await startMock();
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtp-ask-'));
    child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
        env: {
            ...process.env,
            PORT: String(APP_PORT),
            DATA_DIR: dataDir,
            SESSION_SECRET: 'test-secret-not-for-production',
            ADMIN_CODE,
            ANTHROPIC_API_KEY: 'sk-ant-test-not-a-real-key',
            ANTHROPIC_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`
        },
        stdio: 'ignore'
    });

    const deadline = Date.now() + 15000;
    for (;;) {
        try {
            const r = await fetch(BASE + '/api/health');
            if (r.ok) break;
        } catch (_) { /* not up yet */ }
        if (Date.now() > deadline) throw new Error('server did not start');
        await new Promise((r) => setTimeout(r, 150));
    }

    // Break-glass gives an authenticated session without paying bcrypt.
    const login = await fetch(BASE + '/api/auth/admin-code', {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: ADMIN_CODE })
    });
    cookie = (login.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
    assert.ok(cookie, 'failed to obtain a session cookie');
});

after(() => {
    if (child) child.kill();
    if (mock) mock.close();
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('the request sent to the Anthropic API', () => {
    test('carries the model, token cap and grounded system blocks', async () => {
        mockMode = 'ok';
        const res = await ask({ question: 'Why is it overheating?', context: { tree: 'engine_overheat', node: 'oh_start' } });
        assert.equal(res.status, 200);
        assert.equal((await res.json()).answer, 'Check the impeller.',
            'thinking blocks must be filtered out of the answer');

        assert.equal(captured.url, '/v1/messages');
        assert.equal(captured.body.model, 'claude-sonnet-5');
        assert.equal(captured.body.system.length, 2, 'expected instructions + knowledge-base blocks');
        assert.ok(captured.headers['x-api-key'], 'no auth header sent');
    });

    // Sonnet 5 turns adaptive thinking on by default and bills it against
    // max_tokens. Both halves of this matter: without headroom the answer
    // truncates, and without an explicit effort the default is `high` — the
    // wrong latency trade for a tech waiting on a phone.
    test('pins effort to low and leaves max_tokens headroom for thinking', async () => {
        mockMode = 'ok';
        await ask({ question: 'test' });
        assert.deepEqual(captured.body.thinking, { type: 'adaptive' });
        assert.deepEqual(captured.body.output_config, { effort: 'low' },
            'effort defaults to `high` on Sonnet 5 — it must be pinned explicitly');
        assert.ok(captured.body.max_tokens >= 4096,
            `max_tokens ${captured.body.max_tokens} leaves no room for thinking + answer`);
    });

    test('keeps the 1h prompt-cache breakpoint on the knowledge base', async () => {
        mockMode = 'ok';
        await ask({ question: 'test' });
        const kb = captured.body.system[1];
        assert.deepEqual(
            kb.cache_control,
            { type: 'ephemeral', ttl: '1h' },
            'losing this silently re-pays a ~100K-token cache write on every question'
        );
        assert.ok(kb.text.length > 100000, `knowledge base looks truncated (${kb.text.length} chars)`);
    });

    test('clamps oversized client context instead of forwarding it', async () => {
        mockMode = 'ok';
        const huge = 'z'.repeat(5000);
        await ask({ question: 'test', context: { tree: huge, node: huge } });
        const runs = captured.body.messages[0].content.match(/z+/g) || [];
        assert.ok(runs.length > 0, 'context was dropped entirely');
        for (const run of runs) {
            assert.ok(run.length <= 120, `context field reached ${run.length} chars — the 120-char clamp is gone`);
        }
    });
});

describe('degenerate responses never reach the tech as a blank panel', () => {
    test('a refusal (no content blocks) is reported, not returned as success', async () => {
        mockMode = 'refusal';
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 502, 'an empty answer must not be a 200 success');
        const body = await res.json();
        assert.equal(body.success, false);
        assert.match(body.message, /rephrase|try again/i);
    });

    test('a turn that spent its whole budget thinking is reported as a length problem', async () => {
        mockMode = 'thinking-only';
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 502);
        assert.match((await res.json()).message, /length limit|narrower/i);
    });

    test('a truncated but non-empty answer is still delivered, and flagged', async () => {
        mockMode = 'truncated';
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 200, 'a partial answer is better than none — deliver it');
        const body = await res.json();
        assert.equal(body.answer, 'Check the impel');
        assert.equal(body.truncated, true, 'truncation must be visible to the caller');
    });
});

describe('upstream failures are mapped for the client', () => {
    test('rate limiting surfaces as 429, not a generic 500', async () => {
        mockMode = '429';
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 429);
        assert.match((await res.json()).message, /busy|wait/i);
    });

    test('a bad API key surfaces as 503 so it reads as misconfiguration', async () => {
        mockMode = '401';
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 503);
    });

    test('a server error is retried once, then reported as 500', async () => {
        mockMode = '500';
        upstreamHits = 0;
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 500);
        assert.equal(upstreamHits, 2, 'expected maxRetries: 1 (one attempt + one retry)');
    });
});

describe('request guards', () => {
    test('rejects an empty question', async () => {
        mockMode = 'ok';
        assert.equal((await ask({ question: '' })).status, 400);
    });

    test('rejects a question over the length cap', async () => {
        mockMode = 'ok';
        assert.equal((await ask({ question: 'x'.repeat(2500) })).status, 400);
    });

    test('requires authentication', async () => {
        mockMode = 'ok';
        const saved = cookie;
        cookie = '';
        try {
            assert.equal((await ask({ question: 'hi' })).status, 401);
        } finally {
            cookie = saved;
        }
    });
});
