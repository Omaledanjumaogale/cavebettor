/**
 * CaveBettor — shared domain model.
 *
 * Everything the workspace renders is typed here so that the same shapes are
 * used by the local intelligence engine, the API routes and the Convex
 * functions. Monetary values are stored in NGN kobo-safe integers where they
 * represent money, and decimal odds everywhere odds are shown.
 */

export type SportId = 'football' | 'basketball' | 'tennis' | 'icehockey' | 'baseball';

export type FixtureStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed';

export interface Sport {
  id: SportId;
  name: string;
  icon: string;
  accent: string;
  hasDraw: boolean;
}

export interface League {
  id: string;
  name: string;
  shortName: string;
  country: string;
  countryCode: string;
  sport: SportId;
  tier: number;
  season: string;
  logo: string;
  colour: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  leagueId: string;
  sport: SportId;
  elo: number;
  attack: number;
  defence: number;
  form: FormResult[];
  xgFor: number;
  xgAgainst: number;
  cleanSheets: number;
  badges: string[];
}

export type FormResult = 'W' | 'D' | 'L';

export interface Fixture {
  id: string;
  sport: SportId;
  leagueId: string;
  homeId: string;
  awayId: string;
  kickoff: string;
  status: FixtureStatus;
  minute?: number;
  period?: string;
  score: { home: number; away: number };
  venue: string;
  round: string;
  attendance?: number;
  weather?: string;
  officials?: string[];
  h2h: { homeWins: number; draws: number; awayWins: number; last: string[] };
  lineups?: { home: string[]; away: string[] };
  stats?: LiveStats;
}

export interface LiveStats {
  possession: [number, number];
  shots: [number, number];
  shotsOnTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  yellow: [number, number];
  red: [number, number];
  xg: [number, number];
}

export type MarketGroup =
  | 'match'
  | 'handicap'
  | 'totals'
  | 'score'
  | 'goalscorer'
  | 'period'
  | 'sets'
  | 'special';

export interface MarketOutcome {
  id: string;
  label: string;
  shortLabel?: string;
  modelProbability: number;
  fairOdds: number;
  bookOdds: number;
  bestBook: string;
  edge: number;
  kelly: number;
  trend: number;
  confidence: number;
  value: boolean;
}

export interface Market {
  id: string;
  group: MarketGroup;
  label: string;
  description?: string;
  outcomes: MarketOutcome[];
  bookmakerCount: number;
  updatedAt: string;
}

export interface ModelComponent {
  id: string;
  name: string;
  family: 'statistical' | 'machine-learning' | 'market' | 'ensemble' | 'llm';
  weight: number;
  homeProbability: number;
  drawProbability: number;
  awayProbability: number;
  confidence: number;
  note: string;
  accuracy?: number;
}

export interface ScoreCell {
  home: number;
  away: number;
  probability: number;
  total: number;
}

export interface Prediction {
  fixtureId: string;
  generatedAt: string;
  modelVersion: string;
  ensembleVersion: string;
  expectedGoals: { home: number; away: number; total: number };
  probabilities: { home: number; draw: number; away: number };
  fairOdds: { home: number; draw: number; away: number };
  doubleChance: { homeOrDraw: number; homeOrAway: number; drawOrAway: number };
  bothTeamsScore: number;
  over15: number;
  over25: number;
  over35: number;
  scoreGrid: ScoreCell[];
  topScorelines: ScoreCell[];
  markets: Market[];
  components: ModelComponent[];
  confidence: number;
  dataQuality: number;
  edge: number;
  valueBets: ValueBet[];
  recommended: Recommendation;
  insights: Insight[];
  expectedPoints?: { home: number; away: number };
  spread?: { line: number; homeCover: number; awayCover: number };
  totalLine?: { line: number; over: number; under: number };
}

export interface ValueBet {
  market: string;
  marketId: string;
  selection: string;
  odds: number;
  modelProbability: number;
  impliedProbability: number;
  edge: number;
  kellyStake: number;
  stakeNgn: number;
  confidence: number;
  bookmaker: string;
}

export interface Recommendation {
  selection: string;
  market: string;
  odds: number;
  modelProbability: number;
  stakeNgn: number;
  confidence: number;
  rationale: string;
  risk: 'low' | 'medium' | 'high';
}

export interface Insight {
  kind: 'model' | 'market' | 'form' | 'injury' | 'weather' | 'arbitrage' | 'warning' | 'llm';
  title: string;
  body: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface Bookmaker {
  id: string;
  name: string;
  shortName: string;
  margin: number;
  licence: string;
  naira: boolean;
  colour: string;
  rating: number;
}

export interface ModelVersion {
  id: string;
  name: string;
  family: ModelComponent['family'];
  sport: SportId | 'multi';
  version: string;
  status: 'production' | 'shadow' | 'training' | 'archived';
  accuracy: number;
  logLoss: number;
  brier: number;
  roi: number;
  sampleSize: number;
  trainedAt: string;
  features: number;
  drift: number;
  calibration: { bucket: string; predicted: number; observed: number; count: number }[];
  featureImportance: { name: string; weight: number }[];
  description: string;
}

export interface TrainingRun {
  id: string;
  modelId: string;
  sport: SportId | 'multi';
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  epochs: number;
  currentEpoch: number;
  trainRows: number;
  validationRows: number;
  metrics: { accuracy: number; logLoss: number; brier: number; roi: number };
  walkForward: { window: string; accuracy: number; roi: number; bets: number }[];
  notes: string;
}

export interface DataSource {
  id: string;
  name: string;
  kind: 'scraper' | 'api' | 'repo' | 'internal';
  url: string;
  sport: SportId | 'multi';
  status: 'healthy' | 'degraded' | 'offline' | 'needs-key' | 'planned';
  coverage: number;
  markets: number;
  latencyMs: number;
  lastChecked: string;
  recordsToday: number;
  reliability: number;
  requiresKey: boolean;
  note: string;
}

export interface ScrapeJob {
  id: string;
  sourceId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';
  startedAt: string;
  durationMs: number;
  records: number;
  rejected: number;
  message: string;
}

export interface PaperBet {
  id: string;
  fixtureId: string;
  fixtureLabel: string;
  selection: string;
  market: string;
  odds: number;
  stakeNgn: number;
  status: 'open' | 'won' | 'lost' | 'void';
  modelProbability: number;
  edge: number;
  placedAt: string;
  settledAt?: string;
  pnlNgn?: number;
}

export interface BankrollPoint {
  date: string;
  bankrollNgn: number;
  pnlNgn: number;
  bets: number;
  yield: number;
}

export interface WorkspaceMetrics {
  bankrollNgn: number;
  startingBankrollNgn: number;
  profitNgn: number;
  roi: number;
  yield: number;
  strikeRate: number;
  avgOdds: number;
  clv: number;
  openExposureNgn: number;
  settledBets: number;
  openBets: number;
  maxDrawdown: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'analyst' | 'viewer' | 'admin';
  plan: SubscriptionPlan;
  planStatus: 'active' | 'trialing' | 'past_due' | 'cancelled';
  renewsAt: string;
  workspace: string;
  timezone: string;
  currency: 'NGN';
  avatar: string;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceNgn: number;
  interval: 'month';
  tagline: string;
  features: string[];
  limits: { watchlists: number; apiCalls: number; seats: number; llmReports: number };
  featured?: boolean;
}

export interface AnalyticsSummary {
  labels: string[];
  bankroll: number[];
  yield: number[];
  accuracy: number[];
  roiBySport: { sport: SportId; bets: number; roi: number; yield: number }[];
  roiByMarket: { market: string; bets: number; roi: number; strike: number }[];
  monthly: { month: string; bets: number; stakedNgn: number; profitNgn: number; roi: number }[];
  calibration: { bucket: string; predicted: number; observed: number; count: number }[];
}
