import { BOOKMAKERS, LEAGUE_MAP, TEAM_MAP } from '#lib/data/catalog';
import { awayTeam, fixtureLeague, homeTeam, resolveTeam } from '#lib/data/registry';
import { getPrediction } from '#lib/engine/predictions';
import { arbitrage, bookPrices } from '#lib/engine/books';
import { getOddsMovers } from '#lib/engine/analytics';
import { pageFixtureUniverse } from '#lib/server/feed';
import { applyMarketPrices, readMarketPrices } from '#lib/server/providers/marketFeed';
import type { PageServerLoad } from './$types';
import { sortBySchedule } from '#lib/schedule';

export const load: PageServerLoad = async ({ url }) => {
  const [universe, marketBundle] = await Promise.all([pageFixtureUniverse(), readMarketPrices()]);
  // The odds desk covers the whole schedulable slate, not an arbitrary 40.
  const upcoming = sortBySchedule(universe.fixtures.filter((f) => f.status !== 'finished'));
  const selectedId = url.searchParams.get('id') ?? upcoming[0]?.id;
  const fixture = upcoming.find((f) => f.id === selectedId) ?? upcoming[0];
  const prediction = getPrediction(fixture);
  const league = fixtureLeague(fixture);

  // Overlay the real market prices when the collector has any for this match.
  const marketPrices = marketBundle?.prices ?? [];
  if (marketPrices.length) {
    applyMarketPrices(prediction.markets, marketPrices, fixture.id);
  }

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
      const home = resolveTeam(f.homeId, f.leagueId);
      const away = resolveTeam(f.awayId, f.leagueId);
      const p = getPrediction(f);
      const probabilities =
        p.probabilities.draw > 0.005
          ? [p.probabilities.home, p.probabilities.draw, p.probabilities.away]
          : [p.probabilities.home, p.probabilities.away];
      if (probabilities.length < 2) return null;
      const labels = probabilities.length === 3 ? [`${home.name} win`, 'Draw', `${away.name} win`] : [home.name, away.name];
      const result = arbitrage(probabilities, `${f.id}-arb`);
      return {
        fixtureId: f.id,
        kickoff: f.kickoff,
        sport: f.sport,
        league: fixtureLeague(f).name,
        home: home.name,
        away: away.name,
        market: probabilities.length === 3 ? 'Match result — 1X2' : 'Moneyline',
        margin: result.margin,
        totalImplied: result.totalImplied,
        outcomes: result.outcomes.map((o, i) => ({ label: labels[i], odds: o.odds, book: o.name, implied: o.implied }))
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (b?.margin ?? -1) - (a?.margin ?? -1))
    .slice(0, 8);

  return {
    fixtures: upcoming.slice(0, 60).map((f) => ({
      id: f.id,
      label: `${resolveTeam(f.homeId, f.leagueId).name} vs ${resolveTeam(f.awayId, f.leagueId).name}`,
      league: fixtureLeague(f).name,
      kickoff: f.kickoff
    })),
    selected: {
      fixture,
      league,
      home: homeTeam(fixture),
      away: awayTeam(fixture),
      probabilities: prediction.probabilities,
      confidence: prediction.confidence,
      generatedAt: prediction.generatedAt,
      markets: matrices
    },
    bookmakers: BOOKMAKERS,
    marketFeed: {
      provider: marketBundle?.provider ?? 'none',
      prices: marketPrices.length,
      collectedAt: marketBundle?.collectedAt ?? null,
      sports: marketBundle?.sports ?? []
    },
    arbs,
    movers: getOddsMovers().map((m) => ({
      fixtureId: m.fixture.id,
      sport: m.fixture.sport,
      league: fixtureLeague(m.fixture).name,
      home: resolveTeam(m.fixture.homeId, m.fixture.leagueId).name,
      away: resolveTeam(m.fixture.awayId, m.fixture.leagueId).name,
      selection: m.selection,
      odds: m.odds,
      drift: m.drift,
      edge: m.edge,
      kickoff: m.fixture.kickoff
    }))
  };
};
