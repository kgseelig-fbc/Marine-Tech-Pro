// js/askTech.js
// Floating "Ask a Tech" widget. Included on every authenticated page.
// - Text Q&A to /api/ask, grounded by server-side knowledge base
// - Voice input via Web Speech API (Phase 3)
// - Read-aloud answers via SpeechSynthesis (Phase 3)

(function () {
    'use strict';

    function mount() {
        if (document.getElementById('ask-fab')) return;

        var fab = document.createElement('button');
        fab.id = 'ask-fab';
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Ask a tech question');
        fab.textContent = '💬';

        var overlay = document.createElement('div');
        overlay.id = 'ask-overlay';
        overlay.innerHTML = ''
            + '<div id="ask-panel">'
            + '  <div id="ask-header">'
            + '    <div id="ask-title">Ask a Tech</div>'
            + '    <button id="ask-close" type="button" aria-label="Close">×</button>'
            + '  </div>'
            + '  <div id="ask-conversation"></div>'
            + '  <div id="ask-input-row">'
            + '    <button id="ask-mic" type="button" aria-label="Voice input" title="Hold to speak">🎤</button>'
            + '    <textarea id="ask-input" rows="1" placeholder="Ask anything — e.g. How do I purge air from hydraulic steering?"></textarea>'
            + '    <button id="ask-send" type="button">Send</button>'
            + '  </div>'
            + '  <div id="ask-hint">Answers from Marine Tech Pro AI. Verify critical specs against OEM manual.</div>'
            + '</div>';

        document.body.appendChild(fab);
        document.body.appendChild(overlay);

        var panel = overlay.querySelector('#ask-panel');
        var closeBtn = overlay.querySelector('#ask-close');
        var convo = overlay.querySelector('#ask-conversation');
        var input = overlay.querySelector('#ask-input');
        var sendBtn = overlay.querySelector('#ask-send');
        var micBtn = overlay.querySelector('#ask-mic');

        fab.addEventListener('click', function () { overlay.classList.add('open'); setTimeout(function () { input.focus(); }, 100); });
        closeBtn.addEventListener('click', function () { overlay.classList.remove('open'); stopSpeaking(); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.classList.remove('open'); stopSpeaking(); } });
        panel.addEventListener('click', function (e) { e.stopPropagation(); });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
            }
        });
        input.addEventListener('input', function () {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });
        sendBtn.addEventListener('click', submit);

        // --- VOICE INPUT (Web Speech API) ---
        var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        var recognizer = null;
        var listening = false;

        if (!SpeechRec) {
            micBtn.style.display = 'none';
        } else {
            micBtn.addEventListener('click', function () {
                if (listening) { stopListening(); return; }
                startListening();
            });
        }

        function startListening() {
            try {
                recognizer = new SpeechRec();
                recognizer.lang = 'en-US';
                recognizer.interimResults = true;
                recognizer.continuous = false;
                recognizer.maxAlternatives = 1;

                var finalText = '';
                recognizer.onresult = function (e) {
                    var interim = '';
                    for (var i = e.resultIndex; i < e.results.length; i++) {
                        var r = e.results[i];
                        if (r.isFinal) finalText += r[0].transcript;
                        else interim += r[0].transcript;
                    }
                    input.value = (finalText + interim).trim();
                    input.dispatchEvent(new Event('input'));
                };
                recognizer.onerror = function (e) {
                    console.warn('Speech recognition error:', e.error);
                    stopListening();
                };
                recognizer.onend = function () {
                    stopListening();
                    if (input.value.trim()) submit();
                };
                recognizer.start();
                listening = true;
                micBtn.classList.add('listening');
                micBtn.textContent = '⏹';
            } catch (err) {
                console.warn('Could not start speech recognition:', err);
                listening = false;
            }
        }

        function stopListening() {
            if (recognizer) {
                try { recognizer.stop(); } catch (e) { /* ignore */ }
                recognizer = null;
            }
            listening = false;
            micBtn.classList.remove('listening');
            micBtn.textContent = '🎤';
        }

        // --- READ-ALOUD (SpeechSynthesis) ---
        function speak(text) {
            if (!('speechSynthesis' in window)) return;
            try {
                window.speechSynthesis.cancel();
                var u = new SpeechSynthesisUtterance(text);
                u.lang = 'en-US';
                u.rate = 1.0;
                u.pitch = 1.0;
                window.speechSynthesis.speak(u);
            } catch (e) { /* ignore */ }
        }
        function stopSpeaking() {
            if ('speechSynthesis' in window) {
                try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
            }
        }

        // --- CONTEXT DETECTION ---
        function detectContext() {
            // diagnose.html exposes currentTree / currentNodeId as locals — we can't read them.
            // But we can inspect the breadcrumb / tree-key stored on window if set.
            var ctx = {};
            if (window.__currentDiagTree && window.__currentDiagNode) {
                ctx.tree = window.__currentDiagTree;
                ctx.node = window.__currentDiagNode;
            }
            return ctx;
        }

        // --- SUBMIT ---
        function addMsg(cls, text) {
            var div = document.createElement('div');
            div.className = 'ask-msg ' + cls;
            div.textContent = text;
            convo.appendChild(div);
            convo.scrollTop = convo.scrollHeight;
            return div;
        }

        function submit() {
            var q = input.value.trim();
            if (!q) return;
            input.value = '';
            input.style.height = 'auto';
            addMsg('user', q);
            var thinking = addMsg('thinking', 'Thinking…');
            sendBtn.disabled = true;

            fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q, context: detectContext() })
            })
                .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
                .then(function (res) {
                    thinking.remove();
                    sendBtn.disabled = false;
                    if (res.body && res.body.success) {
                        var msg = addMsg('ai', res.body.answer);
                        // Add small "speak" button
                        var btn = document.createElement('button');
                        btn.type = 'button';
                        btn.textContent = '🔊 Read aloud';
                        btn.style.cssText = 'margin-top:8px;background:none;border:1px solid #ccc;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:#555;';
                        btn.addEventListener('click', function () { speak(res.body.answer); });
                        msg.appendChild(document.createElement('br'));
                        msg.appendChild(btn);
                    } else {
                        addMsg('error', (res.body && res.body.message) || 'Something went wrong.');
                    }
                })
                .catch(function () {
                    thinking.remove();
                    sendBtn.disabled = false;
                    addMsg('error', 'Network error. Check connection and try again.');
                });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
