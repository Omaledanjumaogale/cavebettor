import { readCache, writeCache } from '#lib/server/cache';
import { fetchSportDay, fetchSportLive, isoDate, planFloor, type ApiFootballSport } from '#lib/server/providers/apiFootball';
import { normaliseProviderFixtures } from '#lib/server/providers/normalise';
import { registerLeague, registerTeam } from '#lib/data/registry';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { settleSelection, type GradedPick } from '#lib/engine/settlement';
import {
  FINISHED_TTL_MS,
  lifecycleOf,
  mergeSettlements,
  partitionFixtures,
  pruneSettlements,
  settleStale,
  settlementOf,
  type SettlementRecord
} from '#lib/server/lifecycle';
import type { Fixture, SportId } from '#lib/types';

/**
 * Live feed.
 *
 * Collection strategy
 * -------------------
 * Every sport is asked for *whole days* rather than individual leagues:
 *
 *   GET /fixtures?date=YYYY-MM-DD   (football)
 *   GET /games?date=YYYY-MM-DD      (basketball, hockey, NBA, baseball)
 *
 * One request returns every competition the provider covers for that day, so
 * a full global snapshot costs five requests and includes major and minor
 * leagues, cups and tournaments alike. The window is yesterday → tomorrow
 * plus a live sweep, i.e. ~20 requests for the whole world.
 *
 * Everything is cached in the R2 data plane. Page loads never make a provider
 * call; the background revalidation below refreshes the cache when it goes
 * stale, gated by the daily budget ledger.
 */

export const FEED_SPORTS: ApiFootballSport[] = ['football', 'basketball', 'icehockey', 'nba', 'baseball'];

const FEED_KEY = 'feed/fixtures';
const META_KEY = 'feed/meta';
const LIVE_KEY = 'feed/live';
const RESULTS_KEY = 'feed/results';
/**
 * Settlement archive: the retraining set. A finished match is copied here
 * before it leaves the boards, so a 24-hour interface retention never costs
 * the model its training data.
 */
const SETTLEMENTS_KEY = 'feed/settlements';
/** Cache TTL for the archive is capped by the R2 layer; keep it at 45 days. */
const SETTLEMENT_TTL_SAFE = 45 * 86_400_000;
const LOCK_KEY = 'feed/lock';

/** How long a collected feed is considered fresh for page rendering. */
export const FEED_TTL = 20 * 60_000;
/** Minimum gap between two background collections, per isolate and globally. */
const REVALIDATE_FLOOR = 10 * 60_000;

export interface FeedMeta {
  generatedAt: string;
  fixtureCount: number;
  liveCount: number;
  leagues: number;
  sports: Record<string, number>;
  window: { from: string; to: string };
  requests: number;
  source: 'api-football';
}

export interface FeedBundle {
  generatedAt: string;
  fixtures: Fixture[];
  providerCount: number;
  engineCount: number;
  sports: string[];
}

/** Days collected on every full refresh, relative to today. */
const DAY_WINDOW = [-1, 0, 1, 2] as const;

/**
 * Re-register teams and leagues that arrived inline on cached provider
 * fixtures, so every legacy `TEAM_MAP[...]` / `LEAGUE_MAP[...]` lookup in the
 * app resolves real squads after a cold start.
 */
function hydrateRegistry(fixtures: Fixture[]): void {
  for (const fixture of fixtures) {
    if (fixture.league) registerLeague(fixture.league);
    if (fixture.homeTeam) registerTeam(fixture.homeTeam);
    if (fixture.awayTeam) registerTeam(fixture.awayTeam);
  }
}

function dedupe(fixtures: Fixture[]): Fixture[] {
  const byId = new Map<string, Fixture>();
  for (const fixture of fixtures) {
    const existing = byId.get(fixture.id);
    // Prefer the row with a score / live status when duplicates arrive from
    // the day sweep and the live sweep.
    if (!existing) {
      byId.set(fixture.id, fixture);
      continue;
    }
    const richer = fixture.status === 'live' || fixture.status === 'halftime' ? fixture : existing;
    byId.set(fixture.id, { ...existing, ...richer });
  }
  return [...byId.values()];
}

/**
 * Collect a provider snapshot. Called by the scheduled worker and by the
 * guarded background revalidation — never directly by a page load.
 *
 * Pass `sports` to scope a run to one sport. The free Workers plan caps
 * subrequests per invocation, and a whole-window refresh for all five sports
 * needs more than that, so the collector fans out one invocation per sport.
 */
export async function refreshProviderFeed(options: { liveOnly?: boolean; sports?: ApiFootballSport[] } = {}): Promise<FeedMeta> {
  const collected: Fixture[] = [];
  const sports: Record<string, number> = {};
  let requests = 0;

  const target = options.sports?.length ? options.sports : FEED_SPORTS;
  // The free plan rejects dates before a rolling boundary, so the requested
  // window is clamped to whatever the provider last said was allowed.
  const floor = options.liveOnly ? null : await planFloor();
  const days = options.liveOnly
    ? []
    : DAY_WINDOW.map((offset) => isoDate(offset)).filter((day) => !floor || day >= floor);

  for (const sport of target) {
    for (const day of days) {
      const result = await fetchSportDay(sport, day);
      requests += 1;
      if (!result.rows.length) continue;
      const mapped = normaliseProviderFixtures(result.rows, sport);
      if (mapped.fixtures.length) {
        collected.push(...mapped.fixtures);
        sports[sport] = (sports[sport] ?? 0) + mapped.fixtures.length;
      }
    }
    const live = await fetchSportLive(sport);
    requests += 1;
    if (live.rows.length) {
      const mapped = normaliseProviderFixtures(live.rows, sport);
      if (mapped.fixtures.length) {
        collected.push(...mapped.fixtures);
        sports[sport] = (sports[sport] ?? 0) + mapped.fixtures.length;
      }
    }
  }

  // A sport-scoped run only replaces its own slice, so a single-sport tick can
  // never erase the other sports' window.
  const previous = options.sports?.length ? await readProviderFixtures() : [];
  const kept = options.sports?.length ? previous.filter((fixture) => !target.includes(fixture.sport as ApiFootballSport)) : [];
  const fixtures = dedupe([...kept, ...collected]).sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));

  const previousMeta = await readCache<FeedMeta>(META_KEY, true);
  const mergedSports: Record<string, number> = options.sports?.length ? { ...(previousMeta?.value?.sports ?? {}), ...sports } : sports;
  for (const sport of target) if (!mergedSports[sport]) delete mergedSports[sport];

  const meta: FeedMeta = {
    generatedAt: new Date().toISOString(),
    fixtureCount: fixtures.length,
    liveCount: fixtures.filter((f) => f.status === 'live' || f.status === 'halftime').length,
    leagues: new Set(fixtures.map((f) => f.leagueId)).size,
    sports: mergedSports,
    window: {
      from: previousMeta?.value?.window?.from ?? days[0] ?? isoDate(0),
      to: days[days.length - 1] ?? previousMeta?.value?.window?.to ?? isoDate(2)
    },
    requests,
    source: 'api-football'
  };

  if (fixtures.length) {
    hydrateRegistry(fixtures);
    // Plain write: reading first would cost a subrequest the free plan cannot spare.
    await writeCache(FEED_KEY, fixtures, 6 * 3600_000, 'api-football');
    // Every collection also refreshes the retraining archive. It writes only
    // when a new result appears, so the extra subrequests are rare.
    await archiveSettlements(fixtures).catch(() => 0);
  }
  await writeCache(META_KEY, meta, 6 * 3600_000, 'api-football');
  feedMemo = null;
  metaMemo = null;
  return meta;
}

/**
 * Per-isolate memo of the parsed feed.
 *
 * The collected window is ~1.3 MB of JSON. Re-reading and re-parsing it on
 * every page load is what pushes a request over the Worker CPU budget (and
 * bills R2 reads for data that has not changed), so the parsed array is kept
 * in memory for a short window. Convex/R2 stay untouched while it is warm.
 */
const MEMO_MS = 45_000;
let feedMemo: { at: number; fixtures: Fixture[] } | null = null;

/** Drop the isolate memo. Used by tests and after a collection writes new data. */
export function resetFeedMemo(): void {
  feedMemo = null;
  metaMemo = null;
}

/** Read the cached provider fixtures with the latest live sweep overlaid. */
export async function readProviderFixtures(): Promise<Fixture[]> {
  if (feedMemo && Date.now() - feedMemo.at < MEMO_MS) return feedMemo.fixtures;

  const [cached, live] = await Promise.all([readCache<Fixture[]>(FEED_KEY, true), readCache<Fixture[]>(LIVE_KEY, true)]);
  const fixtures = Array.isArray(cached?.value) ? cached.value.slice() : [];
  const liveRows = Array.isArray(live?.value) ? live.value : [];

  const byId = new Map(fixtures.map((fixture) => [fixture.id, fixture]));

  if (liveRows.length) {
    // The live sweep is authoritative for in-play score/clock, and can also
    // introduce matches that started after the last full collection.
    for (const row of liveRows) byId.set(row.id, { ...(byId.get(row.id) ?? {}), ...row });
  }

  // Matches that have left the in-play list are finished: keep the last known
  // score so the board moves them into results instead of reverting to
  // "scheduled 0–0".
  const results = await readCache<Record<string, { home: number; away: number; at: number; period?: string }>>(RESULTS_KEY, true);
  if (results?.value) {
    for (const [id, result] of Object.entries(results.value)) {
      const existing = byId.get(id);
      if (!existing) continue;
      if (existing.status === 'finished') continue;
      byId.set(id, {
        ...existing,
        status: 'finished',
        score: { home: result.home, away: result.away },
        minute: undefined,
        period: result.period ?? 'FT',
        finishedAt: new Date(result.at).toISOString()
      } as Fixture);
    }
  }

  if (liveRows.length || results?.value) {
    fixtures.length = 0;
    fixtures.push(...byId.values());
  }

  // Lifecycle enforcement. A provider that still reports "live" long after the
  // match must have ended cannot keep the fixture on the live board, and a
  // result older than the retention window leaves the interface here — the
  // settlement archive is what survives.
  const now = Date.now();
  const settled = settleStale(fixtures, now);
  const buckets = partitionFixtures(settled, now);
  const visible = [...buckets.live, ...buckets.upcoming, ...buckets.finished, ...buckets.postponed].sort(
    (a, b) => +new Date(a.kickoff) - +new Date(b.kickoff)
  );

  if (visible.length) hydrateRegistry(visible);
  if (visible.length) feedMemo = { at: now, fixtures: visible };
  return visible;
}

let metaMemo: { at: number; value: (FeedMeta & { ageMs: number; stale: boolean }) | null } | null = null;

export async function feedMeta(): Promise<(FeedMeta & { ageMs: number; stale: boolean }) | null> {
  if (metaMemo && Date.now() - metaMemo.at < 30_000) {
    const cached = metaMemo.value;
    if (!cached) return null;
    const ageMs = Date.now() - Date.parse(cached.generatedAt);
    return { ...cached, ageMs, stale: ageMs > FEED_TTL };
  }
  const meta = await readCache<FeedMeta>(META_KEY, true);
  if (!meta) {
    metaMemo = { at: Date.now(), value: null };
    return null;
  }
  const ageMs = Date.now() - Date.parse(meta.value.generatedAt);
  const value = { ...meta.value, ageMs, stale: ageMs > FEED_TTL };
  metaMemo = { at: Date.now(), value };
  return value;
}

/** Cheap counts for the shell; reuses the memo instead of re-reading the feed. */
export async function wireCounts(): Promise<{ fixtures: number; live: number; upcoming: number; competitions: number; sports: number; updatedAt: string | null }> {
  const [fixtures, meta] = await Promise.all([readProviderFixtures(), feedMeta()]);
  const now = Date.now();
  let live = 0;
  let upcoming = 0;
  for (const fixture of fixtures) {
    if (fixture.status === 'live' || fixture.status === 'halftime') live += 1;
    else if (fixture.status === 'scheduled' && +new Date(fixture.kickoff) > now) upcoming += 1;
  }
  return {
    fixtures: fixtures.length,
    live,
    upcoming,
    competitions: new Set(fixtures.map((f) => f.leagueId)).size,
    sports: new Set(fixtures.map((f) => f.sport)).size,
    updatedAt: meta?.generatedAt ?? null
  };
}

/**
 * Merged fixture universe: real provider fixtures first, engine fixtures kept
 * only where the provider has nothing (never to pad the live board).
 */
export async function mergedFixtures(): Promise<{
  fixtures: Fixture[];
  providerCount: number;
  source: 'provider' | 'engine';
}> {
  const provider = await readProviderFixtures();
  // Live collected data replaces the engine entirely. Mixing the two left
  // placeholder fixtures sitting next to real ones on every page.
  if (!provider.length) return { fixtures: getFixtures(), providerCount: 0, source: 'engine' };

  // Sports the provider does not cover at all (tennis has no API-Sports
  // host here) fall back to the catalogue — upcoming fixtures only, never a
  // simulated live score or a fake result.
  const covered = new Set(provider.map((fixture) => fixture.sport));
  const uncovered = getFixtures().filter((fixture) => !covered.has(fixture.sport) && fixture.status === 'scheduled');
  const fixtures = [...provider, ...uncovered].sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
  return { fixtures, providerCount: provider.length, source: 'provider' };
}

/** Live-now bundle used by the live centre. */
export async function liveFeed(): Promise<Fixture[]> {
  const provider = await readProviderFixtures();
  // Real fixtures only: a live centre must never carry a placeholder match.
  const source = provider.length ? provider : getFixtures();
  return source
    .filter((f) => f.status === 'live' || f.status === 'halftime')
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

/**
 * The fixture universe a page should render.
 *
 * Priority: R2 provider feed (real schedules) → Convex snapshot → local
 * engine. Every branch is free: no provider request is made here.
 */
export async function pageFixtureUniverse(): Promise<{
  fixtures: Fixture[];
  source: 'provider' | 'convex' | 'engine';
}> {
  const feed = await mergedFixtures();
  if (feed.providerCount > 0) return { fixtures: feed.fixtures, source: 'provider' };

  const { liveFixtures } = await import('#lib/server/live');
  const snap = await liveFixtures();
  if (snap?.length) return { fixtures: snap, source: 'convex' };

  return { fixtures: getFixtures(), source: 'engine' };
}

/* ── background revalidation ─────────────────────────────────────────────── */

let lastAttempt = 0;
let inFlight: Promise<unknown> | null = null;

/**
 * Stale-while-revalidate for the provider feed.
 *
 * Called from the request hook. It never blocks the response: when the feed
 * is missing or stale it schedules a collection on `waitUntil`, guarded by an
 * in-isolate floor and a cache lock so concurrent requests (and isolates)
 * cannot multiply provider spend.
 *
 * Returns true when a refresh was scheduled.
 */
export async function revalidateFeed(
  waitUntil: ((promise: Promise<unknown>) => void) | undefined,
  options: { force?: boolean } = {}
): Promise<boolean> {
  const now = Date.now();
  if (!options.force && now - lastAttempt < REVALIDATE_FLOOR) return false;

  const meta = await feedMeta();
  if (!options.force && meta && !meta.stale && meta.fixtureCount > 0) return false;

  if (!options.force) {
    const lock = await readCache<number>(LOCK_KEY, false);
    if (lock) return false;
  }
  lastAttempt = now;

  const run = (async () => {
    try {
      await writeCache(LOCK_KEY, now, REVALIDATE_FLOOR, 'api-football');
      await refreshProviderFeed();
    } catch {
      /* the feed keeps serving its last good snapshot */
    } finally {
      inFlight = null;
    }
  })();

  inFlight = run;
  if (waitUntil) waitUntil(run);
  return true;
}

export function feedRefreshing(): boolean {
  return inFlight !== null;
}

/** Sweep every sport's live endpoint and cache the in-play rows. */
export async function refreshLiveNow(options: { sports?: ApiFootballSport[] } = {}): Promise<number> {
  const target = options.sports?.length ? options.sports : FEED_SPORTS;
  const live: Fixture[] = [];
  for (const sport of target) {
    try {
      const result = await fetchSportLive(sport);
      if (!result.rows.length) continue;
      const mapped = normaliseProviderFixtures(result.rows, sport);
      // Hosts without a live filter return the whole day, so the in-play rows
      // are selected here rather than trusting the endpoint.
      live.push(...mapped.fixtures.filter((fixture) => fixture.status === 'live' || fixture.status === 'halftime'));
    } catch {
      /* one sport failing must not stop the others */
    }
  }

  // Keep the other sports' live rows when this run only covers one sport.
  const previous = options.sports?.length ? await readCache<Fixture[]>(LIVE_KEY, true) : null;
  const previousRows = Array.isArray(previous?.value) ? previous.value : [];

  // An empty sweep is meaningful: it means everything that was in play has
  // finished. Returning early here used to leave the last match stuck on the
  // live board until the next full collection.
  if (!live.length && !previousRows.length) return 0;
  if (!live.length && options.sports?.length && !previousRows.some((row) => target.includes(row.sport as ApiFootballSport))) {
    return 0;
  }

  const carried = options.sports?.length ? previousRows.filter((row) => !target.includes(row.sport as ApiFootballSport)) : [];
  const fixtures = dedupe([...carried, ...live]);

  const now = Date.now();
  const stored = await readCache<Record<string, { home: number; away: number; at: number; period?: string }>>(RESULTS_KEY, true);
  const results = { ...(stored?.value ?? {}) };

  // A match already recorded as finished must never re-enter the live board,
  // even when the provider's sweep lags a cycle behind the final whistle.
  const alreadySettled = new Set(Object.keys(results));
  const fresh = fixtures.filter((row) => !alreadySettled.has(row.id));

  // Rows the provider still calls live but which cannot be in play any more.
  const stale = fresh.filter((row) => lifecycleOf(row, now).state === 'finished');
  const inPlay = fresh.filter((row) => lifecycleOf(row, now).state === 'live');

  // Anything that was in play and is no longer in the sweep has finished.
  const currentIds = new Set([...inPlay, ...stale].map((row) => row.id));
  const departed = previousRows.filter(
    (row) => target.includes(row.sport as ApiFootballSport) && !currentIds.has(row.id) && !alreadySettled.has(row.id)
  );

  const newlyFinished = [...departed, ...stale];
  for (const row of newlyFinished) {
    const life = lifecycleOf(row, now);
    results[row.id] = {
      home: row.score?.home ?? 0,
      away: row.score?.away ?? 0,
      at: life.state === 'finished' ? life.finishedAt : now,
      period: row.period ?? 'FT'
    };
  }

  if (newlyFinished.length) {
    // Keep the map small: one day of results is plenty for the board.
    const entries = Object.entries(results)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, 400);
    await writeCache(RESULTS_KEY, Object.fromEntries(entries), FINISHED_TTL_MS, 'api-football');
    // Retraining data survives the purge.
    await archiveSettlements(
      newlyFinished.map((row) => ({
        ...row,
        status: 'finished' as const,
        finishedAt: new Date(results[row.id].at).toISOString()
      })),
      now
    ).catch(() => 0);
  }

  fixtures.length = 0;
  fixtures.push(...inPlay);

  feedMemo = null;
  if (fixtures.length) hydrateRegistry(fixtures);
  // Always write the sweep — an empty list is how the last match leaves the
  // live board. Skipping the write when nothing is in play left stale rows in
  // R2 that the next read would happily serve as "live" again.
  await writeCache(LIVE_KEY, fixtures, 3 * 3600_000, 'api-football');

  // Keep the headline metadata honest about what is in play right now.
  const meta = await readCache<FeedMeta>(META_KEY, true);
  if (meta && meta.value) {
    await writeCache(META_KEY, { ...meta.value, liveCount: fixtures.length }, 6 * 3600_000, 'api-football');
  }
  return fixtures.length;
}

/**
 * Copy settled matches into the retraining archive.
 *
 * This is the only reason a purge is safe: the interface keeps a result for a
 * day, the archive keeps the score, the periods and the competition for 45
 * days so the learning loop can re-price it long after it left the board.
 */
export async function archiveSettlements(rows: Fixture[], now = Date.now()): Promise<number> {
  const finished = rows.filter((row) => row.status === 'finished');
  if (!finished.length) return 0;
  const stored = await readCache<SettlementRecord[]>(SETTLEMENTS_KEY, true);
  const existing = Array.isArray(stored?.value) ? stored.value : [];
  const incoming = finished.map((row) => settlementOf(row, now, gradePicks(row)));
  const merged = pruneSettlements(mergeSettlements(existing, incoming), now);
  await writeCache(SETTLEMENTS_KEY, merged, SETTLEMENT_TTL_SAFE, 'api-football');
  return merged.length;
}

/** The archived settlement set, for the learning loop and the admin console. */
export async function readSettlements(): Promise<SettlementRecord[]> {
  const stored = await readCache<SettlementRecord[]>(SETTLEMENTS_KEY, true);
  return Array.isArray(stored?.value) ? stored.value : [];
}

/**
 * Freeze the model's calls on a match that has just settled.
 *
 * The board only stands behind two picks per fixture — the leading call and
 * the best totals call — so those are what get graded and archived. A pick
 * whose result is ambiguous settles to `null` and is skipped rather than
 * guessed at.
 */
function gradePicks(fixture: Fixture): GradedPick[] {
  let card;
  try {
    card = getPrediction(fixture);
  } catch {
    return [];
  }
  const candidates = [
    card.recommendations[0],
    card.recommendations.find((rec) => /^(ou|total)/.test(rec.marketId || ''))
  ].filter((rec): rec is NonNullable<typeof rec> => Boolean(rec));

  const picks: GradedPick[] = [];
  for (const rec of candidates) {
    const won = settleSelection(fixture, rec.marketId ?? '', rec.selection);
    if (won === null) continue;
    if (picks.some((pick) => pick.marketId === rec.marketId && pick.selection === rec.selection)) continue;
    picks.push({
      marketId: rec.marketId ?? '',
      market: rec.market,
      selection: rec.selection,
      probability: rec.modelProbability,
      odds: rec.odds,
      won
    });
  }
  return picks;
}

/**
 * Results inside the retention window, newest first. This is the only source
 * the finished boards read, so a purged match cannot reappear.
 */
export async function finishedFeed(limit = 40): Promise<Fixture[]> {
  const fixtures = await readProviderFixtures();
  const { finished } = partitionFixtures(fixtures);
  return finished.slice(0, limit);
}

/** Sports that currently have provider fixtures, with counts. */
export function sportCounts(fixtures: Fixture[]): Record<SportId, number> {
  const counts = { football: 0, basketball: 0, tennis: 0, icehockey: 0, baseball: 0 } as Record<SportId, number>;
  for (const fixture of fixtures) counts[fixture.sport] = (counts[fixture.sport] ?? 0) + 1;
  return counts;
}
