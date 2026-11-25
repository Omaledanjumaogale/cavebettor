/**
 * Fixture lifecycle.
 *
 * One place decides when a match is in play, when it is a result, and when a
 * result has aged out of the interface. Three rules keep the boards honest:
 *
 *   1. A match that can no longer be in play is never shown as live, whatever
 *      status the provider last sent. Kick-off plus the sport's maximum
 *      duration is the hard ceiling.
 *   2. Finished matches live in the results bucket for 24 hours so a punter can
 *      check the settlement, then they leave the interface entirely.
 *   3. Leaving the interface never means losing the data. Every settled match
 *      is summarised into a settlement record (score, periods, competition,
 *      kick-off) and archived for retraining before it is purged.
 */
import type { GradedPick } from '#lib/engine/settlement';
import type { Fixture, FixtureStatus, SportId } from '#lib/types';

/** How long a settled match stays on the result boards. */
export const FINISHED_TTL_MS = 24 * 3600_000;
/** How long the settlement archive (retraining data) is kept. */
export const SETTLEMENT_TTL_MS = 45 * 86_400_000;

/**
 * Longest plausible wall-clock duration of a match, kick-off to final whistle,
 * including stoppages, overtime and delays. Used only as an upper bound: past
 * this point a "live" status is stale by definition.
 */
const MAX_DURATION_MS: Record<SportId, number> = {
  football: 3 * 3600_000,
  basketball: 3 * 3600_000,
  icehockey: 4 * 3600_000,
  baseball: 6 * 3600_000,
  tennis: 6 * 3600_000
};

/**
 * Typical wall-clock length of a match, used to date a result when the provider
 * sends no finish timestamp. The maximum above is the "can it still be live?"
 * ceiling; this is the honest estimate of when the whistle went.
 */
const TYPICAL_DURATION_MS: Record<SportId, number> = {
  football: 115 * 60_000,
  basketball: 125 * 60_000,
  icehockey: 140 * 60_000,
  baseball: 180 * 60_000,
  tennis: 150 * 60_000
};

export function typicalDurationMs(sport: SportId): number {
  return TYPICAL_DURATION_MS[sport] ?? TYPICAL_DURATION_MS.football;
}

export const LIVE_STATUSES: FixtureStatus[] = ['live', 'halftime'];

export function isLiveStatus(status: FixtureStatus): boolean {
  return status === 'live' || status === 'halftime';
}

export function maxDurationMs(sport: SportId): number {
  return MAX_DURATION_MS[sport] ?? MAX_DURATION_MS.football;
}

/** When the match actually ended, as far as we can tell. */
export function finishedAtMs(fixture: Fixture, now = Date.now()): number {
  const stamped = fixture.finishedAt ? Date.parse(fixture.finishedAt) : NaN;
  if (Number.isFinite(stamped)) return stamped;
  const kickoff = Date.parse(fixture.kickoff);
  if (!Number.isFinite(kickoff)) return now;
  // No finish stamp: date the result at the sport's typical length rather than
  // its maximum, so the 24-hour clock starts near the real final whistle.
  return Math.min(now, kickoff + typicalDurationMs(fixture.sport));
}

export type Lifecycle =
  | { state: 'live' }
  | { state: 'upcoming' }
  | { state: 'finished'; finishedAt: number; ageMs: number; expired: boolean }
  | { state: 'postponed' };

/**
 * Classify one fixture against the clock.
 *
 * A provider that still says "live" three hours after kick-off is wrong; the
 * match is a result. A finished match older than the retention window is
 * marked expired so the interface can drop it while the archive keeps it.
 */
export function lifecycleOf(fixture: Fixture, now = Date.now()): Lifecycle {
  const kickoff = Date.parse(fixture.kickoff);
  const kickoffValid = Number.isFinite(kickoff);

  if (isLiveStatus(fixture.status)) {
    if (kickoffValid && now - kickoff > maxDurationMs(fixture.sport)) {
      const finishedAt = kickoff + maxDurationMs(fixture.sport);
      return { state: 'finished', finishedAt, ageMs: now - finishedAt, expired: now - finishedAt > FINISHED_TTL_MS };
    }
    return { state: 'live' };
  }

  if (fixture.status === 'finished') {
    const finishedAt = finishedAtMs(fixture, now);
    const ageMs = Math.max(0, now - finishedAt);
    return { state: 'finished', finishedAt, ageMs, expired: ageMs > FINISHED_TTL_MS };
  }

  if (fixture.status === 'postponed') return { state: 'postponed' };
  return { state: 'upcoming' };
}

/**
 * Normalise a fixture list: reclassify stale live rows as results and stamp
 * the finish time so every surface agrees on the age.
 */
export function settleStale(fixtures: Fixture[], now = Date.now()): Fixture[] {
  let changed = false;
  const next = fixtures.map((fixture) => {
    const life = lifecycleOf(fixture, now);
    if (life.state !== 'finished' || fixture.status === 'finished') return fixture;
    changed = true;
    return {
      ...fixture,
      status: 'finished' as FixtureStatus,
      minute: undefined,
      period: fixture.period ?? 'FT',
      finishedAt: new Date(life.finishedAt).toISOString()
    } satisfies Fixture;
  });
  return changed ? next : fixtures;
}

export interface Partition {
  live: Fixture[];
  upcoming: Fixture[];
  /** Results inside the retention window, newest first. */
  finished: Fixture[];
  /** Results older than the window: gone from the interface, kept in the archive. */
  expired: Fixture[];
  postponed: Fixture[];
}

export function partitionFixtures(fixtures: Fixture[], now = Date.now()): Partition {
  const partition: Partition = { live: [], upcoming: [], finished: [], expired: [], postponed: [] };
  const finished: { fixture: Fixture; at: number }[] = [];

  for (const fixture of fixtures) {
    const life = lifecycleOf(fixture, now);
    switch (life.state) {
      case 'live':
        partition.live.push(fixture);
        break;
      case 'upcoming':
        partition.upcoming.push(fixture);
        break;
      case 'postponed':
        partition.postponed.push(fixture);
        break;
      case 'finished':
        if (life.expired) partition.expired.push(fixture);
        else finished.push({ fixture, at: life.finishedAt });
        break;
    }
  }

  partition.finished = finished.sort((a, b) => b.at - a.at).map((row) => row.fixture);
  return partition;
}

/**
 * The row that survives a purge. It carries everything the learning loop needs
 * to re-price the match long after the fixture has left the boards.
 */
export interface SettlementRecord {
  id: string;
  sport: SportId;
  leagueId: string;
  leagueName?: string;
  homeId: string;
  awayId: string;
  homeName?: string;
  awayName?: string;
  kickoff: string;
  finishedAt: string;
  score: { home: number; away: number };
  periods?: { label: string; home: number; away: number }[];
  settledAt: number;
  /**
   * The model's graded calls, frozen at full time. Storing them means the
   * retraining set does not depend on re-pricing a match with a newer model.
   */
  picks?: GradedPick[];
}

export function settlementOf(fixture: Fixture, now = Date.now(), picks?: GradedPick[]): SettlementRecord {
  const life = lifecycleOf(fixture, now);
  const finishedAt = life.state === 'finished' ? life.finishedAt : now;
  return {
    id: fixture.id,
    sport: fixture.sport,
    leagueId: fixture.leagueId,
    leagueName: fixture.league?.name,
    homeId: fixture.homeId,
    awayId: fixture.awayId,
    homeName: fixture.homeTeam?.name,
    awayName: fixture.awayTeam?.name,
    kickoff: fixture.kickoff,
    finishedAt: new Date(finishedAt).toISOString(),
    score: { home: fixture.score?.home ?? 0, away: fixture.score?.away ?? 0 },
    periods: fixture.periods,
    settledAt: now,
    picks
  };
}

/** Trim the archive to its retention window and a hard row cap. */
export function pruneSettlements(
  records: SettlementRecord[],
  now = Date.now(),
  limit = 3_000
): SettlementRecord[] {
  return records
    .filter((record) => {
      const at = Date.parse(record.finishedAt);
      return Number.isFinite(at) ? now - at <= SETTLEMENT_TTL_MS : true;
    })
    .sort((a, b) => b.settledAt - a.settledAt)
    .slice(0, limit);
}

/** Merge settlement records into one de-duplicated list, newest first. */
export function mergeSettlements(...lists: SettlementRecord[][]): SettlementRecord[] {
  const byId = new Map<string, SettlementRecord>();
  for (const list of lists) for (const record of list ?? []) byId.set(record.id, record);
  return [...byId.values()].sort((a, b) => b.settledAt - a.settledAt);
}
