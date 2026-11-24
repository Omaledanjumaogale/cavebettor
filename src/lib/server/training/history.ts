import { readCache, writeCacheIfChanged } from '#lib/server/cache';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import type { Fixture } from '#lib/types';

/**
 * Retained results.
 *
 * The retraining loop never spends a paid API request. It learns from the
 * settled matches the app already knows about: every finished fixture and the
 * probability the ensemble published before kick-off is retained here.
 *
 * The archive lives in the Cloudflare R2 data plane (bulk data). Convex keeps
 * a tiny pointer row so the control plane can report the archive size and
 * checksum without ever reading the payload.
 */

export interface RetainedResult {
  fixtureId: string;
  sport: string;
  leagueId: string;
  kickoff: string;
  /** Probabilities the model published before the match. */
  predicted: { home: number; draw: number; away: number };
  /** Actual result expressed in the same three-way space. */
  actual: { home: number; draw: number; away: number };
  /** Odds the market offered, used to settle the value bets. */
  odds: { home: number; draw: number; away: number };
  value: number;
  settled: boolean;
}

const HISTORY_KEY = 'training/retained-results';

function actualFromScore(fixture: Fixture): { home: number; draw: number; away: number } {
  if (fixture.score.home > fixture.score.away) return { home: 1, draw: 0, away: 0 };
  if (fixture.score.home === fixture.score.away) return { home: 0, draw: 1, away: 0 };
  return { home: 0, draw: 0, away: 1 };
}

/** Build the retained set from fixtures the engine already knows about. */
export function collectRetainedResults(): RetainedResult[] {
  const out: RetainedResult[] = [];
  for (const fixture of getFixtures()) {
    if (fixture.status !== 'finished') continue;
    const prediction = getPrediction(fixture);
    const core = prediction.markets.find((m) => m.id === '1x2' || m.id === 'ml');
    if (!core) continue;
    const home = core.outcomes[0];
    const away = core.outcomes[core.outcomes.length - 1];
    const draw = core.outcomes.length === 3 ? core.outcomes[1] : undefined;
    const actual = actualFromScore(fixture);
    const hit =
      (actual.home === 1 && home.modelProbability >= (away.modelProbability ?? 0)) ||
      (actual.away === 1 && (away.modelProbability ?? 0) > (home.modelProbability ?? 0)) ||
      (actual.draw === 1 && draw !== undefined);
    out.push({
      fixtureId: fixture.id,
      sport: fixture.sport,
      leagueId: fixture.leagueId,
      kickoff: fixture.kickoff,
      predicted: prediction.probabilities,
      actual,
      odds: {
        home: home.bookOdds,
        draw: draw?.bookOdds ?? 0,
        away: away.bookOdds ?? 0
      },
      value: hit ? 1 : 0,
      settled: true
    });
  }
  return out.sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
}

/** Persist the retained set. Only writes when the content actually changed. */
export async function archiveRetainedResults(): Promise<{ rows: number; changed: boolean }> {
  const rows = collectRetainedResults();
  const { changed } = await writeCacheIfChanged(HISTORY_KEY, rows, 24 * 3600_000, 'internal-engine');
  return { rows: rows.length, changed };
}

/** Read the retained set from the data plane. */
export async function readRetainedResults(): Promise<RetainedResult[]> {
  const cached = await readCache<RetainedResult[]>(HISTORY_KEY, true);
  if (cached?.value?.length) return cached.value;
  const fallback = collectRetainedResults();
  if (fallback.length) await writeCacheIfChanged(HISTORY_KEY, fallback, 24 * 3600_000, 'internal-engine');
  return fallback;
}
