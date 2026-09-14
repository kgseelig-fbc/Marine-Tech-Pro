# Marine Tech Pro

Field diagnostic and repair assistant for Freedom Boat Club marine technicians, covering Mercury and Yamaha 4-stroke outboards (115–300 HP) and common boat systems. It is a phone-first web app with:

- guided diagnostic decision trees,
- a searchable fault-code lookup (Mercury, Yamaha YDS and Yamaha on-engine flash codes),
- an engine spec reference,
- **Ask-a-Tech**, an AI assistant grounded in the same knowledge base plus a Yamaha factory service manual reference,
- offline support via a service worker (the data files are cached on the device),
- an admin dashboard for approving users, triaging tech feedback and watching usage/errors.

It is a vanilla HTML/CSS/JS front end served by a small Express server with a SQLite database. No build step.

## Run it locally

```sh
npm install
ADMIN_CODE='a-long-random-break-glass-code' npm start   # http://localhost:3000
```

With no other configuration the server starts with local email/password sign-up enabled, Google SSO disabled, and Ask-a-Tech returning 503 (no API key). The database and generated secrets land in `./data/`.

Sign in with the break-glass code at `/login` to reach `/admin` and approve the first accounts.

## Tests

```sh
npm test          # validates domain data, then runs every suite in test/
npm run check     # syntax-checks every shipped JS file, then validates the data
npm run validate  # data validation only
```

The suites need no API key or network: the Ask-a-Tech tests point the real `/api/ask` handler at a local mock via `ANTHROPIC_BASE_URL`. CI (`.github/workflows/ci.yml`) runs `npm run check`, the tests, and a production dependency audit on every push and pull request.

## Deploy on Railway

1. **Create a service from this repo.** Railway detects `npm start`; `package.json` pins Node `>=20 <25`.
2. **Mount a persistent volume at `/data`.** The SQLite database, session store and generated secrets all live under `DATA_DIR`, which defaults to `/data` when that directory exists. Without a volume every deploy wipes users, sessions and feedback.
3. **Set the environment variables** listed below. The minimum for a working production instance is `BASE_URL`, `ANTHROPIC_API_KEY`, and either the Google pair plus `INITIAL_ADMIN_EMAILS` or `ADMIN_CODE`.
4. **Give the old deployment time to drain.** Railway's default is to SIGKILL the previous deployment 0 seconds after SIGTERM, which makes the app's graceful shutdown a no-op and cuts any in-flight Ask-a-Tech call on every push. Set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30` on the service (or `deploy.drainingSeconds` in a `railway.json`); `DRAIN_TIMEOUT_MS` (default 25000) must stay below that window.
5. **Google OAuth (optional).** In Google Cloud, create an OAuth client and add `<BASE_URL>/auth/google/callback` as an authorised redirect URI. The `/landing`, `/privacy` and `/terms` pages are public for Google's production verification.

`/api/health` is public, exempt from rate limiting, and reports `{ status: 'ok', build, startedAt }` — or `503 { status: 'draining' }` once shutdown has begun — so it can be used as the platform health check.

## Environment variables

See `.env.example` for a commented template. Nothing is required to boot; these matter in production.

| Variable | Required in production | What it does |
| --- | --- | --- |
| `PORT` | set by Railway | Port to listen on (default 3000). |
| `BASE_URL` | yes | Public origin, e.g. `https://marinetech.example.com`. Builds the Google callback URL and is trusted as same-origin by the `/api` CSRF guard. |
| `DATA_DIR` | volume at `/data` | Where `mtp.db`, the session store and generated secrets live. Defaults to `/data` if present, else `./data`. |
| `SESSION_SECRET` | recommended | Signs session cookies. Unset → generated once and persisted at `DATA_DIR/session-secret`, so sessions still survive redeploys. Comma-separated list to rotate: first signs, all verify. |
| `IP_HASH_SALT` | recommended | Salt for the one-way IP hashes in the audit log. Unset → generated once and persisted at `DATA_DIR/ip-hash-salt`. |
| `ADMIN_CODE` | one of the two bootstrap paths | Break-glass admin login. 12+ random characters (the server warns if shorter); rotating it revokes existing break-glass sessions. Empty disables it. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google SSO | Enables "Sign in with Google". |
| `INITIAL_ADMIN_EMAILS` | one of the two bootstrap paths | Comma-separated emails auto-approved as admin on Google sign-in (first sign-in, or the next one if they are already pending). Never applies to local signups — their email is unverified. |
| `ANTHROPIC_API_KEY` | for Ask-a-Tech | Without it `/api/ask` returns 503 and the rest of the app works. |
| `ASK_RATE_PER_MIN` | no | Ask-a-Tech questions per minute per signed-in user (default 15). |
| `SIGNUP_RATE_PER_HOUR` | no | Successful local sign-ups per hour per IP (default 10). |
| `RETENTION_DAYS` | no | Days of usage events and AI transcripts to keep (default 90; 0 disables pruning). Feedback is never pruned. |
| `DRAIN_TIMEOUT_MS` | no | Drain budget after SIGTERM (default 25000). Keep it below the platform's grace window. |
| `GIT_SHA` | no | Build id shown by `/api/health` and `/admin`. Railway supplies `RAILWAY_GIT_COMMIT_SHA` automatically. |
| `FBC_HUB_URL` | no | Link target for the hub button on the admin dashboard (default `https://freedomboatclub.ai`). |
| `NODE_ENV` | `production` | Standard Express production switch. The cookie `Secure` flag follows the connection, not this. |

## Bootstrapping the first admin

Every new account starts as `pending` and cannot use the app until an admin approves it from `/admin`. There are two ways to get the first admin:

- **Google SSO:** put the admin's Google email in `INITIAL_ADMIN_EMAILS`, then sign in with Google. The account is created (or, if it already signed in and is sitting in pending, promoted) as `admin`.
- **Break-glass:** set `ADMIN_CODE`, open `/login`, and enter the code. That gives an admin session with no user row; from `/admin` approve a real account as `admin`, then clear or rotate `ADMIN_CODE`.

Local email/password signups never bootstrap to admin, because nothing verifies that the person owns the address.

If a Google sign-in uses an email that already has a local account, the sign-in is refused (`/login?error=email_exists`) rather than linked or duplicated — an admin sorts it out by deleting or approving the right row.

## Roles and access

| Role | Can |
| --- | --- |
| `pending` | see `/pending` only |
| `tech` | use the app |
| `admin` | use the app and `/admin` (users, feedback, usage, errors) |
| `denied` | nothing; sessions are ended on the next request |

Deleting a user from `/admin` also removes their usage events and AI transcripts and detaches their name and email from any feedback they filed (the feedback text itself stays, as it is the bug tracker).

## Data and privacy notes for operators

- Events and AI transcripts store a salted one-way hash of the IP, never the address.
- Events log user ids, not emails, except failed local logins (the attempted address, pruned with everything else after `RETENTION_DAYS`).
- The Google profile photo is not stored.
- The Yamaha manual corpus in `kb/` is server-side prompt grounding only and is never served to browsers.
