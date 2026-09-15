// lib/db.js unit tests — the datastore logic that has no HTTP surface of its
// own, or whose HTTP surface (Google sign-in) cannot be driven offline.
//
// DATA_DIR is pointed at a throw-away directory BEFORE the module loads: the
// module opens its database and resolves the IP-hash salt at require time.
// One require per file — a second require would be the same cached module.

const { test, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtp-db-'));
process.env.DATA_DIR = dataDir;
delete process.env.IP_HASH_SALT;
delete process.env.RETENTION_DAYS;

const ds = require('../lib/db');

after(() => {
    try { ds.db.close(); } catch (_) { /* already closed */ }
    fs.rmSync(dataDir, { recursive: true, force: true });
});

const DAY = 24 * 60 * 60 * 1000;
const count = (table, where = '1=1', ...params) =>
    ds.db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${where}`).get(...params).c;

describe('module setup', () => {
    test('uses the DATA_DIR it was given and defaults retention to 90 days', () => {
        assert.equal(ds.DATA_DIR, dataDir);
        assert.equal(ds.DB_PATH, path.join(dataDir, 'mtp.db'));
        assert.equal(ds.RETENTION_DAYS, 90);
    });
});

describe('loadOrCreateSecret', () => {
    test('generates 32 random bytes as hex, persists them 0600, and returns the same value afterwards', () => {
        const first = ds.loadOrCreateSecret('unit-secret');
        assert.match(first, /^[0-9a-f]{64}$/);

        const file = path.join(dataDir, 'unit-secret');
        assert.equal(fs.statSync(file).mode & 0o777, 0o600, 'the file IS the secret');
        assert.equal(fs.readFileSync(file, 'utf8').trim(), first);

        assert.equal(ds.loadOrCreateSecret('unit-secret'), first, 'must be idempotent across calls/restarts');
        assert.notEqual(ds.loadOrCreateSecret('another-secret'), first);
    });

    test('the IP-hash salt was persisted at load time and hashes are stable', () => {
        assert.ok(fs.existsSync(path.join(dataDir, 'ip-hash-salt')));
        assert.equal(ds.hashIp('10.0.0.1'), ds.hashIp('10.0.0.1'));
        assert.notEqual(ds.hashIp('10.0.0.1'), ds.hashIp('10.0.0.2'));
        assert.equal(ds.hashIp(''), null);
    });
});

describe('upsertOauthUser', () => {
    test('refuses to create a second identity for an email that already has a local account', () => {
        const local = ds.createLocalUser({ email: 'Dup@Example.com', password_hash: 'h' });
        assert.equal(local.email, 'dup@example.com', 'local signup stores the email lowercased');

        const viaGoogle = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-dup', email: 'DUP@example.com', display_name: 'Dup' });
        assert.equal(viaGoogle, null, 'the strategy turns null into /login?error=email_exists');
        assert.equal(count('users', 'email = ? COLLATE NOCASE', 'dup@example.com'), 1, 'no duplicate row');
        assert.equal(ds.getUserByProvider('google', 'g-dup'), null);
    });

    test('a denied local user cannot resurface as a fresh pending Google row', () => {
        const local = ds.createLocalUser({ email: 'denied@example.com', password_hash: 'h' });
        ds.setUserRole(local.id, 'denied', null);

        const viaGoogle = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-denied', email: 'denied@example.com', display_name: 'D' });
        assert.equal(viaGoogle, null);
        assert.equal(count('users', 'email = ?', 'denied@example.com'), 1);
        assert.equal(ds.getUserById(local.id).role, 'denied', 'the denial must stand');
    });

    test('a pending Google user is promoted on re-sign-in once their email is in INITIAL_ADMIN_EMAILS', () => {
        // The common first-deploy sequence: sign in to see it work, THEN set
        // the env var. The row already exists, so the insert-path bootstrap
        // never fires.
        const first = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-boot', email: 'boot@example.com', display_name: 'Boot', initialAdminEmails: [] });
        assert.equal(first.role, 'pending');
        assert.equal(first.approved_at, null);

        const again = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-boot', email: 'boot@example.com', display_name: 'Boot', initialAdminEmails: ['boot@example.com'] });
        assert.equal(again.id, first.id, 'same row, not a new one');
        assert.equal(again.role, 'admin');
        assert.equal(typeof again.approved_at, 'number');
        assert.equal(count('users', 'provider_id = ?', 'g-boot'), 1);
    });

    test('bootstrap on re-sign-in only promotes from pending — a denied user stays denied', () => {
        const u = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-den', email: 'den@example.com', display_name: 'Den', initialAdminEmails: [] });
        ds.setUserRole(u.id, 'denied', null);

        const again = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-den', email: 'den@example.com', display_name: 'Den', initialAdminEmails: ['den@example.com'] });
        assert.equal(again.id, u.id);
        assert.equal(again.role, 'denied', 'an env var must never override an admin\'s denial');

        // Nor does it touch a tech an admin already approved.
        const t = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-tech', email: 'gtech@example.com', display_name: 'T', initialAdminEmails: [] });
        ds.setUserRole(t.id, 'tech', null);
        assert.equal(ds.upsertOauthUser({ provider: 'google', provider_id: 'g-tech', email: 'gtech@example.com', display_name: 'T', initialAdminEmails: ['gtech@example.com'] }).role, 'tech');
    });

    test('the email is stored lowercased on the update path too', () => {
        const u = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-case', email: 'Mixed@Example.COM', display_name: 'M' });
        assert.equal(u.email, 'mixed@example.com');

        const again = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-case', email: 'MIXED@example.com', display_name: 'M' });
        assert.equal(again.id, u.id);
        assert.equal(again.email, 'mixed@example.com', 'a second sign-in used to store the raw mixed-case email');
    });

    test('avatar_url is null after insert and update, and scrubs a value stored by an earlier build', () => {
        const u = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-av', email: 'av@example.com', display_name: 'Av', avatar_url: 'https://lh3.example/photo.jpg' });
        assert.equal(u.avatar_url, null);

        ds.db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run('https://lh3.example/old.jpg', u.id);
        const again = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-av', email: 'av@example.com', display_name: 'Av' });
        assert.equal(again.avatar_url, null, 'the update path must null out what older builds stored');
    });

    test('display_name is refreshed on sign-in but never blanked', () => {
        const u = ds.upsertOauthUser({ provider: 'google', provider_id: 'g-name', email: 'name@example.com', display_name: 'First Name' });
        assert.equal(ds.upsertOauthUser({ provider: 'google', provider_id: 'g-name', email: 'name@example.com', display_name: '' }).display_name, 'First Name');
        assert.equal(ds.upsertOauthUser({ provider: 'google', provider_id: 'g-name', email: 'name@example.com', display_name: 'New Name' }).display_name, 'New Name');
        assert.equal(u.id, ds.getUserByEmail('NAME@example.com').id, 'email lookup is case-insensitive');
    });
});

describe('users listing and counts', () => {
    test('listUsers omits avatar_url and password_hash; countAdmins counts real admin rows', () => {
        const rows = ds.listUsers();
        assert.ok(rows.length > 0);
        for (const r of rows) {
            assert.ok(!('avatar_url' in r), 'avatar_url is no longer collected and must not be listed');
            assert.ok(!('password_hash' in r));
        }
        assert.equal(ds.countAdmins(), count('users', "role = 'admin'"));
        assert.equal(ds.countPending(), count('users', "role = 'pending'"));
        assert.throws(() => ds.setUserRole(rows[0].id, 'superuser', null), /invalid role/);
    });
});

describe('deleteUser', () => {
    test('detaches feedback and removes the user\'s events and AI transcripts, leaving other users alone', () => {
        const victim = ds.createLocalUser({ email: 'victim@example.com', password_hash: 'h', display_name: 'Vic' });
        const keeper = ds.createLocalUser({ email: 'keeper@example.com', password_hash: 'h', display_name: 'Keep' });

        const fid = ds.insertFeedback({ user_id: victim.id, user_email: victim.email, user_name: 'Vic', category: 'bug', message: 'kept but detached' });
        const keptFid = ds.insertFeedback({ user_id: keeper.id, user_email: keeper.email, user_name: 'Keep', category: 'bug', message: 'untouched' });
        ds.logEvent('tree_start', { user_id: victim.id, data: { tree: 'engine_overheat' } });
        ds.logEvent('fault_lookup', { user_id: victim.id, data: { code: 'YAM-13' } });
        ds.logEvent('tree_start', { user_id: keeper.id, data: { tree: 'engine_no_start' } });
        ds.logAi({ user_id: victim.id, question: 'victim q', answer: 'a', ok: true });
        ds.logAi({ user_id: keeper.id, question: 'keeper q', answer: 'a', ok: true });

        assert.equal(count('events', 'user_id = ?', victim.id), 2);
        assert.equal(count('ai_messages', 'user_id = ?', victim.id), 1);

        ds.deleteUser(victim.id);

        assert.equal(ds.getUserById(victim.id), null);
        assert.ok(ds.getUserById(keeper.id));

        const detached = ds.db.prepare('SELECT * FROM feedback WHERE id = ?').get(fid);
        assert.ok(detached, 'the bug report itself is the product\'s tracker and must survive');
        assert.equal(detached.user_id, null);
        assert.equal(detached.user_email, null);
        assert.equal(detached.user_name, null);
        assert.equal(detached.message, 'kept but detached');
        assert.deepEqual(ds.listFeedbackForUser(victim.id).map((f) => f.id), []);

        const kept = ds.db.prepare('SELECT * FROM feedback WHERE id = ?').get(keptFid);
        assert.equal(kept.user_id, keeper.id);
        assert.equal(kept.user_email, 'keeper@example.com');

        assert.equal(count('events', 'user_id = ?', victim.id), 0);
        assert.equal(count('ai_messages', 'user_id = ?', victim.id), 0);
        assert.equal(count('events', 'user_id = ?', keeper.id), 1);
        assert.equal(count('ai_messages', 'user_id = ?', keeper.id), 1);
    });
});

describe('dashboard queries', () => {
    test('getErrors surfaces ai_truncated alongside real errors, not client noise', () => {
        ds.logEvent('ai_truncated', { data: { tokens_out: 4096 } });
        ds.logEvent('client_error', { data: { msg: 'forged from a browser' } });
        ds.logEvent('bad_request', { data: { status: 400 } });
        ds.logEvent('error', { data: { where: 'express', msg: 'boom' } });
        ds.logEvent('login_fail', { data: { reason: 'admin_code' } });

        const kinds = ds.getErrors(25).map((e) => e.kind);
        assert.ok(kinds.includes('ai_truncated'), 'a truncated answer must reach the error panel');
        assert.ok(kinds.includes('error'));
        assert.ok(kinds.includes('login_fail'));
        assert.ok(!kinds.includes('client_error'), 'browser-reported errors must not be forgeable into the panel');
        assert.ok(!kinds.includes('bad_request'));
    });

    test('getSummary sums prompt-cache reads and writes separately; getRecentAi returns both', () => {
        const before = ds.getSummary().last24h;
        assert.equal(typeof before.aiCacheReadTokens, 'number');
        assert.equal(typeof before.aiCacheWriteTokens, 'number');

        ds.logAi({ question: 'hit', answer: 'a', ok: true, tokens_in: 90012, tokens_out: 8, cache_read: 90000, cache_write: 0 });
        ds.logAi({ question: 'miss', answer: 'a', ok: true, tokens_in: 120012, tokens_out: 8, cache_read: 0, cache_write: 120000 });
        ds.logAi({ question: 'no usage reported', ok: false, error: 'timeout' });

        const after = ds.getSummary().last24h;
        assert.equal(after.aiCacheReadTokens, before.aiCacheReadTokens + 90000);
        assert.equal(after.aiCacheWriteTokens, before.aiCacheWriteTokens + 120000);

        const recent = ds.getRecentAi(3);
        assert.deepEqual(recent.map((r) => r.question), ['no usage reported', 'miss', 'hit']);
        assert.equal(recent[2].cache_read, 90000);
        assert.equal(recent[2].cache_write, 0, 'a real 0 is stored, so hit-rate math is honest');
        assert.equal(recent[1].cache_write, 120000);
        assert.equal(recent[0].cache_read, null, 'rows that never reported usage stay NULL');
    });
});

describe('retention', () => {
    test('pruneOldTelemetry removes only rows older than the window and reports what it removed', () => {
        const eventsBefore = count('events');
        const aiBefore = count('ai_messages');
        const oldTs = Date.now() - 100 * DAY;

        ds.logEvent('tree_start', { data: { tree: 'fresh' } });
        ds.db.prepare('INSERT INTO events (ts, kind, data) VALUES (?, ?, ?)').run(oldTs, 'tree_start', '{"tree":"stale"}');
        ds.logAi({ question: 'fresh', ok: true });
        ds.db.prepare('INSERT INTO ai_messages (ts, question) VALUES (?, ?)').run(oldTs, 'stale');

        // 0 / negative disables pruning entirely — nothing may be touched.
        assert.deepEqual(ds.pruneOldTelemetry(0), { events: 0, ai: 0 });
        assert.deepEqual(ds.pruneOldTelemetry(-1), { events: 0, ai: 0 });
        assert.equal(count('events'), eventsBefore + 2);
        assert.equal(count('ai_messages'), aiBefore + 2);

        assert.deepEqual(ds.pruneOldTelemetry(1), { events: 1, ai: 1 });
        assert.equal(count('events'), eventsBefore + 1);
        assert.equal(count('ai_messages'), aiBefore + 1);
        assert.equal(count('events', 'ts < ?', Date.now() - DAY), 0, 'no stale event may survive');
        assert.equal(count('ai_messages', 'ts < ?', Date.now() - DAY), 0);
        assert.equal(count('events', 'data = ?', '{"tree":"fresh"}'), 1, 'the recent row must survive');
        assert.equal(count('ai_messages', 'question = ?', 'fresh'), 1);

        // Idempotent: a second pass finds nothing.
        assert.deepEqual(ds.pruneOldTelemetry(1), { events: 0, ai: 0 });
    });

    test('startRetentionJob returns null (and does nothing) when disabled', () => {
        assert.equal(ds.startRetentionJob(0), null);
        const timer = ds.startRetentionJob(90);
        assert.ok(timer, 'an enabled job returns its interval');
        clearInterval(timer);
    });
});

describe('token spend and cost', () => {
    // The dashboard's dollar figure is a sum over columns that are easy to
    // misread: tokens_in already contains cache reads and writes, and a cache
    // write costs twice fresh input. lib/pricing.js owns that arithmetic and
    // test/pricing.test.js pins it; these tests pin the aggregation around it —
    // which window a question lands in, the per-model split, and the two kinds
    // of question that cannot be priced honestly.
    const SONNET = 'claude-sonnet-5';
    const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);

    // Rows at a chosen age. logAi always stamps `now`, and half of what is
    // being tested here is which window a row falls into.
    const insertAt = (ageMs, row) => ds.db.prepare(`
        INSERT INTO ai_messages(ts, question, answer, ok, tokens_in, tokens_out, cache_read, cache_write, model)
        VALUES (?,?,?,?,?,?,?,?,?)
    `).run(Date.now() - ageMs, row.question, 'a', row.ok === 0 ? 0 : 1,
        row.tokens_in ?? null, row.tokens_out ?? null,
        row.cache_read ?? null, row.cache_write ?? null, row.model ?? null);

    const HIT  = { tokens_in: 90012,  tokens_out: 8, cache_read: 90000, cache_write: 0 };      // $0.018104
    const COLD = { tokens_in: 120012, tokens_out: 8, cache_read: 0, cache_write: 120000 };     // $0.480104

    test('getSummary totals tokens and dollars per window, keeping unpriced models visible', () => {
        const before = ds.getSummary().aiUsage.last24h;
        assert.equal(typeof before.costUsd, 'number');

        ds.logAi({ question: 'hit',  answer: 'a', ok: true, model: SONNET, ...HIT });
        ds.logAi({ question: 'cold', answer: 'a', ok: true, model: SONNET, ...COLD });
        ds.logAi({ question: 'future model', answer: 'a', ok: true, model: 'claude-not-released', tokens_in: 1000, tokens_out: 100, cache_read: 0, cache_write: 0 });

        const after = ds.getSummary().aiUsage.last24h;
        assert.equal(after.asks, before.asks + 3);
        assert.equal(after.cacheReadTokens,  before.cacheReadTokens + 90000);
        assert.equal(after.cacheWriteTokens, before.cacheWriteTokens + 120000);
        assert.equal(after.outputTokens,     before.outputTokens + 8 + 8 + 100);
        // Fresh input is tokens_in minus the cached tokens it contains: 12 + 12 + 1000.
        assert.equal(after.inputTokens, before.inputTokens + 1024);
        assert.equal(after.totalTokens,
            after.inputTokens + after.cacheReadTokens + after.cacheWriteTokens
            + after.outputTokens + after.unsplitPromptTokens);

        // $0.018104 for the hit + $0.480104 for the miss. The unpriced row adds
        // nothing to the dollars but is counted so the UI can say the total is short.
        near(after.costUsd - before.costUsd, 0.498208, 'cost of one cache hit plus one cache write');
        assert.equal(after.unpricedAsks, before.unpricedAsks + 1);
        assert.equal(after.uncostedAsks, after.unpricedAsks + after.unsplitAsks);

        const unpriced = after.byModel.find((m) => m.model === 'claude-not-released');
        assert.equal(unpriced.costUsd, null, 'an unknown rate must read as unknown, never as free');
        assert.equal(unpriced.inputTokens, 1000, 'its tokens are still counted');
        assert.ok(after.byModel.some((m) => m.model === SONNET));
    });

    test('a question lands in every window wider than its age, and no narrower one', () => {
        // The windows nest, so a 10-day-old question belongs to 30d and all-time
        // but not to 7d. Getting this wrong mislabels the whole spend table.
        const base = ds.getAiUsage();
        insertAt(2 * 60 * 60 * 1000, { question: 'w-2h',  model: SONNET, ...HIT });
        insertAt(3 * DAY,            { question: 'w-3d',  model: SONNET, ...HIT });
        insertAt(10 * DAY,           { question: 'w-10d', model: SONNET, ...HIT });
        insertAt(40 * DAY,           { question: 'w-40d', model: SONNET, ...HIT });

        const now = ds.getAiUsage();
        const added = (k) => now[k].asks - base[k].asks;
        assert.equal(added('last24h'), 1, 'only the 2-hour-old question is in the last 24 hours');
        assert.equal(added('last7d'),  2, '24h questions are inside the 7-day window too');
        assert.equal(added('last30d'), 3);
        assert.equal(added('total'),   4);

        // And the dollars move with them, one cache hit at a time.
        near(now.last7d.costUsd - base.last7d.costUsd, 2 * 0.018104, '7d holds two of the four');
        assert.ok(now.total.costUsd >= now.last30d.costUsd);
        assert.ok(now.last30d.costUsd >= now.last7d.costUsd);
        assert.ok(now.last7d.costUsd >= now.last24h.costUsd);
    });

    test('questions recorded before prompt-cache accounting are reported as uncosted, not billed as fresh input', () => {
        // Rows older than the cache_read/cache_write columns have a real
        // tokens_in and NULL cache columns. Treating that NULL as "nothing was
        // cached" would bill ~96K cached tokens at the full input rate — about
        // ten times over — and quietly inflate every window that reaches them.
        const before = ds.getAiUsage().total;
        insertAt(45 * DAY, { question: 'legacy, no cache columns', tokens_in: 96040, tokens_out: 500 });

        const after = ds.getAiUsage().total;
        assert.equal(after.asks, before.asks + 1);
        assert.equal(after.unsplitAsks, before.unsplitAsks + 1);
        assert.equal(after.unsplitPromptTokens, before.unsplitPromptTokens + 96040,
            'its prompt tokens are counted, just not attributed to a priced column');
        assert.equal(after.inputTokens, before.inputTokens,
            'and above all not counted as fresh input');
        near(after.costUsd - before.costUsd, 0, 'an unknowable split adds no dollars');

        const row = ds.getRecentAi(1)[0];
        assert.equal(row.question, 'legacy, no cache columns');
        assert.equal(row.cost_usd, null, 'the per-question column must say unknown, not $0.00');
    });

    test('a window whose questions are all uncosted reports an unknown cost, not $0.00', () => {
        // A fresh database of nothing but unpriceable questions must not render
        // a confident zero over real spend.
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtp-db2-'));
        const sub = require('node:child_process').spawnSync(process.execPath, ['-e', `
            process.env.DATA_DIR = ${JSON.stringify(dir)};
            const d = require(${JSON.stringify(path.join(__dirname, '..', 'lib', 'db.js'))});
            d.logAi({ question: 'q', answer: 'a', ok: true, model: 'claude-not-released', tokens_in: 1000, tokens_out: 10, cache_read: 0, cache_write: 0 });
            const w = d.getAiUsage().last24h;
            console.log(JSON.stringify({ asks: w.asks, costUsd: w.costUsd, uncosted: w.uncostedAsks }));
        `], { encoding: 'utf8' });
        fs.rmSync(dir, { recursive: true, force: true });
        assert.equal(sub.status, 0, sub.stderr);
        assert.deepEqual(JSON.parse(sub.stdout.trim()), { asks: 1, costUsd: null, uncosted: 1 });
    });

    test('impossible cache columns cannot subtract from the day\'s spend', () => {
        // Defensive: the SQL clamps fresh input at 0 the same way the row-level
        // helper does, so a corrupt row cannot produce negative dollars.
        const before = ds.getAiUsage().last24h;
        insertAt(1000, { question: 'impossible', model: SONNET, tokens_in: 100, tokens_out: 0, cache_read: 90000, cache_write: 0 });
        const after = ds.getAiUsage().last24h;
        assert.equal(after.inputTokens, before.inputTokens, 'clamped at zero, never negative');
        assert.ok(after.costUsd > before.costUsd, 'the cached tokens it did report still cost something');
    });

    test('each question is priced at its own model rate, and the model reaches the dashboard', () => {
        // Opus input is 2.5x Sonnet's, so the same tokens must not cost the same.
        ds.logAi({ question: 'on opus', answer: 'a', ok: true, model: 'claude-opus-5', ...HIT });
        const opusRow = ds.getRecentAi(1)[0];
        assert.equal(opusRow.model, 'claude-opus-5');
        near(opusRow.cost_usd, 0.04526, 'priced at the Opus rate, not the default');

        ds.logAi({ question: 'on sonnet', answer: 'a', ok: true, model: SONNET, ...HIT });
        near(ds.getRecentAi(1)[0].cost_usd, 0.018104, 'and the Sonnet row at the Sonnet rate');

        const models = ds.getAiUsage().total.byModel.map((m) => m.model);
        assert.ok(models.includes('claude-opus-5') && models.includes(SONNET));
        assert.ok(!models.includes(null), 'no NULL bucket should reach the dashboard');
    });

    test('a call that reported no usage is a question that cost nothing', () => {
        ds.logAi({ question: 'no usage', ok: false, model: SONNET, error: 'timeout' });
        const row = ds.getRecentAi(1)[0];
        assert.equal(row.cost_usd, 0, 'not null — nothing was spent, and that is known');
        assert.equal(ds.getAiUsage().last24h.unsplitAsks >= 0, true);
    });
});
