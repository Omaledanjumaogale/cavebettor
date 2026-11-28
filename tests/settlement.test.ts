import { describe, expect, it } from 'vitest';
import { settleSelection } from '../src/lib/engine/settlement';
import type { Fixture } from '../src/lib/types';

const match = (overrides: Partial<Fixture> = {}): Fixture =>
  ({
    id: 'fx_1',
    sport: 'football',
    leagueId: 'epl',
    homeId: 'arsenal',
    awayId: 'chelsea',
    homeTeam: { id: 'arsenal', name: 'Arsenal' },
    awayTeam: { id: 'chelsea', name: 'Chelsea' },
    kickoff: '2026-05-01T18:00:00.000Z',
    status: 'finished',
    score: { home: 2, away: 1 },
    venue: 'Emirates',
    round: '',
    h2h: { homeWins: 0, draws: 0, awayWins: 0, last: [] },
    ...overrides
  }) as Fixture;

describe('market settlement', () => {
  it('settles three-way and moneyline markets', () => {
    expect(settleSelection(match(), '1x2', 'Arsenal win')).toBe(true);
    expect(settleSelection(match(), '1x2', 'Chelsea win')).toBe(false);
    expect(settleSelection(match(), 'ml', 'Arsenal')).toBe(true);
    expect(settleSelection(match({ score: { home: 1, away: 1 } }), '1x2', 'Draw')).toBe(true);
  });

  it('resolves team names from ids when the fixture has no embedded teams', () => {
    const bare = match({ homeTeam: undefined, awayTeam: undefined });
    expect(settleSelection(bare, 'ml', 'Arsenal')).toBe(true);
    expect(settleSelection(bare, '1x2', 'Chelsea win')).toBe(false);
  });

  it('settles tennis games totals against the set scores', () => {
    const tennis = match({
      sport: 'tennis',
      leagueId: 'atp',
      homeId: 'jannik-sinner',
      awayId: 'holger-rune',
      homeTeam: undefined,
      awayTeam: undefined,
      score: { home: 1, away: 2 },
      periods: [
        { label: 'Set 1', home: 0, away: 6 },
        { label: 'Set 2', home: 6, away: 0 },
        { label: 'Set 3', home: 2, away: 6 }
      ]
    });
    // 20 games, not 3 sets.
    expect(settleSelection(tennis, 'games195', 'match over 19.5')).toBe(true);
    expect(settleSelection(tennis, 'games255', 'match under 25.5')).toBe(true);
    expect(settleSelection(tennis, 'set1total', 'Set 1 over 5.5')).toBe(true);
  });

  it('settles both teams to score', () => {
    expect(settleSelection(match(), 'btts', 'Yes')).toBe(true);
    expect(settleSelection(match({ score: { home: 2, away: 0 } }), 'btts', 'No')).toBe(true);
  });

  it('settles double chance and draw no bet', () => {
    expect(settleSelection(match(), 'dc', 'Arsenal or Draw')).toBe(true);
    expect(settleSelection(match({ score: { home: 0, away: 2 } }), 'dc', 'Arsenal or Draw')).toBe(false);
    expect(settleSelection(match({ score: { home: 1, away: 1 } }), 'dnb', 'Arsenal')).toBeNull();
    expect(settleSelection(match(), 'dnb', 'Arsenal')).toBe(true);
  });

  it('settles totals and refuses to guess a push', () => {
    expect(settleSelection(match(), 'ou25', 'match over 2.5')).toBe(true);
    expect(settleSelection(match(), 'ou25', 'match under 2.5')).toBe(false);
    // Exactly on a whole line is a push, not a win.
    expect(settleSelection(match({ score: { home: 2, away: 1 } }), 'ou', 'match over 3')).toBeNull();
  });

  it('settles period totals against the period, not the match', () => {
    const withPeriods = match({
      score: { home: 3, away: 2 },
      periods: [
        { label: 'First half', home: 1, away: 0 },
        { label: 'Second half', home: 2, away: 2 }
      ]
    });
    expect(settleSelection(withPeriods, 'h1total', 'first half over 0.5')).toBe(true);
    expect(settleSelection(withPeriods, 'h1total', 'first half under 0.5')).toBe(false);
    // No period data means no grade, never a default.
    expect(settleSelection(match(), 'h1total', 'first half over 0.5')).toBeNull();
  });

  it('settles handicaps including the push', () => {
    expect(settleSelection(match({ score: { home: 2, away: 1 } }), 'ah', 'Arsenal −1')).toBeNull();
    expect(settleSelection(match({ score: { home: 3, away: 1 } }), 'ah', 'Arsenal −1')).toBe(true);
    expect(settleSelection(match({ score: { home: 2, away: 1 } }), 'ah', 'Chelsea +1')).toBeNull();
    expect(settleSelection(match({ score: { home: 1, away: 3 } }), 'ah', 'Chelsea +1')).toBe(true);
  });

  it('returns null for markets it cannot grade', () => {
    expect(settleSelection(match(), 'cs', '2–1')).toBeNull();
    expect(settleSelection(match(), 'totalexact', '3')).toBeNull();
  });
});
