import { LEAGUES, SPORTS, TEAM_MAP } from '#lib/data/catalog';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { cardOf } from '#lib/snapshot';
import { liveCards, liveFixtures } from '#lib/server/live';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const sport = url.searchParams.get('sport') ?? 'all';
  const league = url.searchParams.get('league') ?? 'all';
  const status = url.searchParams.get('status') ?? 'all';
  const q = (url.searchParams.get('q') ?? '').toLowerCase();
  const view = url.searchParams.get('view') === 'table' ? 'table' : 'grid';

  const [live, cards] = await Promise.all([liveFixtures(), liveCards()]);
  const all = live ?? getFixtures();
  const cardFor = (fixture: (typeof all)[number]) => cards?.[fixture.id] ?? cardOf(getPrediction(fixture));
  const filtered = all.filter((f) => {
    if (sport !== 'all' && f.sport !== sport) return false;
    if (league !== 'all' && f.leagueId !== league) return false;
    if (status === 'live' && f.status !== 'live' && f.status !== 'halftime') return false;
    if (status === 'upcoming' && f.status !== 'scheduled') return false;
    if (status === 'finished' && f.status !== 'finished') return false;
    if (status === 'value') {
      if (!cardFor(f).valueBets.length) return false;
    }
    if (q) {
      const hay = `${TEAM_MAP[f.homeId]?.name} ${TEAM_MAP[f.awayId]?.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return {
    filters: { sport, league, status, q, view },
    total: all.length,
    fixtures: filtered.slice(0, 120).map((fixture) => {
      return {
        fixture,
        prediction: cardFor(fixture)
      };
    }),
    leagues: LEAGUES.map((l) => ({ id: l.id, name: l.name, shortName: l.shortName, sport: l.sport, country: l.country, colour: l.colour })),
    sports: SPORTS
  };
};
