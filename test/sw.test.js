// Service-worker cache-safety tests.
//
// The dangerous failure mode: this app 302s unauthenticated requests to
// /login, and a followed redirect still reports `type === 'basic'`. Caching
// on `res.ok` alone stores the login page under /js/diagnosticTrees.js and
// permanently breaks the app for that tech. isCacheable() is the guard.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load sw.js in a sandbox with just enough of the SW globals to evaluate it.
function loadSw() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
    const listeners = {};
    const sandbox = {
        self: {
            addEventListener: (k, fn) => { listeners[k] = fn; },
            location: { origin: 'https://app.example.com' },
            skipWaiting: () => Promise.resolve(),
            clients: { claim: () => Promise.resolve() }
        },
        caches: {
            open: () => Promise.resolve({ put: () => Promise.resolve() }),
            keys: () => Promise.resolve([]),
            match: () => Promise.resolve(undefined),
            delete: () => Promise.resolve(true)
        },
        fetch: () => Promise.resolve(),
        URL,
        Request: class { constructor(url, opts) { this.url = url; Object.assign(this, opts || {}); } },
        Response: class { constructor(body, init) { this.body = body; Object.assign(this, init || {}); } },
        Promise,
        console
    };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'sw.js' });
    return sandbox;
}

// Build a fake request/response pair.
function req(url, accept) {
    return { url, mode: accept === 'text/html' ? 'navigate' : 'no-cors', headers: { get: () => accept || '' } };
}
function res({ ok = true, type = 'basic', redirected = false, ct = '' }) {
    return { ok, type, redirected, headers: { get: (h) => (h.toLowerCase() === 'content-type' ? ct : null) } };
}

describe('service worker isCacheable', () => {
    const sw = loadSw();
    const isCacheable = vm.runInContext('isCacheable', sw);

    test('caches a genuine JS response', () => {
        assert.equal(
            isCacheable(req('https://app.example.com/js/faultcodes.js'),
                res({ ct: 'application/javascript; charset=UTF-8' })),
            true
        );
    });

    test('REJECTS a redirected response (the auth 302 to /login)', () => {
        assert.equal(
            isCacheable(req('https://app.example.com/js/diagnosticTrees.js'),
                res({ redirected: true, ct: 'text/html; charset=UTF-8' })),
            false,
            'caching this would serve the login page as diagnosticTrees.js forever'
        );
    });

    test('REJECTS HTML served under a .js URL even without the redirect flag', () => {
        assert.equal(
            isCacheable(req('https://app.example.com/js/engineSpecs.js'),
                res({ ct: 'text/html; charset=UTF-8' })),
            false
        );
    });

    test('REJECTS non-ok responses', () => {
        assert.equal(isCacheable(req('https://app.example.com/js/common.js'), res({ ok: false, ct: 'application/javascript' })), false);
    });

    test('REJECTS opaque/cross-origin responses', () => {
        assert.equal(isCacheable(req('https://cdn.other.com/x.js'), res({ type: 'opaque', ct: 'application/javascript' })), false);
    });

    test('caches CSS and rejects HTML under a .css URL', () => {
        assert.equal(isCacheable(req('https://app.example.com/css/styles.css'), res({ ct: 'text/css' })), true);
        assert.equal(isCacheable(req('https://app.example.com/css/styles.css'), res({ ct: 'text/html' })), false);
    });

    test('caches a real HTML navigation but rejects a redirected one', () => {
        assert.equal(isCacheable(req('https://app.example.com/diagnose.html', 'text/html'), res({ ct: 'text/html' })), true);
        assert.equal(
            isCacheable(req('https://app.example.com/diagnose.html', 'text/html'), res({ redirected: true, ct: 'text/html' })),
            false
        );
    });
});

// ---------------------------------------------------------------------------
// Behavioural harness: a CacheStorage stand-in plus a sandbox that captures
// the install/activate/fetch/message listeners so tests can fire them.
// ---------------------------------------------------------------------------

const ORIGIN = 'https://app.example.com';
const absolute = (u) => (typeof u === 'string' ? new URL(u, ORIGIN).href : u.url);

// A previous generation's cache name. Must never equal the live
// CACHE_VERSION or the "older generation" fixtures test nothing — asserted
// once in the generations suite below.
const OLD_GEN = 'mtp-v2';

function contentTypeFor(u) {
    const p = new URL(absolute(u)).pathname;
    if (/\.js$/.test(p)) return 'application/javascript';
    if (/\.css$/.test(p)) return 'text/css';
    if (/\.json$/.test(p)) return 'application/json';
    if (/\.svg$/.test(p)) return 'image/svg+xml';
    if (/\.png$/.test(p)) return 'image/png';
    return 'text/html';
}

// Insertion-ordered CacheStorage stand-in; match() is first-hit-wins.
function makeCaches(seed) {
    const store = new Map();
    const mk = () => {
        const m = new Map();
        return {
            _m: m,
            put: (rq, rs) => { m.set(absolute(rq), rs); return Promise.resolve(); },
            match: (rq) => Promise.resolve(m.get(absolute(rq)))
        };
    };
    for (const [name, entries] of Object.entries(seed || {})) {
        store.set(name, mk());
        for (const [u, v] of Object.entries(entries)) store.get(name)._m.set(absolute(u), v);
    }
    return {
        store,
        open: (n) => { if (!store.has(n)) store.set(n, mk()); return Promise.resolve(store.get(n)); },
        keys: () => Promise.resolve([...store.keys()]),
        delete: (n) => Promise.resolve(store.delete(n)),
        match: (rq) => {
            for (const c of store.values()) {
                const hit = c._m.get(absolute(rq));
                if (hit) return Promise.resolve(hit);
            }
            return Promise.resolve(undefined);
        }
    };
}

function loadWith(caches, fetchImpl) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
    const listeners = {};
    const sandbox = {
        self: {
            addEventListener: (k, fn) => { listeners[k] = fn; },
            location: { origin: ORIGIN },
            skipWaiting: () => Promise.resolve(),
            clients: { claim: () => Promise.resolve() }
        },
        caches, URL, Promise, console, setTimeout, clearTimeout,
        Request: class {
            constructor(u, o) {
                this.url = absolute(u);
                this.mode = 'no-cors';
                this.method = 'GET';
                this.headers = { get: () => '*/*' };
                Object.assign(this, o || {});
            }
        },
        Response: class {
            constructor(b, i) { this.body = b; this.ok = true; Object.assign(this, i || {}); }
        },
        fetch: fetchImpl
    };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'sw.js' });
    return { listeners, sandbox };
}

const healthyNetwork = (r) => Promise.resolve({
    ok: true, type: 'basic', redirected: false,
    clone() { return this; },
    headers: { get: () => contentTypeFor(r) }
});
// Session cookie expired: every precache follows the 302 to /login.
const expiredSession = () => Promise.resolve({
    ok: true, type: 'basic', redirected: true,
    clone() { return this; },
    headers: { get: () => 'text/html' }
});
// Marina dead zone: the request fails outright.
const offline = () => Promise.reject(new TypeError('Failed to fetch'));
// Railway edge while the container restarts: a resolved (not rejected) 502.
const gatewayError = () => Promise.resolve({
    ok: false, status: 502, type: 'basic', redirected: false,
    clone() { return this; },
    headers: { get: () => 'text/html' }
});

// Fire a lifecycle/message listener and wait for everything it extended.
async function fire(listeners, name, extra) {
    const waits = [];
    await listeners[name](Object.assign({ waitUntil: (p) => waits.push(p) }, extra || {}));
    await Promise.all(waits);
}

// Dispatch a fake FetchEvent and hand back what respondWith received. `waits`
// is exposed but NOT awaited here: a test that stubs a never-settling network
// must not block on the background refresh.
function dispatchFetch(listeners, request) {
    let responded = false;
    let out;
    const waits = [];
    listeners.fetch({
        request,
        respondWith: (p) => { responded = true; out = p; },
        waitUntil: (p) => waits.push(p)
    });
    return { responded, out, waits };
}

// A navigation request, as the browser issues for a page load.
const navigate = (sandbox, u) => new sandbox.Request(u, { mode: 'navigate' });
const currentVersion = (sandbox) => vm.runInContext('CACHE_VERSION', sandbox);

// Regression guard for cache-generation shadowing.
//
// CacheStorage.match() with no cacheName scans EVERY cache in creation order
// and returns the first hit. activate() deliberately keeps the previous
// generation when the new install is incomplete (an expired session cookie is
// enough — every precache follows the auth 302 and is rejected). If reads are
// not scoped to CACHE_VERSION, that retained older cache shadows the new one
// on every read, forever, while writes land in the new cache where nothing
// reads them: the tech keeps being served pre-deploy fault codes.
describe('service worker cache generations', () => {
    test('the older-generation fixture is not the live CACHE_VERSION', () => {
        const { sandbox } = loadWith(makeCaches({}), healthyNetwork);
        assert.notEqual(currentVersion(sandbox), OLD_GEN,
            `OLD_GEN collides with CACHE_VERSION — bump OLD_GEN in this file`);
    });

    test('a retained older cache does NOT shadow the current generation', async () => {
        const caches = makeCaches({ [OLD_GEN]: { '/js/faultcodes.js': 'PRE-DEPLOY' } });
        const { listeners, sandbox } = loadWith(caches, expiredSession);

        await fire(listeners, 'install');
        await fire(listeners, 'activate');

        // The incomplete install must keep the old cache as an offline safety net.
        assert.ok(caches.store.has(OLD_GEN), 'incomplete install must not bin the previous cache');

        // Deploy lands: the new generation gets the corrected data.
        const current = await caches.open(currentVersion(sandbox));
        await current.put('/js/faultcodes.js', 'CORRECTED');

        const read = await vm.runInContext('matchCurrent', sandbox)('/js/faultcodes.js');
        assert.equal(read, 'CORRECTED',
            'read resolved to the stale generation — a corrected fault code would never reach the tech');
    });

    test('a complete install bins previous generations', async () => {
        const caches = makeCaches({ [OLD_GEN]: { '/js/faultcodes.js': 'OLD' } });
        const { listeners, sandbox } = loadWith(caches, healthyNetwork);

        await fire(listeners, 'install');
        await fire(listeners, 'activate');

        assert.deepEqual([...caches.store.keys()], [currentVersion(sandbox)],
            'a healthy install should leave exactly one generation');
    });

    test('install completeness survives a worker restart between install and activate', async () => {
        const caches = makeCaches({ [OLD_GEN]: { '/x.js': 'OLD' } });
        const first = loadWith(caches, healthyNetwork);
        await fire(first.listeners, 'install');

        // Worker is killed and respawned: a fresh sandbox has no in-memory flag,
        // so activate must read the marker back out of the cache itself.
        const second = loadWith(caches, healthyNetwork);
        await fire(second.listeners, 'activate');

        assert.ok(!caches.store.has(OLD_GEN),
            'activate trusted an in-memory flag and leaked the old cache across a restart');
    });

    test('every page a tech opens offline is in CORE, not best-effort EXTRA', async () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
        const core = src.slice(src.indexOf('var CORE'), src.indexOf('var EXTRA'));
        // The sprite draws every menu tile, back arrow and widget button; the
        // logo is the brand mark on every page header.
        for (const page of ['/diagnose.html', '/fault-codes.html', '/specs.html', '/js/common.js',
            '/icons/sprite.svg', '/icons/logo-256.png']) {
            assert.ok(core.includes(page),
                `${page} is not in CORE — a cache missing it could still replace a good one`);
        }
    });
});

// The runtime fallback chain that CLAUDE.md describes. A refactor that
// reorders matchCurrent/matchAnyGeneration, drops the 504, or races the
// network when there is nothing to fall back to would otherwise pass CI.
describe('service worker fetch fallbacks', () => {
    test('static asset: network down and only an older generation has it -> serves the older copy', async () => {
        const caches = makeCaches({ [OLD_GEN]: { '/js/faultcodes.js': 'OLD' } });
        const { listeners, sandbox } = loadWith(caches, offline);
        await caches.open(currentVersion(sandbox)); // current generation exists but is empty

        const { responded, out } = dispatchFetch(listeners, new sandbox.Request('/js/faultcodes.js'));
        assert.equal(responded, true);
        assert.equal(await out, 'OLD',
            'an older generation activate() kept is the last-resort offline fallback');
    });

    test('static asset: network down and nothing cached -> a 504 Response, never undefined', async () => {
        const { listeners, sandbox } = loadWith(makeCaches({}), offline);

        const { out } = dispatchFetch(listeners, new sandbox.Request('/js/faultcodes.js'));
        const r = await out;
        assert.ok(r, 'respondWith(undefined) throws in the browser');
        assert.equal(r.status, 504);
    });

    test('static asset: a current-generation hit is served before the network settles', async () => {
        const caches = makeCaches({ [OLD_GEN]: { '/js/faultcodes.js': 'OLD' } });
        const { listeners, sandbox } = loadWith(caches, () => new Promise(() => {}));
        const current = await caches.open(currentVersion(sandbox));
        await current.put('/js/faultcodes.js', 'CURRENT');

        const { out } = dispatchFetch(listeners, new sandbox.Request('/js/faultcodes.js'));
        assert.equal(await out, 'CURRENT', 'stale-while-revalidate must not wait on the network');
    });

    test('HTML: cached page is served when the network stalls past HTML_NETWORK_TIMEOUT_MS', async () => {
        const caches = makeCaches({});
        const { listeners, sandbox } = loadWith(caches, () => new Promise(() => {}));
        vm.runInContext('HTML_NETWORK_TIMEOUT_MS = 20', sandbox);
        const current = await caches.open(currentVersion(sandbox));
        await current.put('/fault-codes.html', 'CACHED PAGE');

        const { out } = dispatchFetch(listeners, navigate(sandbox, '/fault-codes.html'));
        assert.equal(await out, 'CACHED PAGE',
            'a stalled marina connection left the tech on a blank tab with the page in cache');
    });

    test('HTML: without a cached copy the navigation keeps waiting on the network (no timeout)', async () => {
        const { listeners, sandbox } = loadWith(makeCaches({}), () => new Promise(() => {}));
        vm.runInContext('HTML_NETWORK_TIMEOUT_MS = 20', sandbox);

        const { out } = dispatchFetch(listeners, navigate(sandbox, '/fault-codes.html'));
        const settled = await Promise.race([
            out.then(() => 'settled'),
            new Promise((r) => setTimeout(() => r('pending'), 80))
        ]);
        assert.equal(settled, 'pending',
            'with nothing better to show, the SW must not give up on the network');
    });

    test('HTML: a 5xx falls back to the cached copy in the current generation', async () => {
        const caches = makeCaches({});
        const { listeners, sandbox } = loadWith(caches, gatewayError);
        const current = await caches.open(currentVersion(sandbox));
        await current.put('/diagnose.html', 'CACHED PAGE');

        const { out, waits } = dispatchFetch(listeners, navigate(sandbox, '/diagnose.html'));
        assert.equal(await out, 'CACHED PAGE', 'the tech saw the platform error page mid-redeploy');
        await Promise.all(waits);
        assert.equal(await current.match('/diagnose.html'), 'CACHED PAGE', 'the 502 must not overwrite the cache');
    });

    test('HTML: a 5xx falls back to an older generation when the current one misses', async () => {
        const caches = makeCaches({ [OLD_GEN]: { '/diagnose.html': 'OLDER PAGE' } });
        const { listeners, sandbox } = loadWith(caches, gatewayError);
        await caches.open(currentVersion(sandbox));

        const { out } = dispatchFetch(listeners, navigate(sandbox, '/diagnose.html'));
        assert.equal(await out, 'OLDER PAGE');
    });

    test('HTML: a 5xx with nothing cached surfaces the real error, not an offline notice', async () => {
        const { listeners, sandbox } = loadWith(makeCaches({}), gatewayError);

        const { out } = dispatchFetch(listeners, navigate(sandbox, '/diagnose.html'));
        const r = await out;
        assert.equal(r.status, 502, 'an "Offline" notice while online would mislead the tech');
    });

    test('HTML: offline navigation to an app page with no cached copy gets the Home shell', async () => {
        const caches = makeCaches({});
        const { listeners, sandbox } = loadWith(caches, offline);
        const current = await caches.open(currentVersion(sandbox));
        await current.put('/index.html', 'HOME SHELL');

        const { out } = dispatchFetch(listeners, navigate(sandbox, '/fault-codes.html'));
        assert.equal(await out, 'HOME SHELL');
    });

    test('HTML: offline /admin, /landing, /privacy, /terms get the offline notice, never the Home shell', async () => {
        const caches = makeCaches({});
        const { listeners, sandbox } = loadWith(caches, offline);
        const current = await caches.open(currentVersion(sandbox));
        await current.put('/index.html', 'HOME SHELL');

        for (const p of ['/admin', '/landing', '/privacy', '/terms', '/admin.html']) {
            const { out } = dispatchFetch(listeners, navigate(sandbox, p));
            const r = await out;
            assert.notEqual(r, 'HOME SHELL', `${p} silently rendered Home under the wrong URL`);
            assert.equal(r.status, 200);
            assert.match(r.body, /<meta name="viewport" content="width=device-width/,
                'without a viewport meta a phone lays the notice out at ~980px');
            assert.match(r.body, /href="\/index\.html"/, 'the notice must offer a way back to something cached');
        }
    });

    test('HTML: offline with nothing cached at all still returns a usable offline notice', async () => {
        const { listeners, sandbox } = loadWith(makeCaches({}), offline);

        const { out } = dispatchFetch(listeners, navigate(sandbox, '/specs.html'));
        const r = await out;
        assert.ok(r, 'respondWith(undefined) throws in the browser');
        assert.match(r.body, /<meta name="viewport"/);
    });

    test('/api, auth pages, cross-origin and non-GET requests are left to the network', () => {
        const { listeners, sandbox } = loadWith(makeCaches({}), offline);

        for (const u of ['/api/ask', '/api/me', '/login', '/pending', '/logout', 'https://cdn.other.com/x.js']) {
            const { responded } = dispatchFetch(listeners, navigate(sandbox, u));
            assert.equal(responded, false, `${u} must bypass the service worker`);
        }
        const post = dispatchFetch(listeners, new sandbox.Request('/fault-codes.html', { method: 'POST', mode: 'navigate' }));
        assert.equal(post.responded, false, 'only GET is cacheable');
    });
});

// Sign-out purges every cache (shared phones); MTP_WARM_CACHE is how a
// signed-in page gets the shell back, since install only runs once per
// sw.js change and nothing else ever re-fetches CORE.
describe('service worker messages', () => {
    test('MTP_CLEAR_CACHE deletes every cache generation', async () => {
        const caches = makeCaches({ [OLD_GEN]: { '/x.js': 'OLD' } });
        const { listeners } = loadWith(caches, healthyNetwork);
        await fire(listeners, 'install');
        assert.ok(caches.store.size >= 1);

        await fire(listeners, 'message', { data: { type: 'MTP_CLEAR_CACHE' } });
        assert.equal(caches.store.size, 0, 'sign-out must leave nothing behind on a shared phone');
    });

    test('an unrelated or empty message leaves caches alone', async () => {
        const caches = makeCaches({ [OLD_GEN]: { '/x.js': 'OLD' } });
        const { listeners } = loadWith(caches, healthyNetwork);

        await fire(listeners, 'message', { data: { type: 'something-else' } });
        await fire(listeners, 'message', { data: 'not an object' });
        await fire(listeners, 'message', {});
        assert.ok(caches.store.has(OLD_GEN));
        assert.equal(await caches.store.get(OLD_GEN).match('/x.js'), 'OLD');
    });

    test('MTP_WARM_CACHE re-precaches CORE after a sign-out purge and writes the sentinel', async () => {
        const caches = makeCaches({});
        const calls = [];
        const counting = (r) => { calls.push(new URL(r.url).pathname); return healthyNetwork(r); };
        const { listeners, sandbox } = loadWith(caches, counting);
        const CORE = [...vm.runInContext('CORE', sandbox)];
        const CORE_SENTINEL = vm.runInContext('CORE_SENTINEL', sandbox);

        await fire(listeners, 'install');
        await fire(listeners, 'message', { data: { type: 'MTP_CLEAR_CACHE' } });
        assert.equal(caches.store.size, 0);
        calls.length = 0;

        await fire(listeners, 'message', { data: { type: 'MTP_WARM_CACHE' } });

        const current = await caches.open(currentVersion(sandbox));
        for (const u of CORE) {
            assert.ok(await current.match(u), `${u} missing after warm-up — offline is useless without it`);
        }
        assert.ok(await current.match(CORE_SENTINEL), 'sentinel not written after a complete warm-up');
        for (const u of CORE) assert.ok(calls.includes(u), `${u} was never fetched`);
    });

    test('MTP_WARM_CACHE is a no-op when the shell is already complete', async () => {
        const caches = makeCaches({});
        const calls = [];
        const counting = (r) => { calls.push(r.url); return healthyNetwork(r); };
        const { listeners } = loadWith(caches, counting);

        await fire(listeners, 'install');
        calls.length = 0;

        await fire(listeners, 'message', { data: { type: 'MTP_WARM_CACHE' } });
        assert.equal(calls.length, 0, 'every page load posts this — it must cost nothing when the shell is present');
    });

    test('MTP_WARM_CACHE after a signed-out install fills the shell and bins the retained older generation', async () => {
        const caches = makeCaches({ [OLD_GEN]: { '/js/faultcodes.js': 'OLD' } });
        let network = expiredSession;
        const { listeners, sandbox } = loadWith(caches, (r) => network(r));

        // Deploy landed overnight while the session cookie was expired.
        await fire(listeners, 'install');
        await fire(listeners, 'activate');
        assert.ok(caches.store.has(OLD_GEN), 'precondition: incomplete install kept the old cache');

        // Tech signs in; the authenticated page asks for the shell.
        network = healthyNetwork;
        await fire(listeners, 'message', { data: { type: 'MTP_WARM_CACHE' } });

        assert.deepEqual([...caches.store.keys()], [currentVersion(sandbox)],
            'a complete warm-up should bin older generations, same rule as activate()');
        const current = await caches.open(currentVersion(sandbox));
        assert.ok(await current.match('/js/faultcodes.js'));
    });

    test('MTP_WARM_CACHE that still cannot complete the shell keeps the older generation and writes no sentinel', async () => {
        const caches = makeCaches({ [OLD_GEN]: { '/js/faultcodes.js': 'OLD' } });
        const { listeners, sandbox } = loadWith(caches, expiredSession);
        const CORE_SENTINEL = vm.runInContext('CORE_SENTINEL', sandbox);

        await fire(listeners, 'install');
        await fire(listeners, 'activate');
        await fire(listeners, 'message', { data: { type: 'MTP_WARM_CACHE' } });

        assert.ok(caches.store.has(OLD_GEN), 'an incomplete warm-up must not bin the only good cache');
        const current = await caches.open(currentVersion(sandbox));
        assert.equal(await current.match(CORE_SENTINEL), undefined);
    });
});

describe('service worker precache list', () => {
    test('precache URLs carry no version query (they must match what pages request)', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
        const listBlock = src.slice(src.indexOf('var CORE'), src.indexOf('function isCacheable'));
        assert.ok(!/\?v=/.test(listBlock), 'precache entries must not carry ?v= or they never match');
    });

    test('pages request the same unversioned URLs the SW precaches', () => {
        for (const page of ['index.html', 'diagnose.html', 'fault-codes.html', 'specs.html']) {
            const html = fs.readFileSync(path.join(__dirname, '..', 'public', page), 'utf8');
            assert.ok(!/src="\/?js\/[a-zA-Z]+\.js\?v=/.test(html),
                `${page} still references a ?v= asset the SW precache won't match`);
        }
    });
});

describe('/sw.js route', () => {
    // A source assertion: the live-server suites bind fixed ports and run
    // elsewhere. Without no-cache the browser may hold the old worker for up
    // to a day and a deploy's precache changes never reach the tech.
    test('server.js serves /sw.js with Cache-Control: no-cache so a new worker is picked up promptly', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
        const m = /app\.get\(\s*['"]\/sw\.js['"]/.exec(src);
        assert.ok(m, 'server.js no longer registers a /sw.js route');
        const block = src.slice(m.index, src.indexOf('});', m.index));
        assert.match(block, /['"]Cache-Control['"]\s*,\s*['"][^'"]*no-cache/i,
            'the /sw.js route must set Cache-Control: no-cache');
    });
});
