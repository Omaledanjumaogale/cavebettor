# CaveBettor — Research, harmonisation and evidence register

**Engagement:** authorised product-discovery and architecture research, then implementation of a new, independent application.
**Mode:** research followed by an explicitly requested build. No private backend, account or paid dataset was accessed.
**Date:** 2026-02 · **Target:** a new product, not a copy of any supplied application.

---

## 1. Inputs

Seventeen public GitHub repositories and ten public analytics websites were supplied by the requester. Repository evidence was collected from each project's public `README.md` at its default branch (`raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md`). Website evidence was limited to the supplied URLs and public product descriptions; no site was scraped for this build and no backend was reverse engineered.

### Repository evidence register

| Repository | Observed feature themes (from public README) | Adopted into CaveBettor |
| --- | --- | --- |
| `jordantete/OddsHarvester` | OddsPortal upcoming/historical/in-play odds; multi-sport markets; community tips; CLI workflows | Odds collection contract, market taxonomy, closing-line capture |
| `cvidan/bet365-scraper` | Selenium-driven pre-match capture | Reference-only collector pattern; browser automation not promoted |
| `dos-2/oddshub` | Multi-sport aggregation across football, basketball, baseball, hockey, tennis, golf, MMA, boxing, cricket | Multi-sport fixture and odds model |
| `kyleskom/NBA-Machine-Learning-Sports-Betting` | NBA feature pipeline, neural network + XGBoost, Flask web app, odds backfill | Basketball feature framing and model comparison |
| `georgedouzas/sports-betting` | Model registry, backtesting, value bets, CLI/API/MCP interface | Model registry, walk-forward validation, value generation |
| `pretrehr/Sports-betting` | Free-bet conversion, bonus arbitrage, staking optimisation | Staking simulator, bonus mathematics reference |
| `sedemmler/WagerBrain` | Odds conversion, vig removal, Kelly, Poisson utilities | Engine core utilities, de-vigging, Kelly |
| `martineastwood/penaltyblog` | Dixon–Coles, Poisson, Elo, xG loaders | Football statistical baseline |
| `nutcas3/lets-bet` | Multi-tenant betting-engine architecture, wallets, settlement, compliance, observability | Architecture reference only — CaveBettor has no wallet |
| `NBA-Betting/NBA_AI` | Deep-learning + traditional ensemble, spreads/totals, explainability dashboard | Ensemble explanation and basketball markets |
| `klane/databall` | Lineup/pace/four-factor NBA analysis | Basketball feature ideas |
| `elonbiz/sports-betting-sportsbook` | Sportsbook front/back office, cashier, bonus engine | Admin and commercial UX reference |
| `kochlisGit/ProphitBet-Soccer-Bets-Predictor` | Soccer prediction GUI, form matrices, recommendations | Match-lab information architecture |
| `anthonyevans29/Sports-Predictor` | Agent-orchestrated prediction chains, source-of-truth reconciliation | Data reconciliation and analyst pipeline |
| `gmalbert/baseball-predictions` | Daily MLB predictions, live odds, backtests, bankroll charts | Baseball markets and bankroll presentation |
| `JonJonz7/sports-betting-analytics` | Walk-forward model-vs-market edge, calibration, ROI attribution | Calibration and performance analytics |
| `openbookie/sportbook` | Open bookmaker ledger and settlement | Paper-ledger settlement rules |
| `Omaledanjumaogale/PuntersEdge` | Dixon–Coles score matrices, market-anchored goal fitting, decision screener, trained football artifacts | Decision screening (strike, edge cap, model-vs-market gap, push discount) and score-script realism; see decision log |

### Website evidence register

| Site | Supplied purpose | Adopted UX/feature idea |
| --- | --- | --- |
| `btfstats.com` | Team form, xG, statistical previews | Form and xG panels in the match lab |
| `packball.com/en/matches` | Fixtures and live scores | Fixture grouping and live board |
| `redscores.com/football-predictions` | Prediction percentages and tipster confidence | Model-vs-consensus comparison |
| `sports-iq.co.uk` | Advanced football analytics and ratings | Matchup ratings language |
| `sbostats.com/partite` | Odds movement and comparison | Movement radar and eight-book matrix |
| `statschecker.com` | Team stats, streaks, head-to-head | H2H and form modules |
| `tennisbrain.com/predictions` | Tennis probabilities and surface form | Tennis probability model and set markets |
| `progsport.com` | Statistical football forecasts | Forecast presentation |
| `forebet.com` (basketball) | Basketball probability forecasts | Basketball probability layout |

---

## 2. Harmonisation decisions

The product is organised around **one canonical probability contract**, not around each source's UI. Every sport produces the same shape:

```
Fixture → Prediction { probabilities, expected score(s), score distribution,
                       markets[outcomes{modelProbability, fairOdds, bestOdds, edge}],
                       components[], confidence, valueSelections[] }
```

This lets the value board, odds comparison, paper desk, calibration audit and API share one model of the world.

| Capability | Source inspiration | CaveBettor implementation |
| --- | --- | --- |
| Odds collection | OddsHarvester, oddshub, sbostats | Eight-book simulated market with realistic margins; adapter contract for live feeds |
| Vig removal | WagerBrain, penaltyblog | Proportional de-vig in `engine/core.ts` |
| Football probabilities | penaltyblog | Dixon–Coles corrected bivariate Poisson |
| Basketball probabilities | NBA_AI, NBA-ML | Normal margin/total model with sport-specific SDs |
| Tennis probabilities | tennisbrain | Elo + best-of-five amplification |
| Hockey & baseball | oddshub, baseball-predictions | Shot-volume Poisson / run-environment Poisson |
| Value detection | sports-betting (georgedouzas), WagerBrain, PuntersEdge | Edge threshold + quarter-Kelly, then PuntersEdge-style screening: edge cap 25%, model-versus-market gap cap 15 points, push discount on whole lines |
| Calibration | sports-betting-analytics | Reliability buckets, Brier, log-loss, drift |
| Model lifecycle | sports-betting, NBA_AI | Registry, shadow mode, walk-forward gate, rollback |
| Bankroll analytics | baseball-predictions, sports-betting-analytics | Equity curve, drawdown, CLV, monthly attribution |
| Multi-sport coverage | oddshub | 5 sports, 20 leagues, 84 markets |
| Back office | sportsbook repos | Admin console, MRR, audit log, feature flags |

**What was deliberately not carried over:** real-money wallets, deposits, bet placement, casino flows, multi-tenant payment rails and any licensed code or assets. CaveBettor is research software, and the commercial product is a subscription to intelligence.

---

## 3. Observations, inferences and unknowns

### Observations (supported by supplied public material)

- The supplied repositories collectively cover odds collection, statistical modelling, machine learning, backtesting, staking, bankroll charts and sportsbook back-office patterns.
- Several repositories explicitly report walk-forward backtesting, calibration, ROI and bankroll curves.
- The supplied analytics sites present fixtures, probability percentages, form, head-to-head and odds movement.

### Inferences (design choices, not claims about the targets)

- A single probability contract is the cleanest way to harmonise heterogeneous sports.
- Market-implied probability is a strong prior and should anchor any ensemble.
- Value detection without a calibration audit is unfalsifiable, so calibration and CLV are first-class product surfaces.
- A Naira-first subscription product is viable because the requester specified Nigeria as the primary market.

### Unknowns / not verified

- The private backends, data pipelines and exact model internals of every repository and website were **not** reverse engineered. Public README claims were not independently reproduced.
- No live odds, live scores or paid API responses were fetched for this build. Displayed odds outside live mode are **simulated** from model probabilities and bookmaker margins.
- No third-party site was scraped. Collectors default to fixture mode and require explicit permission/keys to run live.
- Model accuracy, ROI and calibration figures shown in the UI are seeded demonstration values from the deterministic engine, not audited historical performance.
- Paystack checkout was implemented against its documented API but not executed without a secret key.
- Convex functions were authored against the documented API; a deployment was not linked in this environment, so runtime behaviour of the Convex backend is unverified here.

---

## 4. Build decisions

1. **SvelteKit 5 + Tailwind 4** for SSR, file-based routing and a design system that can express a dense analytical product.
2. **Deterministic local engine** so the product is demonstrable and testable without secrets, and so every probability is reproducible.
3. **Convex schema** mirroring the same entities for production, with queries/mutations/crons/HTTP endpoints.
4. **Cloudflare Pages** deployment as requested, using the last adapter line that supports Pages.
5. **No chart library** — custom SVG charts keep the bundle lean and the aesthetic consistent.
6. **Honest boundaries** — every surface states that CaveBettor is not a sportsbook and does not guarantee winnings.

### Decision log — PuntersEdge audit (November 2026)

PuntersEdge was read as a reference implementation, not copied: its Dixon–Coles matrix, market-anchored parameter fitting and decision screener were compared with CaveBettor's own engine line by line.

- **Adopted — decision screening.** A call is published only when its strike rate is at least 64%, its edge sits between 1% and 25%, and the model-versus-market gap is no wider than 15 points. Whole-number lines are discounted for the push first (4.5%), because a result can land exactly on the line. The cap on edge is the important one: an edge above 25% is a stale price or a drifted model, not free money.
- **Adopted — one score script per fixture.** The final score is now sampled from the same distribution the model prices and dealt across periods as a monotonic timeline, so a 3–1 final is 3–1 on every surface and its half-time line adds up.
- **Adopted — stable fixture identity.** Fixture ids and scripts are seeded by league, teams and kick-off timestamp on a fixed UTC calendar, so a match does not change result when the board is refreshed.
- **Evaluated, not adopted — trained attack/defence artifacts.** PuntersEdge's `training/artifacts/football.json` fits 24 clubs keyed by football-data.org ids. CaveBettor's 20 competitions use its own team registry, so the numbers cannot be joined without a mapping table; its global priors (home advantage ≈ 0.10 in log space, rho 0) are consistent with CaveBettor's Dixon–Coles configuration, which was left as-is.
- **Evaluated, not adopted — market-anchored goal fitting.** Fitting λ from over/under prices requires a de-vigged two-way totals market per fixture. CaveBettor's prices are model-generated, so fitting the model back to its own prices would be circular; the idea is recorded for when a live odds provider is connected.

---

## 5. Limitations and next evidence to collect

- Validate live adapters against each provider's terms and field mappings.
- Replace seeded model metrics with real walk-forward results once historical data is licensed.
- Add authentication and payment webhooks, then reconcile subscriptions.
- Run accessibility and performance audits on the deployed build.
- Record real closing lines and compute CLV automatically.

## 6. Licence & attribution

CaveBettor is an independent MIT-licensed implementation. The repositories above retain their own licences; only publicly described ideas and patterns were reimplemented. No third-party code, dataset or brand asset is bundled. Bookmaker names are used descriptively for market comparison and do not imply affiliation.
