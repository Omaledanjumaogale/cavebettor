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
```

### Convex (optional production backend)

```bash
npx convex dev          # link a project and generate convex/_generated
node scripts/seed.mjs   # seed sports, leagues, teams, fixtures, predictions, models, sources
```

Set `PUBLIC_CONVEX_URL` in `.env` to the deployment URL. The schema covers users, subscriptions, settings, sports, leagues, teams, fixtures, markets, odds, predictions, market predictions, value selections, model versions, training runs, data sources, scrape jobs, paper bets, watchlists, analysis reports, API keys and audit logs.

### Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy .svelte-kit/cloudflare
```

`wrangler.toml` sets `pages_build_output_dir = ".svelte-kit/cloudflare"`. Add production secrets under **Pages → Settings → Environment variables**:

```
PUBLIC_CONVEX_URL, PAYSTACK_SECRET_KEY, OPENAI_API_KEY,
API_FOOTBALL_KEY, THE_ODDS_API_KEY, SPORTSDB_KEY, BALLDONTLIE_KEY
```

> The Cloudflare adapter pinned in this repo (`@sveltejs/adapter-cloudflare@7.x`) is the last line that supports **Pages**. Newer adapters target Workers. Both run the same SvelteKit output.

---

## Configuration

Every integration is optional and independently activated.

| Variable | Purpose | Fallback when absent |
| --- | --- | --- |
| `PUBLIC_CONVEX_URL` | Reactive production data | Local deterministic engine |
| `OPENAI_API_KEY` (+`OPENAI_MODEL`) | Grounded match analysis | Deterministic analyst templates |
| `API_FOOTBALL_KEY` | Fixtures, lineups, injuries, odds | Local feature store |
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
