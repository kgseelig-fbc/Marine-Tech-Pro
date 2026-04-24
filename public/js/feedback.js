// js/feedback.js
// Floating feedback widget with three tabs:
//   - Submit:       new bug/feedback/enhancement report
//   - My reports:   current tech's submissions with live status + admin note
//   - Known issues: pinned issues all techs should know about

(function () {
    'use strict';

    var SP = '/icons/sprite.svg';

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function fmtTime(ts) {
        if (!ts) return '';
        var diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        var d = new Date(ts);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function statusPill(status) {
        var cls = { 'new': 'warn', 'in_progress': 'ai', 'resolved': 'ok', 'wont_fix': 'muted' }[status] || '';
        var label = (status || '').replace('_', ' ');
        return '<span class="pill ' + cls + '">' + esc(label) + '</span>';
    }

    function mount() {
        if (document.getElementById('fb-fab')) return;

        var fab = document.createElement('button');
        fab.id = 'fb-fab';
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Feedback');
        fab.setAttribute('title', 'Feedback');
        fab.innerHTML = '<svg class="icon"><use href="' + SP + '#i-alert"/></svg>';

        var overlay = document.createElement('div');
        overlay.id = 'fb-overlay';
        overlay.innerHTML = ''
            + '<div id="fb-panel">'
            + '  <div id="fb-header">'
            + '    <div id="fb-title"><svg class="icon"><use href="' + SP + '#i-alert"/></svg> Feedback</div>'
            + '    <button id="fb-close" type="button" aria-label="Close"><svg class="icon"><use href="' + SP + '#i-close"/></svg></button>'
            + '  </div>'
            + '  <div id="fb-tabs">'
            + '    <button type="button" class="fb-tab active" data-tab="submit">Submit</button>'
            + '    <button type="button" class="fb-tab" data-tab="mine">My reports</button>'
            + '    <button type="button" class="fb-tab" data-tab="known">Known issues</button>'
            + '  </div>'
            + '  <div id="fb-body">'
            + '    <div class="fb-tabpane active" data-pane="submit">'
            + '      <label class="fb-label">Type</label>'
            + '      <div id="fb-cat-row">'
            + '        <button type="button" class="fb-cat active" data-cat="bug">Bug / error</button>'
            + '        <button type="button" class="fb-cat" data-cat="feedback">Feedback</button>'
            + '        <button type="button" class="fb-cat" data-cat="enhancement">Enhancement</button>'
            + '      </div>'
            + '      <label class="fb-label" for="fb-msg">Details</label>'
            + '      <textarea id="fb-msg" rows="5" placeholder="What happened, what you expected, or what would help…" maxlength="4000"></textarea>'
            + '      <div id="fb-meta"></div>'
            + '      <div id="fb-status"></div>'
            + '      <div id="fb-actions">'
            + '        <button type="button" id="fb-cancel" class="fb-btn">Cancel</button>'
            + '        <button type="button" id="fb-send" class="fb-btn primary">Send</button>'
            + '      </div>'
            + '    </div>'
            + '    <div class="fb-tabpane" data-pane="mine">'
            + '      <div class="fb-list" id="fb-mine-list"><div class="fb-empty">Loading…</div></div>'
            + '    </div>'
            + '    <div class="fb-tabpane" data-pane="known">'
            + '      <div class="fb-list" id="fb-known-list"><div class="fb-empty">Loading…</div></div>'
            + '    </div>'
            + '  </div>'
            + '</div>';

        document.body.appendChild(fab);
        document.body.appendChild(overlay);

        var panel = overlay.querySelector('#fb-panel');
        var closeBtn = overlay.querySelector('#fb-close');
        var cancelBtn = overlay.querySelector('#fb-cancel');
        var sendBtn = overlay.querySelector('#fb-send');
        var msgInput = overlay.querySelector('#fb-msg');
        var metaEl = overlay.querySelector('#fb-meta');
        var statusEl = overlay.querySelector('#fb-status');
        var catButtons = overlay.querySelectorAll('.fb-cat');
        var tabButtons = overlay.querySelectorAll('.fb-tab');
        var panes = overlay.querySelectorAll('.fb-tabpane');
        var mineList = overlay.querySelector('#fb-mine-list');
        var knownList = overlay.querySelector('#fb-known-list');
        var currentCat = 'bug';

        function open() {
            overlay.classList.add('open');
            statusEl.textContent = '';
            statusEl.className = '';
            updateMeta();
            setTimeout(function () { msgInput.focus(); }, 100);
        }
        function close() {
            overlay.classList.remove('open');
        }

        function updateMeta() {
            var bits = [];
            var path = window.location.pathname + (window.location.search || '');
            bits.push('Page: ' + path);
            if (window.__currentDiagTree) {
                bits.push('Tree: ' + window.__currentDiagTree + (window.__currentDiagNode ? ' / ' + window.__currentDiagNode : ''));
            }
            metaEl.textContent = bits.join(' · ');
        }

        function setCategory(cat) {
            currentCat = cat;
            catButtons.forEach(function (b) {
                b.classList.toggle('active', b.getAttribute('data-cat') === cat);
            });
        }

        function setTab(name) {
            tabButtons.forEach(function (b) {
                b.classList.toggle('active', b.getAttribute('data-tab') === name);
            });
            panes.forEach(function (p) {
                p.classList.toggle('active', p.getAttribute('data-pane') === name);
            });
            if (name === 'mine') loadMine();
            if (name === 'known') loadKnown();
        }

        fab.addEventListener('click', open);
        closeBtn.addEventListener('click', close);
        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        panel.addEventListener('click', function (e) { e.stopPropagation(); });

        catButtons.forEach(function (b) {
            b.addEventListener('click', function () { setCategory(b.getAttribute('data-cat')); });
        });
        tabButtons.forEach(function (b) {
            b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
        });

        msgInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
            }
        });

        sendBtn.addEventListener('click', submit);

        function submit() {
            var msg = msgInput.value.trim();
            if (!msg || msg.length < 3) {
                statusEl.textContent = 'Please add a short description.';
                statusEl.className = 'err';
                return;
            }
            sendBtn.disabled = true;
            statusEl.textContent = 'Sending…';
            statusEl.className = '';

            var payload = {
                category: currentCat,
                message: msg,
                context: {
                    page_url: window.location.pathname + (window.location.search || ''),
                    tree: window.__currentDiagTree || null,
                    node: window.__currentDiagNode || null
                }
            };

            fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
                .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
                .then(function (res) {
                    sendBtn.disabled = false;
                    if (res.body && res.body.success) {
                        statusEl.textContent = 'Thanks — feedback received.';
                        statusEl.className = 'ok';
                        msgInput.value = '';
                        setTimeout(close, 1200);
                    } else {
                        statusEl.textContent = (res.body && res.body.message) || 'Failed to send.';
                        statusEl.className = 'err';
                    }
                })
                .catch(function () {
                    sendBtn.disabled = false;
                    statusEl.textContent = 'Network error. Try again.';
                    statusEl.className = 'err';
                });
        }

        function renderItem(row, opts) {
            opts = opts || {};
            var ctxBits = [];
            if (row.ctx_tree) ctxBits.push('tree: ' + row.ctx_tree + (row.ctx_node ? ' / ' + row.ctx_node : ''));
            else if (row.page_url && !opts.hidePath) ctxBits.push(row.page_url);
            var ctx = ctxBits.length ? '<div class="fb-item-ctx">' + esc(ctxBits.join(' · ')) + '</div>' : '';
            var reply = row.admin_reply
                ? '<div class="fb-item-reply"><div class="fb-item-reply-label">Note from admin</div>'
                  + '<div class="fb-item-reply-body">' + esc(row.admin_reply) + '</div>'
                  + (row.admin_reply_at ? '<div class="fb-item-reply-ts">' + esc(fmtTime(row.admin_reply_at)) + '</div>' : '')
                  + '</div>'
                : '';
            var resolvedLine = row.resolved_at
                ? '<span class="fb-item-ts"> · resolved ' + esc(fmtTime(row.resolved_at)) + '</span>'
                : '';
            var catBadge = opts.hideCategory ? '' :
                '<span class="fb-item-cat">' + esc(row.category || '') + '</span>';
            return '<div class="fb-item">'
                +    '<div class="fb-item-head">'
                +      statusPill(row.status)
                +      catBadge
                +      '<span class="fb-item-ts">' + esc(fmtTime(row.ts)) + resolvedLine + '</span>'
                +    '</div>'
                +    '<div class="fb-item-msg">' + esc(row.message) + '</div>'
                +    ctx
                +    reply
                +  '</div>';
        }

        function loadMine() {
            mineList.innerHTML = '<div class="fb-empty">Loading…</div>';
            fetch('/api/me/feedback', { credentials: 'same-origin' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (d) {
                    if (!d || !d.success) {
                        mineList.innerHTML = '<div class="fb-empty">Unable to load.</div>';
                        return;
                    }
                    var rows = d.feedback || [];
                    if (!rows.length) {
                        mineList.innerHTML = '<div class="fb-empty">You haven’t submitted anything yet.</div>';
                        return;
                    }
                    mineList.innerHTML = rows.map(function (r) { return renderItem(r, {}); }).join('');
                })
                .catch(function () {
                    mineList.innerHTML = '<div class="fb-empty">Network error.</div>';
                });
        }

        function loadKnown() {
            knownList.innerHTML = '<div class="fb-empty">Loading…</div>';
            fetch('/api/known-issues', { credentials: 'same-origin' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (d) {
                    if (!d || !d.success) {
                        knownList.innerHTML = '<div class="fb-empty">Unable to load.</div>';
                        return;
                    }
                    var rows = d.issues || [];
                    if (!rows.length) {
                        knownList.innerHTML = '<div class="fb-empty">No known issues right now.</div>';
                        return;
                    }
                    knownList.innerHTML = rows.map(function (r) {
                        return renderItem(r, { hidePath: true, hideCategory: true });
                    }).join('');
                })
                .catch(function () {
                    knownList.innerHTML = '<div class="fb-empty">Network error.</div>';
                });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
