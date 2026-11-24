# CaveBettor

**Sports intelligence, not a sportsbook.**

CaveBettor is an enterprise-grade prediction, odds-intelligence and bankroll-analytics workspace for football, basketball, tennis, ice hockey and baseball. It harmonises the strongest ideas from seventeen open-source betting projects and nine public analytics sites into one product: real-time fixtures, model probabilities, 84 markets, value detection, a self-training model registry, a data-pipeline control room and a paper trading desk — all priced in **Nigerian Naira (₦)**.

> **Research software for adults 18+.** CaveBettor never accepts deposits, never holds a wallet and never places a bet. Probabilities are estimates, not guarantees.

---

## What is inside

| Area | Capability |
| --- | --- |
| **Command centre** | Live KPIs, bankroll curve, model health, market movers, pipeline health, league coverage, analyst briefing |
| **Fixtures** | 20 competitions, 5 sports, date grouping, sport/league/status/value filters, card and table views |
| **Match lab** | Probability split, value table, correct-score heatmap, totals, top scorelines, model decomposition, H2H, lineups, live stats, LLM analyst |
| **Live centre** | In-play re-pricing every 30 seconds, live edges, probability drift, recent results, upcoming strip |
| **Value board** | Every selection above the 2.5% edge threshold, ranked, with quarter-Kelly stakes and a three-leg accumulator idea |
| **Odds & markets** | Eight-bookmaker comparison, movement radar, arbitrage scan |
| **Model lab** | Production/shadow registry, accuracy, log-loss, Brier, ROI, drift, calibration, feature importance, walk-forward training runs, one-click retraining |
| **Data pipeline** | 32 harmonised sources, health, coverage, latency, reliability, job history, permission-aware collection, API-key slots, schedules |
| **Performance** | Equity curve, drawdown, CLV, monthly ROI, ROI by sport and market, calibration audit, interactive staking simulator |
| **Paper desk** | Full ledger of recorded selections, open exposure, P/L, settlement rules |
| **Research notes** | Feature-harmonisation matrix across all repos/sites, methodology, architecture, decision log |
| **Commercial** | ₦5,000/month Pro plan, Trading Desk seats, Paystack-ready checkout contract, admin console with MRR, users, audit log and feature flags |

### Sports & markets

| Sport | Markets |
| --- | --- |
| Football | 1X2, double chance, draw no bet, BTTS, totals 1.5/2.5/3.5, Asian handicap, correct score |
| Basketball | Moneyline, points spread, total points, team totals |
| Tennis | Match winner, set betting, total games, game handicap |
| Ice hockey | 1X2 (60 min), moneyline incl. OT, puck line, total goals |
| Baseball | Moneyline, run line, total runs |

---

## Stack

- **SvelteKit 2 + Svelte 5** (runes) with SSR
- **Tailwind CSS 4** with a bespoke dark "stadium at night" design system
- **Convex** schema, queries, mutations, actions, crons and HTTP API
- **Cloudflare Pages** adapter (`@sveltejs/adapter-cloudflare`) and Wrangler
- **TypeScript**, **Zod**, **date-fns**, **Lucide** icons, custom SVG charts (no chart-library bloat)
- **Vitest** for deterministic engine tests
- Optional: **OpenAI** (grounded match analyst), **Paystack** (NGN subscriptions), sports-data APIs

---

## Getting started

```bash
npm install
cp .env.example .env      # optional — the app runs without credentials
npm run dev               # http://localhost:5173
```

The application is fully renderable **without any API keys or Convex deployment**. A deterministic intelligence engine generates a fresh, time-anchored fixture universe, probabilities, markets, odds, training runs and a paper ledger on every server start.

### Useful commands

```bash
npm run dev             # development server
npm run build           # production build (Cloudflare Pages output in .svelte-kit/cloudflare)
npm run preview         # preview the production build
npm run check           # svelte-check + TypeScript
npm test                # engine unit tests
npm run convex:dev      # start Convex (generates convex/_generated)
npm run seed            # seed the Convex demo workspace
npm run assets:generate # generate the landing-page visuals (Agnes images API)
npm run assets:build    # WebP masters + responsive derivatives + build-info.json
npm run assets:unique   # one-visual-per-placement guard
npm run assets:check    # asset pipeline validation
npm run verify:static   # assert the public pages exist as static HTML
npm run production:verify  # verify assets and routes on the live domain
npm run ci              # assets:unique + assets:check + check + test + build
```

The GitHub Actions workflow that mirrors `npm run ci` and publishes to Cloudflare lives at
`.github/workflows/ci.yml`. It needs a push token with the `workflow` scope
(`gh auth refresh -s workflow`); until then the same checks run locally with `npm run ci`.

### Static-first delivery

Public pages are pre-rendered so that a page view never consumes a Worker invocation, while authentication, private
data and account mutations stay on the backend path.

| Route | Delivery | Protected paths |
| --- | --- | --- |
| `/` (landing), `/pricing` | static HTML, excluded from Functions | `/api/*`, `/auth/*`, `/dashboard`, `/fixtures/*`, `/live`, `/odds`, `/predictions`, `/models`, `/scrapers`, `/analytics`, `/paper`, `/settings`, `/workspace`, `/admin`, `/sports/*`, `/betslip` |

The route groups make the split explicit: `(public)` is pre-rendered, `(app)` is the authenticated workspace and
`src/routes/api` plus `src/routes/auth` are the never-static backend surface. `npm run build` fails the pipeline if
the expected static pages are missing from `.svelte-kit/cloudflare`, and `npm run production:verify` checks the live
domain afterwards.

### Visual asset pipeline

Landing-page artwork is generated once and then treated as a versioned asset:

```text
src/lib/data/landing-media.json   one row per visual: id, placement, alt text, keywords
design-assets/generated-source/    raw PNG sources (not deployed)
static/images/generated/           optimised WebP masters (1536-class, q82)
static/images/responsive/          640w and 1024w derivatives
static/banners/{svg,webp}/         branded navigation-banner artwork
```

`scripts/check-asset-uniqueness.mjs` fails the build when a visual is reused across two placements, when two masters
are byte- or perceptually identical, or when a banner repeats an id, inscription, artwork or route.

### Betslip builder

`/betslip` assembles priced selections into an accumulator: combined odds and model probability are computed from the
engine, the stake plan is Kelly-based, and the slip can be downloaded as a PNG or JSON file or shared as a link
(`/betslip?slip=…`) that restores the same legs on any device.

### Convex (optional production backend)

```bash
npx convex dev          # link a project and generate convex/_generated
node scripts/seed.mjs   # seed sports, leagues, teams, fixtures, predictions, models, sources
```

Set `PUBLIC_CONVEX_URL` in `.env` to the deployment URL. The schema covers users, subscriptions, settings, sports, leagues, teams, fixtures, markets, odds, predictions, market predictions, value selections, model versions, training runs, data sources, scrape jobs, paper bets, watchlists, analysis reports, API keys and audit logs.

### Cloudflare production

The production deployment is live at **https://cavebettor.ewinproject.org**.

```bash
npm run deploy:cloudflare   # build + wrangler deploy (custom domain, Cloudflare Workers static assets)
npm run deploy:pages        # build + wrangler pages deploy (Pages project fallback)
```

`wrangler.worker.jsonc` binds the custom domain `cavebettor.ewinproject.org`, serves the SvelteKit worker and mounts the build output as static assets. `wrangler.toml` keeps the equivalent Pages project (`cavebettor.pages.dev`) deployable. Both run the same SvelteKit output.

Set production values as Worker/Pages secrets (never commit them):

```
PUBLIC_CONVEX_URL, PUBLIC_CONVEX_SITE_URL, PUBLIC_SITE_URL, PUBLIC_DEMO_MODE,
EWIN_SITE_URL, EWIN_CONVEX_SITE_URL, CONVEX_HTTP_ACTIONS_URL,
SESSION_SECRET, ADMIN_SESSION_SECRET, CAVEBETTOR_SYNC_SECRET,
SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD,
API_FOOTBALL_KEY, THE_ODDS_API_KEY, ODD_API_KEY,
AGNES_AI_KEY, AGNES_API_BASE_URL, AGNES_MODEL,
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
RESEND_API_KEY, RESEND_FROM_EMAIL,
CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_TOKEN,
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
```

Convex deployment: `https://expert-goose-697.eu-west-1.convex.cloud` (HTTP actions on `https://expert-goose-697.eu-west-1.convex.site`). The app reads Convex snapshots first and automatically falls back to the local deterministic engine if Convex is unavailable. A Cloudflare cron worker (`workers/sync-cron.ts`, deployed with `wrangler.cron.jsonc`) refreshes the snapshots every 15 minutes through the secret-guarded `/api/sync` route.

### Authentication

| Route | Purpose |
| --- | --- |
| `/auth/login` | Email + password, Google, GitHub and E-WIN sign-in |
| `/auth/register` | Create an email + password account |
| `/auth/google`, `/auth/github` | OAuth start; callbacks at `/auth/google/callback` and `/auth/github/callback` |
| `/auth/ewin` | E-WIN Hub SSO (`platform=cavebettor`) |
| `/auth/admin` | Super-admin password console |
| `/admin` | Owner console: live sync, users, revenue, integration diagnostics |

Passwords are hashed with PBKDF2-HMAC-SHA256 (210,000 iterations, 16-byte
per-account salt). That derivation is far more CPU than a Cloudflare Worker
invocation may spend, so it runs in a Convex action (`convex/passwordActions.ts`)
and the Worker only ever sees a boolean. In local development and in tests the
same code path falls back to WebCrypto over the R2 data plane. Only the verifier
and its parameters are stored. Eight failed attempts against one address lock
sign-in for 15 minutes, and a failed login never reveals whether an address
exists.

Register the exact redirect URIs in the Google Cloud and GitHub OAuth consoles:

```
https://cavebettor.ewinproject.org/auth/google/callback
https://cavebettor.ewinproject.org/auth/github/callback
```

The owner console lists these callback URLs and the live status of Convex, Agnes AI, Resend and E-WIN SSO.

### Live fixture collection

Fixtures, scores and competitions come from API-Sports, one request per sport per
day plus a live sweep. The account-wide free plan allows **100 requests a day**,
so collection never runs on page traffic:

- `wrangler.collect.jsonc` fires every 15 minutes and `POST`s to
  `/api/providers/refresh` with the sync secret.
- That route plans the tick: a full window refresh (`-1…+2` days, all five
  sports) when the snapshot is older than six hours, otherwise a live sweep —
  and only while the remaining allowance is ahead of an even burn across the
  day. Every outbound call is still gated by the budget ledger.
- Football and the NBA host expose a `live=all` filter; basketball, hockey and
  baseball do not, so those hosts pull today's slate and the in-play rows are
  selected locally.
- The live sweep is cached separately and overlaid on the collected window at
  read time, so scores and clocks stay current without rewriting ~1,500 rows.
- `GET /api/providers/refresh` reports the plan, the ledger and the last provider
  calls. `GET /api/providers/probe?sport=football&mode=live` performs exactly one
  budgeted call for one sport and returns what came back — the fastest way to
  prove a silent fallback is not real data (owner or sync-secret only).

When the allowance is spent or a provider errors, the last good snapshot keeps
serving and every page labels the source (`API-Sports`, `cached snapshot`, or
`engine fallback`) rather than claiming live data it does not have.

---

## Configuration

Every integration is optional and independently activated.

| Variable | Purpose | Fallback when absent |
| --- | --- | --- |
| `PUBLIC_CONVEX_URL` | Reactive production data | Local deterministic engine |
| `OPENAI_API_KEY` (+`OPENAI_MODEL`) | Grounded match analysis | Deterministic analyst templates |
| `API_FOOTBALL_KEY` | Fixtures, live scores, lineups, injuries, odds (100 requests/day on the free plan) | Local feature store |
| `THE_ODDS_API_KEY` | Bookmaker prices and movement | Simulated eight-book market |
| `SPORTSDB_KEY` | Badges, venues, schedules | Catalogue metadata |
| `BALLDONTLIE_KEY` | NBA box scores | Local team features |
| `PAYSTACK_SECRET_KEY` | ₦5,000/month checkout | Demo response, no charge |
| `SCRAPER_MODE` | `fixture` (default) or `live` | Fixture-mode collectors |
| `SCRAPER_USER_AGENT` | Identifies the collector | `CaveBettorBot/1.0` |

API routes:

```
GET  /api/health
GET  /api/fixtures?sport=&league=&status=&q=&limit=
GET  /api/predictions/:fixtureId
GET  /api/odds/:fixtureId
GET  /api/analysis/:fixtureId
GET  /api/search?q=
GET  /api/providers/refresh          collector state, plan and last provider calls
POST /api/providers/refresh          run a collection tick (sync secret or owner)
GET  /api/providers/probe?sport=&mode=  one budgeted provider call, one sport
POST /api/models/train        { "modelId": "mdl_gbm" }
GET  /api/scrape              capabilities
POST /api/scrape              { "sourceId": "odds-harvester", "mode": "fixture" }
POST /api/billing/checkout    { "email": "...", "plan": "pro" }
```

---

## Architecture

```
Cloudflare Pages (SvelteKit SSR + Functions)
        │
        ├── UI: Svelte 5 runes, Tailwind 4, custom SVG charts
        ├── Server routes: fixtures, predictions, odds, analysis, search, training, collection, billing
        └── Intelligence core (deterministic, pure):
              Dixon–Coles bivariate Poisson · dynamic Elo · CaveBoost GBM proxy ·
              market prior · sequence shadow model · calibration · quarter-Kelly
        │
Convex (production state)                     Workers / Cron
  fixtures · predictions · value board          collection · normalisation ·
  training runs · paper bets · audit log        retraining · drift rollback
        │
Licensed APIs · permission-aware collectors · open-source adapters
```

Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Source harmonisation and evidence: [`docs/RESEARCH.md`](docs/RESEARCH.md).

### The model contract

1. Collect prices from eight bookmakers and remove the overround.
2. Generate a sport-specific score distribution.
3. Blend statistical, machine-learning and market components.
4. Calibrate; cap divergence from the market prior unless features justify it.
5. Compute edge = `model probability × best price − 1`; keep edges ≥ 2.5%.
6. Size with quarter-Kelly, capped at 5% of bankroll.
7. Record at the best price, then measure closing-line value and calibration after settlement.

Everything is deterministic for a given fixture and timestamp, so the browser, the API and Convex compute the same number.

---

## Subscription

| Plan | Price | Notes |
| --- | --- | --- |
| Starter | Free | Public probabilities, 3 leagues, basic odds, paper bankroll |
| **Pro** | **₦5,000 / month** | **All sports, leagues, 84 markets, live probabilities, model lab, pipeline, LLM analyst, 25k API calls** |
| Trading Desk | ₦5,000 / seat / month | Up to 5 seats, shared notes, webhooks, role-based access |

Checkout is Paystack-ready. Without a secret key the endpoint returns a labelled demo response and never contacts a provider.

---

## Testing

```bash
npm test
npm run check
```

The suite covers probability normalisation, de-vigging, fair odds, Kelly bounds, normal CDF, Naira formatting, fixture generation, score-grid normalisation, market pricing consistency, value thresholds and component weighting.

---

## Data ethics & limitations

- Collect only where permitted. Respect `robots.txt`, rate limits and provider terms. Live mode is **off** by default.
- No personal data is collected from third-party pages.
- Repository contributions are **patterns and public ideas**, not copied proprietary code or assets.
- Odds displayed outside live mode are simulated bookmaker prices derived from model probabilities and realistic margins; they are clearly not live market data.
- The model does not guarantee profit. Calibration, CLV, ROI and drawdown are published — including losses.
- 18+ only. If gambling stops being fun, stop and seek local support.

## License

MIT for the application code. Third-party repositories retain their own licences; see [`docs/RESEARCH.md`](docs/RESEARCH.md). CaveBettor is an independent work and is not affiliated with any bookmaker, league or data provider.
