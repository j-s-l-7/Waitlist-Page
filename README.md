# Analyez — Operational Frontend

This is the frontend codebase for the **Analyez** waitlist page (deployed at [analyez.com](https://analyez.com)). It features an immersive, engaging UI designed to showcase the "Agentic Investing" concept and capture early user interest.

## Tech Stack

* **Framework:** React 18 + TypeScript
* **Build Tool:** Vite
* **Styling:** Vanilla CSS (custom design system, glassmorphism)
* **Animations:** Framer Motion (`framer-motion`)
* **Icons:** Lucide React (`lucide-react`)
* **API / Backend:** Vercel Serverless Functions (`api/`) using `pg` against Supabase Postgres (schema `waitlist`, table `waitlist.signups`) through the Supabase transaction pooler.

## Project Structure

The project has been structured according to standard Vite/React best practices:

```
Operational Frontend/
├── api/                  # Vercel Serverless Functions (Backend)
│   ├── _db.js            # Shared Postgres pool (underscore = not a route)
│   ├── _http.js          # Shared CORS helper (underscore = not a route)
│   ├── _numbering.js     # Rank -> displayed waitlist number
│   ├── health.js         # GET: database health check
│   ├── waitlist.js       # POST: add an email to the waitlist
│   └── waitlist/count.js # GET: current waitlist size (edge-cached 60s)
├── db/schema.sql         # Idempotent Supabase schema (waitlist.signups)
├── tests/                # API tests (node:test, stubbed DB)
├── public/               # Static assets served at the root (favicon, hero bg)
├── src/                  # React Source Code
│   ├── components/       # Reusable UI components (Hero, CTA, Features, etc.)
│   ├── config/           # Market configurations (content for US/India)
│   ├── hooks/            # Custom React hooks
│   ├── styles/           # CSS stylesheets (Waitlist.css, tokens.css)
│   ├── main.tsx          # React application entry point
│   └── WaitlistPage.tsx  # Main page component
├── index.html            # HTML entry point (requires `src/main.tsx`)
└── package.json          # Dependencies and npm scripts
```

`vercel.json` pins the API functions to Vercel's Singapore region (`sin1`), next to the Supabase database (`ap-southeast-1`), and allows up to 60 s per function so a slow pooler moment does not cut a signup off. Everything else uses Vercel's defaults (Vite build, `api/` functions).

## Key Features

1. **Immersive Hero Animation:** A state-machine-driven sequence (`ImmersiveHero.tsx`) that simulates an AI generating a portfolio based on a user prompt.
2. **Contextual Onboarding:** The UI transitions from a simple search-like interface to a complex data dashboard seamlessly.
3. **Waitlist Capture:** A floating Call-to-Action (`FloatingCTA.tsx`) that validates the email, posts it to `/api/waitlist`, and shows the user's position only after the API confirms the signup. Failures (including a 40 s request timeout) show an inline error with a retry; already-registered emails are told their existing position. The success modal links to the WhatsApp community (https://chat.whatsapp.com/EIYeyk69kfAJfUWsTN0vc2) as a plain link, not a popup.
4. **Device memory:** after a successful signup the browser stores `analyez_waitlist_joined` in `localStorage`, so returning visitors see "You are #N"; the modal's "Join with a different email" clears it. After a server (5xx), 429, network or timeout failure the email is stored as `analyez_waitlist_pending` and POSTed once silently on the next visit; the honest error is still shown and success is never faked. Attempts are at least 2 s apart.

## API

| Route | Method | Responses |
| --- | --- | --- |
| `/api/waitlist` | `POST {"email": "..."}` | `200 {success, position, alreadyRegistered}`, `400` invalid email, `405` wrong method, `503` database unavailable |
| `/api/waitlist/count` | `GET`, `HEAD` | `200 {count}`: the displayed number of the latest signup (770 when empty), cached `s-maxage=60`; `405`, `503` |
| `/api/health` | `GET`, `HEAD` | `200 {ok: true, db: "up"}` or `503 {ok: false, db: "down", code}` (error code only). Cached `s-maxage=15`. Point an uptime monitor here. |

### Waitlist numbering

Each signup gets a stored `rank` (1, 2, 3, ...) assigned inside a transaction under a Postgres advisory lock as `max(rank) + 1`, so concurrent signups never share a number. It is displayed as `rank <= 9 ? 770 + rank : 7761 + rank`: the first nine signups are 771 to 779, the tenth onward are 7771, 7772, ... (7779, 7780, 7781, ...). `position` from `/api/waitlist` is always this displayed number, and `/api/waitlist/count` returns the displayed number of `max(rank)` (770 when empty). Ranks are stored, so deleting a row leaves a gap but never changes anyone else's number (deleting the latest signup lets its rank be reused).

### Reliability

* One `pg` connection per function instance (`max: 1`), 15 s connect timeout, connections kept warm for 30 s. Measured against the shared pooler: about 0.6 s to connect normally, about 3 s during bursts, with occasional spikes to about 12 s.
* A query that fails with a transient connection error (`ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `EPIPE`, `57P01`, `57P03`, `08000`, `08003`, `08006`, "Connection terminated") is retried once after 250 ms on a freshly created pool. SQL and constraint errors are never retried.
* A signup is one transaction on one connection: `BEGIN`, advisory lock, lookup by `lower(email)`, `INSERT ... RETURNING rank`, `COMMIT`. A transient error before `COMMIT` retries the whole transaction once; a failure during `COMMIT` is never retried. The unique index on `lower(email)` is the final guard (error `23505` is answered as "already registered").
* SSL query params in `DATABASE_URL` (`sslmode`, `sslrootcert`, ...) are stripped so the explicit TLS settings below always apply.
* `/api/waitlist/count` reads `max(rank)` from the unique rank index and is edge-cached for 60 s. `/api/health` is CDN-cached 15 s and memoized 10 s per instance.

Emails are trimmed, lowercased, capped at 254 characters and format-checked on both client and server. Re-submitting a registered email returns its existing position (intended product behavior, though it does reveal whether an email is registered).

## Configuration

Set these in Vercel (Project → Settings → Environment Variables) for each environment, and in `.env.local` for local work. See `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Supabase **transaction pooler** URI: the pooler host from Supabase → Connect → Transaction pooler, port **6543** (not the direct `db.<ref>.supabase.co` host, which is IPv6-only and unreachable from Vercel). If it is missing, the API returns `503` and logs `DB_CONFIG_MISSING`. |
| `DATABASE_CA_CERT` | no | PEM CA bundle (e.g. Supabase's CA certificate from the project's database settings). When set, the server certificate is verified. When unset, the connection uses TLS **without** certificate verification. |

### Database

If setting up fresh, run `db/schema.sql` in the Supabase SQL editor. It is idempotent and only touches the `waitlist` schema: it creates `waitlist.signups`, a unique index on `lower(email)`, enables RLS and revokes all access from `anon`, `authenticated` and `public`, so the table is not reachable through the Supabase Data API. All queries in the code are schema-qualified (`waitlist.signups`) because the pooler's `search_path` does not include `waitlist`.

### Free-tier caveats

* The Supabase project is shared with the screener scraper (schemas `equity` and `mf`). Nothing here touches those schemas.
* Free-tier projects pause after a period of inactivity. The scraper's CI hits the project regularly, so no keep-alive is built in; `/api/health` can be pointed at an uptime monitor to notice a pause.
* Storage is a shared 500 MB across all schemas.
* The pooler's client-connection limit is shared with the scraper's CI runners; each waitlist function instance uses at most one connection.

## Security notes

* All SQL is parameterized. Input is validated server-side; the client-supplied IP is taken from Vercel's `x-real-ip` / `x-vercel-forwarded-for` (or the first `x-forwarded-for` entry) and stored only if it parses as an IP.
* CORS headers are only sent to an allowlist (`analyez.com`, `www.analyez.com`, local dev ports); the site itself calls the API same-origin.
* Database errors are logged with their code and message only; the connection string is never logged or returned. `/api/health` returns only the error code.
* The table has RLS enabled and no grants to the Supabase API roles; only the server-side `DATABASE_URL` role can read it.
* TLS to the database is encrypted but not verified unless `DATABASE_CA_CERT` is set.
* There is no application-level rate limiting; use a Vercel Firewall rate-limit rule on `/api/waitlist` if abuse becomes a concern.

## Development

### Running Locally

To run the frontend locally for development:

```bash
# 1. Install dependencies
npm install

# 2. Start the Vite development server
npm run dev
```

*Note: The local Vite dev server does not execute Vercel Serverless Functions (`/api/*`). Signups will show the inline error state locally. To run the API too, use the Vercel CLI with a `.env.local` containing `DATABASE_URL` (copy `.env.example`; prefer a non-production database):*

```bash
vercel dev
```

Without the Vercel CLI, `npm run serve:local` builds the site and serves it on http://localhost:4173 with `/api/*` routed to the real handlers (`scripts/local-server.mjs`). It uses `DATABASE_URL` from `.env.local`, so signups made there are **real rows**. Delete test signups afterwards in the Supabase SQL editor:

```sql
DELETE FROM waitlist.signups WHERE email = 'your-test-email@example.com';
```

Deleting the highest-ranked row lets the next signup reuse its number, so cleaning up right away (before anyone else signs up) keeps the first real signup at 771.

### Tests

```bash
npm test
# Against the real database (inserts and then deletes fake e2e-test-* emails):
node --env-file=.env.local scripts/e2e-supabase.mjs
```

Runs the API handler, numbering, retry and health tests in `tests/` with Node's built-in test runner against a stubbed database (no network or DB access).

### Building for Production

```bash
npm run build
```

The output will be generated in the `dist/` directory.

## Deployment

This project is deployed automatically via Vercel. 

* The `index.html` and `src/` files are compiled by Vite into static assets.
* The files inside the `api/` directory are automatically deployed as Vercel Serverless Functions.

To deploy manually from the CLI:

```bash
vercel deploy --prod
```
