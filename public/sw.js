// sw.js — offline support for Marine Tech Pro.
//
// The whole point: techs work on docks and in marina dead zones. The
// reference data (diagnostic trees, specs, fault codes) is static
// client-side JS, so it can be cached and used with no connection.
//
// Strategy:
//   /api/*        -> network only, never cached (auth + live data)
//   HTML pages    -> network first, then the cached copy (current generation,
//                    then a retained older one), then the cached Home shell,
//                    then an offline notice — NO_SHELL pages (/admin and the
//                    public pages) skip the shell and get the notice directly.
//                    Deploys land immediately when online; when a cached copy
//                    exists the network gets HTML_NETWORK_TIMEOUT_MS before
//                    that copy is served, and a 5xx falls back to it too.
//                    /login, /pending and /logout always go to the network.
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

var CACHE_VERSION = 'mtp-v4';

// Core shell — if these are missing, offline is useless. These are the pages
// and data a tech actually opens on a dock, so a cache missing any of them is
// not good enough to replace a previous one (see activate()). The sprite and
// logo belong here too: every core page draws its menu tiles, back arrow and
// brand mark from them, as do the Ask/Feedback buttons, so a shell without
// them is blank boxes offline. /icons is served without auth, so they can
// never follow the 302 that the CORE/EXTRA split exists to survive.
var CORE = [
    '/index.html',
    '/diagnose.html',
    '/fault-codes.html',
    '/specs.html',
    '/css/styles.css',
    '/js/common.js',
    '/js/diagnosticTrees.js',
    '/js/engineSpecs.js',
    '/js/faultcodes.js',
    '/icons/sprite.svg',
    '/icons/logo-256.png'
];
var EXTRA = [
    '/',
    '/js/askTech.js',
    '/js/feedback.js',
    '/manifest.json'
];

// Written into a cache only when its core shell is complete. activate() reads
// it back rather than trusting an in-memory flag, which would not survive the
// worker being killed between install and activate.
var CORE_SENTINEL = '/__mtp-core-complete';

// How long a navigation waits on the network when a cached copy is on hand.
// On a dock with one bar of signal a request often neither succeeds nor fails
// for tens of seconds (OS-level TCP timeout); the tech would stare at a blank
// tab with the page sitting in the cache. Top-level so tests can shorten it.
var HTML_NETWORK_TIMEOUT_MS = 4000;

// Pages a tech never works from on a dock. Answering these with the cached
// Home shell would render the menu under /admin (or a public page) with no
// explanation; an honest offline notice is better than a silent loop.
var NO_SHELL = /^\/(admin|landing|privacy|terms)(\.html)?$/;

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

// The cached copy of req: the current generation (already looked up by the
// caller) or, failing that, an older one activate() deliberately kept.
function cachedCopy(req, current) {
    if (current) return Promise.resolve(current);
    return matchAnyGeneration(req);
}

// Reject after `ms` unless `p` settles first. The timer is cleared as soon as
// `p` settles so a fast network never leaves a stray timer behind.
function withTimeout(p, ms) {
    return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () { reject(new Error('timeout')); }, ms);
        p.then(
            function (v) { clearTimeout(timer); resolve(v); },
            function (e) { clearTimeout(timer); reject(e); }
        );
    });
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

// Fetch CORE + EXTRA into the current generation. Resolves to true only when
// every CORE entry was genuinely stored — and only then writes CORE_SENTINEL.
// Shared by install and MTP_WARM_CACHE: install runs once per sw.js change,
// so it cannot be the only thing that ever fills the shell (see warmCache).
function precacheShell() {
    return caches.open(CACHE_VERSION).then(function (cache) {
        return Promise.all(CORE.map(function (u) { return precacheOne(cache, u); }))
            .then(function (coreResults) {
                // Extras are best-effort and must not fail the install.
                return Promise.all(EXTRA.map(function (u) { return precacheOne(cache, u); }))
                    .then(function () { return coreResults; });
            })
            .then(function (coreResults) {
                var got = coreResults.filter(Boolean).length;
                if (got !== CORE.length) return false;
                // The marker is stored IN the cache, not on `self`, so it
                // survives the worker being torn down between install and
                // activate.
                return cache.put(CORE_SENTINEL, new Response('1')).then(function () { return true; });
            });
    });
}

// Bin every generation but this one. Callers must first confirm this
// generation holds the core shell (CORE_SENTINEL) — otherwise a bad-network
// update leaves a tech with no offline data at all.
function deleteOtherGenerations() {
    return caches.keys().then(function (keys) {
        var stale = keys.filter(function (k) { return k !== CACHE_VERSION; });
        return Promise.all(stale.map(function (k) { return caches.delete(k); }));
    });
}

self.addEventListener('install', function (event) {
    // Signed-out or flaky install: activate anyway, but the sentinel is only
    // written when the shell is complete, so activate() knows not to bin a
    // good previous cache. The next signed-in page posts MTP_WARM_CACHE,
    // which fills the shell then.
    event.waitUntil(precacheShell().then(function () { return self.skipWaiting(); }));
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
            return deleteOtherGenerations();
        }).then(function () { return self.clients.claim(); })
    );
});

// Synthetic page for a navigation that is offline with nothing to show. A
// full document with a viewport meta: without one a phone lays it out at
// ~980px and the text is unreadable. Home is in CORE, so the link works.
function offlineNotice() {
    return new Response(
        '<!DOCTYPE html><html lang="en"><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Offline</title>' +
        '<body style="margin:0;padding:40px 20px;font:18px/1.5 system-ui,sans-serif;text-align:center">' +
        '<h1 style="font-size:1.4em">You\'re offline</h1>' +
        '<p>This page isn\'t saved on this device yet. Open it once while connected ' +
        'and it will work offline next time.</p>' +
        '<p><a href="/index.html" style="display:inline-block;padding:14px 28px;font-weight:600">Back to Home</a></p>' +
        '<p><button type="button" onclick="location.reload()" style="padding:14px 28px;font:inherit">Retry</button></p>',
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
}

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
        var net = fetch(req).then(function (res) {
            if (isCacheable(req, res)) {
                var copy = res.clone();
                event.waitUntil(cachePut(req, copy));
            }
            return res;
        });
        // Keep the refresh alive even when the tech is answered from cache
        // below (timeout): the eventual network copy still lands for next time.
        event.waitUntil(net.catch(function () {}));

        event.respondWith(
            matchCurrent(req).then(function (current) {
                // A retained older generation counts as a cached copy here:
                // it is exactly what the tech gets once the network fails, so
                // it is also what they should get instead of a 30 s stall.
                return cachedCopy(req, current);
            }).then(function (cached) {
                // With a cached copy on hand, stop waiting on a stalled
                // connection after HTML_NETWORK_TIMEOUT_MS. Without one there
                // is nothing better to show, so wait the network out.
                var attempt = cached ? withTimeout(net, HTML_NETWORK_TIMEOUT_MS) : net;
                return attempt.then(function (res) {
                    // A 502/503 from the platform edge mid-redeploy resolves
                    // (ok: false) rather than rejects. Show the cached page
                    // instead of the platform's error page when there is one;
                    // otherwise the real error is more honest than an offline
                    // notice while online.
                    if (res.status >= 500) {
                        return cachedCopy(req, cached).then(function (hit) { return hit || res; });
                    }
                    return res;
                }).catch(function () {
                    // Offline: current generation first, then any older one
                    // that activate() deliberately kept, then the shell.
                    return cachedCopy(req, cached).then(function (hit) {
                        if (hit) return hit;
                        if (NO_SHELL.test(url.pathname)) return offlineNotice();
                        return matchCurrent('/index.html').then(function (shell) {
                            return shell || matchAnyGeneration('/index.html');
                        }).then(function (shell) {
                            return shell || offlineNotice();
                        });
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

// Re-fill the shell on request from a signed-in page. install runs once per
// sw.js change, so after a sign-out purge (MTP_CLEAR_CACHE), or an install
// that ran while signed out and cached nothing, nothing else would ever fetch
// CORE again — a tech who signed back in on dock WiFi would walk to the boat
// with no fault codes. common.js only posts this from authenticated pages, so
// the fetches carry a valid session. A no-op when the sentinel is present, so
// it costs nothing on the usual page load; deduped so two tabs opening at
// once don't download the shell twice (an in-memory flag is fine here — it is
// only an optimisation, unlike CORE_SENTINEL).
var warming = null;
function warmCache() {
    if (warming) return warming;
    warming = caches.open(CACHE_VERSION).then(function (cache) {
        return cache.match(CORE_SENTINEL);
    }).then(function (complete) {
        if (complete) return false;
        return precacheShell().then(function (complete) {
            // Same rule as activate(): older generations go only once this
            // one holds the full shell.
            if (!complete) return false;
            return deleteOtherGenerations().then(function () { return true; });
        });
    }).then(
        function (r) { warming = null; return r; },
        function (e) { warming = null; throw e; }
    );
    return warming;
}

self.addEventListener('message', function (event) {
    var type = event.data && event.data.type;
    // Let the page drop cached content on sign-out (shared devices).
    if (type === 'MTP_CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(function (keys) {
                return Promise.all(keys.map(function (k) { return caches.delete(k); }));
            })
        );
    } else if (type === 'MTP_WARM_CACHE') {
        event.waitUntil(warmCache());
    }
});
