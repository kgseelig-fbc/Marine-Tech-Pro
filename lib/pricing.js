// What a question to Ask-a-Tech costs, in dollars.
//
// The admin dashboard reports spend from the token counts already stored on
// every `ai_messages` row. Nothing here talks to a billing API — these are
// Anthropic's published list prices, so the figure is an estimate of the API
// line on the bill, not an invoice. Two things make it drift, and both are
// visible rather than silent: a model whose rate is missing is counted as
// UNPRICED (its tokens still show, its dollars don't), and the rate table
// carries the date it was last checked.
//
// Re-check the rates when you change `AI_MODEL` in server.js, and roughly
// once a quarter otherwise: https://www.anthropic.com/pricing#api

// USD per million tokens, list price, checked 2026-09.
//
// `cacheReadMultiple` and the write multiples below are expressed against the
// model's own input rate — that is how Anthropic prices them, so a rate change
// only ever needs the two base numbers edited. A model may override
// `cacheReadMultiple` (some newer models read cache far more cheaply).
const RATES = {
    'claude-sonnet-5': { input: 2.00, output: 10.00 },
    'claude-opus-5':   { input: 5.00, output: 25.00 },
    'claude-haiku-4-5': { input: 1.00, output: 5.00 }
};

// A cache read costs a tenth of fresh input; a cache WRITE costs more than
// fresh input, and how much more depends on how long the entry is kept alive.
const CACHE_READ_MULTIPLE = 0.1;
const CACHE_WRITE_MULTIPLE = { '5m': 1.25, '1h': 2 };

// The TTL server.js asks for on the KB block. It lives here, and server.js
// imports it, so the price of a cache write can never drift from the TTL the
// request actually used — the two numbers are the same number.
//
// It is not stored per row, so changing it reprices historical cache writes at
// the new multiple. That is acceptable while it changes approximately never;
// if it ever becomes a per-request decision, record it on the row instead.
const CACHE_TTL = '1h';

// Rows written before ai_messages had a `model` column. Every one of them was
// this model: it is the only model /api/ask has ever called. Deliberately a
// frozen constant rather than "whatever AI_MODEL is now" — switching models
// must not silently reprice history.
const LEGACY_MODEL = 'claude-sonnet-5';

function ratesFor(model) {
    return Object.prototype.hasOwnProperty.call(RATES, model) ? RATES[model] : null;
}

// Dollars for one request's usage, or null when the model has no published
// rate here. Callers must treat null as "unknown", never as zero — a silent
// zero is how an unpriced model would quietly vanish from the spend total.
//
// `inputTokens` is FRESH input only. The stored `tokens_in` column is the sum
// of fresh input + cache reads + cache writes, so splitting it is the caller's
// job (see splitInputTokens) — passing the raw column here would bill cached
// tokens at the full input rate and overstate spend several-fold.
function costOf({ model, inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0, ttl = CACHE_TTL } = {}) {
    const r = ratesFor(model);
    if (!r) return null;
    const writeMultiple = Object.prototype.hasOwnProperty.call(CACHE_WRITE_MULTIPLE, ttl)
        ? CACHE_WRITE_MULTIPLE[ttl]
        : CACHE_WRITE_MULTIPLE[CACHE_TTL];
    const readMultiple = typeof r.cacheReadMultiple === 'number' ? r.cacheReadMultiple : CACHE_READ_MULTIPLE;
    const perMillion =
          num(inputTokens)      * r.input
        + num(cacheReadTokens)  * r.input * readMultiple
        + num(cacheWriteTokens) * r.input * writeMultiple
        + num(outputTokens)     * r.output;
    return perMillion / 1e6;
}

// Whether a stored row records HOW its prompt tokens were used.
//
// `cache_read`/`cache_write` were added to ai_messages on 2026-09-14; rows
// written before that have a real `tokens_in` (~96K, nearly all of it the
// cached knowledge base) and NULL cache columns. NULL there means "nobody
// recorded it", not "nothing was cached" — and the difference is a factor of
// ten in dollars, because fresh input is $2.00/MTok against $0.20 for a cache
// read. Those rows are therefore reported as uncosted rather than guessed at.
// A row that recorded no usage at all (a failed call: tokens_in NULL) is not
// unsplit — it genuinely cost nothing.
function hasCacheSplit(row) {
    if (!row) return false;
    if (!Number.isFinite(row.tokens_in) || row.tokens_in <= 0) return true;
    return Number.isFinite(row.cache_read) || Number.isFinite(row.cache_write);
}

// tokens_in holds input + cache read + cache write. Fresh input is what is
// left; clamped at 0 so a half-written legacy row can never produce negative
// dollars.
function splitInputTokens(row) {
    const cacheRead  = num(row && row.cache_read);
    const cacheWrite = num(row && row.cache_write);
    return {
        inputTokens: Math.max(0, num(row && row.tokens_in) - cacheRead - cacheWrite),
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        outputTokens: num(row && row.tokens_out)
    };
}

// Dollars for one stored ai_messages row, or null when the row cannot be
// priced honestly — no rate for its model, or no record of how its prompt
// tokens were split (see hasCacheSplit).
function costOfRow(row) {
    if (!row) return null;
    if (!hasCacheSplit(row)) return null;
    return costOf({ model: row.model || LEGACY_MODEL, ...splitInputTokens(row) });
}

// Dollars are carried to the micro-dollar and no further: JSON should show
// 0.245101, not 0.24510099999999998. null (unknown rate) passes through.
function roundUsd(n) {
    return n === null || n === undefined ? null : Math.round(n * 1e6) / 1e6;
}

function num(v) {
    return Number.isFinite(v) ? v : 0;
}

module.exports = {
    RATES,
    CACHE_READ_MULTIPLE,
    CACHE_WRITE_MULTIPLE,
    CACHE_TTL,
    LEGACY_MODEL,
    ratesFor,
    hasCacheSplit,
    costOf,
    costOfRow,
    roundUsd,
    splitInputTokens
};
