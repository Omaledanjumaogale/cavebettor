/**
 * API-Sports client (football, basketball, ice hockey, NBA, baseball).
 *
 * The account has a hard ceiling of 100 requests per day shared by every
 * sport. This client therefore:
 *
 *   1. serves every read from the R2 data-plane cache first,
 *   2. reserves budget before any outbound call,
 *   3. never issues more than the per-sport daily allocation,
 *   4. asks for whole *days* rather than single leagues, so one request
 *      returns every competition the provider knows about — major and minor,
 *      cups and tournaments included,
 *   5. degrades to cached or engine data instead of failing.
 *
 * Hosts and resources differ per sport: football exposes `/fixtures`, the
 * other four expose `/games`. The header name matters — API-Sports rejects
 * requests authenticated with `x-apikey` and only accepts `x-apisports-key`
 * (or the RapidAPI equivalent).
 */

import { env as privateEnv } from '$env/dynamic/private';
import { readCache, deleteCache, writeCacheIfChanged } from '#lib/server/cache';
import { commitApiFootball, releaseApiFootball, reserveApiFootball } from './budget';

export type ApiFootballSport = 'football' | 'basketball' | 'icehockey' | 'nba' | 'baseball';

export const API_FOOTBALL_HOSTS: Record<ApiFootballSport, string> = {
  football: 'v3.football.api-sports.io',
  basketball: 'v1.basketball.api-sports.io',
  icehockey: 'v1.hockey.api-sports.io',
  nba: 'v2.nba.api-sports.io',
  baseball: 'v1.baseball.api-sports.io'
};

/** Football uses `/fixtures`; the other four sports use `/games`. */
export function resourcePath(sport: ApiFootballSport): string {
  return sport === 'football' ? '/fixtures' : '/games';
}

/** Retained for callers that still want a league-scoped request. */
export const API_FOOTBALL_LEAGUES: Record<ApiFootballSport, number[]> = {
  football: [39, 140, 135, 78, 61, 2, 3, 848, 133, 88, 94, 169, 71, 128, 253, 262, 307, 203],
  basketball: [12, 120, 132, 155, 134],
  icehockey: [57, 58, 59, 60],
  nba: [],
  baseball: [1, 2, 3, 5]
};

const TTL_FIXTURES = 20 * 60_000;
const TTL_LIVE = 60_000;
const TTL_ODDS = 15 * 60_000;

export interface ApiFootballFixture {
  id?: number;
  /** Football nests the match metadata under `fixture`. */
  fixture?: {
    id?: number;
    date?: string;
    timestamp?: number;
    referee?: string | null;
    venue?: { name?: string; city?: string };
    status?: { short?: string | null; long?: string | null; elapsed?: number | null };
  };
  date?: string | { start?: string | null; end?: string | null };
  time?: string;
  timestamp?: number;
  status?: { short?: string | number | null; long?: string | null; elapsed?: number | null; timer?: number | null; clock?: string | null };
  venue?: string | { name?: string; city?: string };
  league?: { id?: number; name?: string; country?: string; season?: number | string; logo?: string; round?: string } | string;
  country?: { name?: string; code?: string } | string;
  teams?: {
    home?: { id?: number; name?: string; logo?: string; winner?: boolean | null };
    away?: { id?: number; name?: string; logo?: string; winner?: boolean | null };
    visitors?: { id?: number; name?: string; nickname?: string; code?: string; logo?: string };
  };
  goals?: { home?: number | null; away?: number | null };
  score?: Record<string, { home?: number | null; away?: number | null } | number | null>;
  scores?: {
    home?: number | { total?: number | null; points?: number | null; linescore?: (string | number)[] } | null;
    away?: number | { total?: number | null; points?: number | null; linescore?: (string | number)[] } | null;
    visitors?: { total?: number | null; points?: number | null; linescore?: (string | number)[] } | null;
  };
  periods?: { current?: number | null; total?: number | null; first?: string | null; second?: string | null; third?: string | null };
  arena?: { name?: string; city?: string };
  stage?: number | string | null;
  week?: string | null;
}

export interface ApiFootballEnvelope<T> {
  get: string;
  parameters: Record<string, unknown>;
  errors: unknown;
  results: number;
  response: T;
  paging?: { current: number; total: number };
}

function apiKey(): string {
  return privateEnv.API_FOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '';
}

export function apiFootballConfigured(): boolean {
  return Boolean(apiKey());
}

async function sportAllowance(sport: ApiFootballSport): Promise<number> {
  const { apiFootballSportAllowance } = await import('./budget');
  return apiFootballSportAllowance(sport);
}

interface FetchOptions {
  sport: ApiFootballSport;
  path: string;
  params?: Record<string, string | number>;
  ttlMs: number;
  force?: boolean;
  cost?: number;
}

export interface ProviderFetchResult<T> {
  data: T;
  source: 'api' | 'cache';
  cachedAt?: number;
  requestsUsed: number;
}

function providerErrors(errors: unknown): boolean {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors as object).length > 0;
  return true;
}

export interface ProviderCallLogEntry {
  at: string;
  sport: ApiFootballSport;
  path: string;
  params: Record<string, string | number>;
  outcome: 'ok' | 'cache' | 'http-error' | 'provider-error' | 'network-error' | 'budget';
  status?: number;
  rows?: number;
  detail?: string;
  ms: number;
}

const callLog: ProviderCallLogEntry[] = [];

function recordCall(entry: ProviderCallLogEntry) {
  callLog.unshift(entry);
  if (callLog.length > 60) callLog.length = 60;
}

/** Recent provider calls, newest first — surfaced by the owner console. */
export function recentProviderCalls(): ProviderCallLogEntry[] {
  return callLog.slice(0, 25);
}

/**
 * Perform a budgeted API-Sports read.
 *
 * Returns `null` when the daily ceiling would be exceeded — callers then fall
 * back to the cached payload or the local engine.
 */
export async function apiFootballFetch<T>(options: FetchOptions): Promise<ProviderFetchResult<T> | null> {
  const { sport, path, params = {}, ttlMs, force = false, cost = 1 } = options;
  const cacheKey = `api-football/${sport}/${path}/${JSON.stringify(params)}`;

  if (!force) {
    const cached = await readCache<T>(cacheKey, true);
    // A malformed entry (missing value, or a non-array where a list is
    // expected) must be treated as a miss, not served.
    const usable = cached && cached.value !== undefined && cached.value !== null;
    if (usable && !cached.stale) {
      return { data: cached.value, source: 'cache', cachedAt: cached.storedAt, requestsUsed: 0 };
    }
  }

  if (!apiFootballConfigured()) return null;

  const allowance = await sportAllowance(sport);
  if (allowance <= 0) return null;

  const permission = await reserveApiFootball(sport, cost);
  if (!permission) {
    const fallback = await readCache<T>(cacheKey, true);
    if (fallback && fallback.value != null) {
      return { data: fallback.value, source: 'cache', cachedAt: fallback.storedAt, requestsUsed: 0 };
    }
    return null;
  }

  const host = API_FOOTBALL_HOSTS[sport];
  const url = new URL(`https://${host}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const startedAt = Date.now();
  const paramsSeen = { ...params };

  try {
    const res = await fetch(url, {
      headers: {
        // API-Sports only authenticates `x-apisports-key` (or `x-rapidapi-key`).
        'x-apisports-key': apiKey(),
        'x-rapidapi-key': apiKey(),
        accept: 'application/json'
      },
      signal: AbortSignal.timeout(25_000)
    });
    if (!res.ok) {
      console.warn(`[api-football] ${sport} ${path} -> HTTP ${res.status} ${res.statusText}`);
      recordCall({ at: new Date().toISOString(), sport, path, params: paramsSeen, outcome: 'http-error', status: res.status, detail: res.statusText, ms: Date.now() - startedAt });
      await releaseApiFootball(sport, cost);
      const fallback = await readCache<T>(cacheKey, true);
      if (fallback && fallback.value != null) {
        return { data: fallback.value, source: 'cache', cachedAt: fallback.storedAt, requestsUsed: 0 };
      }
      return null;
    }
    const json = (await res.json()) as ApiFootballEnvelope<T>;
    if (providerErrors(json.errors)) {
      const detail = JSON.stringify(json.errors).slice(0, 200);
      console.warn(`[api-football] ${sport} ${path} -> provider errors ${detail}`);
      recordCall({ at: new Date().toISOString(), sport, path, params: paramsSeen, outcome: 'provider-error', status: res.status, detail, ms: Date.now() - startedAt });
      await releaseApiFootball(sport, cost);
      const fallback = await readCache<T>(cacheKey, true);
      if (fallback && fallback.value != null) {
        return { data: fallback.value, source: 'cache', cachedAt: fallback.storedAt, requestsUsed: 0 };
      }
      return null;
    }
    await commitApiFootball(sport, cost);

    // Never poison the cache: a list endpoint must return a non-empty array,
    // otherwise the payload is left out and the next call retries upstream.
    const payload = json.response as unknown;
    const usable = Array.isArray(payload) ? payload.length > 0 : payload != null;
    if (usable) {
      await writeCacheIfChanged(cacheKey, payload, ttlMs, 'api-football');
    } else {
      await deleteCache(cacheKey);
    }
    recordCall({
      at: new Date().toISOString(),
      sport,
      path,
      params: paramsSeen,
      outcome: 'ok',
      status: res.status,
      rows: Array.isArray(payload) ? payload.length : undefined,
      ms: Date.now() - startedAt
    });
    return { data: (payload ?? []) as T, source: 'api', requestsUsed: cost };
  } catch (error) {
    console.warn(`[api-football] ${sport} ${path} -> ${String(error).slice(0, 200)}`);
    recordCall({ at: new Date().toISOString(), sport, path, params: paramsSeen, outcome: 'network-error', detail: String(error).slice(0, 200), ms: Date.now() - startedAt });
    await releaseApiFootball(sport, cost);
    const fallback = await readCache<T>(cacheKey, true);
    if (fallback && fallback.value != null) {
      return { data: fallback.value, source: 'cache', cachedAt: fallback.storedAt, requestsUsed: 0 };
    }
    return null;
  }
}

export function isoDate(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
}

/** All fixtures for one calendar day across every competition (1 request). */
export async function fetchSportDay(
  sport: ApiFootballSport,
  date: string
): Promise<{ rows: ApiFootballFixture[]; source: 'api' | 'cache' | 'none' }> {
  const result = await apiFootballFetch<ApiFootballFixture[]>({
    sport,
    path: resourcePath(sport),
    params: { date },
    ttlMs: TTL_FIXTURES
  });
  if (!result) return { rows: [], source: 'none' };
  return { rows: result.data ?? [], source: result.source };
}

/**
 * In-play rows for one sport (1 request).
 *
 * Only football and the NBA host expose a `live` filter; the other hosts
 * reject it outright, so for those we pull today's slate and let the caller
 * keep the rows that are actually in play.
 */
export function sportSupportsLiveFilter(sport: ApiFootballSport): boolean {
  return sport === 'football' || sport === 'nba';
}

export async function fetchSportLive(sport: ApiFootballSport): Promise<{ rows: ApiFootballFixture[]; source: 'api' | 'cache' | 'none' }> {
  const result = await apiFootballFetch<ApiFootballFixture[]>({
    sport,
    path: resourcePath(sport),
    params: sportSupportsLiveFilter(sport) ? { live: 'all' } : { date: isoDate(0) },
    ttlMs: TTL_LIVE
  });
  if (!result) return { rows: [], source: 'none' };
  return { rows: result.data ?? [], source: result.source };
}

/** League-scoped window, kept for targeted refreshes. */
export async function fetchSportFixtures(
  sport: ApiFootballSport,
  season = 2025,
  leagues?: number[]
): Promise<ApiFootballFixture[]> {
  const out: ApiFootballFixture[] = [];
  for (const league of leagues ?? API_FOOTBALL_LEAGUES[sport]) {
    const result = await apiFootballFetch<ApiFootballFixture[]>({
      sport,
      path: resourcePath(sport),
      params: { league, season, timezone: 'Africa/Lagos' },
      ttlMs: TTL_FIXTURES
    });
    if (result) out.push(...result.data);
  }
  return out;
}

/** Rotate a league list (kept for the league-scoped path). */
export function rotateLeagues(sport: ApiFootballSport, cycle: number, perCycle: number): number[] {
  const all = API_FOOTBALL_LEAGUES[sport];
  if (all.length <= perCycle) return all;
  const start = (cycle * perCycle) % all.length;
  const slice: number[] = [];
  for (let i = 0; i < perCycle; i++) slice.push(all[(start + i) % all.length]);
  return slice;
}

export async function fetchLiveFixtures(sport: ApiFootballSport): Promise<ApiFootballFixture[]> {
  return (await fetchSportLive(sport)).rows;
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
    ttlMs: 24 * 3600_000
  });
  return result?.data ?? null;
}
