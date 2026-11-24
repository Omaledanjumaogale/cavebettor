import { pageFixtureUniverse } from '#lib/server/feed';
import { getPrediction } from '#lib/engine/predictions';
import { fixtureLeague, homeTeam, awayTeam } from '#lib/data/registry';
import { SPORT_MAP } from '#lib/data/catalog';
import type { PageServerLoad } from './$types';

/**
 * Supplies the betslip builder with priced, selectable markets.
 *
 * Real collected fixtures only: the builder must never offer a leg on a match
 * that does not exist. Every market outcome is offered so a user can build the
 * accumulator they actually want, one per fixture/market pair.
 */
export const load: PageServerLoad = async () => {
  const universe = await pageFixtureUniverse();
  const fixtures = universe.fixtures
    .filter((fixture) => fixture.status !== 'finished')
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
    .slice(0, 40);

  const selections = [];

  for (const fixture of fixtures) {
    let prediction;
    try {
      prediction = getPrediction(fixture);
    } catch {
      continue;
    }
    const home = homeTeam(fixture);
    const away = awayTeam(fixture);
    const league = fixtureLeague(fixture);

    for (const market of prediction.markets) {
      for (const outcome of market.outcomes) {
        if (outcome.bookOdds <= 1.01) continue;
        selections.push({
          id: `${fixture.id}:${market.id}:${outcome.id}`,
          fixtureId: fixture.id,
          fixtureLabel: `${home.name} v ${away.name}`,
          league: league.name,
          leagueId: fixture.leagueId,
          sport: fixture.sport,
          sportLabel: SPORT_MAP[fixture.sport]?.name ?? fixture.sport,
          kickoff: fixture.kickoff,
          status: fixture.status,
          marketId: market.id,
          marketLabel: market.label,
          marketGroup: market.group,
          outcomeId: outcome.id,
          label: outcome.label,
          odds: outcome.bookOdds,
          bestBook: outcome.bestBook,
          probability: outcome.modelProbability,
          edge: outcome.edge,
          kelly: outcome.kelly,
          confidence: outcome.confidence
        });
      }
    }
  }

  return {
    // Ranked by model probability: the strongest options lead the builder.
    selections: selections.sort((a, b) => b.probability - a.probability).slice(0, 400),
    fixtures: fixtures.length,
    bankrollNgn: 1_250_000,
    source: universe.source
  };
};
