/**
 * Bookmaker price feeds.
 *
 * Two providers with hard monthly ceilings:
 *
 *   The Odds API — 250 requests / month
 *   Odd-API      — 500 credits  / month
 *
 * Both are rationed. A request is only spent when the cached copy is stale
 * and the request is worth its cost: the model only asks for prices on the
 * fixtures it actually values, and the Odds API is only consulted for the
 * markets the ensemble is short on. Odd-API is the fallback whenever the
 * Odds API allowance is exhausted.
 */

import { env as privateEnv } from '$env/dynamic/private';
import { readCache, writeCacheIfChanged } from '#lib/server/cache';
import { commit, release, reserve } from './budget';

export interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export interface OddsMarket {
  key: string;
  last_update?: string;
  outcomes: OddsOutcome[];
}

export interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title?: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: { key: string; title: string; last_update?: string; markets: OddsMarket[] }[];
}

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODD_API_BASE = 'https://api.odd-api.com/v1';

/** Markets worth a request. Each Odds API market costs one request credit. */
export const ODDS_API_MARKETS = ['h2h', 'totals', 'spreads'] as const;

/** Team-name → our catalogue team id, used to line prices up with fixtures. */
const SPORT_KEYS: Record<string, string> = {
  soccer_epl: 'epl',
  soccer_spain_la_liga: 'laliga',
  soccer_italy_serie_a: 'seriea',
  soccer_germany_bundesliga: 'bundesliga',
  soccer_france_ligue_one: 'ligue1',
  soccer_uefa_champs_league: 'ucl',
  basketball_nba: 'nba',
  basketball_euroleague: 'euroleague',
  icehockey_nhl: 'nhl',
  baseball_mlb: 'mlb',
  tennis_atp_grand_slam: 'grandslam',
  tennis_wta_grand_slam: 'grandslam'
};

function env(name: string): string {
  return (privateEnv as Record<string, string | undefined>)[name] ?? process.env[name] ?? '';
}

export function oddsApiConfigured(): boolean {
  return Boolean(env('THE_ODDS_API_KEY'));
}

export function oddApiConfigured(): boolean {
  return Boolean(env('ODD_API_KEY'));
}

/** Map an Odds API sport key to a CaveBettor league id. */
export function leagueForSportKey(sportKey: string): string | undefined {
  return SPORT_KEYS[sportKey];
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    title: string;
    last_update: string;
    markets: { key: string; last_update: string; outcomes: { name: string; price: number; point?: number }[] }[];
  }[];
}

async function fetchFromOddsApi<T>(path: string, params: Record<string, string>, ttlMs: number, cost: number): Promise<T | null> {
  const key = env('THE_ODDS_API_KEY');
  if (!key) return null;

  const cacheKey = `the-odds-api/${path}/${JSON.stringify(params)}`;
  const cached = await readCache<T>(cacheKey, true);
  if (cached && !cached.stale) return cached.value;

  const permission = await reserve('the-odds-api', cost);
  if (!permission || permission.remaining < cost) {
    // The monthly ceiling is reached — serve the cached copy only.
    return cached ? cached.value : null;
  }

  const url = new URL(`${ODDS_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('apiKey', key);
  url.searchParams.set('oddsFormat', 'decimal');
  url.searchParams.set('dateFormat', 'iso');

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      await release('the-odds-api', cost);
      return cached ? cached.value : null;
    }
    const json = (await res.json()) as T;
    await commit('the-odds-api', cost);
    await writeCacheIfChanged(cacheKey, json, ttlMs, 'the-odds-api');
    return json;
  } catch {
    await release('the-odds-api', cost);
    return cached ? cached.value : null;
  }
}

/**
 * Prices for a set of sport keys.
 *
 * `sportKeys` should be as small as possible — one request is spent per
 * sport key, so only the leagues with fixtures worth pricing are included.
 */
export async function fetchOddsApiEvents(sportKeys: string[]): Promise<OddsEvent[]> {
  if (!sportKeys.length || !oddsApiConfigured()) return [];
  const params: Record<string, string> = {
    regions: 'eu,uk',
    markets: ODDS_API_MARKETS.join(','),
    oddsFormat: 'decimal',
    dateFormat: 'iso'
  };

  const events: OddsEvent[] = [];
  // The Odds API bills one credit per market group, so three markets cost
  // three credits of the 250/month allowance for a single sport key.
  const cost = ODDS_API_MARKETS.length;
  for (const sportKey of sportKeys.slice(0, 6)) {
    const data = await fetchFromOddsApi<OddsApiEvent[]>(
      `/sports/${sportKey}/odds`,
      params,
      10 * 60_000,
      cost
    );
    if (data) events.push(...data);
  }
  return events as unknown as OddsEvent[];
}

/** Upcoming events list — one request, used to discover live fixtures. */
export async function fetchOddsApiUpcoming(hours = 48): Promise<OddsEvent[]> {
  const data = await fetchFromOddsApi<OddsApiEvent[]>(
    '/sports/upcoming',
    { hours: String(hours) },
    10 * 60_000,
    1
  );
  return (data ?? []) as unknown as OddsEvent[];
}

export interface OddApiEvent {
  id: string;
  sport: string;
  league?: string;
  startTime?: string;
  homeTeam?: string;
  awayTeam?: string;
  teams?: { home?: string; away?: string };
  odds?: unknown;
}

/**
 * Odd-API fallback.
 *
 * Odd-API prices events by id, so a sport listing is one credit and the
 * detail call is another. Only worth it when the Odds API allowance is gone.
 */
export async function fetchOddApiEvents(sport: string): Promise<OddApiEvent[]> {
  const key = env('ODD_API_KEY');
  if (!key) return [];

  const cacheKey = `odd-api/events/${sport}`;
  const cached = await readCache<OddApiEvent[]>(cacheKey, true);
  if (cached && !cached.stale) return cached.value;

  const permission = await reserve('odd-api', 1);
  if (!permission || permission.remaining < 1) {
    // Out of Odd-API credits — serve the cached copy only.
    return cached?.value ?? [];
  }

  const url = new URL(`${ODD_API_BASE}/events`);
  url.searchParams.set('apiKey', key);
  url.searchParams.set('sport', sport);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      await release('odd-api', 1);
      return cached?.value ?? [];
    }
    const json = (await res.json()) as { data?: OddApiEvent[] } | OddApiEvent[];
    const list = Array.isArray(json) ? json : json.data ?? [];
    await commit('odd-api', 1);
    await writeCacheIfChanged(cacheKey, list, 10 * 60_000, 'odd-api');
    return list;
  } catch {
    await release('odd-api', 1);
    return cached?.value ?? [];
  }
}

/** Flatten an Odds API event into per-outcome prices. */
export function flattenEvent(event: OddsEvent): { selection: string; price: number; market: string; book: string }[] {
  const out: { selection: string; price: number; market: string; book: string }[] = [];
  for (const book of event.bookmakers) {
    for (const market of book.markets ?? []) {
      for (const outcome of market.outcomes ?? []) {
        out.push({
          selection: `${event.home_team} v ${event.away_team} · ${market.key} · ${outcome.name}`,
          price: outcome.price,
          market: market.key,
          book: book.title
        });
      }
    }
  }
  return out;
}
