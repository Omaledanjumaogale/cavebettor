/**
 * API-Football client.
 *
 * The account has a hard ceiling of 100 requests per day, shared by every
 * sport. This client therefore:
 *
 *   1. serves every read from the R2 data-plane cache first,
 *   2. reserves budget before any outbound call,
 *   3. never issues more than the per-sport daily allocation,
 *   4. degrades to the local deterministic engine instead of failing.
 *
 * Hosts are per-sport because the API-Sports platform exposes a different
 * base URL for each competition family.
 */

import { env as privateEnv } from '$env/dynamic/private';
import { readCache, writeCacheIfChanged } from '#lib/server/cache';
import { commitApiFootball, releaseApiFootball, reserveApiFootball } from './budget';

export type ApiFootballSport = 'football' | 'basketball' | 'icehockey' | 'nba' | 'baseball';

export const API_FOOTBALL_HOSTS: Record<ApiFootballSport, string> = {
  football: 'v3.football.api-sports.io',
  basketball: 'v1.basketball.api-sports.io',
  icehockey: 'v1.hockey.api-sports.io',
  nba: 'v2.nba.api-sports.io',
  baseball: 'v1.baseball.api-sports.io'
};

/** Season ids used by the league catalogue, mapped to provider league ids. */
export const API_FOOTBALL_LEAGUES: Record<ApiFootballSport, number[]> = {
  football: [39, 140, 135, 78, 61, 2, 133, 88, 94, 169],
  basketball: [134, 8, 133, 10],
  icehockey: [133, 57],
  nba: [134, 8],
  baseball: [133, 10]
};

const TTL_FIXTURES = 30 * 60_000;
const TTL_LIVE = 60_000;
const TTL_ODDS = 15 * 60_000;

export interface ApiFootballFixture {
  id: number;
  date: string;
  timestamp: number;
  status: { short: string; long: string; elapsed: number | null };
  venue: { name: string; city: string };
  league: { id: number; name: string; country: string; season: number; logo?: string };
  home: { id: number; name: string; logo?: string; winner: boolean | null; goals?: Record<string, number>; score?: Record<string, number> };
  away: { id: number; name: string; logo?: string; winner: boolean | null; goals?: Record<string, number>; score?: Record<string, number> };
  /** Top-level score block. Some endpoints return per-half goals instead. */
  score?: { home: number | { home: number; away: number }; away: number | { home: number; away: number } };
}

export interface ApiFootballEnvelope<T> {
  get: string;
  parameters: Record<string, unknown>;
  errors: unknown;
  results: number;
  /** The provider payload for the requested resource (usually an array). */
  response: T;
  paging: { current: number; total: number };
}

function apiKey(): string {
  return privateEnv.API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '';
}

export function apiFootballConfigured(): boolean {
  return Boolean(apiKey());
}

/** Per-sport sub-limit inside the shared 100/day account allowance. */
async function sportAllowance(sport: ApiFootballSport): Promise<number> {
  const { apiFootballSportAllowance } = await import('./budget');
  return apiFootballSportAllowance(sport);
}

interface FetchOptions {
  sport: ApiFootballSport;
  path: string;
  params?: Record<string, string | number>;
  ttlMs: number;
  /** Skip the cache read (used by explicit refresh paths). */
  force?: boolean;
  /** Cost in daily requests (some endpoints count more than one). */
  cost?: number;
}

export interface ProviderFetchResult<T> {
  data: T;
  source: 'api' | 'cache';
  cachedAt?: number;
  requestsUsed: number;
}

/**
 * Perform a budgeted API-Football read.
 *
 * Returns `null` when the daily ceiling would be exceeded — callers then
 * fall back to the cached payload or the local engine.
 */
export async function apiFootballFetch<T>(options: FetchOptions): Promise<ProviderFetchResult<T> | null> {
  const { sport, path, params = {}, ttlMs, force = false, cost = 1 } = options;
  const cacheKey = `api-football/${sport}/${path}/${JSON.stringify(params)}`;

  if (!force) {
    const cached = await readCache<T>(cacheKey, true);
    if (cached && !cached.stale) {
      return { data: cached.value, source: 'cache', cachedAt: cached.storedAt, requestsUsed: 0 };
    }
  }

  if (!apiFootballConfigured()) return null;

  const allowance = await sportAllowance(sport);
  if (allowance <= 0) return null;

  // Both the account-wide daily ceiling and the sport's share of it are
  // checked before a single byte leaves the machine.
  const permission = await reserveApiFootball(sport, cost);
  if (!permission) {
    // Daily ceiling reached — serve the cached copy when we have one.
    const cached = await readCache<T>(cacheKey, true);
    if (cached) return { data: cached.value, source: 'cache', cachedAt: cached.storedAt, requestsUsed: 0 };
    return null;
  }

  const host = API_FOOTBALL_HOSTS[sport];
  const url = new URL(`https://${host}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  try {
    const res = await fetch(url, {
      headers: { 'x-apikey': apiKey(), accept: 'application/json' },
      signal: AbortSignal.timeout(12_000)
    });
    if (!res.ok) {
      await releaseApiFootball(sport, cost);
      const cached = await readCache<T>(cacheKey, true);
      if (cached) return { data: cached.value, source: 'cache', cachedAt: cached.storedAt, requestsUsed: 0 };
      return null;
    }
    const json = (await res.json()) as ApiFootballEnvelope<T>;
    if (json.errors && json.errors !== null && (Array.isArray(json.errors) ? json.errors.length > 0 : true)) {
      await releaseApiFootball(sport, cost);
      const cached = await readCache<T>(cacheKey, true);
      if (cached) return { data: cached.value, source: 'cache', cachedAt: cached.storedAt, requestsUsed: 0 };
      return null;
    }
    await commitApiFootball(sport, cost);
    await writeCacheIfChanged(cacheKey, json.response, ttlMs, 'api-football');
    return { data: json.response, source: 'api', requestsUsed: cost };
  } catch {
    await releaseApiFootball(sport, cost);
    const cached = await readCache<T>(cacheKey, true);
    if (cached) return { data: cached.value, source: 'cache', cachedAt: cached.storedAt, requestsUsed: 0 };
    return null;
  }
}

/** Scheduled fixtures for a sport, merged across its leagues in one request window. */
export async function fetchSportFixtures(
  sport: ApiFootballSport,
  season = 2025,
  leagues?: number[]
): Promise<ApiFootballFixture[]> {
  const out: ApiFootballFixture[] = [];
  for (const league of leagues ?? API_FOOTBALL_LEAGUES[sport]) {
    const result = await apiFootballFetch<ApiFootballFixture[]>({
      sport,
      path: '/fixtures',
      params: { league, season, timezone: 'Africa/Lagos' },
      ttlMs: TTL_FIXTURES
    });
    if (result) out.push(...result.data);
  }
  return out;
}

/**
 * Rotate the league list so each collection cycle asks for a slice of a
 * sport's competitions instead of all of them. Across the day's cycles every
 * competition is refreshed, while a single cycle stays well inside the
 * account-wide daily ceiling.
 */
export function rotateLeagues(sport: ApiFootballSport, cycle: number, perCycle: number): number[] {
  const all = API_FOOTBALL_LEAGUES[sport];
  if (all.length <= perCycle) return all;
  const start = (cycle * perCycle) % all.length;
  const slice: number[] = [];
  for (let i = 0; i < perCycle; i++) slice.push(all[(start + i) % all.length]);
  return slice;
}

/** Live fixtures — one cheap request per sport, cached for a minute. */
export async function fetchLiveFixtures(sport: ApiFootballSport): Promise<ApiFootballFixture[]> {
  const result = await apiFootballFetch<ApiFootballFixture[]>({
    sport,
    path: '/fixtures',
    params: { live: '1', timezone: 'Africa/Lagos' },
    ttlMs: TTL_LIVE
  });
  return result?.data ?? [];
}

export async function fetchSportOdds(sport: ApiFootballSport): Promise<unknown[]> {
  const result = await apiFootballFetch<unknown[]>({
    sport,
    path: '/odds',
    params: { timezone: 'Africa/Lagos' },
    ttlMs: TTL_ODDS
  });
  return result?.data ?? [];
}

/** Account status — one request, cached for a day. */
export async function fetchAccountStatus(): Promise<Record<string, unknown> | null> {
  const result = await apiFootballFetch<Record<string, unknown>>({
    sport: 'football',
    path: '/status',
    params: { timezone: 'Africa/Lagos' },
    ttlMs: 24 * 3600_000
  });
  return result?.data ?? null;
}
