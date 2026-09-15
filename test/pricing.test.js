// What the dashboard's dollar figures are made of.
//
// The numbers here are the app's only view of what Ask-a-Tech costs, and every
// one of them is arithmetic over columns that are easy to misread. Two
// mistakes would be invisible in the UI and wrong by a factor of ten:
//
//   1. `tokens_in` already CONTAINS the cache reads and writes. Billing that
//      column at the full input rate prices ~100K cached tokens as fresh input
//      on every single question — roughly 10x the real cost of a cache hit.
//   2. A cache WRITE is not cheap. At the 1h TTL this app uses it is 2x fresh
//      input against 0.1x for a read, so the same prompt costs 20x more when
//      the breakpoint stops landing — exactly the regression the dashboard
//      exists to make visible.
//
// The exact dollar amounts below are hand-computed from the rate table; if a
// rate changes, they must be recomputed deliberately, not adjusted to match
// whatever the code now returns.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const pricing = require('../lib/pricing');

const SONNET = 'claude-sonnet-5';

describe('rate table', () => {
    test('every model has a numeric input and output rate, output dearer than input', () => {
        const models = Object.keys(pricing.RATES);
        assert.ok(models.length > 0, 'an empty rate table would price everything as unknown');
        for (const m of models) {
            const r = pricing.RATES[m];
            assert.ok(Number.isFinite(r.input) && r.input > 0, `${m}: input rate must be a positive number`);
            assert.ok(Number.isFinite(r.output) && r.output > 0, `${m}: output rate must be a positive number`);
            assert.ok(r.output > r.input, `${m}: output tokens cost more than input on every Claude model`);
        }
    });

    test('the model /api/ask calls is priced', () => {
        // If server.js switches AI_MODEL without adding its rate here, every
        // question lands in unpricedAsks and the spend total silently stops
        // growing. Read the constant out of the server source rather than
        // duplicating it, so the two cannot drift.
        const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'server.js'), 'utf8');
        const m = src.match(/const AI_MODEL = '([^']+)'/);
        assert.ok(m, 'server.js must declare AI_MODEL');
        assert.ok(pricing.ratesFor(m[1]), `server.js calls ${m[1]}, which has no rate in lib/pricing.js`);
    });

    test('the cache TTL used for pricing is one the write multiples cover', () => {
        assert.ok(
            Object.prototype.hasOwnProperty.call(pricing.CACHE_WRITE_MULTIPLE, pricing.CACHE_TTL),
            `CACHE_TTL ${pricing.CACHE_TTL} has no write multiple — cache writes would be mispriced`
        );
        // A 1h entry costs more to write than a 5m one; a read is a fraction
        // of fresh input. Getting either relationship backwards inverts the
        // dashboard's whole story about caching.
        assert.ok(pricing.CACHE_WRITE_MULTIPLE['1h'] > pricing.CACHE_WRITE_MULTIPLE['5m']);
        assert.ok(pricing.CACHE_WRITE_MULTIPLE['5m'] > 1, 'a cache write costs MORE than fresh input');
        assert.ok(pricing.CACHE_READ_MULTIPLE < 1, 'a cache read costs LESS than fresh input');
    });
});

describe('costOf', () => {
    test('prices fresh input, cache reads, cache writes and output at their own rates', () => {
        // Sonnet 5: $2/M input, $10/M output; reads 0.1x input ($0.20/M),
        // 1h writes 2x input ($4.00/M).
        // 1M fresh + 1M read + 1M written + 1M out = 2 + 0.20 + 4 + 10.
        const cost = pricing.costOf({
            model: SONNET,
            inputTokens: 1e6,
            cacheReadTokens: 1e6,
            cacheWriteTokens: 1e6,
            outputTokens: 1e6
        });
        assert.equal(pricing.roundUsd(cost), 16.2);
    });

    test('a cached question is an order of magnitude cheaper than the same question uncached', () => {
        // The real shape of a question against the ~100K-token KB.
        const cached = pricing.costOf({ model: SONNET, inputTokens: 12, cacheReadTokens: 100000, outputTokens: 400 });
        const cold   = pricing.costOf({ model: SONNET, inputTokens: 12, cacheWriteTokens: 100000, outputTokens: 400 });
        assert.equal(pricing.roundUsd(cached), 0.024024);   // 100K x $0.20/M + 400 x $10/M + 12 x $2/M
        assert.equal(pricing.roundUsd(cold),   0.404024);   // 100K x $4.00/M + the same tail
        assert.ok(cold > cached * 10, 'losing the cache breakpoint must show up as a large cost jump');
    });

    test('the 5m TTL is charged less for a write than the 1h TTL', () => {
        const at5m = pricing.costOf({ model: SONNET, cacheWriteTokens: 1e6, ttl: '5m' });
        const at1h = pricing.costOf({ model: SONNET, cacheWriteTokens: 1e6, ttl: '1h' });
        assert.equal(at5m, 2.5);
        assert.equal(at1h, 4);
    });

    test('an unrecognised TTL falls back to the configured one rather than pricing writes as free', () => {
        const odd = pricing.costOf({ model: SONNET, cacheWriteTokens: 1e6, ttl: '17m' });
        assert.equal(odd, pricing.costOf({ model: SONNET, cacheWriteTokens: 1e6, ttl: pricing.CACHE_TTL }));
    });

    test('an unpriced model returns null, never 0 — a silent 0 would hide real spend', () => {
        assert.equal(pricing.costOf({ model: 'some-future-model', inputTokens: 1e6, outputTokens: 1e6 }), null);
        assert.equal(pricing.costOf({ model: null, inputTokens: 1e6 }), null);
        assert.equal(pricing.costOf(), null);
        // Inherited Object properties must not read as a rate.
        assert.equal(pricing.ratesFor('constructor'), null);
        assert.equal(pricing.ratesFor('toString'), null);
    });

    test('missing token fields count as zero, not NaN', () => {
        assert.equal(pricing.costOf({ model: SONNET }), 0);
        assert.equal(pricing.costOf({ model: SONNET, inputTokens: null, outputTokens: undefined }), 0);
    });
});

describe('costOfRow — the stored row shape', () => {
    test('tokens_in is split, so cached tokens are not billed as fresh input', () => {
        // The exact row /api/ask writes for a cache hit: tokens_in is the SUM
        // of 12 fresh + 90000 read.
        const row = { tokens_in: 90012, tokens_out: 8, cache_read: 90000, cache_write: 0, model: SONNET };
        const naive = 90012 * 2 / 1e6 + 8 * 10 / 1e6;   // the bug: whole column at input rate

        assert.equal(pricing.roundUsd(pricing.costOfRow(row)), 0.018104);
        assert.ok(pricing.costOfRow(row) < naive / 5,
            'a cache hit must not be priced as if every prompt token were fresh input');
        assert.deepEqual(pricing.splitInputTokens(row), {
            inputTokens: 12, cacheReadTokens: 90000, cacheWriteTokens: 0, outputTokens: 8
        });
    });

    test('each row is priced at ITS model rate, not a default', () => {
        // The whole reason ai_messages carries a `model` column. Opus input is
        // 2.5x Sonnet's, so a row that ignores the column is off by that much.
        const usage = { tokens_in: 90012, tokens_out: 8, cache_read: 90000, cache_write: 0 };
        const sonnet = pricing.costOfRow({ ...usage, model: 'claude-sonnet-5' });
        const opus   = pricing.costOfRow({ ...usage, model: 'claude-opus-5' });
        assert.equal(pricing.roundUsd(sonnet), 0.018104);
        assert.equal(pricing.roundUsd(opus), 0.04526);
        assert.ok(opus > sonnet * 2, 'a dearer model must cost more for identical tokens');
    });

    test('rows from before the model column are priced as the model that wrote them', () => {
        const legacy = { tokens_in: 90012, tokens_out: 8, cache_read: 90000, cache_write: 0, model: null };
        // Computed from the rate table directly, so this cannot pass by both
        // sides routing through the same `row.model || LEGACY_MODEL` expression.
        const rates = pricing.RATES[pricing.LEGACY_MODEL];
        const expected = (12 * rates.input + 90000 * rates.input * pricing.CACHE_READ_MULTIPLE + 8 * rates.output) / 1e6;
        assert.equal(pricing.roundUsd(pricing.costOfRow(legacy)), pricing.roundUsd(expected));
        assert.notEqual(pricing.LEGACY_MODEL, 'claude-opus-5');
        assert.notEqual(pricing.roundUsd(pricing.costOfRow(legacy)),
            pricing.roundUsd(pricing.costOfRow({ ...legacy, model: 'claude-opus-5' })));
    });

    test('a row that recorded prompt tokens but no cache split cannot be priced', () => {
        // cache_read/cache_write were added on 2026-09-14. Older rows have a
        // real tokens_in (~96K, nearly all of it the cached knowledge base) and
        // NULL cache columns. Reading that NULL as "nothing was cached" bills
        // the whole prompt at the fresh-input rate — about ten times over.
        const legacy = { tokens_in: 96040, tokens_out: 500, cache_read: null, cache_write: null, model: 'claude-sonnet-5' };
        assert.equal(pricing.hasCacheSplit(legacy), false);
        assert.equal(pricing.costOfRow(legacy), null, 'unknown must not be rendered as a number');

        const naive = pricing.costOf({ model: 'claude-sonnet-5', inputTokens: 96040, outputTokens: 500 });
        const honest = pricing.costOfRow({ ...legacy, cache_read: 96000, cache_write: 0 });
        assert.ok(naive > honest * 8, 'this is the size of the mistake being avoided');
    });

    test('a row that reported no usage at all is priced at zero, not unknown', () => {
        // A failed call really did cost nothing — that is knowledge, not a gap.
        const failed = { tokens_in: null, tokens_out: null, cache_read: null, cache_write: null, model: 'claude-sonnet-5' };
        assert.equal(pricing.hasCacheSplit(failed), true);
        assert.equal(pricing.costOfRow(failed), 0);
    });

    test('no row can cost less than nothing', () => {
        // Defensive: cache columns larger than tokens_in must not go negative
        // and quietly subtract from the day's spend.
        const impossible = { tokens_in: 100, cache_read: 90000, cache_write: 0, tokens_out: 0, model: SONNET };
        assert.ok(pricing.costOfRow(impossible) > 0);
        assert.equal(pricing.splitInputTokens(impossible).inputTokens, 0);
    });

    test('costOfRow(null) is null, not a crash', () => {
        assert.equal(pricing.costOfRow(null), null);
        assert.equal(pricing.costOfRow(undefined), null);
    });
});

describe('roundUsd', () => {
    test('keeps micro-dollars and drops float noise', () => {
        assert.equal(pricing.roundUsd(0.24510099999999998), 0.245101);
        assert.equal(pricing.roundUsd(0), 0);
        assert.equal(pricing.roundUsd(null), null);
        assert.equal(pricing.roundUsd(undefined), null);
    });
});
