import { SPORTS } from '#lib/data/catalog';
import { fixtureLeague, resolveTeam } from '#lib/data/registry';
import { getPrediction } from '#lib/engine/predictions';
import { readSnapshot } from '#lib/server/live';
import { feedMeta, pageFixtureUniverse } from '#lib/server/feed';
import { FINISHED_TTL_MS, partitionFixtures } from '#lib/server/lifecycle';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const [universe, liveSnapshot, meta] = await Promise.all([
    pageFixtureUniverse(),
    readSnapshot<any>('live'),
    feedMeta()
  ]);

  const fixtures = universe.fixtures;
  const fromFeed = universe.source === 'provider';

  // Real collected fixtures always win. The Convex snapshot is a fallback for a
  // cold cache, and the last resort is the local engine so the page never 500s.
  let liveRows: any[];
  let recentRows: any[];
  let upcomingRows: any[];
  let origin: 'provider' | 'convex' | 'engine';

  if (fromFeed) {
    origin = 'provider';
    // One source of truth for the buckets: nothing that can no longer be in
    // play reaches the live list, and results are capped to the retention
    // window so a purged match can never reappear here.
    const buckets = partitionFixtures(fixtures);
    liveRows = buckets.live;
    recentRows = buckets.finished.slice(0, 12);
    upcomingRows = buckets.upcoming.slice(0, 10);
  } else if (liveSnapshot?.live?.length || liveSnapshot?.upcoming?.length) {
    origin = 'convex';
    liveRows = liveSnapshot.live ?? [];
    recentRows = liveSnapshot.recent ?? [];
    upcomingRows = liveSnapshot.upcoming ?? [];
  } else {
    origin = 'engine';
    const buckets = partitionFixtures(fixtures);
    liveRows = buckets.live;
    recentRows = buckets.finished.slice(0, 12);
    upcomingRows = buckets.upcoming.slice(0, 10);
  }

  const rows = (items: any[]) => items.map((row: any) => ({ fixture: row.fixture ?? row }));

  const pack = (row: { fixture: any }) => {
    const f = row.fixture;
    const p = getPrediction(f);
    return {
      fixture: f,
      prediction: p,
      league: fixtureLeague(f),
      home: resolveTeam(f.homeId, f.leagueId),
      away: resolveTeam(f.awayId, f.leagueId),
      history: Array.from({ length: 18 }, (_, i) => {
        const base = p.probabilities.home * 100;
        return Math.max(4, Math.min(94, base + Math.sin(i / 2.4 + f.id.length) * 4 + (i * 0.22)));
      })
    };
  };

  const packedLive = rows(liveRows).map(pack);

  return {
    live: packedLive,
    recent: rows(recentRows).map(pack),
    upcoming: rows(upcomingRows).map(pack),
    sports: SPORTS,
    origin,
    meta: {
      updatedAt: meta?.generatedAt ?? null,
      ageMs: meta?.ageMs ?? null,
      stale: meta?.stale ?? true,
      providerFixtures: meta?.fixtureCount ?? 0,
      leagues: meta?.leagues ?? 0
    },
    finishedWindowHours: FINISHED_TTL_MS / 3_600_000,
    counts: {
      live: packedLive.length,
      goals: packedLive.reduce((a, m: any) => a + (m.fixture.score?.home ?? 0) + (m.fixture.score?.away ?? 0), 0),
      value: packedLive.flatMap((m: any) => m.prediction.valueBets).length,
      leagues: new Set(packedLive.map((m: any) => m.fixture.leagueId)).size
    }
  };
};
