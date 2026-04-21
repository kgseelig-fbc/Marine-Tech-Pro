// js/askTech.js
// Floating "Ask a Tech" widget. Included on every authenticated page.
// - Text Q&A to /api/ask, grounded by server-side knowledge base
// - Voice input: Web Speech API (Chrome/Android + iOS 14.5+ Safari via webkit prefix)
// - Voice output: SpeechSynthesis with best-available native voice selection

(function () {
    'use strict';

    var SP = '/icons/sprite.svg';
    var VOICE_PREF_KEY = 'mtp-voice-pref-v1';
    var RATE_PREF_KEY = 'mtp-voice-rate-v1';

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

    // Voice list loads async on some browsers (notably Chrome).
    function getVoices(cb) {
        if (!('speechSynthesis' in window)) return cb([]);
        var v = window.speechSynthesis.getVoices();
        if (v && v.length) return cb(v);
        var done = false;
        window.speechSynthesis.onvoiceschanged = function () {
            if (done) return;
            done = true;
            cb(window.speechSynthesis.getVoices() || []);
        };
        // Safety timeout — some browsers never fire the event.
        setTimeout(function () {
            if (done) return;
            done = true;
            cb(window.speechSynthesis.getVoices() || []);
        }, 800);
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
            + '<div id="ask-panel">'
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
            + '  <div id="ask-conversation"></div>'
            + '  <div id="ask-speaking-bar" class="hidden">'
            + '    <span><span class="speaking-dot"></span>Speaking…</span>'
            + '    <button id="ask-stop-speak" type="button">Stop</button>'
            + '  </div>'
            + '  <div id="ask-input-row">'
            + '    <button id="ask-mic" type="button" aria-label="Voice input" title="Tap to speak"><svg class="icon"><use href="' + SP + '#i-mic"/></svg></button>'
            + '    <textarea id="ask-input" rows="1" placeholder="Ask anything — e.g. How do I purge air from hydraulic steering?"></textarea>'
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

        // --- VOICE SETTINGS ----------------------------------------------
        var selectedVoice = null;
        var savedRate = parseFloat(localStorage.getItem(RATE_PREF_KEY) || '1.05') || 1.05;
        rateInput.value = String(savedRate);
        rateVal.textContent = savedRate.toFixed(2).replace(/\.?0+$/, '') + '×';

        if (!('speechSynthesis' in window)) {
            voiceSettingsBtn.style.display = 'none';
        } else {
            getVoices(function (voices) {
                if (!voices || voices.length === 0) return;
                var saved = localStorage.getItem(VOICE_PREF_KEY);
                var picked = pickBestVoice(voices, saved);
                selectedVoice = picked.voice;
                voiceSelect.innerHTML = picked.allEnglish.map(function (v) {
                    var label = v.name + ' — ' + v.lang + (v.localService ? ' · device' : '');
                    return '<option value="' + v.voiceURI.replace(/"/g,'&quot;') + '"' + (selectedVoice && v.voiceURI === selectedVoice.voiceURI ? ' selected' : '') + '>' + label + '</option>';
                }).join('');
            });

            voiceSelect.addEventListener('change', function () {
                var voices = window.speechSynthesis.getVoices() || [];
                var match = voices.find(function (v) { return v.voiceURI === voiceSelect.value; });
                if (match) {
                    selectedVoice = match;
                    localStorage.setItem(VOICE_PREF_KEY, match.voiceURI);
                }
            });
            rateInput.addEventListener('input', function () {
                var r = parseFloat(rateInput.value) || 1.0;
                rateVal.textContent = r.toFixed(2).replace(/\.?0+$/, '') + '×';
                localStorage.setItem(RATE_PREF_KEY, String(r));
            });
            voiceTest.addEventListener('click', function () {
                speak('Marine tech pro. Voice check. Kill switch off before electrical work.');
            });
            voiceSettingsBtn.addEventListener('click', function () {
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
                if (listening) { stopListening(); return; }
                startListening();
            });
        }

        function startListening() {
            // Stop any ongoing TTS so we don't feed back into the mic.
            stopSpeaking();
            try {
                recognizer = new SpeechRec();
                recognizer.lang = 'en-US';
                recognizer.interimResults = true;
                recognizer.continuous = false;
                recognizer.maxAlternatives = 1;

                var finalText = '';
                var gotAudio = false;
                recognizer.onaudiostart = function () { gotAudio = true; };
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
                    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                        addMsg('error', 'Microphone permission denied. Allow mic access in your browser settings.');
                    } else if (e.error === 'no-speech' && !gotAudio) {
                        // Silent — just stop.
                    }
                    stopListening();
                };
                recognizer.onend = function () {
                    stopListening();
                    if (input.value.trim()) submit();
                };
                recognizer.start();
                listening = true;
                micBtn.classList.add('listening');
                micBtn.setAttribute('aria-label', 'Stop listening');
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
        _askReal = function (question) {
            overlay.classList.add('open');
            input.value = String(question);
            input.dispatchEvent(new Event('input'));
            setTimeout(function () { submit(); }, 120);
        };
        while (_askQueue.length) _askReal(_askQueue.shift());

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
                        addReadAloudButton(msg, res.body.answer);
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
