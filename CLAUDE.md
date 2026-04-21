# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marine Tech Pro is a field diagnostic and repair assistant web app for marine technicians, focused on Mercury and Yamaha 4-stroke outboard engines (115–300 HP). Built for Freedom Boat Club technicians.

## Commands

- **Install dependencies:** `npm install`
- **Run the server:** `npm start` (runs `node server.js` on port 3000)
- **Environment variables:** `PORT`, `ADMIN_CODE` (break-glass admin login), `SESSION_SECRET`, `NODE_ENV`, `ANTHROPIC_API_KEY` (Ask-a-Tech AI), `DATA_DIR` (SQLite location — defaults to `/data` if present else `./data`), `FBC_HUB_URL` (defaults to `https://freedomboatclub.ai`), `IP_HASH_SALT`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BASE_URL` (e.g. `https://marinetech.freedomboatclub.ai` — used to build the Google OAuth callback URL), `INITIAL_ADMIN_EMAILS` (comma-separated list; matching emails are auto-approved as admin on first sign-in)

There are no tests, linter, or build step configured.

## Architecture

This is a vanilla HTML/CSS/JS app served by an Express.js backend. No frameworks, no bundler, no transpilation.

### Server (`server.js`)

Express server with session-based auth. Three ways in: (1) Google SSO, (2) email/password local signup/login, (3) `ADMIN_CODE` break-glass. Per-user access control lives in a SQLite `users` table with roles `pending`|`tech`|`admin`|`denied`. New sign-ups default to `pending` and can't access anything until an admin approves them from `/admin`. Bootstrap the first admin by adding their email to `INITIAL_ADMIN_EMAILS` — matching emails are auto-approved as admin on first sign-in.

Auth module lives in `lib/auth.js` (passport config, `loadUser`/`requireAuth`/`requireAdmin` middleware, bcrypt helpers). Routes:

- `/login` (GET) — login/signup page
- `/pending` (GET) — awaiting-approval page for pending users
- `/api/auth/config` — feature flags (which auth modes are enabled)
- `/api/me` — current user info
- `/api/auth/signup` (POST), `/api/auth/login` (POST) — local email/password
- `/api/auth/admin-code` (POST) — break-glass admin login
- `/auth/google`, `/auth/google/callback` — Google OAuth
- `/api/logout` (POST), `/logout` (GET)
- `/api/admin/users` (GET), `/api/admin/users/:id/role` (POST), `/api/admin/users/:id/delete` (POST) — admin user management
- `/api/ask` (POST) — Ask-a-Tech AI endpoint. Uses `@anthropic-ai/sdk` with `claude-sonnet-4-6`. Grounded by the three KB files (diagnostic trees, engine specs, fault codes) loaded at server startup and cached via `cache_control: ephemeral`. Rate-limited to 15 questions/min per IP. Accepts `{ question, context: { tree, node } }`.
- Auth middleware sits between public routes and `express.static`, so static assets (css/icons) bypass auth but HTML pages and JS data files require it. The `loadUser` middleware runs globally and sets `req.user` from the session before any route.

### Frontend (`public/`)

Four HTML pages, each self-contained with inline `<script>` blocks:

- **`index.html`** — Home/menu linking to the three feature pages
- **`diagnose.html`** — Guided diagnostic decision trees. Loads `js/diagnosticTrees.js` and walks through `window.defined_trees[treeName]` via a state machine (`currentTree`, `currentNodeId`, `navHistory`). Node types: `question`, `instruction`, `resolution`
- **`fault-codes.html`** — Searchable fault code lookup. Loads `js/faultcodes.js` (`window.faultCodeDatabase` array). Search filters by code, description, causes
- **`specs.html`** — Engine spec reference. Loads `js/engineSpecs.js` (`window.engineSpecDatabase` array). Renders spec tables per engine

### Data Files (`public/js/`)

All domain data lives in three JS files that attach to `window`:

- **`diagnosticTrees.js`** — `window.defined_trees` object. Each tree has `title`, `requiredTools`, `startNode`, and a `nodes` map. Trees: `engine_no_start`, `engine_overheat`, `engine_runs_rough`, `charging_electrical`, `trim_steering`, `electronics`, `stereo_audio`, `nav_lights`, `horn_system`
- **`engineSpecs.js`** — `window.engineSpecDatabase` array of engine spec objects (Mercury and Yamaha models)
- **`faultcodes.js`** — `window.faultCodeDatabase` array. Each entry has `code`, `manufacturer`, `severity`, `system`, `description`, `causes`, `steps`, `tools`, `parts` (causes/steps are pipe-delimited strings)

### Styling

`public/css/styles.css` — shared styles. Page-specific styles are in inline `<style>` blocks within each HTML file.

### Ask-a-Tech Widget (`public/js/askTech.js`)

A floating `💬` button on every authenticated page opens a modal Q&A panel that calls `/api/ask`. Features:
- Text input with Enter-to-send, Shift+Enter newline
- Voice input via Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) — tap mic, speak, auto-submits on silence
- Read-aloud of answers via `SpeechSynthesis`
- Context-aware: `diagnose.html` sets `window.__currentDiagTree` and `window.__currentDiagNode`, which the widget forwards to the backend so the AI can relate answers to the tech's current step
