// SQLite datastore for the whole app: telemetry (events, ai_messages),
// users/roles/approvals, feedback reports and the express-session store all
// live in one file at DATA_DIR/mtp.db, with the generated session-secret and
// ip-hash-salt files beside it. On Railway, mount a persistent volume at
// DATA_DIR (e.g. /data) or every account, approval, session and report is
// lost on each deploy — not just the logs.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pricing = require('./pricing');

const DATA_DIR = process.env.DATA_DIR
    || (fs.existsSync('/data') ? '/data' : path.join(__dirname, '..', 'data'));

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

// Secrets that must survive a restart but that an operator may not have set:
// the session-signing secret and the IP-hash salt. Generated once and kept
// next to the database, so a redeploy with the same volume keeps every tech
// signed in and keeps COUNT(DISTINCT ip_hash) meaningful. A per-boot random
// value would silently do neither. Mode 0600 because the file IS the secret.
function loadOrCreateSecret(name) {
    const file = path.join(DATA_DIR, name);
    try {
        const existing = fs.readFileSync(file, 'utf8').trim();
        if (existing) return existing;
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
    }
    const fresh = crypto.randomBytes(32).toString('hex');
    try {
        // 'wx' so two processes racing on first boot can't clobber each other:
        // the loser sees EEXIST and reads what the winner wrote.
        fs.writeFileSync(file, fresh + '\n', { mode: 0o600, flag: 'wx' });
        return fresh;
    } catch (e) {
        if (e.code === 'EEXIST') return fs.readFileSync(file, 'utf8').trim();
        // An unwritable DATA_DIR is an operator problem, not a reason to refuse
        // to start — the app still works, the secret just won't outlive this
        // process. Say so loudly.
        console.warn(`WARNING: could not persist ${file} (${e.message}) — using a per-boot value; sessions/IP hashes will not survive a restart.`);
        return fresh;
    }
}

// Resolved here, before anything can call hashIp(): the salt must be fixed
// for the life of the process. The old fallback was a string literal in this
// file, which made every hash reversible by anyone who could read the source.
const IP_SALT = process.env.IP_HASH_SALT || loadOrCreateSecret('ip-hash-salt');

const DB_PATH = path.join(DATA_DIR, 'mtp.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         INTEGER NOT NULL,
    kind       TEXT NOT NULL,
    session_id TEXT,
    ip_hash    TEXT,
    ua         TEXT,
    data       TEXT
);
CREATE INDEX IF NOT EXISTS ix_events_ts   ON events(ts);
CREATE INDEX IF NOT EXISTS ix_events_kind ON events(kind);
-- Dashboard counts filter on (kind, ts) together; the single-column indexes
-- force a full scan of one index's match set per count.
CREATE INDEX IF NOT EXISTS ix_events_kind_ts ON events(kind, ts);

CREATE TABLE IF NOT EXISTS ai_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          INTEGER NOT NULL,
    session_id  TEXT,
    ip_hash     TEXT,
    question    TEXT NOT NULL,
    answer      TEXT,
    ctx_tree    TEXT,
    ctx_node    TEXT,
    tokens_in   INTEGER,
    tokens_out  INTEGER,
    duration_ms INTEGER,
    ok          INTEGER,
    error       TEXT
);
CREATE INDEX IF NOT EXISTS ix_ai_ts ON ai_messages(ts);

CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          INTEGER NOT NULL,
    user_id     INTEGER,
    user_email  TEXT,
    user_name   TEXT,
    category    TEXT NOT NULL,
    message     TEXT NOT NULL,
    page_url    TEXT,
    ctx_tree    TEXT,
    ctx_node    TEXT,
    ua          TEXT,
    status      TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS ix_feedback_ts     ON feedback(ts);
CREATE INDEX IF NOT EXISTS ix_feedback_status ON feedback(status);

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    provider      TEXT NOT NULL,
    provider_id   TEXT NOT NULL,
    email         TEXT,
    display_name  TEXT,
    avatar_url    TEXT,
    password_hash TEXT,
    role          TEXT NOT NULL DEFAULT 'pending',
    created_at    INTEGER NOT NULL,
    approved_at   INTEGER,
    approved_by   INTEGER,
    last_login_at INTEGER,
    UNIQUE(provider, provider_id)
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_role  ON users(role);
`);

// Backward-compatible column additions. Only "duplicate column name" is an
// expected error here — anything else (disk full, corruption, SQLITE_BUSY)
// must NOT be swallowed, or the schema silently ends up in an unknown shape.
function addColumn(sql) {
    try {
        db.exec(sql);
    } catch (e) {
        if (!/duplicate column name/i.test(e.message)) throw e;
    }
}

addColumn(`ALTER TABLE events ADD COLUMN user_id INTEGER`);
addColumn(`ALTER TABLE feedback ADD COLUMN admin_reply TEXT`);
addColumn(`ALTER TABLE feedback ADD COLUMN admin_reply_at INTEGER`);
addColumn(`ALTER TABLE feedback ADD COLUMN admin_reply_seen_at INTEGER`);
addColumn(`ALTER TABLE feedback ADD COLUMN resolved_at INTEGER`);
addColumn(`ALTER TABLE feedback ADD COLUMN is_known_issue INTEGER NOT NULL DEFAULT 0`);
// user_id lets an account deletion take its AI transcripts with it (the
// privacy policy promises deletion; without a link there is nothing to delete
// by). cache_read/cache_write are kept apart from tokens_in so the dashboard
// can tell a prompt-cache hit from a ~100K-token cache write — summed together
// a silently lost cache breakpoint looks identical to a healthy one.
addColumn(`ALTER TABLE ai_messages ADD COLUMN user_id INTEGER`);
addColumn(`ALTER TABLE ai_messages ADD COLUMN cache_read INTEGER`);
addColumn(`ALTER TABLE ai_messages ADD COLUMN cache_write INTEGER`);
// The model each question was billed against. Rates differ per model, so
// without it a model switch would reprice every past row at the new model's
// rate; rows older than this column are priced as pricing.LEGACY_MODEL.
addColumn(`ALTER TABLE ai_messages ADD COLUMN model TEXT`);

const stmtInsertEvent = db.prepare(`
    INSERT INTO events(ts, kind, session_id, ip_hash, ua, data, user_id)
    VALUES (@ts, @kind, @session_id, @ip_hash, @ua, @data, @user_id)
`);

const stmtInsertAi = db.prepare(`
    INSERT INTO ai_messages(ts, session_id, ip_hash, user_id, question, answer, ctx_tree, ctx_node, tokens_in, tokens_out, cache_read, cache_write, model, duration_ms, ok, error)
    VALUES (@ts, @session_id, @ip_hash, @user_id, @question, @answer, @ctx_tree, @ctx_node, @tokens_in, @tokens_out, @cache_read, @cache_write, @model, @duration_ms, @ok, @error)
`);

function hashIp(ip) {
    if (!ip) return null;
    return crypto.createHash('sha256').update(IP_SALT + ':' + ip).digest('hex').slice(0, 16);
}

function logEvent(kind, { session_id, ip, ua, data, user_id } = {}) {
    try {
        stmtInsertEvent.run({
            ts: Date.now(),
            kind: String(kind).slice(0, 48),
            session_id: session_id || null,
            ip_hash: hashIp(ip),
            ua: ua ? String(ua).slice(0, 200) : null,
            data: data ? JSON.stringify(data).slice(0, 4000) : null,
            user_id: user_id || null
        });
    } catch (e) { console.warn('logEvent failed:', e.message); }
}

function logAi(row) {
    try {
        stmtInsertAi.run({
            ts: Date.now(),
            session_id: row.session_id || null,
            ip_hash: hashIp(row.ip),
            user_id: row.user_id || null,
            question: String(row.question || '').slice(0, 2000),
            answer: row.answer ? String(row.answer).slice(0, 8000) : null,
            ctx_tree: row.ctx_tree ? String(row.ctx_tree).slice(0, 120) : null,
            ctx_node: row.ctx_node ? String(row.ctx_node).slice(0, 120) : null,
            tokens_in: row.tokens_in || null,
            tokens_out: row.tokens_out || null,
            // A real 0 is kept (a cache WRITE request reads 0) — only rows
            // that never reported usage are NULL, so hit-rate math is honest.
            cache_read: Number.isFinite(row.cache_read) ? row.cache_read : null,
            cache_write: Number.isFinite(row.cache_write) ? row.cache_write : null,
            model: row.model ? String(row.model).slice(0, 64) : null,
            duration_ms: row.duration_ms || null,
            ok: row.ok ? 1 : 0,
            error: row.error ? String(row.error).slice(0, 500) : null
        });
    } catch (e) { console.warn('logAi failed:', e.message); }
}

// --- Aggregates for the dashboard ---

// Token spend and its dollar cost, per window and per model.
//
// One pass over ai_messages, bucketed by age, because the dashboard polls this
// every 30 seconds and better-sqlite3 is synchronous: four separate window
// queries meant four scans blocking the event loop while techs wait on
// /api/ask. Windows nest (24h ⊂ 7d ⊂ 30d ⊂ all), so they are summed from the
// buckets in JS. Volume is bounded by RETENTION_DAYS pruning, not by traffic.
//
// Grouped by model because rates differ per model and the table spans however
// many models the app has used; rows written before the `model` column are
// attributed to pricing.LEGACY_MODEL.
//
// Two kinds of row cannot be priced honestly, and both are counted rather than
// guessed at or silently treated as free:
//   - no rate published for the model (pricing.RATES) — tokens known, dollars not;
//   - no record of how the prompt tokens split between fresh input, cache reads
//     and cache writes (rows older than those columns) — a factor-of-ten
//     difference in dollars, so their prompt tokens are reported apart.
const BUCKET_24H = 1, BUCKET_7D = 7, BUCKET_30D = 30, BUCKET_OLDER = 99;

const stmtAiUsage = db.prepare(`
    SELECT model,
           bucket,
           COUNT(*)                                                   AS asks,
           COALESCE(SUM(CASE WHEN split THEN MAX(tin - cr - cw, 0) ELSE 0 END), 0) AS inputTokens,
           COALESCE(SUM(CASE WHEN split THEN cr   ELSE 0 END), 0)     AS cacheReadTokens,
           COALESCE(SUM(CASE WHEN split THEN cw   ELSE 0 END), 0)     AS cacheWriteTokens,
           COALESCE(SUM(tout), 0)                                     AS outputTokens,
           COALESCE(SUM(CASE WHEN split THEN tout ELSE 0 END), 0)     AS costedOutputTokens,
           COALESCE(SUM(CASE WHEN split THEN 0 ELSE tin END), 0)      AS unsplitPromptTokens,
           COALESCE(SUM(CASE WHEN split THEN 0 ELSE 1 END), 0)        AS unsplitAsks
    FROM (
        SELECT COALESCE(model, @legacy) AS model,
               CASE WHEN ts >= @w24 THEN ${BUCKET_24H}
                    WHEN ts >= @w7  THEN ${BUCKET_7D}
                    WHEN ts >= @w30 THEN ${BUCKET_30D}
                    ELSE ${BUCKET_OLDER} END AS bucket,
               COALESCE(tokens_in, 0)  AS tin,
               COALESCE(tokens_out, 0) AS tout,
               COALESCE(cache_read, 0) AS cr,
               COALESCE(cache_write, 0) AS cw,
               -- A row with no usage at all (a failed call) is not "unsplit":
               -- it genuinely cost nothing. Only a row that recorded prompt
               -- tokens without recording the cache split is unknowable.
               CASE WHEN tokens_in IS NULL OR tokens_in <= 0
                          OR cache_read IS NOT NULL OR cache_write IS NOT NULL
                    THEN 1 ELSE 0 END AS split
        FROM ai_messages
    )
    GROUP BY model, bucket
`);

function emptyWindow() {
    return {
        asks: 0,
        inputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
        unsplitPromptTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        unpricedAsks: 0,
        unsplitAsks: 0,
        uncostedAsks: 0,
        byModel: []
    };
}

// Sum the given buckets into one window and price it.
function windowFrom(groups) {
    const out = emptyWindow();
    const perModel = new Map();

    for (const g of groups) {
        const m = perModel.get(g.model) || {
            model: g.model, asks: 0, inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
            outputTokens: 0, costedOutputTokens: 0, unsplitPromptTokens: 0, unsplitAsks: 0
        };
        m.asks               += g.asks;
        m.inputTokens        += g.inputTokens;
        m.cacheReadTokens    += g.cacheReadTokens;
        m.cacheWriteTokens   += g.cacheWriteTokens;
        m.outputTokens       += g.outputTokens;
        m.costedOutputTokens += g.costedOutputTokens;
        m.unsplitPromptTokens += g.unsplitPromptTokens;
        m.unsplitAsks        += g.unsplitAsks;
        perModel.set(g.model, m);
    }

    let costUsd = 0;
    for (const m of [...perModel.values()].sort((a, b) => a.model.localeCompare(b.model))) {
        const rated = !!pricing.ratesFor(m.model);
        // Only rows whose split is known contribute dollars; the rest are
        // counted as uncosted below.
        const modelCost = rated ? pricing.roundUsd(pricing.costOf({
            model: m.model,
            inputTokens: m.inputTokens,
            outputTokens: m.costedOutputTokens,
            cacheReadTokens: m.cacheReadTokens,
            cacheWriteTokens: m.cacheWriteTokens
        })) : null;
        const totalTokens = m.inputTokens + m.cacheReadTokens + m.cacheWriteTokens
                          + m.outputTokens + m.unsplitPromptTokens;

        out.asks             += m.asks;
        out.inputTokens      += m.inputTokens;
        out.cacheReadTokens  += m.cacheReadTokens;
        out.cacheWriteTokens += m.cacheWriteTokens;
        out.outputTokens     += m.outputTokens;
        out.unsplitPromptTokens += m.unsplitPromptTokens;
        out.totalTokens      += totalTokens;
        out.unsplitAsks      += m.unsplitAsks;
        if (!rated) out.unpricedAsks += m.asks - m.unsplitAsks;
        else costUsd += modelCost || 0;

        out.byModel.push({
            model: m.model,
            asks: m.asks,
            inputTokens: m.inputTokens,
            cacheReadTokens: m.cacheReadTokens,
            cacheWriteTokens: m.cacheWriteTokens,
            outputTokens: m.outputTokens,
            unsplitAsks: m.unsplitAsks,
            totalTokens,
            costUsd: modelCost
        });
    }

    out.uncostedAsks = out.unpricedAsks + out.unsplitAsks;
    // Every ask in the window was unpriceable: report the cost as unknown, so
    // the dashboard shows "?" instead of a confident $0.00 over real spend.
    out.costUsd = (out.asks > 0 && out.uncostedAsks === out.asks) ? null : pricing.roundUsd(costUsd);
    return out;
}

function getAiUsage() {
    const now = Date.now();
    const day = 86400 * 1000;
    const groups = stmtAiUsage.all({
        legacy: pricing.LEGACY_MODEL,
        w24: now - day,
        w7:  now - 7 * day,
        w30: now - 30 * day
    });
    const inBucket = (...keep) => groups.filter((g) => keep.includes(g.bucket));

    return {
        // Windows longer than this show only what pruning has left.
        retentionDays: RETENTION_DAYS,
        last24h: windowFrom(inBucket(BUCKET_24H)),
        last7d:  windowFrom(inBucket(BUCKET_24H, BUCKET_7D)),
        last30d: windowFrom(inBucket(BUCKET_24H, BUCKET_7D, BUCKET_30D)),
        total:   windowFrom(groups)
    };
}

function getSummary() {
    const now = Date.now();
    const day = 86400 * 1000;

    const counts = (kind, since) => db.prepare(
        `SELECT COUNT(*) c FROM events WHERE kind = ? AND ts >= ?`
    ).get(kind, since).c;

    // Successful logins are logged under three kinds: login_ok (local),
    // login_ok_google, login_ok_breakglass. Count them all.
    const loginCounts = (since) => db.prepare(
        `SELECT COUNT(*) c FROM events WHERE kind LIKE 'login_ok%' AND ts >= ?`
    ).get(since).c;

    const aiCount = (since) => db.prepare(
        `SELECT COUNT(*) c FROM ai_messages WHERE ts >= ?`
    ).get(since).c;

    const uniqIps = (since) => db.prepare(
        `SELECT COUNT(DISTINCT ip_hash) c FROM events WHERE ts >= ? AND ip_hash IS NOT NULL`
    ).get(since).c;

    // Prompt-cache health: reads/(reads+writes) should sit near 1 in steady
    // use. A run of writes means the 1h breakpoint stopped landing.
    const aiCache = db.prepare(
        `SELECT COALESCE(SUM(cache_read), 0) r, COALESCE(SUM(cache_write), 0) w FROM ai_messages WHERE ts >= ?`
    ).get(now - day);

    return {
        last24h: {
            logins:       loginCounts(now - day),
            loginFail:    counts('login_fail', now - day),
            treeStarts:   counts('tree_start', now - day),
            faultLookups: counts('fault_lookup', now - day),
            aiAsks:       aiCount(now - day),
            aiCacheReadTokens:  aiCache.r,
            aiCacheWriteTokens: aiCache.w,
            uniqueUsers:  uniqIps(now - day)
        },
        last7d: {
            logins:       loginCounts(now - 7*day),
            treeStarts:   counts('tree_start', now - 7*day),
            aiAsks:       aiCount(now - 7*day),
            uniqueUsers:  uniqIps(now - 7*day)
        },
        total: {
            events:       db.prepare(`SELECT COUNT(*) c FROM events`).get().c,
            aiMessages:   db.prepare(`SELECT COUNT(*) c FROM ai_messages`).get().c
        },
        // Tokens and dollars per window. `total` is every row still in the
        // table, which RETENTION_DAYS prunes — it is all-time only for an
        // instance younger than the retention window, and the dashboard says so.
        aiUsage: getAiUsage()
    };
}

function getActivityByHour(hours = 48) {
    const now = Date.now();
    const since = now - hours * 3600 * 1000;
    const rows = db.prepare(`
        SELECT (ts/3600000) AS hour_bucket,
               SUM(CASE WHEN kind = 'tree_start' THEN 1 ELSE 0 END) AS trees,
               SUM(CASE WHEN kind = 'fault_lookup' THEN 1 ELSE 0 END) AS faults,
               SUM(CASE WHEN kind LIKE 'login_ok%' THEN 1 ELSE 0 END) AS logins
        FROM events
        WHERE ts >= ?
        GROUP BY hour_bucket
        ORDER BY hour_bucket ASC
    `).all(since);
    const aiRows = db.prepare(`
        SELECT (ts/3600000) AS hour_bucket, COUNT(*) AS n
        FROM ai_messages
        WHERE ts >= ?
        GROUP BY hour_bucket
        ORDER BY hour_bucket ASC
    `).all(since);
    const aiByHour = Object.fromEntries(aiRows.map(r => [r.hour_bucket, r.n]));
    const startHour = Math.floor(since / 3600000);
    const endHour = Math.floor(now / 3600000);
    const out = [];
    const byHour = Object.fromEntries(rows.map(r => [r.hour_bucket, r]));
    for (let h = startHour; h <= endHour; h++) {
        const r = byHour[h] || { trees: 0, faults: 0, logins: 0 };
        out.push({
            hour: h * 3600000,
            trees: r.trees || 0,
            faults: r.faults || 0,
            logins: r.logins || 0,
            ai: aiByHour[h] || 0
        });
    }
    return out;
}

function getTopTrees(limit = 12) {
    return db.prepare(`
        SELECT data AS d, COUNT(*) AS n
        FROM events
        WHERE kind = 'tree_start' AND data IS NOT NULL
        GROUP BY d
        ORDER BY n DESC
        LIMIT ?
    `).all(limit).map(r => {
        let tree = '';
        try { tree = JSON.parse(r.d).tree || ''; } catch(_) {}
        return { tree, count: r.n };
    });
}

function getRecentAi(limit = 25) {
    return db.prepare(`
        SELECT ts, question, answer, ctx_tree, ctx_node, ok, duration_ms, tokens_in, tokens_out, cache_read, cache_write, model
        FROM ai_messages
        ORDER BY id DESC
        LIMIT ?
    `).all(limit).map((r) => ({ ...r, cost_usd: pricing.roundUsd(pricing.costOfRow(r)) }));
}

function getRecentEvents(limit = 40) {
    return db.prepare(`
        SELECT ts, kind, ip_hash, ua, data
        FROM events
        ORDER BY id DESC
        LIMIT ?
    `).all(limit);
}

function getErrors(limit = 25) {
    return db.prepare(`
        SELECT ts, kind, data
        FROM events
        WHERE kind IN ('error','login_fail','ai_error','ai_truncated')
        ORDER BY id DESC
        LIMIT ?
    `).all(limit);
}

// --- USERS ---

const ROLES = new Set(['pending', 'tech', 'admin', 'denied']);

const stmtGetUserById = db.prepare(`SELECT * FROM users WHERE id = ?`);
const stmtGetUserByProvider = db.prepare(`SELECT * FROM users WHERE provider = ? AND provider_id = ?`);
const stmtGetUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1`);
const stmtInsertUser = db.prepare(`
    INSERT INTO users (provider, provider_id, email, display_name, avatar_url, password_hash, role, created_at, approved_at)
    VALUES (@provider, @provider_id, @email, @display_name, @avatar_url, @password_hash, @role, @created_at, @approved_at)
`);
// avatar_url is written as NULL on both insert and update: the privacy policy
// lists name, email and account ID as what Google sign-in yields, nothing in
// the UI renders a photo, and a stored-but-undisclosed profile field is
// exactly what a Limited Use review flags. The column stays so no migration
// is needed; NULL-ing it here also scrubs values stored by earlier builds.
const stmtUpdateOauthFields = db.prepare(`
    UPDATE users
       SET email = COALESCE(@email, email),
           display_name = COALESCE(@display_name, display_name),
           avatar_url = NULL
     WHERE id = @id
`);
const stmtTouchLogin = db.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`);
const stmtSetRole = db.prepare(`
    UPDATE users
       SET role = @role,
           approved_at = COALESCE(approved_at, @approved_at),
           approved_by = COALESCE(approved_by, @approved_by)
     WHERE id = @id
`);
const stmtDeleteUser = db.prepare(`DELETE FROM users WHERE id = ?`);
// Deleting an account must take its personal data with it — the privacy
// policy promises that, and a bare DELETE FROM users left feedback rows
// (email, name, message) behind indefinitely, since feedback is outside the
// retention prune. Feedback content stays (it is the product's bug tracker)
// but is detached from the person; telemetry keyed to them goes entirely.
const stmtScrubFeedbackUser = db.prepare(
    `UPDATE feedback SET user_id = NULL, user_email = NULL, user_name = NULL WHERE user_id = ?`
);
const stmtDeleteEventsForUser = db.prepare(`DELETE FROM events WHERE user_id = ?`);
const stmtDeleteAiForUser = db.prepare(`DELETE FROM ai_messages WHERE user_id = ?`);
const deleteUserTx = db.transaction((id) => {
    stmtDeleteUser.run(id);
    stmtScrubFeedbackUser.run(id);
    stmtDeleteEventsForUser.run(id);
    stmtDeleteAiForUser.run(id);
});

function getUserById(id) {
    if (!id) return null;
    return stmtGetUserById.get(id) || null;
}

function getUserByProvider(provider, providerId) {
    return stmtGetUserByProvider.get(provider, providerId) || null;
}

function getUserByEmail(email) {
    if (!email) return null;
    return stmtGetUserByEmail.get(email) || null;
}

// Returns the user row, or null when the email already belongs to a different
// account (the caller turns that into a login refusal).
function upsertOauthUser({ provider, provider_id, email, display_name, initialAdminEmails = [] }) {
    // Lowercase on every path, not just insert: the bootstrap check below is
    // an exact match, and a mixed-case email stored by a second sign-in would
    // silently miss it (lookups are COLLATE NOCASE, so nothing else noticed).
    const normEmail = email ? String(email).toLowerCase() : null;
    const existing = getUserByProvider(provider, provider_id);
    const now = Date.now();
    if (existing) {
        stmtUpdateOauthFields.run({
            id: existing.id,
            email: normEmail,
            display_name: display_name || null
        });
        // Bootstrap on re-sign-in too, not only at row creation. The common
        // first-deploy sequence is "sign in to see it work, THEN set
        // INITIAL_ADMIN_EMAILS" — without this the intended admin is stuck in
        // pending with nobody able to approve them. Only pending is promoted:
        // an admin-set tech or denied must not be overridden by an env var.
        const checkEmail = normEmail || (existing.email ? String(existing.email).toLowerCase() : null);
        if (existing.role === 'pending' && checkEmail && initialAdminEmails.includes(checkEmail)) {
            return setUserRole(existing.id, 'admin', null);
        }
        return getUserById(existing.id);
    }
    // No automatic linking when the email is already taken by another row.
    // Linking would let a verified Google identity take over an unverified
    // local account with the same address — or, the other way round, let a
    // denied local user resurface as a fresh pending Google row. Either way an
    // admin resolves it by hand; the login page explains what happened.
    if (getUserByEmail(normEmail)) return null;
    const isBootstrapAdmin = !!(normEmail && initialAdminEmails.includes(normEmail));
    const role = isBootstrapAdmin ? 'admin' : 'pending';
    const info = stmtInsertUser.run({
        provider,
        provider_id,
        email: normEmail,
        display_name: display_name || null,
        avatar_url: null,
        password_hash: null,
        role,
        created_at: now,
        approved_at: isBootstrapAdmin ? now : null
    });
    return getUserById(info.lastInsertRowid);
}

// Local signups NEVER bootstrap to admin: email ownership is unverified, so
// matching INITIAL_ADMIN_EMAILS here would let anyone who knows (or guesses)
// the bootstrap address register it and become admin. The bootstrap only
// applies to verified-email providers (Google, in upsertOauthUser). For
// local-only deployments, use ADMIN_CODE break-glass to approve the first admin.
function createLocalUser({ email, password_hash, display_name }) {
    const normEmail = String(email).toLowerCase();
    const now = Date.now();
    const info = stmtInsertUser.run({
        provider: 'local',
        provider_id: normEmail,
        email: normEmail,
        display_name: display_name || null,
        avatar_url: null,
        password_hash,
        role: 'pending',
        created_at: now,
        approved_at: null
    });
    return getUserById(info.lastInsertRowid);
}

function touchUserLogin(id) {
    if (!id) return;
    stmtTouchLogin.run(Date.now(), id);
}

function setUserRole(id, role, approvedBy) {
    if (!ROLES.has(role)) throw new Error('invalid role');
    const approved_at = (role === 'tech' || role === 'admin') ? Date.now() : null;
    stmtSetRole.run({ id, role, approved_at, approved_by: approvedBy || null });
    return getUserById(id);
}

function deleteUser(id) {
    deleteUserTx(id);
}

function listUsers({ limit = 500 } = {}) {
    return db.prepare(`
        SELECT id, provider, email, display_name, role,
               created_at, approved_at, approved_by, last_login_at
          FROM users
         ORDER BY
            CASE role WHEN 'pending' THEN 0 WHEN 'admin' THEN 1 WHEN 'tech' THEN 2 ELSE 3 END,
            created_at DESC
         LIMIT ?
    `).all(limit);
}

function countPending() {
    return db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'pending'`).get().c;
}

// Used by the last-admin guardrails. Counting in SQL (ix_users_role) instead
// of filtering a capped listUsers() page — past 500 users the page can omit
// admin rows and the guard would wrongly refuse legitimate demotions.
function countAdmins() {
    return db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'admin'`).get().c;
}

// --- FEEDBACK ---

const FEEDBACK_CATEGORIES = new Set(['bug', 'feedback', 'enhancement']);
const FEEDBACK_STATUSES = new Set(['new', 'in_progress', 'resolved', 'wont_fix']);

const stmtInsertFeedback = db.prepare(`
    INSERT INTO feedback (ts, user_id, user_email, user_name, category, message, page_url, ctx_tree, ctx_node, ua, status)
    VALUES (@ts, @user_id, @user_email, @user_name, @category, @message, @page_url, @ctx_tree, @ctx_node, @ua, 'new')
`);

function insertFeedback({ user_id, user_email, user_name, category, message, page_url, ctx_tree, ctx_node, ua }) {
    const info = stmtInsertFeedback.run({
        ts: Date.now(),
        user_id: user_id || null,
        user_email: user_email || null,
        user_name: user_name || null,
        category: String(category).slice(0, 24),
        message: String(message).slice(0, 4000),
        page_url: page_url ? String(page_url).slice(0, 500) : null,
        ctx_tree: ctx_tree ? String(ctx_tree).slice(0, 120) : null,
        ctx_node: ctx_node ? String(ctx_node).slice(0, 120) : null,
        ua: ua ? String(ua).slice(0, 200) : null
    });
    return info.lastInsertRowid;
}

function listFeedback({ limit = 200, status = null } = {}) {
    if (status && FEEDBACK_STATUSES.has(status)) {
        return db.prepare(`
            SELECT * FROM feedback WHERE status = ? ORDER BY id DESC LIMIT ?
        `).all(status, limit);
    }
    return db.prepare(`
        SELECT * FROM feedback
        ORDER BY
            CASE status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
            id DESC
        LIMIT ?
    `).all(limit);
}

function setFeedbackStatus(id, status) {
    if (!FEEDBACK_STATUSES.has(status)) throw new Error('invalid status');
    const now = Date.now();
    if (status === 'resolved' || status === 'wont_fix') {
        db.prepare(`UPDATE feedback SET status = ?, resolved_at = COALESCE(resolved_at, ?) WHERE id = ?`)
            .run(status, now, id);
    } else {
        db.prepare(`UPDATE feedback SET status = ?, resolved_at = NULL WHERE id = ?`).run(status, id);
    }
    return db.prepare(`SELECT * FROM feedback WHERE id = ?`).get(id);
}

function setFeedbackAdminReply(id, reply) {
    const text = reply == null ? null : String(reply).slice(0, 4000);
    db.prepare(`UPDATE feedback SET admin_reply = ?, admin_reply_at = ? WHERE id = ?`)
        .run(text, text ? Date.now() : null, id);
    return db.prepare(`SELECT * FROM feedback WHERE id = ?`).get(id);
}

function setFeedbackKnownIssue(id, flag) {
    db.prepare(`UPDATE feedback SET is_known_issue = ? WHERE id = ?`).run(flag ? 1 : 0, id);
    return db.prepare(`SELECT * FROM feedback WHERE id = ?`).get(id);
}

function countNewFeedback() {
    return db.prepare(`SELECT COUNT(*) c FROM feedback WHERE status = 'new'`).get().c;
}

function listFeedbackForUser(userId) {
    if (!userId) return [];
    return db.prepare(`
        SELECT id, ts, category, message, status, admin_reply, admin_reply_at,
               resolved_at, page_url, ctx_tree, ctx_node, is_known_issue
        FROM feedback
        WHERE user_id = ?
        ORDER BY
            CASE status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
            id DESC
        LIMIT 100
    `).all(userId);
}

function listKnownIssues() {
    // Show pinned issues, open ones first then recently resolved (last 30 days).
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return db.prepare(`
        SELECT id, ts, category, message, status, admin_reply, admin_reply_at,
               resolved_at, ctx_tree
        FROM feedback
        WHERE is_known_issue = 1
          AND (status IN ('new','in_progress') OR resolved_at >= ?)
        ORDER BY
            CASE status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
            id DESC
        LIMIT 50
    `).all(cutoff);
}

// --- RETENTION ---
// events/ai_messages are append-only telemetry with no natural ceiling: the
// beacon endpoint alone allows 120 writes/min/user. Trim on startup and daily
// so the SQLite file on the mounted volume can't grow without bound.
const _retentionRaw = process.env.RETENTION_DAYS;
const _retentionParsed = parseInt(_retentionRaw || '90', 10);
if (_retentionRaw && !Number.isFinite(_retentionParsed)) {
    console.warn(`RETENTION_DAYS="${_retentionRaw}" is not a number — falling back to 90 days.`);
}
const RETENTION_DAYS = Number.isFinite(_retentionParsed) ? _retentionParsed : 90;

// Delete in bounded batches: better-sqlite3 is synchronous, so one unbounded
// DELETE over a long-neglected table would block the event loop (and the
// health check) for as long as it takes.
const BATCH = 5000;
const stmtPruneEvents = db.prepare(
    `DELETE FROM events WHERE id IN (SELECT id FROM events WHERE ts < ? LIMIT ${BATCH})`
);
const stmtPruneAi = db.prepare(
    `DELETE FROM ai_messages WHERE id IN (SELECT id FROM ai_messages WHERE ts < ? LIMIT ${BATCH})`
);

function pruneOldTelemetry(days = RETENTION_DAYS) {
    if (!days || days <= 0) return { events: 0, ai: 0 };
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const MAX = 500000; // backstop so a pathological table can't spin forever
    let events = 0, ai = 0;
    try {
        let r;
        do { r = stmtPruneEvents.run(cutoff); events += r.changes; } while (r.changes === BATCH && events < MAX);
        do { r = stmtPruneAi.run(cutoff); ai += r.changes; } while (r.changes === BATCH && ai < MAX);
        return { events, ai };
    } catch (e) {
        console.warn('pruneOldTelemetry failed:', e.message);
        return { events, ai };
    }
}

function startRetentionJob(days = RETENTION_DAYS) {
    if (!days || days <= 0) {
        console.log('Retention: disabled (RETENTION_DAYS <= 0) — telemetry will grow unbounded.');
        return null;
    }
    const run = () => {
        const n = pruneOldTelemetry(days);
        if (n.events || n.ai) {
            console.log(`Retention: pruned ${n.events} events, ${n.ai} ai_messages older than ${days}d`);
        }
    };
    // Defer the first pass so startup and the platform's health check aren't
    // queued behind what may be the largest prune this database ever does.
    const first = setTimeout(run, 30000);
    if (first.unref) first.unref();
    const timer = setInterval(run, 24 * 60 * 60 * 1000);
    if (timer.unref) timer.unref(); // never hold the process open
    return timer;
}

module.exports = {
    db,
    DB_PATH,
    DATA_DIR,
    loadOrCreateSecret,
    logEvent,
    logAi,
    hashIp,
    pruneOldTelemetry,
    startRetentionJob,
    RETENTION_DAYS,
    getSummary,
    getActivityByHour,
    getTopTrees,
    getAiUsage,
    getRecentAi,
    getRecentEvents,
    getErrors,
    // users
    getUserById,
    getUserByProvider,
    getUserByEmail,
    upsertOauthUser,
    createLocalUser,
    touchUserLogin,
    setUserRole,
    deleteUser,
    listUsers,
    countPending,
    countAdmins,
    ROLES,
    // feedback
    insertFeedback,
    listFeedback,
    setFeedbackStatus,
    setFeedbackAdminReply,
    setFeedbackKnownIssue,
    countNewFeedback,
    listFeedbackForUser,
    listKnownIssues,
    FEEDBACK_CATEGORIES,
    FEEDBACK_STATUSES
};
