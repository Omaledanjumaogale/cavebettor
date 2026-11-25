import { describe, expect, it } from 'vitest';
import {
  compareSchedule,
  kickoffMs,
  nextUp,
  scheduleDay,
  schedulePhase,
  sortBySchedule,
  sortRowsBySchedule
} from '../src/lib/schedule';

const at = (iso: string) => ({ kickoff: iso, id: iso, sport: 'football', leagueId: 'epl' });

describe('schedule ordering', () => {
  it('reads the next kick-off first and later kick-offs below', () => {
    const rows = [
      at('2026-05-01T20:00:00.000Z'),
      at('2026-05-01T15:00:00.000Z'),
      at('2026-05-02T12:00:00.000Z'),
      at('2026-05-01T18:30:00.000Z')
    ];
    expect(sortBySchedule(rows).map((row) => row.kickoff)).toEqual([
      '2026-05-01T15:00:00.000Z',
      '2026-05-01T18:30:00.000Z',
      '2026-05-01T20:00:00.000Z',
      '2026-05-02T12:00:00.000Z'
    ]);
  });

  it('never mutates the array it was given', () => {
    const rows = [at('2026-05-02T12:00:00.000Z'), at('2026-05-01T12:00:00.000Z')];
    const sorted = sortBySchedule(rows);
    expect(rows[0].kickoff).toBe('2026-05-02T12:00:00.000Z');
    expect(sorted[0].kickoff).toBe('2026-05-01T12:00:00.000Z');
  });

  it('keeps same-minute fixtures in a stable order', () => {
    const a = { kickoff: '2026-05-01T15:00:00.000Z', id: 'b', sport: 'football', leagueId: 'epl' };
    const b = { kickoff: '2026-05-01T15:00:00.000Z', id: 'a', sport: 'football', leagueId: 'epl' };
    const once = sortBySchedule([a, b]).map((row) => row.id);
    const twice = sortBySchedule([b, a]).map((row) => row.id);
    expect(once).toEqual(twice);
    expect(once).toEqual(['a', 'b']);
  });

  it('sorts an unparseable kick-off to the end, never the top', () => {
    const rows = [at('not-a-date' as unknown as string), at('2026-05-01T15:00:00.000Z')];
    expect(sortBySchedule(rows)[0].kickoff).toBe('2026-05-01T15:00:00.000Z');
    expect(kickoffMs(rows[0])).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('orders wrapped rows by their fixture', () => {
    const rows = [
      { fixture: at('2026-05-01T21:00:00.000Z'), prediction: null },
      { fixture: at('2026-05-01T17:00:00.000Z'), prediction: null }
    ];
    expect(sortRowsBySchedule(rows)[0].fixture.kickoff).toBe('2026-05-01T17:00:00.000Z');
  });

  it('puts matches already in play at the top, because they kicked off first', () => {
    const now = Date.parse('2026-05-01T19:00:00.000Z');
    const rows = [
      { ...at('2026-05-01T21:00:00.000Z'), status: 'scheduled' },
      { ...at('2026-05-01T18:00:00.000Z'), status: 'live' },
      { ...at('2026-05-01T20:00:00.000Z'), status: 'scheduled' }
    ];
    const sorted = sortBySchedule(rows);
    expect(sorted[0].status).toBe('live');
    expect(schedulePhase(sorted[0], now)).toBe('live');
  });

  it('classifies what is next, soon, today and later', () => {
    const now = Date.parse('2026-05-01T19:00:00.000Z');
    expect(schedulePhase({ kickoff: '2026-05-01T19:00:00.000Z', status: 'halftime' }, now)).toBe('live');
    expect(schedulePhase({ kickoff: '2026-05-01T19:10:00.000Z', status: 'scheduled' }, now)).toBe('next');
    expect(schedulePhase({ kickoff: '2026-05-01T20:00:00.000Z', status: 'scheduled' }, now)).toBe('soon');
    // Day boundaries are local, so "today" is the local calendar day.
    expect(schedulePhase({ kickoff: '2026-05-01T22:00:00.000Z', status: 'scheduled' }, now)).toBe('today');
    expect(schedulePhase({ kickoff: '2026-05-04T12:00:00.000Z', status: 'scheduled' }, now)).toBe('later');
    expect(schedulePhase({ kickoff: '2026-05-01T18:00:00.000Z', status: 'scheduled' }, now)).toBe('past');
  });

  it('finds the single next fixture and ignores the ones already due', () => {
    const now = Date.parse('2026-05-01T19:00:00.000Z');
    const rows = [
      { fixture: { kickoff: '2026-05-01T18:00:00.000Z', id: 'past' } },
      { fixture: { kickoff: '2026-05-01T21:00:00.000Z', id: 'later' } },
      { fixture: { kickoff: '2026-05-01T19:20:00.000Z', id: 'next' } }
    ];
    expect(nextUp(rows, now)?.fixture.id).toBe('next');
    expect(nextUp([rows[0]], now)).toBeNull();
  });

  it('groups by local calendar day', () => {
    const a = scheduleDay({ kickoff: '2026-05-01T12:00:00.000Z' });
    const b = scheduleDay({ kickoff: '2026-05-02T12:00:00.000Z' });
    expect(a).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a).not.toBe(b);
    // Same day, different hours collapse to one bucket.
    expect(scheduleDay({ kickoff: '2026-05-01T08:00:00.000Z' })).toBe(a);
  });

  it('treats the comparator as a total order', () => {
    const rows = [at('2026-05-01T15:00:00.000Z'), at('2026-05-02T15:00:00.000Z'), at('2026-05-01T15:00:00.000Z')];
    for (const a of rows) for (const b of rows) {
      const forward = compareSchedule(a, b);
      const backward = compareSchedule(b, a);
      if (forward === 0) expect(backward).toBe(0);
      else expect(Math.sign(forward)).toBe(-Math.sign(backward));
    }
  });
});
