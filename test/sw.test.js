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
    const ORIGIN = 'https://app.example.com';
    const absolute = (u) => (typeof u === 'string' ? new URL(u, ORIGIN).href : u.url);

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
            caches, URL, Promise, console,
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

    async function fire(listeners, name) {
        const waits = [];
        await listeners[name]({ waitUntil: (p) => waits.push(p) });
        await Promise.all(waits);
    }

    test('a retained older cache does NOT shadow the current generation', async () => {
        const caches = makeCaches({ 'mtp-v2': { '/js/faultcodes.js': 'PRE-DEPLOY' } });
        const { listeners, sandbox } = loadWith(caches, expiredSession);

        await fire(listeners, 'install');
        await fire(listeners, 'activate');

        // The incomplete install must keep the old cache as an offline safety net.
        assert.ok(caches.store.has('mtp-v2'), 'incomplete install must not bin the previous cache');

        // Deploy lands: the new generation gets the corrected data.
        const current = await caches.open(vm.runInContext('CACHE_VERSION', sandbox));
        await current.put('/js/faultcodes.js', 'CORRECTED');

        const read = await vm.runInContext('matchCurrent', sandbox)('/js/faultcodes.js');
        assert.equal(read, 'CORRECTED',
            'read resolved to the stale generation — a corrected fault code would never reach the tech');
    });

    test('a complete install bins previous generations', async () => {
        const caches = makeCaches({ 'mtp-v2': { '/js/faultcodes.js': 'OLD' } });
        const { listeners } = loadWith(caches, healthyNetwork);

        await fire(listeners, 'install');
        await fire(listeners, 'activate');

        assert.deepEqual([...caches.store.keys()], ['mtp-v3'],
            'a healthy install should leave exactly one generation');
    });

    test('install completeness survives a worker restart between install and activate', async () => {
        const caches = makeCaches({ 'mtp-v2': { '/x.js': 'OLD' } });
        const first = loadWith(caches, healthyNetwork);
        await fire(first.listeners, 'install');

        // Worker is killed and respawned: a fresh sandbox has no in-memory flag,
        // so activate must read the marker back out of the cache itself.
        const second = loadWith(caches, healthyNetwork);
        await fire(second.listeners, 'activate');

        assert.ok(!caches.store.has('mtp-v2'),
            'activate trusted an in-memory flag and leaked the old cache across a restart');
    });

    test('every page a tech opens offline is in CORE, not best-effort EXTRA', async () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
        const core = src.slice(src.indexOf('var CORE'), src.indexOf('var EXTRA'));
        for (const page of ['/diagnose.html', '/fault-codes.html', '/specs.html', '/js/common.js']) {
            assert.ok(core.includes(page),
                `${page} is not in CORE — a cache missing it could still replace a good one`);
        }
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
