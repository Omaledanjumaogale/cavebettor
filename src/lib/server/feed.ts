import { readCache, writeCacheIfChanged } from '#lib/server/cache';
import { fetchLiveFixtures, fetchSportFixtures, rotateLeagues, type ApiFootballSport } from '#lib/server/providers/apiFootball';
import { normaliseProviderFixtures } from '#lib/server/providers/normalise';
import { getFixtures } from '#lib/engine/fixtures';
import type { Fixture } from '#lib/types';

/**
 * Live feed.
 *
 * Provider fixtures are cached in the Cloudflare R2 data plane and merged
 * with the deterministic engine output. The merge is:
 *
 *   live provider fixture  → replaces the engine fixture for that match
 *   engine fixture only    → kept (covers cups, friendlies and everything the
 *                            free provider plan does not list)
 *
 * Refresh work never happens on a page request: it is driven by the scheduled
 * Cloudflare worker, so user traffic does not consume the 100/day
 * API-Football allowance.
 */

export const FEED_SPORTS: ApiFootballSport[] = ['football', 'basketball', 'icehockey', 'nba', 'baseball'];

const FEED_KEY = 'feed/fixtures';
const FEED_TTL = 20 * 60_000;

/**
 * Competitions requested per sport per collection cycle.
 *
 * The API-Football allowance is 100 requests a day for the whole account.
 * Football alone lists ten competitions, so asking for all of them every
 * cycle would burn the day. Each cycle takes a slice and the slice rotates,
 * which keeps three collections a day at roughly 20 requests in total.
 */
const LEAGUES_PER_CYCLE: Record<ApiFootballSport, number> = {
  football: 5,
  basketball: 2,
  icehockey: 1,
  nba: 1,
  baseball: 1
};

export interface FeedBundle {
  generatedAt: string;
  fixtures: Fixture[];
  providerCount: number;
  engineCount: number;
  sports: string[];
}

/** Refresh the provider fixture set. Called by the scheduled worker only. */
export async function refreshProviderFeed(): Promise<{ provider: number; rejected: number; sports: string[]; requests: number }> {
  const all: Fixture[] = [];
  let rejected = 0;
  let requests = 0;
  const sports: string[] = [];

  // The cycle index rotates the competitions each sport asks for.
  const cycle = Number(process.env.CAVEBETTOR_COLLECT_CYCLE ?? '') || Math.floor(Date.now() / (12 * 3600_000));

  for (const sport of FEED_SPORTS) {
    const leagues = rotateLeagues(sport, cycle, LEAGUES_PER_CYCLE[sport]);
    const rows = await fetchSportFixtures(sport, 2025, leagues);
    requests += leagues.length + 1; // + the live call below
    if (!rows.length) continue;
    const mapped = normaliseProviderFixtures(rows, sport);
    all.push(...mapped.fixtures);
    rejected += mapped.rejected;
    sports.push(sport);
  }

  await writeCacheIfChanged(FEED_KEY, all, 6 * 3600_000, 'api-football');
  return { provider: all.length, rejected, sports, requests };
}

/** Read the cached provider fixtures. Never performs a network call. */
export async function readProviderFixtures(): Promise<Fixture[]> {
  const cached = await readCache<Fixture[]>(FEED_KEY, true);
  return cached?.value ?? [];
}

/**
 * Merged fixture universe: live provider fixtures first, engine fixtures as
 * the fallback so the workspace is never empty.
 */
export async function mergedFixtures(): Promise<{ fixtures: Fixture[]; providerCount: number }> {
  const provider = await readProviderFixtures();
  if (!provider.length) {
    return { fixtures: getFixtures(), providerCount: 0 };
  }
  const providerKeys = new Set(provider.map((f) => `${f.homeId}|${f.awayId}`));
  const engineOnly = getFixtures().filter((f) => !providerKeys.has(`${f.homeId}|${f.awayId}`));
  const fixtures = [...provider, ...engineOnly].sort(
    (a, b) => +new Date(a.kickoff) - +new Date(b.kickoff)
  );
  return { fixtures, providerCount: provider.length };
}

/** Live-now bundle used by the live centre. */
export async function liveFeed(): Promise<Fixture[]> {
  const cached = await readCache<Fixture[]>(FEED_KEY, true);
  const provider = cached?.value ?? [];
  const engine = getFixtures();
  const byId = new Map<string, Fixture>();
  for (const f of [...provider, ...engine]) {
    const key = `${f.homeId}|${f.awayId}`;
    byId.set(key, f);
  }
  return [...byId.values()]
    .filter((f) => f.status === 'live' || f.status === 'halftime')
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

/**
 * The fixture universe a page should render.
 *
 * Priority: R2 provider feed (real schedules) → Convex snapshot → local
 * engine. Every branch is free: no provider request is made here.
 */
export async function pageFixtureUniverse(): Promise<{ fixtures: Fixture[]; source: 'provider' | 'convex' | 'engine' }> {
  const feed = await mergedFixtures();
  if (feed.providerCount > 0) return { fixtures: feed.fixtures, source: 'provider' };

  const { liveFixtures } = await import('#lib/server/live');
  const snap = await liveFixtures();
  if (snap?.length) return { fixtures: snap, source: 'convex' };

  return { fixtures: getFixtures(), source: 'engine' };
}

/** Fetch live-now provider rows directly (scheduled refresh path). */
export async function refreshLiveNow(): Promise<number> {
  const rows = [];
  for (const sport of FEED_SPORTS) {
    rows.push(...(await fetchLiveFixtures(sport)));
  }
  return rows.length;
}
