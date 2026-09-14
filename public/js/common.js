// js/common.js — shared page shell helpers.
//
// Everything here used to be copy-pasted per page: the beacon fetch lived in
// three inline scripts, logout in three more, and the HTML escaper was
// private to feedback.js while every data-rendering page needed one.
//
// Exposes window.MTP = { beacon, logout, esc, trapFocus, toast }.

(function () {
    'use strict';

    var MTP = window.MTP || {};

    // Fire-and-forget analytics beacon. Never throws, never blocks.
    MTP.beacon = function (kind, data) {
        try {
            fetch('/api/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: kind, data: data || null }),
                credentials: 'same-origin',
                keepalive: true
            }).catch(function () {});
        } catch (_) {}
    };

    // Small dismissable notice for things a page has no status line for
    // (e.g. a sign-out that could not reach the server). One at a time; a
    // new call replaces the previous toast. Never throws.
    MTP.toast = function (message) {
        try {
            var old = document.getElementById('mtp-toast');
            if (old && old.parentNode) old.parentNode.removeChild(old);
            var el = document.createElement('div');
            el.id = 'mtp-toast';
            el.className = 'mtp-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            var text = document.createElement('span');
            text.textContent = message;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Dismiss');
            btn.innerHTML = '&times;';
            var timer = null;
            var dismiss = function () {
                clearTimeout(timer);
                if (el.parentNode) el.parentNode.removeChild(el);
            };
            btn.addEventListener('click', dismiss);
            el.appendChild(text);
            el.appendChild(btn);
            document.body.appendChild(el);
            timer = setTimeout(dismiss, 8000);
        } catch (_) {}
    };

    // Drop the service-worker cache so app pages and reference data don't
    // survive a sign-out on a shared device. Resolves even if nothing could
    // be cleared — a failed purge must not block the sign-out itself.
    function clearOfflineCaches() {
        try {
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'MTP_CLEAR_CACHE' });
            }
            if (window.caches && caches.keys) {
                return caches.keys()
                    .then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })
                    .catch(function () {});
            }
        } catch (_) {}
        return Promise.resolve();
    }

    // POST-only logout (a GET that destroys the session is CSRF-able).
    // The cache purge and the trip to /login happen ONLY after the server
    // confirmed the session is gone. If the POST never got there (no signal
    // on the dock) we used to wipe every cached tree and fault code, leave
    // the session alive, and navigate to /login — which the worker does not
    // serve offline — stranding the tech on the browser's error page. Now a
    // failed sign-out changes nothing and says so.
    MTP.logout = function () {
        return fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
            .then(function (r) {
                if (!r || !r.ok) throw new Error('HTTP ' + (r && r.status));
                return clearOfflineCaches();
            })
            .then(function () { window.location.replace('/login'); }, function (err) {
                var msg = (err && /^HTTP \d/.test(err.message))
                    ? 'Sign-out failed (' + err.message + '). Try again.'
                    : "You're offline — sign out when you have signal.";
                MTP.toast(msg);
            });
    };

    // HTML-escape a value for safe interpolation into innerHTML.
    MTP.esc = function (s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    };

    // Modal focus management: trap Tab inside `panel` while open, close on
    // Escape, and restore focus to whatever opened it.
    // Returns a function that tears the handlers down.
    MTP.trapFocus = function (panel, onClose) {
        var previouslyFocused = document.activeElement;
        var SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

        function focusable() {
            return Array.prototype.filter.call(
                panel.querySelectorAll(SELECTOR),
                function (el) { return el.offsetParent !== null; }
            );
        }

        function onKeydown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (typeof onClose === 'function') onClose();
                return;
            }
            if (e.key !== 'Tab') return;
            var items = focusable();
            if (!items.length) return;
            var first = items[0];
            var last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', onKeydown, true);

        return function release() {
            document.removeEventListener('keydown', onKeydown, true);
            if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                previouslyFocused.focus();
            }
        };
    };

    window.MTP = MTP;

    // Register the service worker so reference data works offline.
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').catch(function (err) {
                console.warn('Service worker registration failed:', err);
            });
            // Ask the active worker to (re)fill the offline shell. Its
            // install step only runs once per sw.js byte-change, so a cache
            // emptied by a sign-out — or left incomplete because the deploy
            // landed while the tech was signed out and every precache
            // followed the auth 302 — would otherwise stay empty until the
            // next deploy. This file only runs on authenticated pages, so the
            // worker's fetches carry a valid session. Best effort: a page
            // must never fail to load because warming did.
            try {
                navigator.serviceWorker.ready.then(function (reg) {
                    if (reg && reg.active) reg.active.postMessage({ type: 'MTP_WARM_CACHE' });
                }).catch(function () {});
            } catch (_) {}
        });
    }
})();
