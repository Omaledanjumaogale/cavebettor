/**
 * Continuous learning.
 *
 * Every settled fixture is a training row. We re-price finished matches with
 * the current model, compare the call with what actually happened, and keep a
 * calibration table of predicted-versus-observed hit rates by probability
 * bucket and by competition.
 *
 * The table feeds back into `calibrateThreeWay`, so a bucket the model has been
 * over-rating is quietly discounted and a bucket it has been under-rating is
 * nudged up. More settled matches means a better table, which means better
 * selections — the loop improves with every completed game.
 */
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { setLearnedCalibration } from '#lib/engine/scoring';
import { settleSelection, type GradedPick } from '#lib/engine/settlement';
import type { CalibrationBucket } from '#lib/engine/scoring';
import { readCache, writeCache } from '#lib/server/cache';
import { resolveTeam } from '#lib/data/registry';
import { readProviderFixtures, readSettlements } from './feed';
import type { SettlementRecord } from './lifecycle';
import type { Fixture } from '#lib/types';

const KEY = 'engine/learning-v1';
const INDEX_KEY = 'engine/learning-runs';
const MEMO_MS = 20 * 60_000;
const MAX_ROWS = 240;

export interface LearningReport {
  generatedAt: string;
  settled: number;
  buckets: CalibrationBucket[];
  leagues: { leagueId: string; sport: string; n: number; predicted: number; observed: number }[];
  sports: { sport: string; n: number; predicted: number; observed: number }[];
  history: { at: string; n: number; predicted: number; observed: number }[];
  accuracy: number;
  sample: { fixtureId: string; selection: string; probability: number; won: boolean }[];
}

let memo: { at: number; report: LearningReport } | null = null;

function bucketOf(probability: number): string {
  const from = Math.min(0.9, Math.floor(probability * 10) / 10);
  return `${from.toFixed(1)}-${(from + 0.1).toFixed(1)}`;
}

/**
 * Rebuild a fixture from an archived settlement.
 *
 * The interface forgets a result after 24 hours; the archive does not. This is
 * how a match that left the board a month ago still counts as a training row.
 */
function fixtureFromSettlement(record: SettlementRecord): Fixture {
  const home = resolveTeam(record.homeId, record.leagueId);
  const away = resolveTeam(record.awayId, record.leagueId);
  return {
    id: record.id,
    sport: record.sport,
    leagueId: record.leagueId,
    homeId: record.homeId,
    awayId: record.awayId,
    homeTeam: record.homeName ? { ...home, name: record.homeName } : home,
    awayTeam: record.awayName ? { ...away, name: record.awayName } : away,
    kickoff: record.kickoff,
    status: 'finished',
    score: record.score,
    periods: record.periods,
    finishedAt: record.finishedAt,
    venue: 'Settlement archive',
    round: '',
    h2h: { homeWins: 0, draws: 0, awayWins: 0, last: [] },
    source: 'api-football'
  };
}

/** Re-price every settled fixture and rebuild the calibration table. */
export async function refreshLearning(force = false): Promise<LearningReport> {
  if (!force && memo && Date.now() - memo.at < MEMO_MS) return memo.report;

  const cachedHit = await readCache<LearningReport>(KEY);
  const cached = cachedHit?.value ?? null;
  if (!force && cached && Date.now() - new Date(cached.generatedAt).getTime() < MEMO_MS) {
    memo = { at: Date.now(), report: cached };
    setLearnedCalibration(cached.buckets);
    return cached;
  }

  const [provider, archived] = await Promise.all([
    readProviderFixtures().catch(() => [] as Fixture[]),
    readSettlements().catch(() => [] as SettlementRecord[])
  ]);
  // In-window results first (re-priced with the freshest state), then the
  // archive so purging a match from the board never removes training data.
  const finished = [
    ...provider.filter((f) => f.status === 'finished'),
    ...getFixtures().filter((f) => f.status === 'finished'),
    ...archived.map(fixtureFromSettlement)
  ]
    .filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i)
    .slice(0, MAX_ROWS);

  interface TrainingRow {
    id: string;
    leagueId: string;
    sport: string;
    picks: GradedPick[];
  }

  const training = new Map<string, TrainingRow>();

  // Re-price an in-window match with the current model.
  for (const fixture of finished) {
    let card;
    try {
      card = getPrediction(fixture);
    } catch {
      continue;
    }
    // The market the model actually stood behind, plus its top totals call.
    const candidates = [
      card.recommendations[0],
      card.recommendations.find((r) => /^(ou|total)/.test(r.marketId || ''))
    ].filter((r): r is NonNullable<typeof r> => Boolean(r));

    const picks: GradedPick[] = [];
    for (const pick of candidates) {
      const won = settleSelection(fixture, pick.marketId ?? '', pick.selection);
      if (won === null) continue;
      picks.push({
        marketId: pick.marketId ?? '',
        market: pick.market,
        selection: pick.selection,
        probability: pick.modelProbability,
        odds: pick.odds,
        won
      });
    }
    if (picks.length) training.set(fixture.id, { id: fixture.id, leagueId: fixture.leagueId, sport: fixture.sport, picks });
  }

  // Archived picks were graded at full time against the model that made them,
  // so they outrank a later re-price of the same match.
  for (const record of archived) {
    if (!record.picks?.length) continue;
    training.set(record.id, { id: record.id, leagueId: record.leagueId, sport: record.sport, picks: record.picks });
  }

  const buckets = new Map<string, { predicted: number; observed: number; n: number }>();
  const leagues = new Map<string, { leagueId: string; sport: string; predicted: number; observed: number; n: number }>();
  const sports = new Map<string, { sport: string; predicted: number; observed: number; n: number }>();
  const sample: LearningReport['sample'] = [];
  let predictedSum = 0;
  let observedSum = 0;
  let rows = 0;

  for (const entry of training.values()) {
    for (const pick of entry.picks) {
      const key = bucketOf(pick.probability);
      const bucket = buckets.get(key) ?? { predicted: 0, observed: 0, n: 0 };
      bucket.predicted += pick.probability;
      bucket.observed += pick.won ? 1 : 0;
      bucket.n += 1;
      buckets.set(key, bucket);

      const league = leagues.get(entry.leagueId) ?? {
        leagueId: entry.leagueId,
        sport: entry.sport,
        predicted: 0,
        observed: 0,
        n: 0
      };
      league.predicted += pick.probability;
      league.observed += pick.won ? 1 : 0;
      league.n += 1;
      leagues.set(entry.leagueId, league);

      const sport = sports.get(entry.sport) ?? { sport: entry.sport, predicted: 0, observed: 0, n: 0 };
      sport.predicted += pick.probability;
      sport.observed += pick.won ? 1 : 0;
      sport.n += 1;
      sports.set(entry.sport, sport);

      predictedSum += pick.probability;
      observedSum += pick.won ? 1 : 0;
      rows += 1;

      if (sample.length < 24) {
        sample.push({ fixtureId: entry.id, selection: pick.selection, probability: pick.probability, won: pick.won });
      }
    }
  }

  const bucketList: CalibrationBucket[] = [...buckets.entries()]
    .map(([key, value]) => {
      const [from, to] = key.split('-').map(Number);
      return {
        from,
        to,
        n: value.n,
        predicted: value.n ? value.predicted / value.n : from,
        observed: value.n ? value.observed / value.n : from,
        factor: value.n ? Number(Math.min(1.12, Math.max(0.85, value.observed / Math.max(0.05, value.predicted))).toFixed(3)) : 1
      };
    })
    .sort((a, b) => a.from - b.from);

  const historyHit = await readCache<LearningReport['history']>(INDEX_KEY);
  const previous: LearningReport['history'] = Array.isArray(historyHit?.value) ? historyHit.value : [];

  const report: LearningReport = {
    generatedAt: new Date().toISOString(),
    settled: rows,
    buckets: bucketList,
    leagues: [...leagues.values()]
      .map((entry) => ({
        leagueId: entry.leagueId,
        sport: entry.sport,
        n: entry.n,
        predicted: Number((entry.predicted / entry.n).toFixed(3)),
        observed: Number((entry.observed / entry.n).toFixed(3))
      }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 40),
    sports: [...sports.values()].map((entry) => ({
      sport: entry.sport,
      n: entry.n,
      predicted: Number((entry.predicted / entry.n).toFixed(3)),
      observed: Number((entry.observed / entry.n).toFixed(3))
    })),
    history: [
      ...previous,
      { at: new Date().toISOString(), n: rows, predicted: Number((predictedSum / Math.max(1, rows)).toFixed(3)), observed: Number((observedSum / Math.max(1, rows)).toFixed(3)) }
    ].slice(-30),
    accuracy: rows ? Number((observedSum / rows).toFixed(3)) : 0,
    sample
  };

  memo = { at: Date.now(), report };
  setLearnedCalibration(bucketList);
  await Promise.all([writeCache(KEY, report, 7 * 86_400_000), writeCache(INDEX_KEY, report.history, 90 * 86_400_000)]);
  return report;
}

/** Read the current table without forcing a rebuild. */
export async function readLearning(): Promise<LearningReport | null> {
  if (memo) return memo.report;
  const cached = (await readCache<LearningReport>(KEY))?.value ?? null;
  if (cached) {
    memo = { at: Date.now(), report: cached };
    setLearnedCalibration(cached.buckets);
  }
  return cached;
}

/** Cached league hit rate, used to veto a competition the model misreads. */
export function leagueAccuracy(report: LearningReport | null, leagueId: string): number | null {
  const row = report?.leagues.find((entry) => entry.leagueId === leagueId);
  if (!row || row.n < 8) return null;
  return row.observed;
}
