# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marine Tech Pro is a field diagnostic and repair assistant web app for marine technicians, focused on Mercury and Yamaha 4-stroke outboard engines (115–300 HP). Built for Freedom Boat Club technicians.

## Commands

- **Install dependencies:** `npm install`
- **Run the server:** `npm start` (runs `node server.js` on port 3000)
- **Run tests:** `npm test` (validates domain data, then runs the suites in `test/` via `node --test`). No API key or network needed — `test/ask.test.js` points the real `/api/ask` handler at a local mock via `ANTHROPIC_BASE_URL` and asserts the exact request the SDK sends, so an SDK upgrade can't silently change the AI contract (notably the 1h prompt-cache breakpoint — losing it re-pays a ~100K-token cache write on every question, with no error to notice). The server-spawning suites share `test/helpers.js` (free port per server, temp `DATA_DIR`, captured stderr on failure), so they can run in parallel; `test/db.test.js` exercises `lib/db.js` directly and `test/server-lifecycle.test.js` covers graceful shutdown.
- **Validate data only:** `npm run validate` (checks diagnostic-tree graph integrity and node shapes, fault-code schema, engine-spec schema, metric/imperial unit pairs across the data files and the Yamaha corpus, and menu coverage)
- **Syntax + data check:** `npm run check` (`node --check` on every shipped JS file — server, `lib/`, `scripts/`, `public/js/`, the service worker — then the validator; CI runs this rather than a hand-maintained file list)
- **Regenerate app icons:** `npm install --no-save sharp && npm run icons` (only needed when the master artwork changes — see "Icons" below)
- **Environment variables:** `PORT`, `ADMIN_CODE` (break-glass admin login; the server warns at startup if it is shorter than 12 characters), `SESSION_SECRET` (comma-separated list allowed — first entry signs, all verify, so rotation needs no mass sign-out), `NODE_ENV`, `ANTHROPIC_API_KEY` (Ask-a-Tech AI), `DATA_DIR` (SQLite location — defaults to `/data` if present else `./data`), `FBC_HUB_URL` (defaults to `https://freedomboatclub.ai`), `IP_HASH_SALT`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BASE_URL` (e.g. `https://marinetech.freedomboatclub.ai` — used to build the Google OAuth callback URL), `INITIAL_ADMIN_EMAILS` (comma-separated list; matching emails are auto-approved as admin on **Google** sign-in only — at first sign-in, or on the next sign-in if the account is still pending — local signups never bootstrap to admin because their email is unverified)

  When `SESSION_SECRET` or `IP_HASH_SALT` is unset the server generates a value once and persists it at `DATA_DIR/session-secret` / `DATA_DIR/ip-hash-salt` (mode 0600) via `datastore.loadOrCreateSecret()`, so sessions survive a redeploy on the same volume and IP hashes stay stable. A per-boot random value used to sign every tech out on each deploy.

Also honoured: `RETENTION_DAYS` (telemetry pruning window, default 90), `ASK_RATE_PER_MIN` (Ask-a-Tech questions per minute per user, default 15), `SIGNUP_RATE_PER_HOUR` (successful local sign-ups per hour per IP, default 10 — failed attempts do not count), `DRAIN_TIMEOUT_MS` (default 25000), `GIT_SHA`. `README.md` and `.env.example` are the operator-facing reference for all of these.

There is no linter or build step. Tests are plain `node --test` (no framework) plus a data validator; CI runs `npm run check`, the tests and a production dependency audit on every push/PR (`.github/workflows/ci.yml`).

## Architecture

This is a vanilla HTML/CSS/JS app served by an Express.js backend. No frameworks, no bundler, no transpilation.

### Server (`server.js`)

Express server with session-based auth. Three ways in: (1) Google SSO, (2) email/password local signup/login, (3) `ADMIN_CODE` break-glass. Per-user access control lives in a SQLite `users` table with roles `pending`|`tech`|`admin`|`denied`. New sign-ups default to `pending` and can't access anything until an admin approves them from `/admin`. Bootstrap the first admin by adding their email to `INITIAL_ADMIN_EMAILS` — matching emails are auto-approved as admin on first Google sign-in (never on local signup, whose email is unverified).

Auth module lives in `lib/auth.js` (passport config, `loadUser`/`requireAuth`/`requireAdmin` middleware, bcrypt helpers). Routes:

- `/login` (GET) — login/signup page
- `/pending` (GET) — awaiting-approval page for pending users
- `/api/auth/config` — feature flags (which auth modes are enabled)
- `/api/me` — current user info
- `/api/auth/signup` (POST), `/api/auth/login` (POST) — local email/password
- `/api/auth/admin-code` (POST) — break-glass admin login
- `/auth/google`, `/auth/google/callback` — Google OAuth
- `/api/logout` (POST — the only route that ends a session); `/logout` (GET) renders a confirmation page whose button POSTs, so a session can't be destroyed by a cross-site link
- `/sw.js` — service worker (public, root scope)
- `/admin.html` — redirects to `/admin` behind `requireAdmin`, so the raw dashboard page is never served to a tech by the protected static handler
- `/api/admin/users` (GET), `/api/admin/users/:id/role` (POST), `/api/admin/users/:id/delete` (POST) — admin user management. Deletion is a transaction: the user row, their `events` and `ai_messages` go, and their name/email are detached from `feedback` (the report text stays — it is the bug tracker). Events never log raw emails (only ids), except `login_fail`.
- `/api/admin/overview` (GET) — dashboard stats/activity/errors for `/admin`
- `/api/feedback` (POST) — tech bug/feedback/enhancement submissions; `/api/admin/feedback` (GET), `/api/admin/feedback/:id/status|reply|pin` (POST, 404 for an unknown id) — admin triage; `/api/me/feedback` (GET), `/api/known-issues` (GET) — user-visible status
- `/api/event` (POST) — client beacon for tree navigations, fault lookups, spec views (allowlisted kinds; client errors log as `client_error`, never `error`, so the admin error panel can't be spoofed from a browser)
- `/api/health` (GET) — public health/version endpoint (exempt from rate limiting, matched on the path so a `?t=…` cache-buster does not defeat the exemption); answers `503 { status: 'draining' }` once shutdown has begun
- `/landing`, `/privacy`, `/terms`, `/manifest.json` — public pages/assets (no auth)
- `/api/ask` (POST) — Ask-a-Tech AI endpoint. Uses `@anthropic-ai/sdk` with `claude-sonnet-5` (60s timeout, 1 retry). Grounded by the four KB files (diagnostic trees, engine specs, fault codes, Yamaha manual reference) loaded at server startup and cached via `cache_control: ephemeral` with a 1h TTL. Rate-limited to `ASK_RATE_PER_MIN` (default 15) questions/min per signed-in user (per IP for break-glass sessions, which have no user id). The SDK budget is 60 s per attempt with one retry; the widget's `ASK_TIMEOUT_MS` (130 s) covers that worst case and the handler aborts the upstream call if the client disconnects first. Accepts `{ question, context: { tree, node } }` (context fields are bounded to 120 chars).

  **Three request settings are load-bearing on Sonnet 5 and must move together.** Adaptive thinking is ON by default (it was off by omission on Sonnet 4.6), and `max_tokens` caps thinking *plus* answer text — so `max_tokens` is 4096, not the 1024 that was pure answer budget before; dropping it back truncates a tech mid-sentence. `effort` defaults to `high`, which is the wrong latency trade for someone waiting on a phone beside a running engine, so it is pinned to `low` in `output_config`. An empty answer (safety refusal, or a turn that spent its whole budget thinking) returns 502 rather than a 200 with a blank string, and a truncated-but-usable answer is delivered with `truncated: true` and logged as `ai_truncated`. `test/ask.test.js` guards all of this.

  Sonnet 5's tokenizer runs ~30% heavier than Sonnet 4.6's for the same text, so the ~370 KB KB costs proportionally more per call even though the per-token list price is unchanged. Re-measure with `count_tokens` before relying on any cost figure.
- Auth middleware sits between public routes and `express.static`, so static assets (css/icons) and the routes above marked public bypass auth, but HTML pages and JS data files require it. The `loadUser` middleware runs globally and sets `req.user` from the session before any route. The global rate limiter applies to `/api/*` only (and skips `/api/health` and `/api/event`); the per-endpoint limiters on authenticated routes (ask, feedback, beacon) are keyed by user id (`perUserKey`), not IP, so techs behind one marina NAT get independent budgets. `requireAdmin` sends a signed-in non-admin HTML request to `/` (JSON callers get 403).
- **Async route handlers go through `wrap()`.** Express 4 ignores the promise an `async` handler returns, and the process-level `unhandledRejection` guard deliberately shuts the server down — so an escaped rejection in signup/login/ask used to take the whole app offline. `wrap()` routes it to the terminal error handler (one JSON 500, one `error` event) instead.

**Middleware order in `server.js` is load-bearing** — helmet → compression → `/api` rate limit → `/api` same-origin guard → body parsers → session → `loadUser` → public routes → `/css`+`/icons` static → `requireAuth` → admin routes → protected static → `/api` 404 → error handler. Moving a route across `app.use(requireAuth)` silently changes who can reach it; `test/auth.test.js` guards the main cases.

Other server behaviours worth knowing:
- **A session that points at a deleted user is stripped in place, never destroyed mid-request.** express-session's `destroy()` deletes `req.session` synchronously, and the login/signup/logout handlers that run next all dereference it; with the old code the first request after an admin deleted a tech could crash the server. `loadUser` now does `delete req.session.userId` and continues. Signup likewise regenerates the session *before* inserting the user row so a store failure cannot orphan an account.
- **Sessions are rolling** (`rolling: true`; the SQLite store implements `touch`), so the 8h cookie maxAge is 8h of inactivity, not 8h from login.
- **Google sign-in with an email that already has another account is refused** (`/login?error=email_exists`) rather than linked or duplicated — either direction of automatic linking is a takeover path via an unverified local row; an admin resolves it by hand. `upsertOauthUser` returns `null` in that case.
- **Break-glass sessions carry a tag** derived from `ADMIN_CODE`; `loadUser` re-checks it every request, so rotating the code revokes all existing break-glass sessions immediately. The code itself is compared with `crypto.timingSafeEqual`.
- **Google OAuth uses a `state` parameter** stored in the session and verified in the callback (login-CSRF protection).
- **Telemetry retention:** `events`/`ai_messages` older than `RETENTION_DAYS` are pruned 30 s after startup (so the health check is never queued behind the first prune) and then daily.
- **Graceful shutdown** on SIGTERM/SIGINT drains connections and closes SQLite (Railway sends SIGTERM on redeploy).
- If a KB file fails to load the server still starts; only `/api/ask` degrades to 503. A missing `kb/yamahaManuals.js` is warned about at startup (the AI silently stops citing factory specs otherwise). The KB system text is built once at startup (`KB_SYSTEM_TEXT`) and the corpus file's `window.yamahaManualReference = \`…\`;` wrapper is stripped so it is not billed as prompt tokens.
- **`ai_messages` records `user_id`, `cache_read` and `cache_write`** (prompt-cache read/write tokens) separately from `tokens_in`, and the admin overview reports a 24h cache hit rate — summed together, a silently lost 1h cache breakpoint looked identical to a healthy one.

### Frontend (`public/`)

Ten HTML pages, each self-contained with inline `<script>` blocks. The four app pages:

- **`index.html`** — Home/menu linking to the three feature pages
- **`diagnose.html`** — Guided diagnostic decision trees. Loads `js/diagnosticTrees.js` and walks through `window.defined_trees[treeName]` via a state machine (`currentTree`, `currentNodeId`, `navHistory`). Node types: `question`, `instruction`, `resolution`. Tree navigation is mirrored into browser history (`pushState` per node, `popstate` restores), so the phone's Back button steps back one node instead of unloading the page; a reload resumes from `history.state`. A resolution's optional `jumpTo` (`{ tree }` or `{ href }`, plus `label`) renders as a primary button into another tree or page.
- **`fault-codes.html`** — Searchable fault code lookup. Loads `js/faultcodes.js` (`window.faultCodeDatabase` array). Search filters by code, description, system, causes, steps, tools, parts. Each card's header is a real `<button aria-expanded>` and the details are a sibling panel (keep it that way — a `role=button` wrapping the whole card flattened every diagnostic step for screen readers). Yamaha cards label their numbering series (`YAM-F-*` on-engine flash code vs `YAM-*` YDS code).
- **`specs.html`** — Engine spec reference. Loads `js/engineSpecs.js` (`window.engineSpecDatabase` array). Renders spec tables per engine; current platforms are listed first and `legacy: true` entries under a divider, each button showing `yearsShort`, so a fleet tech does not pick the 2003–2013 sibling of a current engine

Plus: **`login.html`** (login/signup), **`pending.html`** (awaiting approval), **`admin.html`** (dashboard + user/feedback management — its 30 s refresh skips a table while a control in it has focus or a note is unsaved, and restores drafts/focus after a re-render, so it never wipes a half-typed reply), and the public **`landing.html`**, **`privacy.html`**, **`terms.html`**. Admins land on `/` like everyone else (server `landingFor()` and the client redirects agree).

### Data Files (`public/js/`)

All domain data lives in four JS files that attach to `window`:

- **`diagnosticTrees.js`** — `window.defined_trees` object. Each tree has `title`, `requiredTools`, `startNode`, and a `nodes` map (every node's `id` must equal its key — the breadcrumb and the validator rely on it). Trees: `engine_no_start`, `engine_overheat`, `engine_runs_rough`, `yamaha_flash_codes`, `charging_electrical`, `trim_steering`, `electronics`, `stereo_audio`, `nav_lights`, `horn_system`, `bilge_pump`, `livewell_pump`, `washdown_pump`
- **`engineSpecs.js`** — `window.engineSpecDatabase` array of engine spec objects (Mercury and Yamaha models). Every entry carries `yearsShort` (shown on the picker button) and legacy platforms carry `legacy: true`. Numbers shared by a templated block across different engines are prefixed "Typical — verify with YDS"; only figures traceable to the factory corpus in `kb/` are stated as fact.
- **`faultcodes.js`** — `window.faultCodeDatabase` array. Each entry has `code`, `manufacturer`, `severity` (`Warning`|`Alarm`|`Shutdown`|`Info` — Info is for informational codes such as "normal, no faults"), `system`, `description`, `causes`, `steps`, `tools`, `parts` (causes/steps are pipe-delimited strings). Contains two DISTINCT Yamaha numbering series: `YAM-nn` (YDS/Command Link codes) and `YAM-F-nn` (on-engine flash codes) — the same number means different things in each series. `YAM-nn` cards carry generic values qualified by platform; the factory figures live on the `YAM-F-nn` cards and the Engine Specs page.

**Technical numbers are load-bearing.** A generic band applied to the wrong engine condemns a healthy one (the no-start tree once called every Yamaha below a Mercury-only 170 PSI floor "internal damage"). Never add a spec figure that is not sourced from `kb/yamahaManuals.js`, an existing `engineSpecs.js` entry, or arithmetic; qualify by platform or point at the Engine Specs page instead. Metric/imperial pairs must agree (`npm run validate` checks kPa/PSI within 1.5 PSI and Nm/ft-lb within 3 %); factory-printed torque values stay as printed.
`public/js/feedback.js`, `public/js/askTech.js` and `public/js/common.js` are UI code (below), not data.

**`kb/yamahaManuals.js`** — Yamaha factory service manual reference corpus (F115C/F150TR/F200-F225TR). Server-side AI grounding only; deliberately outside `public/` so it isn't shipped to browsers that never load it. Keep its `window.yamahaManualReference = \`…\`;` wrapper shape — `loadKB()` strips it.

### Shared frontend module (`public/js/common.js`)

Exposes `window.MTP`: `beacon(kind, data)` (POSTs `/api/event`), `logout()` (POST-only; wipes the offline cache and leaves for `/login` **only after** the server confirmed the session is gone — a sign-out attempted with no signal changes nothing and shows a toast, instead of destroying every cached tree and stranding the tech on an unreachable `/login`), `esc(s)` (HTML escaper), `trapFocus(panel, onClose)` (modal focus trap + Escape) and `toast(message)` (dismissable status notice). Also registers the service worker and posts `{ type: 'MTP_WARM_CACHE' }` to it on every authenticated page load. Loaded before `askTech.js`/`feedback.js` on every authenticated page — add new shared helpers here rather than copy-pasting into page scripts.

### Offline (`public/sw.js`)

Service worker precaches the app shell, the three data files, the icon sprite and the logo. `/api/*` is never cached; HTML is network-first (so deploys land immediately) — but when a cached copy exists the network gets `HTML_NETWORK_TIMEOUT_MS` (4 s) before that copy is served, and a 5xx from the platform edge mid-redeploy also falls back to it; JS/CSS/icons are stale-while-revalidate. Bump `CACHE_VERSION` when the precache list or caching logic changes (currently `mtp-v4`; `test/sw.test.js` reads it from the loaded worker rather than hard-coding it).

**The shell is filled by `precacheShell()`, from `install` and from the `MTP_WARM_CACHE` message.** `install` only runs once per `sw.js` byte-change, so after a sign-out purge (`MTP_CLEAR_CACHE`), or an install that ran while signed out and cached nothing, nothing else would ever fetch CORE again until the next deploy. Every authenticated page posts `MTP_WARM_CACHE`; the worker re-runs the precache only when the core sentinel is missing, so it costs nothing on a normal load. Navigations to `/admin` and the public pages get the offline notice rather than the cached Home shell (`NO_SHELL`).

**Cache generations are load-bearing.** `activate()` deliberately keeps the previous generation when the new install is incomplete — an expired session cookie is enough, since every precache then follows the auth 302 and is rejected by `isCacheable` — so two caches can legitimately coexist. Because `caches.match()` with no `cacheName` scans **every** cache in creation order and returns the first hit, all reads go through `matchCurrent()` (scoped to `CACHE_VERSION`). Older generations are consulted only via `matchAnyGeneration()` as an offline last resort. Read unscoped and a retained older cache shadows the new one forever while writes land where nothing reads them — a tech keeps being served pre-deploy fault codes. `test/sw.test.js` guards this. Install completeness is recorded as a sentinel entry *inside* the cache, not on `self`, so it survives the worker being killed between `install` and `activate`. Anything a tech opens offline belongs in `CORE`, not `EXTRA`: a cache missing a `CORE` entry is not allowed to replace a good one.

### Icons (`public/icons/`, `assets/`)

The high-res master is `assets/fbc-logo-master.jpeg` (2000×2000) and lives **outside `public/`** so it is never served — it exists only to regenerate the icon set. `scripts/generate-icons.js` derives every shipped icon from it via sharp, which is deliberately *not* a dependency (install it with `--no-save` when regenerating; the generated PNGs are committed).

Two manifest icon families, and the distinction matters:
- **`purpose: "any"`** (`icon-192/512.png`) — full-bleed. Nothing crops these.
- **`purpose: "maskable"`** (`icon-maskable-192/512.png`) — the badge is drawn at 78% and padded with white to the edges. Android crops maskable icons to a platform-chosen shape (circle, squircle, teardrop) and only a centred circle of 80% diameter is guaranteed to survive. The FBC badge carries the "FREEDOM BOAT CLUB" wordmark on its rim, so a full-bleed maskable icon would have that text sliced off by every mask. The generator **asserts** no ink escapes the safe zone and fails rather than emit a croppable icon.

Also derived: `apple-touch-icon.png` (180), `logo-256.png` (in-page brand mark, rendered at 72–78px), and `favicon-16/32.png`. `test/icons.test.js` asserts declared `sizes` match the real PNG headers and that every icon referenced by a page or the service worker exists — the original bug was a single 2000×2000 JPEG declared as both 192×192 and 512×512 and used as the favicon on every page.

### Styling

`public/css/styles.css` — shared styles. Page-specific styles are in inline `<style>` blocks within each HTML file.

### Ask-a-Tech Widget (`public/js/askTech.js`)

A floating `💬` button on every authenticated page opens a modal Q&A panel that calls `/api/ask`. Features:
- Text input with Enter-to-send, Shift+Enter newline
- Voice input via Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) — tap mic, speak, auto-submits on silence
- Read-aloud of answers via `SpeechSynthesis`
- Context-aware: `diagnose.html` sets `window.__currentDiagTree` and `window.__currentDiagNode`, which the widget forwards to the backend so the AI can relate answers to the tech's current step
