import type { RetainedResult } from './history';

/**
 * Daily self-training.
 *
 * Runs at 04:00 Africa/Lagos (03:00 UTC). It collects the retained results,
 * evaluates candidate models chronologically over walk-forward windows and
 * keeps the current production champion unless a candidate passes every
 * improvement check.
 *
 * Nothing in this loop touches a paid provider: it uses the retained results
 * and the historical exports already in the data plane.
 */

export interface CandidateModel {
  id: string;
  name: string;
  version: string;
  description: string;
  /**
   * Blending weights applied to the retained per-component probabilities.
   * The retained set stores the published ensemble probability, so a
   * candidate re-weights the model vs. the market prior it was published
   * with. `modelWeight` is the share given to the model and the remainder
   * to the market-implied probability.
   */
  modelWeight: number;
  /** Edge threshold (probability difference) at which a bet is placed. */
  valueThreshold: number;
}

export interface WindowMetrics {
  window: string;
  from: string;
  to: string;
  rows: number;
  accuracy: number;
  logLoss: number;
  brier: number;
  roi: number;
  bets: number;
  wins: number;
}

export interface EvaluationResult {
  candidateId: string;
  championId: string;
  windows: WindowMetrics[];
  accuracy: number;
  logLoss: number;
  brier: number;
  roi: number;
  bets: number;
  wins: number;
  checks: {
    name: string;
    passed: boolean;
    detail: string;
    threshold: string;
  }[];
  promoted: boolean;
  reason: string;
}

export const CHAMPION_ID = 'cavebettor-ensemble-v7.3';

/** The candidate set is evaluated every night against the champion. */
export const CANDIDATES: CandidateModel[] = [
  {
    id: 'cavebettor-ensemble-v7.3',
    name: 'CaveBettor Ensemble',
    version: 'v7.3',
    description: 'Current production champion: Dixon–Coles, Elo, CaveBoost and a vig-free market prior.',
    modelWeight: 1,
    valueThreshold: 0.025
  },
  {
    id: 'cavebettor-ensemble-v7.4-market-tilt',
    name: 'CaveBettor Ensemble (market-tilted)',
    version: 'v7.4-rc1',
    description: 'Shifts weight toward the de-vigged market consensus to reduce variance on low-confidence fixtures.',
    modelWeight: 0.85,
    valueThreshold: 0.02
  },
  {
    id: 'cavebettor-ensemble-v7.4-model-tilt',
    name: 'CaveBettor Ensemble (model-tilted)',
    version: 'v7.4-rc2',
    description: 'Shifts weight toward the structural model to capture sharper edges on under-covered fixtures.',
    modelWeight: 1.12,
    valueThreshold: 0.03
  }
];

/** Minimum sample before a candidate is even considered. */
const MIN_ROWS = 12;
/** Windows used for the chronological walk-forward evaluation. */
const WINDOWS = 4;
/** A candidate must win at least this share of windows to be promoted. */
const WINDOW_MAJORITY = 0.6;
/** Minimum accuracy improvement required for promotion. */
const MIN_ACCURACY_GAIN = 0.002;
/** Maximum tolerated log-loss regression. */
const MAX_LOG_LOSS_REGRESSION = 0.004;
/** Maximum tolerated Brier regression. */
const MAX_BRIER_REGRESSION = 0.0015;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Re-weight a published probability with the market-implied probability.
 *
 * `modelWeight` above 1 sharpens the model view, below 1 pulls it back
 * toward the market. This is how a candidate is expressed against the
 * retained history without re-training the whole ensemble.
 */
export function applyCandidate(
  result: RetainedResult,
  candidate: CandidateModel
): { home: number; draw: number; away: number } {
  const impliedHome = result.odds.home > 0 ? 1 / result.odds.home : result.predicted.home;
  const impliedAway = result.odds.away > 0 ? 1 / result.odds.away : result.predicted.away;
  const impliedDraw = result.odds.draw > 0 ? 1 / result.odds.draw : result.predicted.draw;
  const mix = (model: number, market: number) =>
    clamp(model * candidate.modelWeight + market * (1 - candidate.modelWeight), 0.001, 0.999);
  const home = mix(result.predicted.home, impliedHome);
  const away = mix(result.predicted.away, impliedAway);
  const draw = clamp(
    result.predicted.draw * candidate.modelWeight + impliedDraw * (1 - candidate.modelWeight),
    0.001,
    0.999
  );
  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total };
}

function pick(probs: { home: number; draw: number; away: number }): 'home' | 'draw' | 'away' {
  if (probs.home >= probs.draw && probs.home >= probs.away) return 'home';
  if (probs.draw >= probs.away) return 'draw';
  return 'away';
}

function evaluateWindow(rows: RetainedResult[], candidate: CandidateModel, label: string): WindowMetrics {
  let correct = 0;
  let logLoss = 0;
  let brier = 0;
  let staked = 0;
  let returned = 0;
  let bets = 0;
  let wins = 0;

  for (const row of rows) {
    const probs = applyCandidate(row, candidate);
    const actual = row.actual;
    const actualProbs = [actual.home, actual.draw, actual.away];
    const modelProbs = [probs.home, probs.draw, probs.away];

    for (let i = 0; i < 3; i++) {
      const p = Math.min(0.999, Math.max(0.001, modelProbs[i]));
      logLoss += -(actualProbs[i] * Math.log(p));
      brier += (modelProbs[i] - actualProbs[i]) ** 2;
    }

    if (pick(probs) === pick(actual)) correct += 1;

    // Value bet: the model price beats the stored market price.
    const prices = [row.odds.home, row.odds.draw, row.odds.away];
    let bestEdge = 0;
    let bestIndex = -1;
    let bestPrice = 0;
    for (let i = 0; i < 3; i++) {
      if (prices[i] <= 1.01) continue;
      const edge = modelProbs[i] * prices[i] - 1;
      if (edge > bestEdge) {
        bestEdge = edge;
        bestIndex = i;
        bestPrice = prices[i];
      }
    }
    if (bestIndex >= 0 && bestEdge >= candidate.valueThreshold) {
      bets += 1;
      staked += 1;
      const won = actualProbs[bestIndex] === 1;
      if (won) {
        wins += 1;
        returned += bestPrice;
      }
      void row;
    }
  }

  const n = Math.max(1, rows.length);
  return {
    window: label,
    from: rows[0]?.kickoff ?? '',
    to: rows[rows.length - 1]?.kickoff ?? '',
    rows: rows.length,
    accuracy: correct / n,
    logLoss: logLoss / n,
    brier: brier / n,
    roi: staked > 0 ? ((returned - staked) / staked) * 100 : 0,
    bets,
    wins
  };
}

/**
 * Chronological walk-forward evaluation.
 *
 * Results are ordered by kick-off and split into contiguous windows. A
 * candidate never sees a later window during an earlier one, so this is a
 * genuine out-of-time test rather than a shuffled cross-validation.
 */
export function evaluateCandidate(
  history: RetainedResult[],
  candidate: CandidateModel,
  champion: CandidateModel
): EvaluationResult {
  const ordered = [...history].sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
  const usable = ordered.slice(-Math.max(MIN_ROWS * WINDOWS, ordered.length));

  const size = Math.floor(usable.length / WINDOWS);
  const windows: WindowMetrics[] = [];
  for (let w = 0; w < WINDOWS; w++) {
    const slice = usable.slice(w * size, w === WINDOWS - 1 ? usable.length : (w + 1) * size);
    if (slice.length) windows.push(evaluateWindow(slice, candidate, `W${w + 1}`));
  }

  const championWindows: WindowMetrics[] = [];
  for (let w = 0; w < WINDOWS; w++) {
    const slice = usable.slice(w * size, w === WINDOWS - 1 ? usable.length : (w + 1) * size);
    if (slice.length) championWindows.push(evaluateWindow(slice, champion, `W${w + 1}`));
  }

  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  const accuracy = mean(windows.map((w) => w.accuracy));
  const logLoss = mean(windows.map((w) => w.logLoss));
  const brier = mean(windows.map((w) => w.brier));
  const roi = mean(windows.map((w) => w.roi));
  const bets = windows.reduce((a, w) => a + w.bets, 0);
  const wins = windows.reduce((a, w) => a + w.wins, 0);

  const champAccuracy = mean(championWindows.map((w) => w.accuracy));
  const champLogLoss = mean(championWindows.map((w) => w.logLoss));
  const champBrier = mean(championWindows.map((w) => w.brier));
  const champRoi = mean(championWindows.map((w) => w.roi));

  const windowWins = windows.filter((w, i) => w.accuracy >= (championWindows[i]?.accuracy ?? 0)).length;
  const windowShare = windows.length ? windowWins / windows.length : 0;
  const enoughRows = usable.length >= MIN_ROWS;

  const checks = [
    {
      name: 'Adequate sample',
      passed: enoughRows,
      detail: `${usable.length} retained results across ${windows.length} walk-forward windows`,
      threshold: `≥ ${MIN_ROWS} rows`
    },
    {
      name: 'Accuracy improvement',
      passed: accuracy - champAccuracy >= MIN_ACCURACY_GAIN,
      detail: `candidate ${(accuracy * 100).toFixed(2)}% vs champion ${(champAccuracy * 100).toFixed(2)}%`,
      threshold: `≥ +${(MIN_ACCURACY_GAIN * 100).toFixed(2)}pp`
    },
    {
      name: 'Log-loss guard',
      passed: logLoss - champLogLoss <= MAX_LOG_LOSS_REGRESSION,
      detail: `candidate ${logLoss.toFixed(4)} vs champion ${champLogLoss.toFixed(4)}`,
      threshold: `regression ≤ ${MAX_LOG_LOSS_REGRESSION}`
    },
    {
      name: 'Brier guard',
      passed: brier - champBrier <= MAX_BRIER_REGRESSION,
      detail: `candidate ${brier.toFixed(4)} vs champion ${champBrier.toFixed(4)}`,
      threshold: `regression ≤ ${MAX_BRIER_REGRESSION}`
    },
    {
      name: 'Window majority',
      passed: windowShare >= WINDOW_MAJORITY,
      detail: `${windowWins} of ${windows.length} windows at or above the champion`,
      threshold: `≥ ${(WINDOW_MAJORITY * 100).toFixed(0)}% of windows`
    },
    {
      name: 'ROI not degraded',
      passed: roi >= champRoi - 1,
      detail: `candidate ${roi.toFixed(2)}% vs champion ${champRoi.toFixed(2)}%`,
      threshold: 'regression ≤ 1pp'
    }
  ];

  const promoted = checks.every((c) => c.passed);
  return {
    candidateId: candidate.id,
    championId: champion.id,
    windows,
    accuracy,
    logLoss,
    brier,
    roi,
    bets,
    wins,
    checks,
    promoted,
    reason: promoted
      ? 'Candidate passed every improvement check and is promoted to production.'
      : `Champion retained — ${checks.filter((c) => !c.passed).map((c) => c.name.toLowerCase()).join(', ')} did not pass.`
  };
}

/** Run the full nightly evaluation over every candidate. */
export function runNightlyEvaluation(history: RetainedResult[]): {
  champion: CandidateModel;
  results: EvaluationResult[];
  promoted: EvaluationModel | null;
} {
  const champion = CANDIDATES.find((c) => c.id === CHAMPION_ID)!;
  const results = CANDIDATES.filter((c) => c.id !== champion.id).map((candidate) =>
    evaluateCandidate(history, candidate, champion)
  );
  const winner = results.find((r) => r.promoted);
  return { champion, results, promoted: winner ? CANDIDATES.find((c) => c.id === winner.candidateId)! : null };
}

export interface EvaluationModel {
  id: string;
  name: string;
  version: string;
}
