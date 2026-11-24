import { LEAGUE_MAP, TEAM_MAP } from '#lib/data/catalog';
import type { Fixture, League, SportId, Team } from '#lib/types';

/**
 * Live team / league registry.
 *
 * The built-in catalogue covers the competitions the engine models in depth.
 * Live fixtures fetched from API-Football bring real squads that are not in
 * that catalogue, so they are registered here at runtime. Registration adds
 * entries to the shared TEAM_MAP / LEAGUE_MAP objects, which means every
 * existing consumer (engine, components, API routes) resolves live teams
 * without further changes.
 */

export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Register (or refresh) a live team so the whole app can resolve it by id. */
export function registerTeam(team: Team): Team {
  const existing = TEAM_MAP[team.id];
  if (existing) {
    Object.assign(existing, team);
    return existing;
  }
  TEAM_MAP[team.id] = team;
  return team;
}

/** Register (or refresh) a live league. */
export function registerLeague(league: League): League {
  const existing = LEAGUE_MAP[league.id];
  if (existing) {
    Object.assign(existing, league);
    return existing;
  }
  LEAGUE_MAP[league.id] = league;
  return league;
}

/** Resolve a team by id, falling back to a neutral record for unknown ids. */
export function resolveTeam(id: string, leagueId?: string): Team {
  const found = TEAM_MAP[id];
  if (found) return found;
  const sport: SportId = leagueId && LEAGUE_MAP[leagueId] ? LEAGUE_MAP[leagueId].sport : 'football';
  const name = id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id,
    name,
    shortName: name.slice(0, 3).toUpperCase(),
    leagueId: leagueId ?? 'unknown',
    sport,
    elo: 1550,
    attack: 1,
    defence: 1,
    form: ['W', 'D', 'L', 'W', 'D'],
    xgFor: 1.2,
    xgAgainst: 1.2,
    cleanSheets: 4,
    badges: []
  };
}

/** Resolve a league by id, falling back to a neutral record. */
export function resolveLeague(id: string, sport: SportId): League {
  const found = LEAGUE_MAP[id];
  if (found) return found;
  const name = id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id,
    name,
    shortName: id.slice(0, 4).toUpperCase(),
    country: 'International',
    countryCode: 'INT',
    sport,
    tier: 1,
    season: '2025/26',
    logo: '',
    colour: '#22463a'
  };
}

/** Team attached to a fixture — provider teams take precedence. */
export function homeTeam(fixture: Fixture): Team {
  return fixture.homeTeam ?? resolveTeam(fixture.homeId, fixture.leagueId);
}

/** Team attached to a fixture — provider teams take precedence. */
export function awayTeam(fixture: Fixture): Team {
  return fixture.awayTeam ?? resolveTeam(fixture.awayId, fixture.leagueId);
}

/** League attached to a fixture — provider leagues take precedence. */
export function fixtureLeague(fixture: Fixture): League {
  return fixture.league ?? resolveLeague(fixture.leagueId, fixture.sport);
}
