import { registerLeague, registerTeam, slug } from '#lib/data/registry';
import { hashString, mulberry32 } from '#lib/engine/core';
import type { ApiFootballFixture, ApiFootballSport } from '#lib/server/providers/apiFootball';
import type { Fixture, FixtureStatus, League, SportId, Team } from '#lib/types';

/**
 * Normalisation of API-Football payloads into CaveBettor fixtures.
 *
 * The provider gives the real fixture list, kick-off times, live scores and
 * competition. Team strength is inferred from the catalogue when the team is
 * known there, and otherwise from a stable hash so repeated runs produce the
 * same ratings (and therefore the same model output).
 */

const SPORT_OF: Record<ApiFootballSport, SportId> = {
  football: 'football',
  basketball: 'basketball',
  icehockey: 'icehockey',
  nba: 'basketball',
  baseball: 'baseball'
};

/** Provider league id → CaveBettor league id, per sport. */
const LEAGUE_KEYS: Record<ApiFootballSport, Record<number, string>> = {
  football: {
    39: 'epl', 140: 'laliga', 135: 'seriea', 78: 'bundesliga', 61: 'ligue1', 2: 'ucl', 133: 'npfl', 88: 'championship', 94: 'eredivisie', 169: 'saudi'
  },
  basketball: { 134: 'nba', 8: 'euroleague', 133: 'nbbl', 10: 'nba' },
  icehockey: { 133: 'nhl', 57: 'nhl' },
  nba: { 134: 'nba', 8: 'euroleague' },
  baseball: { 133: 'mlb', 10: 'mlb' }
};

const COUNTRY_CODE: Record<string, string> = {
  England: 'GB', Spain: 'ES', Italy: 'IT', Germany: 'DE', France: 'FR', Europe: 'EU', Nigeria: 'NG', Netherlands: 'NL', 'Saudi Arabia': 'SA', USA: 'US', 'United States': 'US', Japan: 'JP', World: 'INT', International: 'INT'
};

function statusOf(raw: string): FixtureStatus {
  const s = raw.toUpperCase();
  if (s === 'FT' || s === 'AET' || s === 'PEN') return 'finished';
  if (s === '1H' || s === '2H' || s === 'HT' || s === 'ET' || s === 'BT' || s === 'P1' || s === 'P2' || s === 'P3' || s === 'Q1' || s === 'Q2' || s === 'Q3' || s === 'Q4') return 'live';
  if (s === 'POST' || s === 'CANC') return 'postponed';
  return 'scheduled';
}

function scoreOf(fixture: ApiFootballFixture): { home: number; away: number } {
  const scored = fixture.score;
  if (scored) {
    const home = typeof scored.home === 'number' ? scored.home : scored.home?.home;
    const away = typeof scored.away === 'number' ? scored.away : scored.away?.away;
    if (typeof home === 'number' && typeof away === 'number') return { home, away };
  }
  const homeGoals = fixture.home?.goals;
  const awayGoals = fixture.away?.goals;
  if (typeof homeGoals?.home === 'number' && typeof awayGoals?.home === 'number') {
    return { home: homeGoals.home, away: awayGoals.home };
  }
  return { home: 0, away: 0 };
}

function inferredTeam(id: string, name: string, leagueId: string, sport: SportId): Team {
  const rand = mulberry32(hashString(`${id}:strength`));
  // attack/defence are multipliers used by the engine's expected-score model:
  // football ~1.3, basketball ~1.10, hockey ~1.09, baseball ~1.07.
  const baseline: Record<SportId, number> = { football: 1.62, basketball: 1.12, tennis: 1.12, icehockey: 1.11, baseball: 1.09 };
  // Absolute scoring baselines used for xG for / against.
  const scoring: Record<SportId, number> = { football: 1.45, basketball: 111, tennis: 2.0, icehockey: 3.2, baseball: 4.8 };
  const jitter = 0.9 + rand() * 0.22;
  const short =
    name
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 3) || name.slice(0, 3);
  return {
    id,
    name,
    shortName: short.toUpperCase(),
    leagueId,
    sport,
    elo: Math.round(1420 + rand() * 420),
    attack: Number((baseline[sport] * jitter).toFixed(3)),
    defence: Number((baseline[sport] * (2 - jitter)).toFixed(3)),
    form: ['W', 'D', 'L', 'W', 'D'],
    xgFor: Number((scoring[sport] * jitter).toFixed(2)),
    xgAgainst: Number((scoring[sport] * (2 - jitter)).toFixed(2)),
    cleanSheets: 4,
    badges: []
  };
}

export function normaliseProviderFixture(
  raw: ApiFootballFixture,
  sport: ApiFootballSport
): Fixture | null {
  const sportId = SPORT_OF[sport];
  const leagueId = LEAGUE_KEYS[sport][raw.league?.id] ?? slug(raw.league?.name ?? 'international');
  if (!raw.home?.name || !raw.away?.name) return null;

  const homeKey = slug(raw.home.name);
  const awayKey = slug(raw.away.name);
  const league: League = registerLeague({
    id: leagueId,
    name: raw.league?.name ?? slug(raw.league?.name ?? 'International'),
    shortName: (raw.league?.name ?? 'INT').slice(0, 4).toUpperCase(),
    country: raw.league?.country ?? 'International',
    countryCode: COUNTRY_CODE[raw.league?.country ?? ''] ?? 'INT',
    sport: sportId,
    tier: 1,
    season: String(raw.league?.season ?? '2025/26'),
    logo: raw.league?.logo ?? '',
    colour: '#22463a'
  });

  const home = registerTeam(inferredTeam(homeKey, raw.home.name, leagueId, sportId));
  const away = registerTeam(inferredTeam(awayKey, raw.away.name, leagueId, sportId));

  const kickoff = raw.date ? new Date(raw.date) : new Date(raw.timestamp * 1000);
  const status = statusOf(raw.status?.short ?? 'NS');
  const score = scoreOf(raw);

  return {
    id: `af_${raw.id}`,
    sport: sportId,
    leagueId,
    homeId: homeKey,
    awayId: awayKey,
    homeTeam: home,
    awayTeam: away,
    league,
    kickoff: kickoff.toISOString(),
    status,
    minute: raw.status?.elapsed ?? undefined,
    period: raw.status?.long ?? undefined,
    score,
    venue: [raw.venue?.name, raw.venue?.city].filter(Boolean).join(', ') || 'Venue to be confirmed',
    round: `${league.name} · Matchday ${(raw.league?.season ?? 1) % 40 || 1}`,
    h2h: { homeWins: 0, draws: 0, awayWins: 0, last: [] },
    source: 'api-football'
  };
}

/** Normalise a provider batch, dropping malformed rows. */
export function normaliseProviderFixtures(
  rows: ApiFootballFixture[],
  sport: ApiFootballSport
): { fixtures: Fixture[]; rejected: number } {
  const fixtures: Fixture[] = [];
  let rejected = 0;
  for (const row of rows) {
    const mapped = normaliseProviderFixture(row, sport);
    if (mapped) fixtures.push(mapped);
    else rejected += 1;
  }
  return { fixtures, rejected };
}

export function providerFixtureKey(fixtureId: number | string): string {
  return hashString(`api-football:${fixtureId}`).toString(36);
}
