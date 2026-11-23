# CaveBettor — Architecture

## 1. Runtime topology

```
┌────────────────────────────────────────────────────────────────────┐
│ Cloudflare Pages (edge)                                            │
│  • SvelteKit SSR + static assets                                   │
│  • _worker.js for /api/* routes                                    │
│  • Cache: immutable assets, short TTL for fixture JSON             │
└───────────────┬───────────────────────────────┬────────────────────┘
                │                               │
     ┌──────────▼──────────┐         ┌──────────▼──────────┐
     │ Convex              │         │ Workers / Cron      │
     │ • reactive queries  │         │ • collectors        │
     │ • mutations/actions │         │ • normalisation     │
     │ • crons + HTTP API  │         │ • retraining        │
     │ • audit log         │         │ • drift rollback    │
     └──────────┬──────────┘         └──────────┬──────────┘
                │                               │
     ┌──────────▼───────────────────────────────▼──────────┐
     │ External data                                        │
     │ Licensed APIs · permission-aware collectors ·         │
     │ open-source adapters (patterns only)                  │
     └──────────────────────────────────────────────────────┘
```

The **local deterministic engine** is the reference implementation. It lets the entire product render with no credentials and gives the API, the browser and the backend a single source of truth. Convex mirrors the same entities for production multi-user state.

## 2. Routes

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/` | SSR | Command centre, KPIs, live, value, health |
| `/fixtures` | SSR + URL filters | Fixture universe |
| `/fixtures/[id]` | SSR | Match lab (analysis, markets, stats, lineups, models) |
| `/live` | SSR + 30s invalidate | In-play centre |
| `/predictions` | SSR | Ranked value board and accumulator idea |
| `/odds` | SSR + query selection | Eight-book comparison, movement, arbitrage |
| `/models` | SSR + POST training | Model registry, calibration, job history |
| `/scrapers` | SSR + POST collection | Pipeline control room |
| `/analytics` | SSR | Performance, calibration, staking simulator |
| `/paper` | SSR + client filter | Paper ledger |
| `/workspace` | SSR + localStorage | Harmonisation matrix, methodology, notes |
| `/settings` | SSR + localStorage | Profile, billing, keys, sources, prefs, security |
| `/pricing` | SSR | Plans, comparison, FAQ |
| `/admin` | SSR | MRR, users, audit, flags |
| `/auth/login`, `/auth/register` | SSR | Demo authentication screens |
| `/api/*` | Server routes | JSON contracts (see README) |

## 3. Domain model

Canonical entities (TypeScript in `src/lib/types.ts`, Convex in `convex/schema.ts`):

`Sport → League → Team → Fixture → Market → Outcome`
`Fixture → Prediction → MarketPrediction / ValueSelection`
`ModelVersion → TrainingRun`
`DataSource → ScrapeJob`
`User → Subscription / Settings / PaperBet / Watchlist / ApiKey / AuditLog`

Money is stored in whole Naira; odds are decimal; probabilities are floats in `[0,1]`.

## 4. Intelligence engine

### Football / hockey (60 min)

Dixon–Coles corrected bivariate Poisson:

```
λ_home = attack_home^1.15 · defence_away^1.10 · base · home_advantage · EloAdj
λ_away = attack_away^1.12 · defence_home^1.08 · base · 0.86 · EloAdj
P(h,a) = Poisson(λ_home,h) · Poisson(λ_away,a) · τ(h,a)
```

Low-score correction `τ` uses a negative rho (`≈ −0.085`) with deterministic jitter. Live matches scale the remaining lambdas by elapsed time and re-anchor the current score.

### Basketball

Normal margin/total model: `margin = E[home] − E[away]`, `sd ≈ 12.6` (NBA) or `≈ 9.8` (EuroLeague). Moneyline uses the normal CDF; spreads and totals use the corresponding tail probabilities.

### Tennis

Logistic Elo with a home/venue adjustment and a best-of-five amplification for Grand Slams. Game totals use a normal approximation; set betting derives from the match probability.

### Baseball

Poisson run distributions with park, pitcher and weather adjustments; moneyline, run line and totals derive from the joint grid.

### Ensemble

Weights per sport, e.g. football: Dixon–Coles 0.34, CaveBoost 0.28, Elo 0.18, market 0.20 (normalised with a shadow sequence model). The market prior is a vig-free consensus of eight books, which anchors the output and prevents unjustified drift.

### Pricing and staking

For each outcome:

```
implied_book = p · (1 + margin · 0.9) · noise
odds = 1 / implied_book
edge = p · best_odds − 1
kelly = max(0, (p(b−1) − (1−p)) / (b−1)) · 0.25
```

Only `edge ≥ 0.025` and `odds ≥ 1.3` surface as value. Stakes are floored/capped at ₦1,000–₦50,000 on the demo bankroll.

## 5. Determinism and reproducibility

- All randomness derives from `hashString(seed)` / `mulberry32`, never `Math.random()`, in fixture and prediction generation.
- Fixtures are re-generated at most once per minute from a time anchor.
- Predictions are cached by `fixtureId + status + score + minute`.
- The same input yields the same probabilities in SSR and in `/api/*`.

## 6. Data pipeline

1. **Ingest** — repo adapter, scraper worker or API client; timeouts, retries, backoff.
2. **Normalise** — canonical team/league/fixture/market/price entities; unknown fields quarantined.
3. **Validate** — range checks, duplicate detection, stale-price rejection, overround sanity.
4. **Store** — Convex plus an odds time series; immutable snapshots per training run.
5. **Learn** — feature store feeds walk-forward training; closing lines score every prediction.

`SCRAPER_MODE` defaults to `fixture`, which validates the normaliser without contacting third parties. A live run performs a `robots.txt` check, uses a declared user agent and refuses to bypass restrictions. The `bet365-scraper` pattern is labelled reference-only because browser automation is brittle and site-specific.

## 7. Security

- Secrets live in environment variables (Cloudflare/Convex), never in the client bundle.
- The browser "demo vault" on the settings page is explicitly labelled non-production and is not sent anywhere.
- Paystack checkout is server-side; the secret key never reaches the browser.
- Convex auth is expected to provide `tokenIdentifier`; `users.me` scopes every user query.
- All consequential actions (model promotion, plan change, key rotation, paper bet) are written to `auditLogs`.
- Role model: owner, analyst, viewer, admin. Admin console is guarded by role in production.

## 8. Performance & accessibility

- Charts are hand-built SVG: no chart bundle, responsive `viewBox`, tabular numerals.
- Reduced layout thrash through CSS gradients and transforms; no layout animation on scroll.
- Keyboard: command palette (`⌘K`/`Ctrl K`), visible focus rings, semantic buttons/links.
- Colour is never the only signal: labels, arrows and text accompany every state.
- Tables scroll horizontally on small screens; core actions are reachable from the mobile bottom nav.
- `prefers-reduced-motion` is respected by keeping animations short and non-essential.

## 9. Failure modes

| Failure | Behaviour |
| --- | --- |
| No Convex URL | Local engine renders the product |
| No LLM key | Deterministic analyst templates |
| Provider 429/timeout | Job marked failed/degraded with backoff; last good snapshot retained |
| Model drift > 4.2% | Champion demoted to shadow; audit entry written |
| Paystack absent | Checkout returns a clearly labelled demo response |
| Stale odds | Rejected at validation; UI shows last updated timestamp |

## 10. Roadmap

1. Wire Convex Auth + Paystack webhooks and invoice reconciliation.
2. Promote collectors to Workers with per-source queues and Durable Object rate limits.
3. Persist odds snapshots and closing lines; compute CLV automatically.
4. Train the sequence model on real data and keep it in shadow until it wins all windows.
5. Add per-league model variants and player-level markets.
6. Add exports (CSV/JSON), webhooks and a read-only public API with quotas.
