// js/replies.js
// Shows admin replies to feedback the current tech submitted.
// Polls /api/me/replies on load; renders a small banner above the feedback FAB.
// Tech can dismiss (acks the reply) or open the original context link.

(function () {
    'use strict';

    var SP = '/icons/sprite.svg';
    var POLL_MS = 60 * 1000;

    function fmtTime(ts) {
        var diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return new Date(ts).toLocaleDateString();
    }

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    var stack;
    function ensureStack() {
        if (stack) return stack;
        stack = document.createElement('div');
        stack.id = 'reply-stack';
        document.body.appendChild(stack);
        return stack;
    }

    function ack(id, cardEl) {
        fetch('/api/me/replies/' + id + '/ack', { method: 'POST' })
            .catch(function () {});
        cardEl.classList.add('dismissing');
        setTimeout(function () { cardEl.remove(); }, 220);
    }

    function render(reply) {
        var card = document.createElement('div');
        card.className = 'reply-card';
        var ctxBits = [];
        if (reply.ctx_tree) {
            ctxBits.push('Tree: ' + reply.ctx_tree + (reply.ctx_node ? ' / ' + reply.ctx_node : ''));
        } else if (reply.page_url) {
            ctxBits.push(reply.page_url);
        }
        var ctxLine = ctxBits.length ? '<div class="reply-ctx">' + esc(ctxBits.join(' · ')) + '</div>' : '';

        card.innerHTML = ''
            + '<div class="reply-head">'
            + '  <span class="reply-title"><svg class="icon"><use href="' + SP + '#i-check"/></svg> Update on your feedback</span>'
            + '  <button type="button" class="reply-close" aria-label="Dismiss"><svg class="icon"><use href="' + SP + '#i-close"/></svg></button>'
            + '</div>'
            + '<div class="reply-body">' + esc(reply.admin_reply) + '</div>'
            + ctxLine
            + '<div class="reply-meta">' + esc(fmtTime(reply.admin_reply_at)) + '</div>';

        card.querySelector('.reply-close').addEventListener('click', function () {
            ack(reply.id, card);
        });
        return card;
    }

    var seenIds = {};
    function load() {
        fetch('/api/me/replies', { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
                if (!d || !d.success || !Array.isArray(d.replies) || !d.replies.length) return;
                var s = ensureStack();
                d.replies.forEach(function (rep) {
                    if (seenIds[rep.id]) return;
                    seenIds[rep.id] = true;
                    s.appendChild(render(rep));
                });
            })
            .catch(function () {});
    }

    function start() {
        load();
        setInterval(load, POLL_MS);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
