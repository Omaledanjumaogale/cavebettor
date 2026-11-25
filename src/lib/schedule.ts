/**
 * Schedule ordering.
 *
 * Every fixture surface — the universe, the live centre, each sport desk —
 * reads in the order the matches are actually played: the next kick-off first,
 * later kick-offs below, day by day. Nothing is ranked by probability here;
 * probability ranks the value board, the calendar ranks the calendar.
 *
 * The comparators are pure and timezone-safe: they compare absolute instants,
 * never formatted strings, so a fixture cannot move because the machine
 * changed locale.
 */

export interface Scheduled {
  kickoff: string;
}

/** Absolute kick-off in milliseconds. Unparseable dates sort last, never first. */
export function kickoffMs(fixture: Scheduled): number {
  const parsed = Date.parse(fixture.kickoff);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

interface Sortable extends Scheduled {
  id?: string;
  sport?: string;
  leagueId?: string;
}

/**
 * Chronological order, with stable tie-breaks.
 *
 * Two matches kicking off at the same minute are ordered by sport, then
 * competition, then id, so consecutive renders of the same feed never swap
 * rows around and the list cannot "flicker" between page loads.
 */
export function compareSchedule(a: Sortable, b: Sortable): number {
  const delta = kickoffMs(a) - kickoffMs(b);
  if (delta !== 0) return delta;
  const sport = String(a.sport ?? '').localeCompare(String(b.sport ?? ''));
  if (sport !== 0) return sport;
  const league = String(a.leagueId ?? '').localeCompare(String(b.leagueId ?? ''));
  if (league !== 0) return league;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

/** Sort a list of fixtures (or anything with a kickoff) by the schedule. */
export function sortBySchedule<T extends Sortable>(rows: readonly T[]): T[] {
  return [...rows].sort(compareSchedule);
}

/** Sort rows that wrap a fixture, e.g. `{ fixture, prediction }`. */
export function sortRowsBySchedule<T extends { fixture: Sortable }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => compareSchedule(a.fixture, b.fixture));
}

/** Same day in the user's own timezone, used for day separators. */
export function scheduleDay(fixture: Scheduled): string {
  const date = new Date(kickoffMs(fixture));
  if (Number.isNaN(date.getTime())) return 'Unscheduled';
  // `en-CA` yields YYYY-MM-DD, which sorts and compares as a plain string.
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export type SchedulePhase = 'live' | 'next' | 'soon' | 'today' | 'later' | 'past';

/**
 * Where a fixture sits relative to now. Used for the "next up" marker and to
 * dim matches that should already have kicked off while the provider catches
 * up — never to reorder the list, which stays strictly chronological.
 */
export function schedulePhase(fixture: Scheduled & { status?: string }, now: number): SchedulePhase {
  if (fixture.status === 'live' || fixture.status === 'halftime') return 'live';
  const kickoff = kickoffMs(fixture);
  if (kickoff === Number.MAX_SAFE_INTEGER) return 'later';
  if (kickoff <= now) return 'past';
  const minutes = (kickoff - now) / 60_000;
  if (minutes <= 15) return 'next';
  if (minutes <= 90) return 'soon';
  if (scheduleDay(fixture) === scheduleDay({ kickoff: new Date(now).toISOString() })) return 'today';
  return 'later';
}

/**
 * The single fixture that is "next up": the earliest kick-off still to come.
 * Returns null when everything listed has already started.
 */
export function nextUp<T extends { fixture: Sortable }>(rows: readonly T[], now: number): T | null {
  let best: T | null = null;
  for (const row of rows) {
    const kickoff = kickoffMs(row.fixture);
    if (kickoff === Number.MAX_SAFE_INTEGER || kickoff <= now) continue;
    if (!best || kickoff < kickoffMs(best.fixture)) best = row;
  }
  return best;
}
