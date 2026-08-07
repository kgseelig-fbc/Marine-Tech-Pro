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
