/**
 * Market price feed.
 *
 * The Odds API (250 requests/month) and Odd-API (500 credits/month) are the
 * external price sources. They are rationed hard:
 *
 *   • a request is only made when the cached copy has expired,
 *   • only the competitions with open fixtures are priced,
 *   • The Odds API is asked first; Odd-API is the fallback,
 *   • page views never trigger a request — they read the R2 cache.
 *
 * The prices are then overlaid on the engine's synthetic bookmaker matrix so
 * the odds board shows a real market consensus when one exists.
 */

import { readCache, writeCacheIfChanged } from '#lib/server/cache';
import type { Fixture, Market, MarketOutcome } from '#lib/types';
import { fetchOddApiEvents, fetchOddsApiEvents, type OddsEvent, type OddApiEvent } from './odds';

export const MARKET_FEED_KEY = 'feed/market-prices';
const MARKET_FEED_TTL = 30 * 60_000;

/** Vault sport keys for the competitions we actually price. */
const SPORT_KEY_BY_LEAGUE: Record<string, string> = {
  epl: 'soccer_epl',
  laliga: 'soccer_spain_la_liga',
  seriea: 'soccer_italy_serie_a',
  bundesliga: 'soccer_germany_bundesliga',
  ligue1: 'soccer_france_ligue_one',
  ucl: 'soccer_uefa_champs_league',
  nba: 'basketball_nba',
  euroleague: 'basketball_euroleague',
  nhl: 'icehockey_nhl',
  mlb: 'baseball_mlb'
};

/** Vault sport keys mapped onto the Odd-API sport vocabulary. */
const SPORT_KEY_TO_ODD_API: Record<string, string> = {
  soccer_epl: 'soccer',
  soccer_spain_la_liga: 'soccer',
  soccer_italy_serie_a: 'soccer',
  soccer_germany_bundesliga: 'soccer',
  soccer_france_ligue_one: 'soccer',
  soccer_uefa_champs_league: 'soccer',
  basketball_nba: 'basketball',
  basketball_euroleague: 'basketball',
  icehockey_nhl: 'hockey',
  baseball_mlb: 'baseball'
};

/** A single priced selection, keyed by the fixture it belongs to. */
export interface MarketPrice {
  fixtureId: string;
  selection: string;
  market: string;
  book: string;
  price: number;
  point?: number;
  updatedAt: string;
}

export interface MarketPriceBundle {
  prices: MarketPrice[];
  provider: 'the-odds-api' | 'odd-api' | 'none';
  collectedAt: string;
  sports: string[];
}

function matchKey(home: string, away: string): string {
  return `${home.trim().toLowerCase()}|${away.trim().toLowerCase()}`;
}

/**
 * Attach provider prices to fixtures.
 *
 * Matching is done on the two team names in either order, because the
 * provider and the fixture list do not always agree on the order.
 */
function attach(events: OddsEvent[], fixtures: Fixture[], provider: MarketPriceBundle['provider']): MarketPrice[] {
  const byPair = new Map<string, Fixture>();
  for (const fixture of fixtures) {
    const home = fixture.homeTeam?.name;
    const away = fixture.awayTeam?.name;
    if (!home || !away) continue;
    byPair.set(matchKey(home, away), fixture);
    byPair.set(matchKey(away, home), fixture);
  }

  const prices: MarketPrice[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    const fixture = byPair.get(matchKey(event.home_team, event.away_team));
    if (!fixture) continue;
    for (const book of event.bookmakers ?? []) {
      for (const market of book.markets ?? []) {
        for (const outcome of market.outcomes ?? []) {
          const key = `${fixture.id}:${book.key}:${market.key}:${outcome.name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          prices.push({
            fixtureId: fixture.id,
            selection: outcome.name,
            market: market.key,
            book: book.title,
            price: outcome.price,
            point: outcome.point,
            updatedAt: book.last_update ?? new Date().toISOString()
          });
        }
      }
    }
  }
  void provider;
  return prices;
}

/**
 * Attach Odd-API prices.
 *
 * Odd-API returns one event per fixture with a price map keyed by outcome
 * name, so the mapping here is direct rather than a market/outcome join.
 */
function attachOddApi(events: OddApiEvent[], fixtures: Fixture[]): MarketPrice[] {
  const byPair = new Map<string, Fixture>();
  for (const fixture of fixtures) {
    const home = fixture.homeTeam?.name;
    const away = fixture.awayTeam?.name;
    if (!home || !away) continue;
    byPair.set(matchKey(home, away), fixture);
    byPair.set(matchKey(away, home), fixture);
  }

  const prices: MarketPrice[] = [];
  for (const event of events) {
    const home = event.homeTeam ?? event.teams?.home;
    const away = event.awayTeam ?? event.teams?.away;
    if (!home || !away) continue;
    const fixture = byPair.get(matchKey(home, away));
    if (!fixture) continue;

    const raw = event.odds as Record<string, unknown> | undefined;
    const entries = Array.isArray(raw)
      ? (raw as { name?: string; price?: number }[])
      : Object.entries(raw ?? {}).map(([name, value]) => ({
          name,
          price: typeof value === 'object' && value !== null ? (value as { price?: number }).price : (value as number)
        }));

    for (const entry of entries) {
      if (!entry?.name || typeof entry.price !== 'number' || entry.price <= 1.01) continue;
      prices.push({
        fixtureId: fixture.id,
        selection: entry.name,
        market: 'h2h',
        book: 'Odd-API',
        price: entry.price,
        updatedAt: new Date().toISOString()
      });
    }
  }
  return prices;
}

/**
 * Refresh the market price feed. Called by the scheduled collector only.
 */
export async function refreshMarketPrices(fixtures: Fixture[]): Promise<MarketPriceBundle> {
  const usedLeagues = new Set(fixtures.filter((f) => f.status !== 'finished').map((f) => f.leagueId));
  const sportKeys = [...usedLeagues]
    .map((id) => SPORT_KEY_BY_LEAGUE[id])
    .filter((key): key is string => Boolean(key))
    .slice(0, 6);

  if (!sportKeys.length) {
    const empty: MarketPriceBundle = { prices: [], provider: 'none', collectedAt: new Date().toISOString(), sports: [] };
    await writeCacheIfChanged(MARKET_FEED_KEY, empty, MARKET_FEED_TTL, 'none');
    return empty;
  }

  const events = await fetchOddsApiEvents(sportKeys);
  let provider: MarketPriceBundle['provider'] = events.length ? 'the-odds-api' : 'none';

  let prices = attach(events, fixtures, provider);

  // The Odds API allowance may be exhausted; Odd-API is the fallback and it
  // is only spent when there is something worth pricing.
  if (!prices.length) {
    const fallbackSport = SPORT_KEY_TO_ODD_API[sportKeys[0]] ?? 'soccer';
    const oddEvents = await fetchOddApiEvents(fallbackSport);
    const oddPrices = attachOddApi(oddEvents, fixtures);
    if (oddPrices.length) {
      provider = 'odd-api';
      prices = oddPrices;
    }
  }

  const bundle: MarketPriceBundle = {
    prices,
    provider,
    collectedAt: new Date().toISOString(),
    sports: sportKeys
  };
  await writeCacheIfChanged(MARKET_FEED_KEY, bundle, MARKET_FEED_TTL, provider);
  return bundle;
}

/** Read the cached market prices. Never performs a network call. */
export async function readMarketPrices(): Promise<MarketPriceBundle | null> {
  const cached = await readCache<MarketPriceBundle>(MARKET_FEED_KEY, true);
  return cached?.value ?? null;
}

/**
 * Overlay the real prices on the engine's outcomes.
 *
 * When a provider price exists for an outcome, it becomes the best price and
 * the edge is recomputed from it. Otherwise the synthetic book spread stays.
 */
export function applyMarketPrices(markets: Market[], prices: MarketPrice[], fixtureId: string): {
  updated: number;
  providers: string[];
} {
  const providerPrices = prices.filter((p) => p.fixtureId === fixtureId);
  if (!providerPrices.length) return { updated: 0, providers: [] };

  const providers = new Set<string>();
  let updated = 0;

  for (const market of markets) {
    for (const outcome of market.outcomes) {
      const match = providerPrices.find(
        (p) =>
          p.market === marketGroupToProviderMarket(market.group) &&
          (p.selection === outcome.label ||
            p.selection === outcome.label.split(' ').pop() ||
            outcome.label.includes(p.selection))
      );
      if (!match || !Number.isFinite(match.price) || match.price <= 1.01) continue;
      outcome.bookOdds = match.price;
      outcome.bestBook = match.book;
      outcome.edge = Number((outcome.modelProbability * match.price - 1).toFixed(4));
      outcome.value = outcome.edge > 0.025 && outcome.modelProbability > 0.08;
      providers.add(match.book);
      updated += 1;
    }
  }

  return { updated, providers: [...providers] };
}

/** Map a CaveBettor market group to the provider market key. */
function marketGroupToProviderMarket(group: Market['group']): string {
  if (group === 'totals') return 'totals';
  if (group === 'handicap') return 'spreads';
  return 'h2h';
}

/** Recompute the top value bets after prices were overlaid. */
export function revalueOutcomes(outcomes: MarketOutcome[]): void {
  for (const outcome of outcomes) {
    outcome.edge = Number((outcome.modelProbability * outcome.bookOdds - 1).toFixed(4));
    outcome.value = outcome.edge > 0.025 && outcome.modelProbability > 0.08;
  }
}
