import { describe, expect, it } from 'vitest';
import {
  API_FOOTBALL_SPORT_ALLOCATION,
  BUDGET_RULES,
  apiFootballSportAllowance,
  budgetKey,
  budgetSnapshot,
  reserve
} from '../src/lib/server/providers/budget';
import { SPORT_DASHBOARDS, SPORT_DASHBOARD_MAP } from '../src/lib/data/sportDashboards';
import { LEAGUES } from '../src/lib/data/catalog';

describe('provider budget ledger', () => {
  it('encodes the three plan ceilings', () => {
    const apiFootball = BUDGET_RULES.find((r) => r.provider === 'api-football')!;
    const oddsApi = BUDGET_RULES.find((r) => r.provider === 'the-odds-api')!;
    const oddApi = BUDGET_RULES.find((r) => r.provider === 'odd-api')!;

    expect(apiFootball.limit).toBe(100);
    expect(apiFootball.period).toBe('day');
    expect(oddsApi.limit).toBe(250);
    expect(oddsApi.period).toBe('month');
    expect(oddApi.limit).toBe(500);
    expect(oddApi.unit).toBe('credit');
  });

  it('splits the API-Football daily allowance without exceeding it', () => {
    const total = Object.values(API_FOOTBALL_SPORT_ALLOCATION).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('gives every sport a non-zero share', () => {
    for (const sport of ['football', 'basketball', 'icehockey', 'nba', 'baseball']) {
      expect(apiFootballSportAllowance(sport)).toBeGreaterThan(0);
    }
  });

  it('keys the ledger by provider and period', () => {
    const now = new Date('2026-05-04T10:00:00.000Z');
    expect(budgetKey('api-football', now)).toBe('api-football:2026-05-04');
    expect(budgetKey('the-odds-api', now)).toBe('the-odds-api:2026-05');
    expect(budgetKey('odd-api', now)).toBe('odd-api:2026-05');
  });

  it('refuses to reserve beyond the ceiling', async () => {
    const before = await budgetSnapshot();
    const rule = BUDGET_RULES.find((r) => r.provider === 'odd-api')!;
    const spent = before.find((b) => b.provider === 'odd-api')!.used;

    // Fill the remaining allowance, then one request too many.
    for (let i = spent; i < rule.limit; i++) {
      const grant = await reserve('odd-api', 1);
      expect(grant).not.toBeNull();
    }
    const overflow = await reserve('odd-api', 1);
    expect(overflow?.remaining).toBe(0);
  });
});

describe('sport dashboards', () => {
  it('covers every sport the app prices, tennis included', () => {
    const ids = SPORT_DASHBOARDS.map((d) => d.id);
    expect(ids).toEqual(['football', 'basketball', 'nba', 'icehockey', 'baseball', 'tennis']);
  });

  it('gives tennis its own desk and competition set', () => {
    const tennis = SPORT_DASHBOARD_MAP.tennis;
    expect(tennis.sport).toBe('tennis');
    expect(tennis.leagueIds).toContain('atp');
    expect(tennis.primaryMarkets.map((m) => m.id)).toContain('sethcp');
  });

  it('gives NBA its own desk on the basketball engine', () => {
    const nba = SPORT_DASHBOARD_MAP.nba;
    expect(nba.sport).toBe('basketball');
    expect(nba.leagueIds).toEqual(['nba']);
    expect(nba.providerHost).toBe('v2.nba.api-sports.io');
  });

  it('never double-books a competition between desks', () => {
    const seen = new Map<string, string>();
    for (const desk of SPORT_DASHBOARDS) {
      for (const leagueId of desk.leagueIds) {
        const owner = seen.get(leagueId);
        expect(owner, `${leagueId} is claimed by both ${owner} and ${desk.id}`).toBeUndefined();
        seen.set(leagueId, desk.id);
      }
    }
  });

  it('only references competitions that exist in the catalogue', () => {
    const leagueIds = new Set(LEAGUES.map((l) => l.id));
    for (const desk of SPORT_DASHBOARDS) {
      for (const leagueId of desk.leagueIds) {
        expect(leagueIds.has(leagueId)).toBe(true);
      }
    }
  });

  it('keeps the sport engine and the catalogue sport in step', () => {
    for (const desk of SPORT_DASHBOARDS) {
      for (const leagueId of desk.leagueIds) {
        const league = LEAGUES.find((l) => l.id === leagueId)!;
        expect(league.sport).toBe(desk.sport);
      }
    }
  });

  it('describes markets and stat boards for every desk', () => {
    for (const desk of SPORT_DASHBOARDS) {
      expect(desk.primaryMarkets.length).toBeGreaterThan(0);
      expect(desk.secondaryMarkets.length).toBeGreaterThan(0);
      expect(desk.statBoard.length).toBeGreaterThan(0);
      expect(desk.modelling.length).toBeGreaterThan(0);
    }
  });
});
