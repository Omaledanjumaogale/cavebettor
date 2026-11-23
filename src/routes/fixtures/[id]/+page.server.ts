import { error } from '@sveltejs/kit';
import { LEAGUE_MAP, MODELS, TEAM_MAP, BOOKMAKERS } from '#lib/data/catalog';
import { getFixture, getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { getLeagueTable } from '#lib/engine/analytics';
import { cardOf } from '#lib/snapshot';
import { liveCards, liveFixtures, livePrediction } from '#lib/server/live';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const [live, cards] = await Promise.all([liveFixtures(), liveCards()]);
  const fixture = live?.find((f) => f.id === params.id) ?? getFixture(params.id);
  if (!fixture) throw error(404, 'Fixture not found');
  const prediction = (await livePrediction(fixture.id)) ?? getPrediction(fixture);
  const cardFor = (f: typeof fixture) => cards?.[f.id] ?? cardOf(getPrediction(f));
  const league = LEAGUE_MAP[fixture.leagueId];
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];

  const related = (live ?? getFixtures())
    .filter((f) => f.leagueId === fixture.leagueId && f.id !== fixture.id)
    .slice(0, 5)
    .map((f) => ({ fixture: f, prediction: cardFor(f) }));

  return {
    fixture,
    league,
    home,
    away,
    prediction,
    related,
    table: league.sport === 'football' ? getLeagueTable(league.id).slice(0, 8) : [],
    bookmakers: BOOKMAKERS,
    models: MODELS.filter((m) => m.family !== 'llm').map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      status: m.status,
      accuracy: m.accuracy,
      family: m.family,
      calibration: m.calibration
    }))
  };
};
