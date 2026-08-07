# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marine Tech Pro is a field diagnostic and repair assistant web app for marine technicians, focused on Mercury and Yamaha 4-stroke outboard engines (115–300 HP). Built for Freedom Boat Club technicians.

## Commands

- **Install dependencies:** `npm install`
- **Run the server:** `npm start` (runs `node server.js` on port 3000)
- **Run tests:** `npm test` (validates domain data, then runs the auth-gating suite in `test/` via `node --test`)
- **Validate data only:** `npm run validate` (checks diagnostic-tree graph integrity, fault-code schema, menu coverage)
- **Syntax + data check:** `npm run check`
- **Regenerate app icons:** `npm install --no-save sharp && npm run icons` (only needed when the master artwork changes — see "Icons" below)
- **Environment variables:** `PORT`, `ADMIN_CODE` (break-glass admin login), `SESSION_SECRET`, `NODE_ENV`, `ANTHROPIC_API_KEY` (Ask-a-Tech AI), `DATA_DIR` (SQLite location — defaults to `/data` if present else `./data`), `FBC_HUB_URL` (defaults to `https://freedomboatclub.ai`), `IP_HASH_SALT`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BASE_URL` (e.g. `https://marinetech.freedomboatclub.ai` — used to build the Google OAuth callback URL), `INITIAL_ADMIN_EMAILS` (comma-separated list; matching emails are auto-approved as admin on first **Google** sign-in only — local signups never bootstrap to admin because their email is unverified)

Also honoured: `RETENTION_DAYS` (telemetry pruning window, default 90).

There is no linter or build step. Tests are plain `node --test` (no framework) plus a data validator; CI runs both on every push/PR (`.github/workflows/ci.yml`).

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
- `/api/admin/users` (GET), `/api/admin/users/:id/role` (POST), `/api/admin/users/:id/delete` (POST) — admin user management
- `/api/admin/overview` (GET) — dashboard stats/activity/errors for `/admin`
- `/api/feedback` (POST) — tech bug/feedback/enhancement submissions; `/api/admin/feedback` (GET), `/api/admin/feedback/:id/status|reply|pin` (POST) — admin triage; `/api/me/feedback` (GET), `/api/known-issues` (GET) — user-visible status
- `/api/event` (POST) — client beacon for tree navigations, fault lookups, spec views (allowlisted kinds; client errors log as `client_error`, never `error`, so the admin error panel can't be spoofed from a browser)
- `/api/health` (GET) — public health/version endpoint (exempt from rate limiting)
- `/landing`, `/privacy`, `/terms`, `/manifest.json` — public pages/assets (no auth)
- `/api/ask` (POST) — Ask-a-Tech AI endpoint. Uses `@anthropic-ai/sdk` with `claude-sonnet-4-6` (60s timeout, 1 retry). Grounded by the four KB files (diagnostic trees, engine specs, fault codes, Yamaha manual reference) loaded at server startup and cached via `cache_control: ephemeral` with a 1h TTL. Rate-limited to 15 questions/min per IP. Accepts `{ question, context: { tree, node } }` (context fields are bounded to 120 chars).
- Auth middleware sits between public routes and `express.static`, so static assets (css/icons) and the routes above marked public bypass auth, but HTML pages and JS data files require it. The `loadUser` middleware runs globally and sets `req.user` from the session before any route. The global rate limiter applies to `/api/*` only.

**Middleware order in `server.js` is load-bearing** — helmet → compression → `/api` rate limit → `/api` same-origin guard → body parsers → session → `loadUser` → public routes → `/css`+`/icons` static → `requireAuth` → admin routes → protected static → `/api` 404 → error handler. Moving a route across `app.use(requireAuth)` silently changes who can reach it; `test/auth.test.js` guards the main cases.

Other server behaviours worth knowing:
- **Break-glass sessions carry a tag** derived from `ADMIN_CODE`; `loadUser` re-checks it every request, so rotating the code revokes all existing break-glass sessions immediately. The code itself is compared with `crypto.timingSafeEqual`.
- **Google OAuth uses a `state` parameter** stored in the session and verified in the callback (login-CSRF protection).
- **Telemetry retention:** `events`/`ai_messages` older than `RETENTION_DAYS` are pruned at startup and daily.
- **Graceful shutdown** on SIGTERM/SIGINT drains connections and closes SQLite (Railway sends SIGTERM on redeploy).
- If a KB file fails to load the server still starts; only `/api/ask` degrades to 503.

### Frontend (`public/`)

Ten HTML pages, each self-contained with inline `<script>` blocks. The four app pages:

- **`index.html`** — Home/menu linking to the three feature pages
- **`diagnose.html`** — Guided diagnostic decision trees. Loads `js/diagnosticTrees.js` and walks through `window.defined_trees[treeName]` via a state machine (`currentTree`, `currentNodeId`, `navHistory`). Node types: `question`, `instruction`, `resolution`
- **`fault-codes.html`** — Searchable fault code lookup. Loads `js/faultcodes.js` (`window.faultCodeDatabase` array). Search filters by code, description, system, causes, steps, tools, parts
- **`specs.html`** — Engine spec reference. Loads `js/engineSpecs.js` (`window.engineSpecDatabase` array). Renders spec tables per engine

Plus: **`login.html`** (login/signup), **`pending.html`** (awaiting approval), **`admin.html`** (dashboard + user/feedback management), and the public **`landing.html`**, **`privacy.html`**, **`terms.html`**.

### Data Files (`public/js/`)

All domain data lives in four JS files that attach to `window`:

- **`diagnosticTrees.js`** — `window.defined_trees` object. Each tree has `title`, `requiredTools`, `startNode`, and a `nodes` map. Trees: `engine_no_start`, `engine_overheat`, `engine_runs_rough`, `yamaha_flash_codes`, `charging_electrical`, `trim_steering`, `electronics`, `stereo_audio`, `nav_lights`, `horn_system`, `bilge_pump`, `livewell_pump`, `washdown_pump`
- **`engineSpecs.js`** — `window.engineSpecDatabase` array of engine spec objects (Mercury and Yamaha models)
- **`faultcodes.js`** — `window.faultCodeDatabase` array. Each entry has `code`, `manufacturer`, `severity` (`Warning`|`Alarm`|`Shutdown`), `system`, `description`, `causes`, `steps`, `tools`, `parts` (causes/steps are pipe-delimited strings). Contains two DISTINCT Yamaha numbering series: `YAM-nn` (YDS/Command Link codes) and `YAM-F-nn` (on-engine flash codes) — the same number means different things in each series
`public/js/feedback.js`, `public/js/askTech.js` and `public/js/common.js` are UI code (below), not data.

**`kb/yamahaManuals.js`** — Yamaha factory service manual reference corpus (F115C/F150TR/F200-F225TR). Server-side AI grounding only; deliberately outside `public/` so it isn't shipped to browsers that never load it.

### Shared frontend module (`public/js/common.js`)

Exposes `window.MTP`: `beacon(kind, data)` (POSTs `/api/event`), `logout()` (POST-only), `esc(s)` (HTML escaper), and `trapFocus(panel, onClose)` (modal focus trap + Escape). Also registers the service worker. Loaded before `askTech.js`/`feedback.js` on every authenticated page — add new shared helpers here rather than copy-pasting into page scripts.

### Offline (`public/sw.js`)

Service worker precaches the app shell and the three data files. `/api/*` is never cached; HTML is network-first (so deploys land immediately); JS/CSS/icons are stale-while-revalidate. Bump `CACHE_VERSION` when the precache list changes.

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
