// js/feedback.js
// Floating feedback widget. Included on every authenticated page.
// Tech submits a short report categorized as bug / feedback / enhancement.
// Auto-captures page URL and current diagnostic context when present.

(function () {
    'use strict';

    var SP = '/icons/sprite.svg';

    function mount() {
        if (document.getElementById('fb-fab')) return;

        var fab = document.createElement('button');
        fab.id = 'fb-fab';
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Send feedback');
        fab.setAttribute('title', 'Send feedback');
        fab.innerHTML = '<svg class="icon"><use href="' + SP + '#i-alert"/></svg>';

        var overlay = document.createElement('div');
        overlay.id = 'fb-overlay';
        overlay.innerHTML = ''
            + '<div id="fb-panel">'
            + '  <div id="fb-header">'
            + '    <div id="fb-title"><svg class="icon"><use href="' + SP + '#i-alert"/></svg> Send feedback</div>'
            + '    <button id="fb-close" type="button" aria-label="Close"><svg class="icon"><use href="' + SP + '#i-close"/></svg></button>'
            + '  </div>'
            + '  <div id="fb-body">'
            + '    <label class="fb-label">Type</label>'
            + '    <div id="fb-cat-row">'
            + '      <button type="button" class="fb-cat active" data-cat="bug">Bug / error</button>'
            + '      <button type="button" class="fb-cat" data-cat="feedback">Feedback</button>'
            + '      <button type="button" class="fb-cat" data-cat="enhancement">Enhancement</button>'
            + '    </div>'
            + '    <label class="fb-label" for="fb-msg">Details</label>'
            + '    <textarea id="fb-msg" rows="5" placeholder="What happened, what you expected, or what would help…" maxlength="4000"></textarea>'
            + '    <div id="fb-meta"></div>'
            + '    <div id="fb-status"></div>'
            + '    <div id="fb-actions">'
            + '      <button type="button" id="fb-cancel" class="fb-btn">Cancel</button>'
            + '      <button type="button" id="fb-send" class="fb-btn primary">Send</button>'
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

        fab.addEventListener('click', open);
        closeBtn.addEventListener('click', close);
        cancelBtn.addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        panel.addEventListener('click', function (e) { e.stopPropagation(); });

        catButtons.forEach(function (b) {
            b.addEventListener('click', function () { setCategory(b.getAttribute('data-cat')); });
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
