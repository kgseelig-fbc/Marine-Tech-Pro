// Lightweight SQLite datastore for audit/analytics.
// One file at DATA_DIR/mtp.db. On Railway, mount a persistent volume
// to DATA_DIR (e.g. /data) or logs reset on each deploy.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR
    || (fs.existsSync('/data') ? '/data' : path.join(__dirname, '..', 'data'));

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

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

// Add user_id column to events if missing (backward-compatible migration).
try { db.exec(`ALTER TABLE events ADD COLUMN user_id INTEGER`); } catch (_) {}

const stmtInsertEvent = db.prepare(`
    INSERT INTO events(ts, kind, session_id, ip_hash, ua, data, user_id)
    VALUES (@ts, @kind, @session_id, @ip_hash, @ua, @data, @user_id)
`);

const stmtInsertAi = db.prepare(`
    INSERT INTO ai_messages(ts, session_id, ip_hash, question, answer, ctx_tree, ctx_node, tokens_in, tokens_out, duration_ms, ok, error)
    VALUES (@ts, @session_id, @ip_hash, @question, @answer, @ctx_tree, @ctx_node, @tokens_in, @tokens_out, @duration_ms, @ok, @error)
`);

const IP_SALT = process.env.IP_HASH_SALT || 'marine-tech-pro-salt';
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
            question: String(row.question || '').slice(0, 2000),
            answer: row.answer ? String(row.answer).slice(0, 8000) : null,
            ctx_tree: row.ctx_tree || null,
            ctx_node: row.ctx_node || null,
            tokens_in: row.tokens_in || null,
            tokens_out: row.tokens_out || null,
            duration_ms: row.duration_ms || null,
            ok: row.ok ? 1 : 0,
            error: row.error ? String(row.error).slice(0, 500) : null
        });
    } catch (e) { console.warn('logAi failed:', e.message); }
}

// --- Aggregates for the dashboard ---

function getSummary() {
    const now = Date.now();
    const day = 86400 * 1000;

    const counts = (kind, since) => db.prepare(
        `SELECT COUNT(*) c FROM events WHERE kind = ? AND ts >= ?`
    ).get(kind, since).c;

    const aiCount = (since) => db.prepare(
        `SELECT COUNT(*) c FROM ai_messages WHERE ts >= ?`
    ).get(since).c;

    const uniqIps = (since) => db.prepare(
        `SELECT COUNT(DISTINCT ip_hash) c FROM events WHERE ts >= ? AND ip_hash IS NOT NULL`
    ).get(since).c;

    return {
        last24h: {
            logins:       counts('login_ok', now - day),
            loginFail:    counts('login_fail', now - day),
            treeStarts:   counts('tree_start', now - day),
            faultLookups: counts('fault_lookup', now - day),
            aiAsks:       aiCount(now - day),
            uniqueUsers:  uniqIps(now - day)
        },
        last7d: {
            logins:       counts('login_ok', now - 7*day),
            treeStarts:   counts('tree_start', now - 7*day),
            aiAsks:       aiCount(now - 7*day),
            uniqueUsers:  uniqIps(now - 7*day)
        },
        total: {
            events:       db.prepare(`SELECT COUNT(*) c FROM events`).get().c,
            aiMessages:   db.prepare(`SELECT COUNT(*) c FROM ai_messages`).get().c
        }
    };
}

function getActivityByHour(hours = 48) {
    const now = Date.now();
    const since = now - hours * 3600 * 1000;
    const rows = db.prepare(`
        SELECT (ts/3600000) AS hour_bucket,
               SUM(CASE WHEN kind = 'tree_start' THEN 1 ELSE 0 END) AS trees,
               SUM(CASE WHEN kind = 'fault_lookup' THEN 1 ELSE 0 END) AS faults,
               SUM(CASE WHEN kind = 'login_ok' THEN 1 ELSE 0 END) AS logins
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
        SELECT ts, question, answer, ctx_tree, ctx_node, ok, duration_ms, tokens_in, tokens_out
        FROM ai_messages
        ORDER BY id DESC
        LIMIT ?
    `).all(limit);
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
        WHERE kind IN ('error','login_fail','ai_error')
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
const stmtUpdateOauthFields = db.prepare(`
    UPDATE users
       SET email = COALESCE(@email, email),
           display_name = COALESCE(@display_name, display_name),
           avatar_url = COALESCE(@avatar_url, avatar_url)
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

function upsertOauthUser({ provider, provider_id, email, display_name, avatar_url, initialAdminEmails = [] }) {
    const existing = getUserByProvider(provider, provider_id);
    const now = Date.now();
    if (existing) {
        stmtUpdateOauthFields.run({
            id: existing.id,
            email: email || null,
            display_name: display_name || null,
            avatar_url: avatar_url || null
        });
        return getUserById(existing.id);
    }
    const normEmail = email ? String(email).toLowerCase() : null;
    const isBootstrapAdmin = !!(normEmail && initialAdminEmails.includes(normEmail));
    const role = isBootstrapAdmin ? 'admin' : 'pending';
    const info = stmtInsertUser.run({
        provider,
        provider_id,
        email: normEmail,
        display_name: display_name || null,
        avatar_url: avatar_url || null,
        password_hash: null,
        role,
        created_at: now,
        approved_at: isBootstrapAdmin ? now : null
    });
    return getUserById(info.lastInsertRowid);
}

function createLocalUser({ email, password_hash, display_name, initialAdminEmails = [] }) {
    const normEmail = String(email).toLowerCase();
    const now = Date.now();
    const isBootstrapAdmin = initialAdminEmails.includes(normEmail);
    const role = isBootstrapAdmin ? 'admin' : 'pending';
    const info = stmtInsertUser.run({
        provider: 'local',
        provider_id: normEmail,
        email: normEmail,
        display_name: display_name || null,
        avatar_url: null,
        password_hash,
        role,
        created_at: now,
        approved_at: isBootstrapAdmin ? now : null
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
    stmtDeleteUser.run(id);
}

function listUsers({ limit = 500 } = {}) {
    return db.prepare(`
        SELECT id, provider, email, display_name, avatar_url, role,
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

module.exports = {
    db,
    DB_PATH,
    logEvent,
    logAi,
    hashIp,
    getSummary,
    getActivityByHour,
    getTopTrees,
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
    ROLES
};
