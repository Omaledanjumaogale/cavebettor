import { describe, expect, it } from 'vitest';
import {
  FINISHED_TTL_MS,
  SETTLEMENT_TTL_MS,
  lifecycleOf,
  maxDurationMs,
  mergeSettlements,
  partitionFixtures,
  pruneSettlements,
  settleStale,
  settlementOf,
  type SettlementRecord
} from '../src/lib/server/lifecycle';
import type { Fixture } from '../src/lib/types';

const HOUR = 3600_000;
const NOW = Date.parse('2026-05-01T20:00:00.000Z');

function fixtureFixture(overrides: Partial<Fixture> = {}): Fixture {
  const kickoff = new Date(NOW - 2 * HOUR).toISOString();
  return {
    id: 'fx_test',
    sport: 'football',
    leagueId: 'epl',
    homeId: 'arsenal',
    awayId: 'chelsea',
    kickoff,
    status: 'live',
    minute: 55,
    score: { home: 1, away: 0 },
    venue: 'Emirates Stadium',
    round: 'Matchday 30',
    h2h: { homeWins: 0, draws: 0, awayWins: 0, last: [] },
    ...overrides
  };
}

describe('fixture lifecycle', () => {
  it('keeps a match live while it can still be in play', () => {
    const life = lifecycleOf(fixtureFixture(), NOW);
    expect(life.state).toBe('live');
  });

  it('reclassifies a match that cannot still be live', () => {
    const kickoff = new Date(NOW - maxDurationMs('football') - HOUR).toISOString();
    const life = lifecycleOf(fixtureFixture({ kickoff }), NOW);
    expect(life.state).toBe('finished');
  });

  it('never leaves a stale live row on the live board', () => {
    const stale = fixtureFixture({ id: 'fx_stale', kickoff: new Date(NOW - 6 * HOUR).toISOString() });
    const fresh = fixtureFixture({ id: 'fx_fresh', kickoff: new Date(NOW - HOUR).toISOString() });
    const buckets = partitionFixtures([stale, fresh], NOW);
    expect(buckets.live.map((f) => f.id)).toEqual(['fx_fresh']);
    expect(buckets.finished.map((f) => f.id)).toEqual(['fx_stale']);
    expect(buckets.expired).toHaveLength(0);
  });

  it('stamps the finish time when it reclassifies', () => {
    const kickoff = new Date(NOW - 5 * HOUR).toISOString();
    const [settled] = settleStale([fixtureFixture({ kickoff })], NOW);
    expect(settled.status).toBe('finished');
    expect(settled.minute).toBeUndefined();
    expect(settled.finishedAt).toBe(new Date(Date.parse(kickoff) + maxDurationMs('football')).toISOString());
  });

  it('retains a result for 24 hours and purges it after that', () => {
    const recent = fixtureFixture({
      id: 'fx_recent',
      status: 'finished',
      finishedAt: new Date(NOW - 23 * HOUR).toISOString()
    });
    const old = fixtureFixture({
      id: 'fx_old',
      status: 'finished',
      finishedAt: new Date(NOW - 25 * HOUR).toISOString()
    });
    const buckets = partitionFixtures([recent, old], NOW);
    expect(buckets.finished.map((f) => f.id)).toEqual(['fx_recent']);
    expect(buckets.expired.map((f) => f.id)).toEqual(['fx_old']);
  });

  it('orders results newest first', () => {
    const a = fixtureFixture({ id: 'a', status: 'finished', finishedAt: new Date(NOW - 3 * HOUR).toISOString() });
    const b = fixtureFixture({ id: 'b', status: 'finished', finishedAt: new Date(NOW - HOUR).toISOString() });
    const c = fixtureFixture({ id: 'c', status: 'finished', finishedAt: new Date(NOW - 8 * HOUR).toISOString() });
    expect(partitionFixtures([a, b, c], NOW).finished.map((f) => f.id)).toEqual(['b', 'a', 'c']);
  });

  it('keeps the settlement that survives the purge', () => {
    const record = settlementOf(
      fixtureFixture({
        status: 'finished',
        score: { home: 3, away: 2 },
        finishedAt: new Date(NOW - 2 * HOUR).toISOString(),
        periods: [
          { label: 'Half time', home: 1, away: 1 },
          { label: 'Full time', home: 3, away: 2 }
        ]
      }),
      NOW
    );
    expect(record.score).toEqual({ home: 3, away: 2 });
    expect(record.periods).toHaveLength(2);
    expect(record.leagueId).toBe('epl');
    expect(record.settledAt).toBe(NOW);
  });

  it('ages the settlement archive out and caps it', () => {
    const make = (id: string, ageHours: number, settledAt = NOW): SettlementRecord => ({
      id,
      sport: 'football',
      leagueId: 'epl',
      homeId: 'a',
      awayId: 'b',
      kickoff: new Date(NOW - ageHours * HOUR).toISOString(),
      finishedAt: new Date(NOW - ageHours * HOUR).toISOString(),
      score: { home: 1, away: 0 },
      settledAt
    });
    const fresh = make('fresh', 2);
    const ancient = make('ancient', SETTLEMENT_TTL_MS / HOUR + 24);
    expect(pruneSettlements([fresh, ancient], NOW).map((r) => r.id)).toEqual(['fresh']);

    const many = Array.from({ length: 12 }, (_, i) => make(`m${i}`, i + 1, NOW - i));
    expect(pruneSettlements(many, NOW, 5)).toHaveLength(5);
    // Newest settlement first.
    expect(pruneSettlements(many, NOW, 3)[0].id).toBe('m0');
  });

  it('de-duplicates the archive on merge', () => {
    const base = (score: number): SettlementRecord => ({
      id: 'same',
      sport: 'football',
      leagueId: 'epl',
      homeId: 'a',
      awayId: 'b',
      kickoff: new Date(NOW).toISOString(),
      finishedAt: new Date(NOW).toISOString(),
      score: { home: score, away: 0 },
      settledAt: NOW
    });
    const merged = mergeSettlements([base(1)], [base(2)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].score.home).toBe(2);
  });

  it('published the retention window the boards use', () => {
    expect(FINISHED_TTL_MS).toBe(24 * HOUR);
  });
});
