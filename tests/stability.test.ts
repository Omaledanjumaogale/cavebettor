import { describe, expect, it } from 'vitest';
import { TEAMS } from '../src/lib/data/catalog';
import { generateFixtures } from '../src/lib/engine/fixtures';
import { buildPrediction, getPrediction } from '../src/lib/engine/predictions';
import type { Fixture } from '../src/lib/types';

const NOW = new Date('2026-11-22T12:00:00Z').getTime();
const fixtures = generateFixtures(NOW);

const atKickoff = (fixture: Fixture): Fixture => ({
  ...fixture,
  status: 'scheduled',
  minute: undefined,
  period: undefined,
  score: { home: 0, away: 0 },
  periods: undefined,
  stats: undefined,
  finishedAt: undefined
});

describe('published prediction contract', () => {
  it('covers every team in every competition on every matchday', () => {
    const seen = new Map<string, Set<string>>();
    for (const fixture of fixtures) {
      const key = `${fixture.leagueId}|${fixture.kickoff.slice(0, 10)}`;
      const teams = seen.get(key) ?? new Set<string>();
      teams.add(fixture.homeId);
      teams.add(fixture.awayId);
      seen.set(key, teams);
    }
    for (const [key, teams] of seen) {
      const leagueId = key.split('|')[0];
      const roster = TEAMS.filter((team) => team.leagueId === leagueId);
      expect(teams.size).toBe(roster.length);
    }
  });

  it('never changes the card after kickoff', () => {
    for (const fixture of fixtures.filter((f) => f.status !== 'scheduled')) {
      // Build the reference directly from the kickoff view; the published
      // reader is then checked against it rather than against its own cache.
      const pre = buildPrediction(atKickoff(fixture));
      const live = getPrediction(fixture);
      expect(live.probabilities).toEqual(pre.probabilities);
      expect(live.confidence).toBe(pre.confidence);
      expect(live.recommendations).toEqual(pre.recommendations);
      expect(live.valueBets).toEqual(pre.valueBets);
    }
  });

  it('gives every fixture at least one ranked market call', () => {
    for (const fixture of fixtures) {
      const card = getPrediction(fixture);
      expect(card.recommendations.length).toBeGreaterThan(0);
      expect(card.recommendations.length).toBeLessThanOrEqual(8);
    }
  });

  it('spreads confidence with the actual pick probability', () => {
    const cards = fixtures.map((fixture) => getPrediction(fixture));
    const values = cards.map((card) => card.confidence);
    expect(Math.min(...values)).toBeLessThan(70);
    expect(Math.max(...values)).toBeGreaterThanOrEqual(80);
    // No pile-up in a narrow 70-78 band.
    expect(new Set(values).size).toBeGreaterThan(8);
  });

  it('does not repeat over 1.5 as the headline across football', () => {
    const football = fixtures.filter((fixture) => fixture.sport === 'football');
    const headlines = football.map((fixture) => getPrediction(fixture).recommendations[0]);
    // Team totals are a different bet; the repeat the board must avoid is the
    // match-total 'over 1.5' appearing on fixture after fixture.
    const over15 = headlines.filter((call) => call?.marketId === 'ou15');
    expect(over15.length).toBeLessThanOrEqual(Math.ceil(football.length * 0.1));
    expect(new Set(headlines.map((call) => call?.marketId)).size).toBeGreaterThanOrEqual(4);
  });
});