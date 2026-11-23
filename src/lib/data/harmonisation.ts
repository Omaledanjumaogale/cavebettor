export interface HarmonisedSource {
  id: string;
  name: string;
  url: string;
  kind: 'repo' | 'site' | 'api';
  contributions: string[];
  cavebettorModules: string[];
  status: 'adopted' | 'adapted' | 'reference';
}

/** Evidence-based feature harmonisation matrix used by the Research notes page. */
export const HARMONISATION: HarmonisedSource[] = [
  {
    id: 'oddsharvester',
    name: 'OddsHarvester',
    url: 'https://github.com/jordantete/OddsHarvester',
    kind: 'repo',
    contributions: ['OddsPortal upcoming/historical/in-play collection', 'Multi-sport market coverage', 'Community prediction snapshots', 'CLI-first normalisation'],
    cavebettorModules: ['Data pipeline', 'Odds & markets', 'Closing-line value'],
    status: 'adopted'
  },
  {
    id: 'bet365-scraper',
    name: 'bet365-scraper',
    url: 'https://github.com/cvidan/bet365-scraper',
    kind: 'repo',
    contributions: ['Selenium pre-match odds capture', 'Browser-driven fallback for JS-heavy books'],
    cavebettorModules: ['Data pipeline'],
    status: 'reference'
  },
  {
    id: 'oddshub',
    name: 'oddshub',
    url: 'https://github.com/dos-2/oddshub',
    kind: 'repo',
    contributions: ['Multi-sport aggregation', 'Football, basketball, baseball, hockey, tennis, golf, MMA, boxing, cricket coverage'],
    cavebettorModules: ['Fixtures', 'Odds & markets'],
    status: 'adopted'
  },
  {
    id: 'nba-ml',
    name: 'NBA Machine Learning Sports Betting',
    url: 'https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting',
    kind: 'repo',
    contributions: ['NBA feature pipeline', 'Neural network + XGBoost comparison', 'Flask reporting patterns', 'Odds backfilling'],
    cavebettorModules: ['Model lab', 'Basketball analysis'],
    status: 'adapted'
  },
  {
    id: 'sports-betting-py',
    name: 'sports-betting (georgedouzas)',
    url: 'https://github.com/georgedouzas/sports-betting',
    kind: 'repo',
    contributions: ['Model registry', 'Walk-forward backtesting', 'Value-bet generation', 'MCP/agent interface'],
    cavebettorModules: ['Model lab', 'Value board', 'API'],
    status: 'adopted'
  },
  {
    id: 'sports-betting-bonus',
    name: 'Sports-betting (pretrehr)',
    url: 'https://github.com/pretrehr/Sports-betting',
    kind: 'repo',
    contributions: ['Free-bet conversion mathematics', 'Bonus arbitrage combinations', 'Stake optimisation'],
    cavebettorModules: ['Staking simulator', 'Research notes'],
    status: 'adapted'
  },
  {
    id: 'wagerbrain',
    name: 'WagerBrain',
    url: 'https://github.com/sedemmler/WagerBrain',
    kind: 'repo',
    contributions: ['Odds conversion', 'Vig removal', 'Kelly staking', 'Poisson utilities'],
    cavebettorModules: ['Engine core', 'Staking', 'Odds'],
    status: 'adopted'
  },
  {
    id: 'penaltyblog',
    name: 'penaltyblog',
    url: 'https://github.com/martineastwood/penaltyblog',
    kind: 'repo',
    contributions: ['Dixon–Coles model', 'Poisson and Elo implementations', 'xG data loaders', 'Football modelling reference'],
    cavebettorModules: ['Ensemble', 'Football analysis'],
    status: 'adopted'
  },
  {
    id: 'lets-bet',
    name: 'lets-bet',
    url: 'https://github.com/nutcas3/lets-bet',
    kind: 'repo',
    contributions: ['Production betting-engine architecture', 'Wallet and settlement flows', 'Risk and compliance patterns', 'Observability'],
    cavebettorModules: ['Architecture', 'Admin', 'Paper desk'],
    status: 'reference'
  },
  {
    id: 'nba-ai',
    name: 'NBA_AI',
    url: 'https://github.com/NBA-Betting/NBA_AI',
    kind: 'repo',
    contributions: ['Deep-learning + traditional ensemble', 'Spread and totals modelling', 'Explainability dashboard'],
    cavebettorModules: ['Model lab', 'Basketball analysis'],
    status: 'adapted'
  },
  {
    id: 'databall',
    name: 'databall',
    url: 'https://github.com/klane/databall',
    kind: 'repo',
    contributions: ['Lineup, pace and four-factor analysis', 'NBA pre-game modelling'],
    cavebettorModules: ['Basketball features'],
    status: 'reference'
  },
  {
    id: 'sportsbook',
    name: 'sports-betting-sportsbook',
    url: 'https://github.com/elonbiz/sports-betting-sportsbook',
    kind: 'repo',
    contributions: ['Back-office and cashier workflows', 'Bonus engine patterns', 'Admin dashboards'],
    cavebettorModules: ['Admin', 'Subscription'],
    status: 'reference'
  },
  {
    id: 'prophitbet',
    name: 'ProphitBet v3',
    url: 'https://github.com/kochlisGit/ProphitBet-Soccer-Bets-Predictor',
    kind: 'repo',
    contributions: ['Soccer prediction workflows', 'Form matrices', 'Bet recommendation UX'],
    cavebettorModules: ['Fixture analysis', 'Value board'],
    status: 'adapted'
  },
  {
    id: 'sports-predictor',
    name: 'Sports-Predictor',
    url: 'https://github.com/anthonyevans29/Sports-Predictor',
    kind: 'repo',
    contributions: ['Agent-orchestrated prediction chains', 'Source-of-truth reconciliation'],
    cavebettorModules: ['LLM analyst', 'Data pipeline'],
    status: 'adapted'
  },
  {
    id: 'baseball-predictions',
    name: 'baseball-predictions',
    url: 'https://github.com/gmalbert/baseball-predictions',
    kind: 'repo',
    contributions: ['Daily MLB predictions', 'Live odds', 'Backtests and bankroll charts'],
    cavebettorModules: ['Baseball analysis', 'Performance'],
    status: 'adopted'
  },
  {
    id: 'betting-analytics',
    name: 'sports-betting-analytics',
    url: 'https://github.com/JonJonz7/sports-betting-analytics',
    kind: 'repo',
    contributions: ['Walk-forward model-vs-market edge', 'Calibration reporting', 'ROI attribution'],
    cavebettorModules: ['Performance', 'Model lab'],
    status: 'adopted'
  },
  {
    id: 'sportbook',
    name: 'Sportbook',
    url: 'https://github.com/openbookie/sportbook',
    kind: 'repo',
    contributions: ['Open bookmaker ledger', 'Market settlement reference'],
    cavebettorModules: ['Paper desk'],
    status: 'reference'
  },
  {
    id: 'btfstats',
    name: 'btfstats.com',
    url: 'https://btfstats.com',
    kind: 'site',
    contributions: ['Team form and xG previews', 'Statistical match context'],
    cavebettorModules: ['Fixture analysis', 'Feature store'],
    status: 'adapted'
  },
  {
    id: 'packball',
    name: 'packball.com',
    url: 'https://packball.com/en/matches',
    kind: 'site',
    contributions: ['Fixture list and live scores', 'Market snapshots'],
    cavebettorModules: ['Fixtures', 'Live centre'],
    status: 'adapted'
  },
  {
    id: 'redscores',
    name: 'redscores.com',
    url: 'https://redscores.com/football-predictions',
    kind: 'site',
    contributions: ['Consensus prediction percentages', 'Tipster confidence comparison'],
    cavebettorModules: ['Model comparison', 'Value board'],
    status: 'adapted'
  },
  {
    id: 'sports-iq',
    name: 'sports-iq.co.uk',
    url: 'https://sports-iq.co.uk',
    kind: 'site',
    contributions: ['Advanced football analytics', 'Matchup ratings'],
    cavebettorModules: ['Fixture analysis'],
    status: 'reference'
  },
  {
    id: 'sbostats',
    name: 'sbostats.com',
    url: 'https://www.sbostats.com/partite',
    kind: 'site',
    contributions: ['Odds movement', 'Bookmaker comparison'],
    cavebettorModules: ['Odds & markets', 'Movement radar'],
    status: 'adapted'
  },
  {
    id: 'statschecker',
    name: 'statschecker.com',
    url: 'https://www.statschecker.com',
    kind: 'site',
    contributions: ['Multi-sport team statistics', 'Streaks and head-to-head'],
    cavebettorModules: ['Stats & form', 'Features'],
    status: 'adapted'
  },
  {
    id: 'tennisbrain',
    name: 'tennisbrain.com',
    url: 'https://www.tennisbrain.com/predictions',
    kind: 'site',
    contributions: ['Tennis win probabilities', 'Surface form and set markets'],
    cavebettorModules: ['Tennis analysis'],
    status: 'adapted'
  },
  {
    id: 'progsport',
    name: 'progsport.com',
    url: 'https://www.progsport.com',
    kind: 'site',
    contributions: ['Statistical football forecasts'],
    cavebettorModules: ['Fixture analysis'],
    status: 'reference'
  },
  {
    id: 'forebet',
    name: 'forebet.com',
    url: 'https://www.forebet.com/en/basketball/predictions-today',
    kind: 'site',
    contributions: ['Basketball probability forecasts', 'Score distributions'],
    cavebettorModules: ['Basketball analysis'],
    status: 'adapted'
  }
];

export const SPORT_MARKETS = [
  { sport: 'Football', markets: ['1X2', 'Double chance', 'Draw no bet', 'BTTS', 'Over/Under 1.5–3.5', 'Asian handicap', 'Correct score'], primary: 'Dixon–Coles + GBM' },
  { sport: 'Basketball', markets: ['Moneyline', 'Points spread', 'Total points', 'Team totals'], primary: 'Normal margin model + GBM' },
  { sport: 'Tennis', markets: ['Match winner', 'Set betting', 'Total games', 'Game handicap'], primary: 'Elo + surface + sequence' },
  { sport: 'Ice hockey', markets: ['1X2 (60 min)', 'Moneyline incl. OT', 'Puck line', 'Total goals'], primary: 'Shot-volume Poisson' },
  { sport: 'Baseball', markets: ['Moneyline', 'Run line', 'Total runs'], primary: 'Pitcher-led run environment' }
];

export const ARCHITECTURE_LAYERS = [
  { name: 'Experience', detail: 'SvelteKit 5 · Tailwind CSS 4 · responsive command centre, fixture lab, value board, model lab and pipeline console.' },
  { name: 'API', detail: 'SvelteKit server routes for fixtures, predictions, odds, analysis, search, training and collection. JSON, cache-friendly, Cloudflare Pages Functions.' },
  { name: 'Intelligence', detail: 'Deterministic ensemble: Dixon–Coles bivariate Poisson, dynamic Elo, gradient boosting proxy, market prior, sequence shadow model, calibration and Kelly staking.' },
  { name: 'Data', detail: 'Convex reactive database (schema, queries, mutations, actions) with a local deterministic engine fallback so the product renders without credentials.' },
  { name: 'Automation', detail: 'Scheduled collection, normalisation gates, nightly walk-forward retraining, hourly calibration audit and drift rollback.' },
  { name: 'Commercial', detail: '₦5,000/month subscription, Paystack-ready checkout contract, role-based workspaces, API quotas and audit logs.' }
];
