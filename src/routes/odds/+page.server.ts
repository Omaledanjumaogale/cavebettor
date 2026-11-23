import { BOOKMAKERS, LEAGUE_MAP, TEAM_MAP } from '#lib/data/catalog';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { arbitrage, bookPrices } from '#lib/engine/books';
import { getOddsMovers } from '#lib/engine/analytics';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  const upcoming = getFixtures().filter((f) => f.status !== 'finished');
  const selectedId = url.searchParams.get('id') ?? upcoming[0]?.id;
  const fixture = upcoming.find((f) => f.id === selectedId) ?? upcoming[0];
  const prediction = getPrediction(fixture);
  const league = LEAGUE_MAP[fixture.leagueId];

  const matrices = prediction.markets.map((market) => ({
    id: market.id,
    label: market.label,
    group: market.group,
    outcomes: market.outcomes.map((outcome) => {
      const prices = bookPrices(outcome.modelProbability, `${fixture.id}-${market.id}-${outcome.id}`);
      const best = prices.reduce((a, b) => (b.odds > a.odds ? b : a));
      return {
        id: outcome.id,
        label: outcome.label,
        modelProbability: outcome.modelProbability,
        fairOdds: outcome.fairOdds,
        bestBook: best.name,
        bestOdds: best.odds,
        edge: outcome.edge,
        prices: prices.map((p) => ({ id: p.id, odds: p.odds, colour: p.colour, shortName: p.shortName }))
      };
    })
  }));

  const arbs = upcoming
    .map((f) => {
      const p = getPrediction(f);
      const main = p.markets.find((m) => m.id === '1x2' || m.id === 'ml');
      if (!main) return null;
      const result = arbitrage(main.outcomes.map((o) => o.modelProbability), `${f.id}-arb`);
      return {
        fixtureId: f.id,
        kickoff: f.kickoff,
        league: LEAGUE_MAP[f.leagueId].shortName,
        home: TEAM_MAP[f.homeId].shortName,
        away: TEAM_MAP[f.awayId].shortName,
        market: main.label,
        margin: result.margin,
        totalImplied: result.totalImplied,
        outcomes: result.outcomes.map((o, i) => ({ label: main.outcomes[i].label, odds: o.odds, book: o.name, implied: o.implied }))
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (b?.margin ?? -1) - (a?.margin ?? -1))
    .slice(0, 8);

  return {
    fixtures: upcoming.slice(0, 60).map((f) => ({
      id: f.id,
      label: `${TEAM_MAP[f.homeId].shortName} vs ${TEAM_MAP[f.awayId].shortName}`,
      league: LEAGUE_MAP[f.leagueId].shortName,
      kickoff: f.kickoff
    })),
    selected: {
      fixture,
      league,
      home: TEAM_MAP[fixture.homeId],
      away: TEAM_MAP[fixture.awayId],
      probabilities: prediction.probabilities,
      confidence: prediction.confidence,
      generatedAt: prediction.generatedAt,
      markets: matrices
    },
    bookmakers: BOOKMAKERS,
    arbs,
    movers: getOddsMovers().map((m) => ({
      fixtureId: m.fixture.id,
      league: LEAGUE_MAP[m.fixture.leagueId].shortName,
      home: TEAM_MAP[m.fixture.homeId].shortName,
      away: TEAM_MAP[m.fixture.awayId].shortName,
      selection: m.selection,
      odds: m.odds,
      drift: m.drift,
      edge: m.edge,
      kickoff: m.fixture.kickoff
    }))
  };
};
