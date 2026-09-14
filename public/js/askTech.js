// js/askTech.js
// Floating "Ask a Tech" widget. Loaded by the four app pages (index, diagnose,
// fault-codes, specs) after js/common.js — not by /admin or /pending.
// - Text Q&A to /api/ask, grounded by server-side knowledge base
// - Voice input: Web Speech API (Chrome/Android + iOS 14.5+ Safari via webkit prefix)
// - Voice output: SpeechSynthesis with best-available native voice selection

(function () {
    'use strict';

    var SP = '/icons/sprite.svg';
    var VOICE_PREF_KEY = 'mtp-voice-pref-v1';
    var RATE_PREF_KEY = 'mtp-voice-rate-v1';
    // Must cover the server's worst case: the SDK gets 60 s per attempt and
    // one retry (server.js), so a first attempt that times out and a retry
    // that succeeds can legitimately finish at ~125 s. Giving up earlier
    // discards an answer the server then bills and logs as delivered. A
    // mobile browser can otherwise leave a dropped request pending far
    // longer than this, with Send disabled the whole time.
    var ASK_TIMEOUT_MS = 130 * 1000;

    // Storage access THROWS (rather than returning null) when site data is
    // blocked for the origin — private mode on some browsers, managed-device
    // WebViews. An uncaught throw mid-mount used to leave a panel with a dead
    // mic, dead voice settings and every queued askTech() call stranded.
    function lsGet(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
    function lsSet(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* ignore */ } }

    // Expose askTech() immediately so callers that fire before mount() still work.
    // Questions queued here get flushed as soon as the widget finishes mounting.
    var _askQueue = [];
    var _askReal = null;
    window.askTech = function (question) {
        if (!question) return;
        if (typeof _askReal === 'function') return _askReal(question);
        _askQueue.push(question);
    };

    // --- VOICE SELECTION ---------------------------------------------------
    // Pick the best-sounding native en-* voice available on the device.
    // Priority:
    //   1. User's saved preference (if still installed)
    //   2. Platform-specific premium voices by name (iOS Siri Enhanced,
    //      Samantha; Android Google en-US/en-GB; Chrome desktop Google voices)
    //   3. Any en-* "localService" voice (bundled, better quality offline)
    //   4. Any en-* voice
    // Returns { voice, allEnglish }.
    function pickBestVoice(voices, savedUri) {
        var english = voices.filter(function (v) {
            return /^en([-_]|$)/i.test(v.lang || '');
        });
        if (english.length === 0) return { voice: null, allEnglish: [] };

        if (savedUri) {
            var saved = english.find(function (v) { return v.voiceURI === savedUri; });
            if (saved) return { voice: saved, allEnglish: english };
        }

        // Platform-specific premium names, ranked best-first.
        var premiumNames = [
            // iOS / macOS — higher-quality variants
            'Ava (Enhanced)', 'Ava (Premium)',
            'Samantha (Enhanced)', 'Samantha (Premium)',
            'Evan (Enhanced)', 'Evan (Premium)',
            'Tom (Enhanced)', 'Tom (Premium)',
            'Nicky (Enhanced)', 'Nicky (Premium)',
            'Ava', 'Samantha', 'Alex', 'Evan', 'Nicky', 'Tom', 'Allison',
            'Karen', 'Daniel',
            // Android / Chrome — Google neural voices
            'Google US English', 'Google UK English Male', 'Google UK English Female',
            'Google en-US', 'Google en-GB',
            // Microsoft Edge online neural
            'Microsoft Aria Online (Natural) - English (United States)',
            'Microsoft Jenny Online (Natural) - English (United States)',
            'Microsoft Guy Online (Natural) - English (United States)'
        ];
        for (var i = 0; i < premiumNames.length; i++) {
            var hit = english.find(function (v) { return v.name === premiumNames[i]; });
            if (hit) return { voice: hit, allEnglish: english };
        }

        // "Enhanced" or "Premium" in name (iOS marks upgraded voices this way)
        var enhanced = english.find(function (v) { return /Enhanced|Premium|Neural|Natural/i.test(v.name); });
        if (enhanced) return { voice: enhanced, allEnglish: english };

        // Prefer a localService voice over cloud; en-US over en-GB; default over not.
        english.sort(function (a, b) {
            var la = a.localService ? 1 : 0;
            var lb = b.localService ? 1 : 0;
            if (la !== lb) return lb - la;
            var ua = /en[-_]US/i.test(a.lang) ? 1 : 0;
            var ub = /en[-_]US/i.test(b.lang) ? 1 : 0;
            if (ua !== ub) return ub - ua;
            var da = a.default ? 1 : 0;
            var db = b.default ? 1 : 0;
            return db - da;
        });
        return { voice: english[0], allEnglish: english };
    }

    // Voice list loads async on some browsers (notably Chrome), and Android /
    // cold-start iOS can take well over a second to report it. Delivers the
    // current list right away, again when the safety timer fires, and again
    // on every later voiceschanged — so cb must be idempotent. A one-shot
    // version used to stop listening after 800 ms; when the engine came up
    // late the voice picker stayed empty and the saved voice was ignored.
    function watchVoices(cb) {
        if (!('speechSynthesis' in window)) return cb([]);
        var synth = window.speechSynthesis;
        var lastCount = -1;
        function deliver() {
            var v = synth.getVoices() || [];
            if (v.length === lastCount) return; // nothing new (Chrome fires the event repeatedly)
            lastCount = v.length;
            cb(v);
        }
        deliver();
        // addEventListener rather than onvoiceschanged= so this neither
        // clobbers nor is clobbered by another listener on the page.
        try { synth.addEventListener('voiceschanged', deliver); }
        catch (_) { synth.onvoiceschanged = deliver; }
        // Safety timer — some browsers never fire the event but do have the
        // list ready shortly after load.
        setTimeout(deliver, 800);
    }

    // Strip characters that make TTS sound robotic / parenthetical.
    function cleanForSpeech(text) {
        if (!text) return '';
        return text
            .replace(/\*/g, '')
            .replace(/_([^_]+)_/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\s*\n\s*[-•]\s*/g, '. ')   // bullets → sentence breaks
            .replace(/\s*\n\s*/g, '. ')
            .replace(/\(([^)]{1,40})\)/g, ', $1,')
            .replace(/\s{2,}/g, ' ')
            .replace(/\.+/g, '.')
            .trim();
    }

    function mount() {
        if (document.getElementById('ask-fab')) return;

        var fab = document.createElement('button');
        fab.id = 'ask-fab';
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Ask a tech question');
        fab.innerHTML = '<svg class="icon"><use href="' + SP + '#i-chat"/></svg>';

        var overlay = document.createElement('div');
        overlay.id = 'ask-overlay';
        overlay.innerHTML = ''
            + '<div id="ask-panel" role="dialog" aria-modal="true" aria-labelledby="ask-title">'
            + '  <div id="ask-header">'
            + '    <div id="ask-title"><svg class="icon"><use href="' + SP + '#i-ai"/></svg> Ask a Tech</div>'
            + '    <div id="ask-header-actions">'
            + '      <button id="ask-voice-settings" type="button" aria-label="Voice settings" title="Voice settings"><svg class="icon"><use href="' + SP + '#i-speaker"/></svg></button>'
            + '      <button id="ask-close" type="button" aria-label="Close"><svg class="icon"><use href="' + SP + '#i-close"/></svg></button>'
            + '    </div>'
            + '  </div>'
            + '  <div id="ask-voice-panel" class="hidden">'
            + '    <label>Voice <select id="ask-voice-select"></select></label>'
            + '    <label>Speed <input type="range" id="ask-voice-rate" min="0.8" max="1.4" step="0.05" value="1.05"> <span id="ask-voice-rate-val">1.05×</span></label>'
            + '    <button id="ask-voice-test" type="button">Test</button>'
            + '  </div>'
            + '  <div id="ask-conversation" role="log" aria-live="polite" aria-relevant="additions"></div>'
            + '  <div id="ask-speaking-bar" class="hidden">'
            + '    <span><span class="speaking-dot"></span>Speaking…</span>'
            + '    <button id="ask-stop-speak" type="button">Stop</button>'
            + '  </div>'
            + '  <div id="ask-input-row">'
            + '    <button id="ask-mic" type="button" aria-label="Voice input" title="Tap to speak"><svg class="icon"><use href="' + SP + '#i-mic"/></svg></button>'
            + '    <textarea id="ask-input" rows="1" aria-label="Your question" placeholder="Ask anything — e.g. How do I purge air from hydraulic steering?"></textarea>'
            + '    <button id="ask-send" type="button" aria-label="Send"><svg class="icon"><use href="' + SP + '#i-send"/></svg></button>'
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
        var speakBar = overlay.querySelector('#ask-speaking-bar');
        var stopSpeakBtn = overlay.querySelector('#ask-stop-speak');
        var voiceSettingsBtn = overlay.querySelector('#ask-voice-settings');
        var voicePanel = overlay.querySelector('#ask-voice-panel');
        var voiceSelect = overlay.querySelector('#ask-voice-select');
        var rateInput = overlay.querySelector('#ask-voice-rate');
        var rateVal = overlay.querySelector('#ask-voice-rate-val');
        var voiceTest = overlay.querySelector('#ask-voice-test');

        var releaseTrap = null;
        function openPanel() {
            if (overlay.classList.contains('open')) return;
            overlay.classList.add('open');
            if (window.MTP && MTP.trapFocus) releaseTrap = MTP.trapFocus(panel, closePanel);
            setTimeout(function () { input.focus(); }, 100);
        }
        function closePanel() {
            if (!overlay.classList.contains('open')) return;
            overlay.classList.remove('open');
            stopSpeaking();
            if (listening) stopListening(true);
            if (releaseTrap) { releaseTrap(); releaseTrap = null; }
        }

        fab.addEventListener('click', openPanel);
        closeBtn.addEventListener('click', closePanel);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) closePanel(); });
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

        // --- VOICE SETTINGS ----------------------------------------------
        var selectedVoice = null;
        var savedRate = parseFloat(lsGet(RATE_PREF_KEY) || '1.05') || 1.05;
        rateInput.value = String(savedRate);
        rateVal.textContent = savedRate.toFixed(2).replace(/\.?0+$/, '') + '×';

        // Idempotent: runs on every voiceschanged. The in-memory choice
        // outranks the stored one so a re-run never undoes a pick the tech
        // just made in the dropdown (storage may be blocked).
        function populateVoices(voices) {
            if (!voices || voices.length === 0) return;
            var preferred = (selectedVoice && selectedVoice.voiceURI) || lsGet(VOICE_PREF_KEY);
            var picked = pickBestVoice(voices, preferred);
            selectedVoice = picked.voice;
            voiceSelect.innerHTML = picked.allEnglish.map(function (v) {
                var label = v.name + ' — ' + v.lang + (v.localService ? ' · device' : '');
                return '<option value="' + v.voiceURI.replace(/"/g,'&quot;') + '"' + (selectedVoice && v.voiceURI === selectedVoice.voiceURI ? ' selected' : '') + '>' + label + '</option>';
            }).join('');
        }

        if (!('speechSynthesis' in window)) {
            voiceSettingsBtn.style.display = 'none';
        } else {
            watchVoices(populateVoices);

            voiceSelect.addEventListener('change', function () {
                var voices = window.speechSynthesis.getVoices() || [];
                var match = voices.find(function (v) { return v.voiceURI === voiceSelect.value; });
                if (match) {
                    selectedVoice = match;
                    lsSet(VOICE_PREF_KEY, match.voiceURI);
                }
            });
            rateInput.addEventListener('input', function () {
                var r = parseFloat(rateInput.value) || 1.0;
                rateVal.textContent = r.toFixed(2).replace(/\.?0+$/, '') + '×';
                lsSet(RATE_PREF_KEY, String(r));
            });
            voiceTest.addEventListener('click', function () {
                speak('Marine tech pro. Voice check. Kill switch off before electrical work.');
            });
            voiceSettingsBtn.addEventListener('click', function () {
                // Last-chance fill for engines that never fire voiceschanged.
                if (!voiceSelect.options.length) populateVoices(window.speechSynthesis.getVoices() || []);
                voicePanel.classList.toggle('hidden');
            });
        }
        stopSpeakBtn.addEventListener('click', stopSpeaking);

        // --- VOICE INPUT (Web Speech API) -------------------------------
        var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        var recognizer = null;
        var listening = false;

        if (!SpeechRec) {
            micBtn.style.display = 'none';
        } else {
            micBtn.addEventListener('click', function () {
                // Tapping the mic while listening CANCELS — it must not submit
                // whatever partial transcript (or pre-existing draft) is in the box.
                if (listening) { stopListening(true); return; }
                startListening();
            });
        }

        function startListening() {
            // Stop any ongoing TTS so we don't feed back into the mic.
            stopSpeaking();
            try {
                recognizer = new SpeechRec();
                // Every handler below checks it still belongs to the live
                // session. abort() dispatches onend/onerror asynchronously,
                // so a stale event from session A (cancelled by a mic tap)
                // could land after session B started and stop() or abort() B
                // — to the tech, the mic "stops working" on the third tap.
                var me = recognizer;
                recognizer.lang = 'en-US';
                recognizer.interimResults = true;
                recognizer.continuous = false;
                recognizer.maxAlternatives = 1;

                var finalText = '';
                var gotAudio = false;
                var cancelled = false;
                var baseline = input.value; // typed draft present before listening
                recognizer.onaudiostart = function () { gotAudio = true; };
                recognizer.onresult = function (e) {
                    if (recognizer !== me) return;
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
                    if (recognizer !== me) return;
                    var code = e && e.error;
                    console.warn('Speech recognition error:', code);
                    // Every failure gets a hint, or the tech taps the mic,
                    // speaks, and sees nothing happen. Only 'aborted' is
                    // silent: that is the browser cancelling on its own (page
                    // hidden, another session) — a mic-tap cancel never gets
                    // here because stopListening() nulls `recognizer` first.
                    var msg = null;
                    if (code === 'not-allowed' || code === 'service-not-allowed') {
                        msg = 'Microphone permission denied. Allow mic access in your browser settings.';
                    } else if (code === 'no-speech') {
                        // ~8 s without speech: engine noise, wind, phone too far.
                        msg = "Didn't catch that — tap the mic and try again.";
                    } else if (code === 'audio-capture') {
                        msg = 'No microphone found.';
                    } else if (code === 'network') {
                        // Chrome/Android recognition is cloud-backed.
                        msg = 'Voice input needs a connection.';
                    } else if (code !== 'aborted') {
                        msg = 'Voice input failed — try again or type your question.';
                    }
                    if (msg) addMsg('error', msg);
                    cancelled = true; // never auto-submit after an error
                    stopListening(true);
                };
                recognizer.onend = function () {
                    if (recognizer !== me) return;
                    // Only auto-submit on a natural end of speech that actually
                    // produced a transcript — never on cancel/error, and never
                    // submit a typed draft the user hadn't sent yet. A cancel
                    // (mic tap, panel close) nulls `recognizer` before this can
                    // fire, so the guard above already rules it out.
                    var spoke = input.value.trim() && input.value !== baseline;
                    if (listening) stopListening(false);
                    if (!cancelled && spoke) submit();
                };
                recognizer.start();
                listening = true;
                micBtn.classList.add('listening');
                micBtn.setAttribute('aria-label', 'Stop listening');
            } catch (err) {
                console.warn('Could not start speech recognition:', err);
                recognizer = null;
                listening = false;
            }
        }

        function stopListening(cancel) {
            if (recognizer) {
                var r = recognizer;
                // Null first, so any event abort()/stop() dispatches is seen
                // as stale by the session's own handlers.
                recognizer = null;
                // abort() discards the session without firing a final result;
                // stop() would finalize and let onend auto-submit.
                try { cancel ? r.abort() : r.stop(); } catch (e) { /* ignore */ }
            }
            listening = false;
            micBtn.classList.remove('listening');
            micBtn.setAttribute('aria-label', 'Voice input');
        }

        // --- READ-ALOUD (SpeechSynthesis) ---------------------------------
        function speak(text) {
            if (!('speechSynthesis' in window)) return;
            try {
                window.speechSynthesis.cancel();
                var cleaned = cleanForSpeech(text);
                if (!cleaned) return;
                var u = new SpeechSynthesisUtterance(cleaned);
                // The list may have arrived after mount without an event.
                if (!selectedVoice) populateVoices(window.speechSynthesis.getVoices() || []);
                if (selectedVoice) { u.voice = selectedVoice; u.lang = selectedVoice.lang || 'en-US'; }
                else u.lang = 'en-US';
                u.rate  = parseFloat(rateInput.value) || 1.05;
                u.pitch = 1.0;
                u.volume = 1.0;
                u.onstart = function () { speakBar.classList.remove('hidden'); };
                u.onend   = function () { speakBar.classList.add('hidden'); };
                u.onerror = function () { speakBar.classList.add('hidden'); };
                // iOS Safari bug workaround: sometimes speak() silently no-ops
                // if speechSynthesis was "paused". Resume first.
                try { window.speechSynthesis.resume(); } catch (_) {}
                window.speechSynthesis.speak(u);
            } catch (e) { /* ignore */ }
        }
        function stopSpeaking() {
            if ('speechSynthesis' in window) {
                try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
            }
            speakBar.classList.add('hidden');
        }

        // --- CONTEXT DETECTION --------------------------------------------
        function detectContext() {
            var ctx = {};
            if (window.__currentDiagTree && window.__currentDiagNode) {
                ctx.tree = window.__currentDiagTree;
                ctx.node = window.__currentDiagNode;
            }
            return ctx;
        }

        // --- SUBMIT --------------------------------------------------------
        function addMsg(cls, text) {
            var div = document.createElement('div');
            div.className = 'ask-msg ' + cls;
            div.textContent = text;
            convo.appendChild(div);
            convo.scrollTop = convo.scrollHeight;
            return div;
        }

        function addReadAloudButton(msg, text) {
            if (!('speechSynthesis' in window)) return;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ask-read-btn';
            btn.innerHTML = '<svg class="icon icon-sm"><use href="' + SP + '#i-speaker"/></svg>Read aloud';
            btn.addEventListener('click', function () { speak(text); });
            msg.appendChild(document.createElement('br'));
            msg.appendChild(btn);
        }

        // Wire up the real askTech implementation and flush any queued calls.
        // Callers (diagnose.html's "Explain this step" button) fire this at
        // will, so it must not clobber what the tech is doing: a question
        // arriving while one is in flight waits in _askQueue and is sent from
        // done() (it used to hit the busy guard and silently sit in the box);
        // a question arriving over an unsent draft goes under the draft for
        // the tech to send or edit, rather than replacing it.
        var busy = false;
        _askReal = function (question) {
            question = String(question);
            openPanel();
            if (busy) {
                if (_askQueue.indexOf(question) === -1) _askQueue.push(question);
                return;
            }
            var draft = input.value.trim();
            if (draft && draft !== question) {
                input.value = draft + '\n' + question;
                input.dispatchEvent(new Event('input'));
                return;
            }
            input.value = question;
            input.dispatchEvent(new Event('input'));
            setTimeout(function () { submit(); }, 120);
        };
        while (_askQueue.length) _askReal(_askQueue.shift());

        function submit() {
            if (busy) return; // Enter key must not stack requests while one is in flight
            var q = input.value.trim();
            if (!q) return;
            busy = true;
            input.value = '';
            input.style.height = 'auto';
            addMsg('user', q);
            var thinking = addMsg('thinking', 'Thinking…');
            sendBtn.disabled = true;

            // Guarded: a very old WebView without AbortController just gets
            // the previous unbounded fetch.
            var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
            var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ASK_TIMEOUT_MS) : null;

            var finished = false;
            function done() {
                if (finished) return; // the trailing catch can run after a throw in the success branch
                finished = true;
                clearTimeout(timer);
                thinking.remove();
                sendBtn.disabled = false;
                busy = false;
                // A question handed to askTech() while we were busy goes next.
                if (_askQueue.length) _askReal(_askQueue.shift());
            }
            // Put a failed question back so one tap on Send retries it —
            // but never over something the tech typed while waiting (or a
            // question done() just queued up).
            function restoreDraft() {
                if (input.value.trim()) return;
                input.value = q;
                input.dispatchEvent(new Event('input'));
            }

            var opts = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q, context: detectContext() })
            };
            if (ctrl) opts.signal = ctrl.signal;

            fetch('/api/ask', opts)
                .then(function (r) {
                    // Non-JSON bodies (proxy errors, redirects) must not be
                    // misreported as network failures — keep the status.
                    return r.json()
                        .then(function (j) { return { status: r.status, body: j }; })
                        .catch(function (err) {
                            // …but a timeout that hits mid-body is still a timeout.
                            if (err && err.name === 'AbortError') throw err;
                            return { status: r.status, body: null };
                        });
                })
                .then(function (res) {
                    done();
                    if (res.body && res.body.success) {
                        var msg = addMsg('ai', res.body.answer);
                        if (res.body.truncated) {
                            // Thinking shares max_tokens on Sonnet 5, so the
                            // server can deliver a usable-but-cut answer. A
                            // procedure that stops mid-step must not read as
                            // complete.
                            var note = document.createElement('div');
                            note.className = 'ask-truncated';
                            note.textContent = 'Answer was cut short — ask a narrower question for the rest.';
                            msg.appendChild(note);
                        }
                        addReadAloudButton(msg, res.body.answer);
                    } else if (res.status === 401) {
                        addMsg('error', 'Session expired. Refresh the page and sign in again.');
                        restoreDraft();
                    } else if (res.status === 429) {
                        addMsg('error', (res.body && res.body.message) || 'Too many requests — wait a minute and try again.');
                        restoreDraft();
                    } else {
                        addMsg('error', (res.body && res.body.message) || 'Something went wrong (HTTP ' + res.status + '). Try again.');
                        restoreDraft();
                    }
                })
                .catch(function (err) {
                    done();
                    if (err && err.name === 'AbortError') {
                        addMsg('error', 'The AI took too long. Try again.');
                    } else {
                        addMsg('error', 'Network error. Check connection and try again.');
                    }
                    restoreDraft();
                });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
