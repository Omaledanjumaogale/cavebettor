import { LEAGUE_MAP, SPORTS, TEAM_MAP } from '#lib/data/catalog';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { cardOf } from '#lib/snapshot';
import { liveCards, liveFixtures, readSnapshot } from '#lib/server/live';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const [liveSnapshot, live, cards] = await Promise.all([
    readSnapshot<any>('live'),
    liveFixtures(),
    liveCards()
  ]);
  const fixtures = live ?? getFixtures();
  const source = liveSnapshot ?? {
    live: fixtures.filter((f) => f.status === 'live' || f.status === 'halftime'),
    recent: fixtures.filter((f) => f.status === 'finished').slice(-6).reverse(),
    upcoming: fixtures.filter((f) => f.status === 'scheduled').slice(0, 8)
  };

  const rows = (items: any[]) => items.map((row: any) => ({ fixture: row.fixture ?? row, prediction: row.prediction }));

  const pack = (row: { fixture: (typeof fixtures)[number]; prediction?: any }) => {
    const f = row.fixture;
    const p = row.prediction ?? cards?.[f.id] ?? cardOf(getPrediction(f));
    return {
      fixture: f,
      prediction: p,
      league: LEAGUE_MAP[f.leagueId],
      home: TEAM_MAP[f.homeId],
      away: TEAM_MAP[f.awayId],
      history: Array.from({ length: 18 }, (_, i) => {
        const base = p.probabilities.home * 100;
        return Math.max(4, Math.min(94, base + Math.sin(i / 2.4 + f.id.length) * 4 + (i * 0.22)));
      })
    };
  };

  const liveRows = rows(source.live);
  return {
    live: liveRows.map(pack),
    recent: rows(source.recent).map(pack),
    upcoming: rows(source.upcoming).map(pack),
    sports: SPORTS,
    counts: {
      live: liveRows.length,
      goals: liveRows.reduce((a: number, r: any) => a + r.fixture.score.home + r.fixture.score.away, 0),
      value: liveRows.flatMap((r: any) => (r.prediction ?? cards?.[r.fixture.id] ?? cardOf(getPrediction(r.fixture))).valueBets).length,
      leagues: new Set(liveRows.map((r: any) => r.fixture.leagueId)).size
    }
  };
};
