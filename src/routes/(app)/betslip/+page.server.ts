import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { LEAGUE_MAP, TEAM_MAP, SPORT_MAP } from '#lib/data/catalog';
import type { PageServerLoad } from './$types';

/**
 * Supplies the betslip builder with priced, selectable markets.
 *
 * Only the strongest selection per fixture/market pair is offered so the slip
 * stays a small number of high-conviction legs, and every leg carries the
 * model probability, the best available price and the edge behind it.
 */
export const load: PageServerLoad = async () => {
  const fixtures = getFixtures()
    .filter((fixture) => fixture.status !== 'finished')
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

  const selections = [];

  for (const fixture of fixtures) {
    const prediction = getPrediction(fixture);
    const home = TEAM_MAP[fixture.homeId];
    const away = TEAM_MAP[fixture.awayId];
    if (!home || !away) continue;

    for (const market of prediction.markets) {
      const best = market.outcomes
        .filter((outcome) => outcome.bookOdds > 1.01)
        .sort((a, b) => b.edge - a.edge)[0];
      if (!best || best.edge <= 0.01) continue;

      selections.push({
        id: `${fixture.id}:${market.id}:${best.id}`,
        fixtureId: fixture.id,
        fixtureLabel: `${home.name} v ${away.name}`,
        league: LEAGUE_MAP[fixture.leagueId]?.shortName ?? fixture.leagueId,
        leagueId: fixture.leagueId,
        sport: fixture.sport,
        sportLabel: SPORT_MAP[fixture.sport]?.name ?? fixture.sport,
        kickoff: fixture.kickoff,
        status: fixture.status,
        marketId: market.id,
        marketLabel: market.label,
        marketGroup: market.group,
        outcomeId: best.id,
        label: best.label,
        odds: best.bookOdds,
        bestBook: best.bestBook,
        probability: best.modelProbability,
        edge: best.edge,
        kelly: best.kelly,
        confidence: best.confidence
      });
    }
  }

  return {
    selections: selections.sort((a, b) => b.edge * b.confidence - a.edge * a.confidence).slice(0, 220),
    bankrollNgn: 1_250_000
  };
};
