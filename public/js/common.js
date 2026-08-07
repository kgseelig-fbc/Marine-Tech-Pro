// js/common.js — shared page shell helpers.
//
// Everything here used to be copy-pasted per page: the beacon fetch lived in
// three inline scripts, logout in three more, and the HTML escaper was
// private to feedback.js while every data-rendering page needed one.
//
// Exposes window.MTP = { beacon, logout, esc, trapFocus }.

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

    // POST-only logout (a GET that destroys the session is CSRF-able).
    // Also drops the service-worker cache so app pages and reference data
    // don't survive a sign-out on a shared device.
    MTP.logout = function () {
        return fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
            .catch(function () {})
            .then(function () {
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
            })
            .then(function () { window.location.replace('/login'); });
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
        });
    }
})();
