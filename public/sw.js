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

// Core shell — if these are missing, offline is useless. These are the pages
// and data a tech actually opens on a dock, so a cache missing any of them is
// not good enough to replace a previous one (see activate()).
var CORE = [
    '/index.html',
    '/diagnose.html',
    '/fault-codes.html',
    '/specs.html',
    '/css/styles.css',
    '/js/common.js',
    '/js/diagnosticTrees.js',
    '/js/engineSpecs.js',
    '/js/faultcodes.js'
];
var EXTRA = [
    '/',
    '/icons/sprite.svg',
    '/icons/logo-256.png',
    '/js/askTech.js',
    '/js/feedback.js',
    '/manifest.json'
];

// Written into a cache only when its core shell is complete. activate() reads
// it back rather than trusting an in-memory flag, which would not survive the
// worker being killed between install and activate.
var CORE_SENTINEL = '/__mtp-core-complete';

// Read scoped to the CURRENT generation.
//
// `caches.match(req)` with no cacheName scans every cache in creation order
// and returns the first hit — so an older generation that activate() kept on
// purpose would shadow this one on every read, forever, while writes went to
// the new cache where nothing read them. A tech would keep being served the
// pre-deploy fault codes. Reads must name the cache; older generations are a
// last-resort offline fallback only (matchAnyGeneration).
function matchCurrent(req) {
    return caches.open(CACHE_VERSION).then(function (c) { return c.match(req); });
}

// Only for when the network is gone AND the current cache misses: better to
// hand a tech slightly stale reference data than nothing at all in a dead zone.
function matchAnyGeneration(req) {
    return caches.match(req);
}

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
            // activate() knows not to bin a good previous cache. The marker
            // is stored IN the cache, not on `self`, so it survives the
            // worker being torn down between install and activate.
            if (got !== CORE.length) return self.skipWaiting();
            return caches.open(CACHE_VERSION).then(function (cache) {
                return cache.put(CORE_SENTINEL, new Response('1'));
            }).then(function () { return self.skipWaiting(); });
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        // Only bin previous generations once THIS one actually holds the core
        // shell — otherwise a bad-network update leaves a tech with no offline
        // data at all. Reads are scoped to CACHE_VERSION (matchCurrent), so a
        // retained old cache costs quota but can never shadow fresh assets.
        caches.open(CACHE_VERSION).then(function (cache) {
            return cache.match(CORE_SENTINEL);
        }).then(function (complete) {
            if (!complete) return Promise.resolve();
            return caches.keys().then(function (keys) {
                var stale = keys.filter(function (k) { return k !== CACHE_VERSION; });
                return Promise.all(stale.map(function (k) { return caches.delete(k); }));
            });
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
                // Offline: current generation first, then any older one that
                // activate() deliberately kept, then the shell.
                return matchCurrent(req).then(function (hit) {
                    return hit || matchAnyGeneration(req);
                }).then(function (hit) {
                    if (hit) return hit;
                    return matchCurrent('/index.html').then(function (shell) {
                        return shell || matchAnyGeneration('/index.html');
                    }).then(function (shell) {
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
    // matchCurrent, not caches.match — a retained older generation must never
    // shadow this one, or a corrected fault code never reaches the tech.
    event.respondWith(
        matchCurrent(req).then(function (hit) {
            var net = fetch(req).then(function (res) {
                if (isCacheable(req, res)) {
                    var copy = res.clone();
                    event.waitUntil(cachePut(req, copy));
                }
                return res;
            }).catch(function () {
                // Offline and not in the current generation — fall back to an
                // older one activate() kept rather than failing outright.
                // Never resolve to undefined: respondWith(undefined) throws.
                return hit || matchAnyGeneration(req).then(function (old) {
                    return old || new Response('', { status: 504, statusText: 'Offline' });
                });
            });

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
