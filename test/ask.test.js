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
// the real handler is pointed at a local mock (test/helpers.js) that records
// what it receives.
//
// The main server runs with ASK_RATE_PER_MIN raised well above the default
// 15/min: this file fires more than that in a second, and a limiter 429 in
// the middle of a contract test reads as "expected 200, got 429" with nothing
// pointing at the limiter. The limiter itself is tested in its own server at
// the bottom, where the per-user keying is what matters.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');

let app;
let mock;
let cookie = '';

function ask(body, opts = {}) {
    return H.postJson(app.base, '/api/ask', body, { cookie, ...opts });
}

async function overview() {
    const r = await H.get(app.base, '/api/admin/overview', { cookie });
    assert.equal(r.status, 200);
    return r.json();
}

before(async () => {
    mock = await H.startMockAnthropic();
    app = await H.startServer({
        env: {
            ANTHROPIC_API_KEY: 'sk-ant-test-not-a-real-key',
            ANTHROPIC_BASE_URL: mock.base,
            ASK_RATE_PER_MIN: '1000'
        }
    });
    // Break-glass gives an authenticated (admin) session without paying bcrypt.
    cookie = await H.breakGlass(app.base);
});

after(async () => {
    if (app) {
        const { code } = await app.stop();
        app.rm();
        assert.equal(code, 0, `server should exit 0 on SIGTERM:\n${app.output()}`);
    }
    if (mock) await mock.close();
});

describe('the request sent to the Anthropic API', () => {
    test('carries the model, token cap and grounded system blocks', async () => {
        mock.setMode('ok');
        const res = await ask({ question: 'Why is it overheating?', context: { tree: 'engine_overheat', node: 'oh_start' } });
        assert.equal(res.status, 200);
        assert.equal((await res.json()).answer, 'Check the impeller.',
            'thinking blocks must be filtered out of the answer');

        const captured = mock.captured();
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
        mock.setMode('ok');
        await ask({ question: 'test' });
        const { body } = mock.captured();
        assert.deepEqual(body.thinking, { type: 'adaptive' });
        assert.deepEqual(body.output_config, { effort: 'low' },
            'effort defaults to `high` on Sonnet 5 — it must be pinned explicitly');
        assert.ok(body.max_tokens >= 4096,
            `max_tokens ${body.max_tokens} leaves no room for thinking + answer`);
    });

    test('keeps the 1h prompt-cache breakpoint on the knowledge base', async () => {
        mock.setMode('ok');
        await ask({ question: 'test' });
        const kb = mock.captured().body.system[1];
        assert.deepEqual(
            kb.cache_control,
            { type: 'ephemeral', ttl: '1h' },
            'losing this silently re-pays a ~100K-token cache write on every question'
        );
        assert.ok(kb.text.length > 100000, `knowledge base looks truncated (${kb.text.length} chars)`);
    });

    // The three public data files alone clear the size check above, so a
    // renamed or dropped corpus would pass it; only its own heading proves it
    // is in the prompt. And only the text inside the template literal is
    // prompt material — the JS wrapper was being billed as cached tokens.
    test('grounds the model in the Yamaha factory manual, without the JS wrapper', async () => {
        mock.setMode('ok');
        await ask({ question: 'test' });
        const kb = mock.captured().body.system[1];
        assert.match(kb.text, /YAMAHA FACTORY SERVICE MANUAL REFERENCE/,
            'kb/yamahaManuals.js is missing from the grounding prompt');
        assert.ok(!kb.text.includes('window.yamahaManualReference'),
            'the corpus file\'s JS wrapper must be stripped before it is sent');
    });

    test('clamps oversized client context instead of forwarding it', async () => {
        mock.setMode('ok');
        const huge = 'z'.repeat(5000);
        await ask({ question: 'test', context: { tree: huge, node: huge } });
        const runs = mock.captured().body.messages[0].content.match(/z+/g) || [];
        assert.ok(runs.length > 0, 'context was dropped entirely');
        for (const run of runs) {
            assert.ok(run.length <= 120, `context field reached ${run.length} chars — the 120-char clamp is gone`);
        }
    });
});

describe('what the admin dashboard can see afterwards', () => {
    // tokens_in sums input + cache read + cache write, so a request that READ
    // 90K cached tokens and one that WROTE them look identical there. The
    // split columns are how an operator notices the breakpoint stopped landing.
    test('prompt-cache reads are recorded apart from cache writes', async () => {
        mock.setMode('ok');
        assert.equal((await ask({ question: 'cache accounting' })).status, 200);

        const o = await overview();
        const row = o.recentAi[0];
        assert.equal(row.question, 'cache accounting');
        assert.equal(row.cache_read, 90000, 'cache_read must mirror usage.cache_read_input_tokens');
        assert.equal(row.cache_write, 0, 'a real 0 write must be stored as 0, not dropped');
        assert.equal(row.tokens_in, 12 + 90000, 'tokens_in keeps the historical sum');
        assert.equal(row.tokens_out, 8);

        assert.ok(o.summary.last24h.aiCacheReadTokens >= 90000,
            `aiCacheReadTokens ${o.summary.last24h.aiCacheReadTokens} should include this request`);
        assert.equal(typeof o.summary.last24h.aiCacheWriteTokens, 'number');
    });
});

describe('degenerate responses never reach the tech as a blank panel', () => {
    test('a refusal (no content blocks) is reported, not returned as success', async () => {
        mock.setMode('refusal');
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 502, 'an empty answer must not be a 200 success');
        const body = await res.json();
        assert.equal(body.success, false);
        assert.match(body.message, /rephrase|try again/i);
    });

    test('a turn that spent its whole budget thinking is reported as a length problem', async () => {
        mock.setMode('thinking-only');
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 502);
        assert.match((await res.json()).message, /length limit|narrower/i);

        // The most expensive failure (a full prompt, nothing usable back)
        // must show its real token cost in the admin table, not "0 / 0".
        const o = await overview();
        const row = o.recentAi[0];
        assert.equal(row.ok, 0);
        assert.equal(row.tokens_out, 8, 'output tokens from usage must be recorded on the empty-answer path');
        assert.equal(row.tokens_in, 90012, 'input + cache tokens must be recorded on the empty-answer path');
        assert.equal(row.cache_read, 90000);
    });

    test('a truncated but non-empty answer is still delivered, flagged, and visible to admins', async () => {
        mock.setMode('truncated');
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 200, 'a partial answer is better than none — deliver it');
        const body = await res.json();
        assert.equal(body.answer, 'Check the impel');
        assert.equal(body.truncated, true, 'truncation must be visible to the caller');

        // The handler logs it "so it shows up in the admin panel" — the error
        // panel, not the generic event feed where it scrolls off in minutes.
        const o = await overview();
        assert.ok(o.errors.some((e) => e.kind === 'ai_truncated'),
            'ai_truncated must appear in the admin error panel');
    });
});

describe('upstream failures are mapped for the client', () => {
    test('rate limiting surfaces as 429, not a generic 500', async () => {
        mock.setMode('429');
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 429);
        assert.match((await res.json()).message, /busy|wait/i);
    });

    test('a bad API key surfaces as 503 so it reads as misconfiguration', async () => {
        mock.setMode('401');
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 503);
    });

    test('a server error is retried once, then reported as 500', async () => {
        mock.setMode('500');
        mock.resetHits();
        const res = await ask({ question: 'test' });
        assert.equal(res.status, 500);
        assert.equal(mock.hits(), 2, 'expected maxRetries: 1 (one attempt + one retry)');
    });
});

describe('request guards', () => {
    test('rejects an empty question', async () => {
        mock.setMode('ok');
        assert.equal((await ask({ question: '' })).status, 400);
    });

    test('rejects a question over the length cap', async () => {
        mock.setMode('ok');
        assert.equal((await ask({ question: 'x'.repeat(2500) })).status, 400);
    });

    test('requires authentication', async () => {
        mock.setMode('ok');
        const saved = cookie;
        cookie = '';
        try {
            assert.equal((await ask({ question: 'hi' })).status, 401);
        } finally {
            cookie = saved;
        }
    });
});

describe('the Ask limiter is per user, not per IP', () => {
    // Techs on one marina/shop NAT share an IP. With an IP-keyed bucket the
    // fifth tech of the morning got "slow down" for questions other people
    // asked. Break-glass has no user id and falls back to the IP bucket.
    let s;
    before(async () => {
        s = await H.startServer({
            env: {
                ANTHROPIC_API_KEY: 'sk-ant-test-not-a-real-key',
                ANTHROPIC_BASE_URL: mock.base,
                ASK_RATE_PER_MIN: '2'
            }
        });
        mock.setMode('ok');
    });
    after(async () => {
        if (!s) return;
        const { code } = await s.stop();
        s.rm();
        assert.equal(code, 0, `server should exit 0 on SIGTERM:\n${s.output()}`);
    });

    test('two sessions from the same IP get independent budgets', async () => {
        const bg = await H.breakGlass(s.base);
        const askAs = (c) => H.postJson(s.base, '/api/ask', { question: 'test' }, { cookie: c });

        assert.equal((await askAs(bg)).status, 200);
        assert.equal((await askAs(bg)).status, 200);
        const third = await askAs(bg);
        assert.equal(third.status, 429, 'the third question in a minute must hit the limiter');
        assert.match((await third.json()).message, /slow down/i);

        // Same IP, different (real) user: a fresh bucket.
        const tech = await H.createApprovedUser(s.base, bg, 'tech@example.com', 'tech-password-123');
        assert.equal((await askAs(tech.cookie)).status, 200, 'a tech behind the same NAT must not inherit the break-glass budget');
        assert.equal((await askAs(tech.cookie)).status, 200);
        assert.equal((await askAs(tech.cookie)).status, 429, 'the tech has their own budget, not an unlimited one');
    });
});
