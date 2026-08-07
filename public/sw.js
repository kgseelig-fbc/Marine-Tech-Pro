// sw.js — offline support for Marine Tech Pro.
//
// The whole point: techs work on docks and in marina dead zones. The
// reference data (diagnostic trees, specs, fault codes) is static
// client-side JS, so it can be cached and used with no connection.
//
// Strategy:
//   /api/*        -> network only, never cached (auth + live data)
//   HTML pages    -> network first, fall back to cache, then to an offline
//                    notice, so deploys land immediately when online
//   JS/CSS/icons  -> stale-while-revalidate: instant from cache, refreshed
//                    in the background for the next load
//
// CRITICAL: this app requires auth, and unauthenticated requests get a 302
// to /login. A followed redirect still has `type === 'basic'`, so caching on
// `res.ok` alone would store the login page under /js/diagnosticTrees.js and
// permanently break the app. Every cache write goes through isCacheable(),
// which rejects redirected responses and content-type mismatches.
//
// Bump CACHE_VERSION whenever the precache list or caching logic changes.

var CACHE_VERSION = 'mtp-v3';

// Core shell — if these are missing, offline is useless.
var CORE = [
    '/index.html',
    '/css/styles.css',
    '/js/diagnosticTrees.js',
    '/js/engineSpecs.js',
    '/js/faultcodes.js'
];
var EXTRA = [
    '/',
    '/diagnose.html',
    '/fault-codes.html',
    '/specs.html',
    '/icons/sprite.svg',
    '/icons/logo-256.png',
    '/js/common.js',
    '/js/askTech.js',
    '/js/feedback.js',
    '/manifest.json'
];

// A response is safe to cache only if it is a real, non-redirected,
// same-origin 200 whose content-type matches what was asked for.
function isCacheable(req, res) {
    if (!res || !res.ok || res.type !== 'basic') return false;
    if (res.redirected) return false; // followed an auth 302 — this is /login

    var ct = (res.headers.get('content-type') || '').toLowerCase();
    var url = new URL(req.url);
    var path = url.pathname;

    if (/\.js$/i.test(path)) return ct.indexOf('javascript') !== -1 || ct.indexOf('ecmascript') !== -1;
    if (/\.css$/i.test(path)) return ct.indexOf('text/css') !== -1;
    if (/\.json$/i.test(path)) return ct.indexOf('json') !== -1;
    if (/\.(svg)$/i.test(path)) return ct.indexOf('svg') !== -1;
    if (/\.(png|jpe?g|webp|gif|ico)$/i.test(path)) return ct.indexOf('image/') !== -1;
    // HTML pages: make sure we didn't get redirected to an auth page.
    if (isHtmlRequest(req)) return ct.indexOf('text/html') !== -1;
    return true;
}

function isHtmlRequest(req) {
    return req.mode === 'navigate'
        || (req.headers.get('accept') || '').indexOf('text/html') !== -1;
}

function cachePut(req, res) {
    return caches.open(CACHE_VERSION).then(function (c) { return c.put(req, res); });
}

// Fetch and store one URL, resolving to true only on a genuine cache write.
function precacheOne(cache, url) {
    var req = new Request(url, { credentials: 'same-origin', redirect: 'follow' });
    return fetch(req).then(function (res) {
        if (!isCacheable(req, res)) return false;
        return cache.put(req, res.clone()).then(function () { return true; });
    }).catch(function () { return false; });
}

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(function (cache) {
            return Promise.all(CORE.map(function (u) { return precacheOne(cache, u); }))
                .then(function (coreResults) {
                    // Extras are best-effort and must not fail the install.
                    return Promise.all(EXTRA.map(function (u) { return precacheOne(cache, u); }))
                        .then(function () { return coreResults; });
                });
        }).then(function (coreResults) {
            var got = coreResults.filter(Boolean).length;
            // Signed-out or flaky install: activate anyway (runtime
            // stale-while-revalidate will fill the cache once the tech is
            // signed in), but record that the shell is incomplete so
            // activate() knows not to bin a good previous cache.
            self.__mtpCoreComplete = got === CORE.length;
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            var stale = keys.filter(function (k) { return k !== CACHE_VERSION; });
            // Only bin the previous cache once this one actually holds the
            // core shell — otherwise a bad-network update leaves a tech with
            // no offline data at all.
            if (!self.__mtpCoreComplete) return Promise.resolve();
            return Promise.all(stale.map(function (k) { return caches.delete(k); }));
        }).then(function () { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;

    var url;
    try { url = new URL(req.url); } catch (_) { return; }
    if (url.origin !== self.location.origin) return;

    // Never cache API traffic — it is authenticated and live.
    if (url.pathname.indexOf('/api/') === 0) return;

    // Auth pages must always hit the network so redirects behave.
    if (url.pathname === '/login' || url.pathname === '/pending' || url.pathname === '/logout') return;

    if (isHtmlRequest(req)) {
        event.respondWith(
            fetch(req).then(function (res) {
                if (isCacheable(req, res)) {
                    var copy = res.clone();
                    event.waitUntil(cachePut(req, copy));
                }
                return res;
            }).catch(function () {
                return caches.match(req).then(function (hit) {
                    if (hit) return hit;
                    return caches.match('/index.html').then(function (shell) {
                        if (shell) return shell;
                        return new Response(
                            '<!DOCTYPE html><meta charset="utf-8"><title>Offline</title>' +
                            '<div style="font-family:system-ui;padding:40px;text-align:center;">' +
                            '<h2>Offline</h2><p>This page has not been cached yet. ' +
                            'Reconnect and open it once to make it available offline.</p></div>',
                            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                        );
                    });
                });
            })
        );
        return;
    }

    // Static assets: serve from cache immediately, refresh in background.
    event.respondWith(
        caches.match(req).then(function (hit) {
            var net = fetch(req).then(function (res) {
                if (isCacheable(req, res)) {
                    var copy = res.clone();
                    event.waitUntil(cachePut(req, copy));
                }
                return res;
            }).catch(function () { return hit; });

            if (hit) {
                event.waitUntil(net.catch(function () {}));
                return hit;
            }
            return net;
        })
    );
});

// Let the page drop cached content on sign-out (shared devices).
self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'MTP_CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(function (keys) {
                return Promise.all(keys.map(function (k) { return caches.delete(k); }));
            })
        );
    }
});
