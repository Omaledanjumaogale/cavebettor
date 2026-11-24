import { BOOKMAKERS, LEAGUE_MAP, TEAM_MAP } from '#lib/data/catalog';
import { awayTeam, fixtureLeague, homeTeam, resolveTeam } from '#lib/data/registry';
import { getPrediction } from '#lib/engine/predictions';
import { arbitrage, bookPrices } from '#lib/engine/books';
import { getOddsMovers } from '#lib/engine/analytics';
import { liveCards, livePrediction } from '#lib/server/live';
import { pageFixtureUniverse } from '#lib/server/feed';
import { applyMarketPrices, readMarketPrices } from '#lib/server/providers/marketFeed';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const [universe, cards, marketBundle] = await Promise.all([
    pageFixtureUniverse(),
    liveCards(),
    readMarketPrices()
  ]);
  // Price a bounded slate: the whole window is too large to model per request.
  const upcoming = universe.fixtures.filter((f) => f.status !== 'finished').slice(0, 40);
  const selectedId = url.searchParams.get('id') ?? upcoming[0]?.id;
  const fixture = upcoming.find((f) => f.id === selectedId) ?? upcoming[0];
  const prediction = (await livePrediction(fixture.id)) ?? getPrediction(fixture);
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
      const card = cards?.[f.id];
      const home = resolveTeam(f.homeId, f.leagueId);
      const away = resolveTeam(f.awayId, f.leagueId);
      const probabilities = card
        ? card.probabilities.draw > 0.005
          ? [card.probabilities.home, card.probabilities.draw, card.probabilities.away]
          : [card.probabilities.home, card.probabilities.away]
        : (() => {
            const p = getPrediction(f);
            const main = p.markets.find((m) => m.id === '1x2' || m.id === 'ml');
            return main ? main.outcomes.map((o) => o.modelProbability) : [];
          })();
      if (probabilities.length < 2) return null;
      const labels = probabilities.length === 3 ? [`${home.shortName} win`, 'Draw', `${away.shortName} win`] : [home.shortName, away.shortName];
      const result = arbitrage(probabilities, `${f.id}-arb`);
      return {
        fixtureId: f.id,
        kickoff: f.kickoff,
        league: fixtureLeague(f).shortName,
        home: home.shortName,
        away: away.shortName,
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
      label: `${resolveTeam(f.homeId, f.leagueId).shortName} vs ${resolveTeam(f.awayId, f.leagueId).shortName}`,
      league: fixtureLeague(f).shortName,
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
      league: fixtureLeague(m.fixture).shortName,
      home: resolveTeam(m.fixture.homeId, m.fixture.leagueId).shortName,
      away: resolveTeam(m.fixture.awayId, m.fixture.leagueId).shortName,
      selection: m.selection,
      odds: m.odds,
      drift: m.drift,
      edge: m.edge,
      kickoff: m.fixture.kickoff
    }))
  };
};
