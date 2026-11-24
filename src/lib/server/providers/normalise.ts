import { registerLeague, registerTeam, slug } from '#lib/data/registry';
import { hashString, mulberry32 } from '#lib/engine/core';
import type { ApiFootballFixture, ApiFootballSport } from '#lib/server/providers/apiFootball';
import type { Fixture, FixtureStatus, League, SportId, Team } from '#lib/types';

/**
 * Normalisation of API-Sports payloads into CaveBettor fixtures.
 *
 * Five providers, five payload shapes:
 *
 *   football   /fixtures   { fixture: { date, status, venue }, league: {...}, teams: { home, away }, goals, score }
 *   basketball /games      { date, status, league: {...}, country: {...}, teams: { home, away }, scores: { home: { total }, away: { total } } }
 *   icehockey  /games      { date, status, league, country, teams, scores: { home: 0, away: 3 }, periods }
 *   nba        /games      { date: { start }, status: { short: 1|2|3 }, league: "standard", teams: { visitors, home }, scores: { visitors: { points }, home: { points } } }
 *   baseball   /games      { date, status, league, country, teams, scores: { home: { total }, away: { total } } }
 *
 * Competition ids are mapped to the built-in catalogue where one exists, and
 * otherwise to a stable slug so every league the provider knows about — major
 * or minor, cup or league — becomes a first-class CaveBettor competition.
 */

const SPORT_OF: Record<ApiFootballSport, SportId> = {
  football: 'football',
  basketball: 'basketball',
  icehockey: 'icehockey',
  nba: 'basketball',
  baseball: 'baseball'
};

/** Provider league id → CaveBettor league id, per sport, where a match exists. */
const LEAGUE_KEYS: Record<ApiFootballSport, Record<number, string>> = {
  football: {
    39: 'epl',
    140: 'laliga',
    135: 'seriea',
    78: 'bundesliga',
    61: 'ligue1',
    2: 'ucl',
    3: 'europa',
    848: 'conference',
    133: 'npfl',
    88: 'championship',
    94: 'eredivisie',
    169: 'saudi',
    71: 'brasileirao',
    128: 'argentina',
    253: 'mls',
    262: 'ligamx',
    307: 'saudi',
    203: 'superlig'
  },
  basketball: { 12: 'nba', 8: 'euroleague', 133: 'nbbl', 120: 'acb', 132: 'ncaa', 155: 'bsl' },
  icehockey: { 57: 'nhl', 58: 'khl', 59: 'echl', 60: 'shl' },
  nba: {},
  baseball: { 1: 'mlb', 2: 'npb', 3: 'kbo', 5: 'lidom' }
};

const COUNTRY_CODE: Record<string, string> = {
  England: 'GB',
  Spain: 'ES',
  Italy: 'IT',
  Germany: 'DE',
  France: 'FR',
  Europe: 'EU',
  World: 'INT',
  International: 'INT',
  Nigeria: 'NG',
  Netherlands: 'NL',
  'Saudi Arabia': 'SA',
  USA: 'US',
  'United States': 'US',
  Japan: 'JP',
  Brazil: 'BR',
  Argentina: 'AR',
  Mexico: 'MX',
  Turkey: 'TR',
  Russia: 'RU',
  Sweden: 'SE',
  Cuba: 'CU',
  Canada: 'CA'
};

/** Live statuses per provider family. */
const LIVE_SHORT = new Set([
  '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE',
  'Q1', 'Q2', 'Q3', 'Q4', 'OT', 'AOT', 'BT',
  'P1', 'P2', 'P3', 'SO'
]);

const FINISHED_SHORT = new Set(['FT', 'AET', 'PEN', 'AOT', 'AFTER GAME', 'ENDED', 'FINISHED']);

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.name === 'string') return record.name;
    if (typeof record.start === 'string') return record.start;
  }
  return '';
}

function leagueOf(raw: ApiFootballFixture): { id: number; name: string; country: string; season: string; logo: string } {
  const league = raw.league;
  const country = text(raw.country) || (league && typeof league === 'object' ? text(league.country) : '');
  if (league && typeof league === 'object') {
    return {
      id: Number(league.id ?? 0),
      name: String(league.name ?? 'International'),
      country: country || 'International',
      season: String(league.season ?? ''),
      logo: String(league.logo ?? '')
    };
  }
  // API-NBA returns a string such as "standard" and no league object.
  return { id: 0, name: country ? `${country} Basketball` : 'NBA', country: country || 'USA', season: '', logo: '' };
}

function statusOf(raw: ApiFootballFixture, sport: ApiFootballSport): FixtureStatus {
  const short = String(raw.fixture?.status?.short ?? raw.status?.short ?? '').toUpperCase();
  const long = String(raw.fixture?.status?.long ?? raw.status?.long ?? '').toUpperCase();

  if (sport === 'nba') {
    // API-NBA uses 1 = scheduled, 2 = in play, 3 = finished.
    if (short === '3' || long === 'FINISHED' || long === 'FINAL') return 'finished';
    if (short === '2' || long.includes('IN PROGRESS') || long.includes('HALFTIME')) return 'live';
    if (long.includes('POSTPONED') || long.includes('CANCEL')) return 'postponed';
    return 'scheduled';
  }

  if (FINISHED_SHORT.has(short) || long.includes('FINISHED')) return 'finished';
  if (LIVE_SHORT.has(short) || long.includes('PERIOD') || long.includes('HALF')) return 'live';
  if (short === 'HT') return 'halftime';
  if (short === 'POST' || short === 'CANC' || short === 'PST' || long.includes('POSTPONED') || long.includes('CANCEL')) {
    return 'postponed';
  }
  return 'scheduled';
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

/** Score extraction across the five shapes. */
function scoreOf(raw: ApiFootballFixture, sport: ApiFootballSport): { home: number; away: number } {
  if (sport === 'nba') {
    const homeSide = raw.scores?.home;
    const awaySide = raw.scores?.visitors;
    const readPoints = (side: unknown): number | null => {
      if (typeof side === 'number') return numberOrNull(side);
      if (side && typeof side === 'object') {
        const record = side as { points?: number | null; total?: number | null };
        return numberOrNull(record.points) ?? numberOrNull(record.total);
      }
      return null;
    };
    return { home: readPoints(homeSide) ?? 0, away: readPoints(awaySide) ?? 0 };
  }

  if (sport === 'icehockey') {
    const home = raw.scores?.home;
    const away = raw.scores?.away;
    if (typeof home === 'number' || typeof away === 'number') {
      return { home: numberOrNull(home) ?? 0, away: numberOrNull(away) ?? 0 };
    }
  }

  const homeScore = raw.scores?.home;
  const awayScore = raw.scores?.away;
  if (homeScore && typeof homeScore === 'object') {
    const total = numberOrNull(homeScore.total) ?? numberOrNull(homeScore.points);
    const other = awayScore && typeof awayScore === 'object' ? numberOrNull(awayScore.total) ?? numberOrNull(awayScore.points) : null;
    if (total !== null || other !== null) return { home: total ?? 0, away: other ?? 0 };
  }

  // Football.
  const goals = raw.goals;
  if (goals) {
    const home = numberOrNull(goals.home);
    const away = numberOrNull(goals.away);
    if (home !== null || away !== null) return { home: home ?? 0, away: away ?? 0 };
  }
  const fulltime = raw.score?.fulltime;
  if (fulltime && typeof fulltime === 'object') {
    return { home: numberOrNull(fulltime.home) ?? 0, away: numberOrNull(fulltime.away) ?? 0 };
  }
  return { home: 0, away: 0 };
}

/** Elapsed minute / period label for the live centre. */
function progressOf(raw: ApiFootballFixture, sport: ApiFootballSport, status: FixtureStatus): { minute?: number; period?: string } {
  const statusBlock = raw.fixture?.status ?? raw.status;
  if (status !== 'live' && status !== 'halftime') return { period: String(statusBlock?.long ?? '') || undefined };
  if (sport === 'football') {
    const elapsed = numberOrNull(statusBlock?.elapsed);
    return { minute: elapsed ?? undefined, period: String(statusBlock?.long ?? '') };
  }
  if (sport === 'nba') {
    const period = numberOrNull(raw.periods?.current);
    return { minute: period ? Math.min(48, period * 12) : undefined, period: period ? `Q${period}` : 'Live' };
  }
  const short = String(statusBlock?.short ?? '');
  if (short.startsWith('P') || short.startsWith('Q')) {
    const period = Number(short.slice(1)) || undefined;
    const minute = period ? Math.round((period / (sport === 'icehockey' ? 3 : 4)) * (sport === 'icehockey' ? 60 : 48)) : undefined;
    return { minute, period: short };
  }
  return { minute: undefined, period: String(raw.status?.long ?? 'Live') };
}

function shortNameOf(name: string): string {
  const short = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 3);
  return (short || name.slice(0, 3)).toUpperCase();
}

function inferredTeam(id: string, name: string, leagueId: string, sport: SportId, logo: string): Team {
  const rand = mulberry32(hashString(`${id}:strength`));
  // attack/defence are multipliers for the engine's expected-score model.
  const baseline: Record<SportId, number> = { football: 1.62, basketball: 1.12, tennis: 1.12, icehockey: 1.11, baseball: 1.09 };
  // Absolute scoring baselines used for xG for / against.
  const scoring: Record<SportId, number> = { football: 1.45, basketball: 111, tennis: 2.0, icehockey: 3.2, baseball: 4.8 };
  const jitter = 0.9 + rand() * 0.22;
  return {
    id,
    name,
    shortName: shortNameOf(name),
    leagueId,
    sport,
    elo: Math.round(1420 + rand() * 420),
    attack: Number((baseline[sport] * jitter).toFixed(3)),
    defence: Number((baseline[sport] * (2 - jitter)).toFixed(3)),
    form: ['W', 'D', 'L', 'W', 'D'],
    xgFor: Number((scoring[sport] * jitter).toFixed(2)),
    xgAgainst: Number((scoring[sport] * (2 - jitter)).toFixed(2)),
    cleanSheets: 4,
    badges: [],
    logo
  };
}

export function normaliseProviderFixture(raw: ApiFootballFixture, sport: ApiFootballSport): Fixture | null {
  const sportId = SPORT_OF[sport];
  const meta = leagueOf(raw);
  const mappedKey = LEAGUE_KEYS[sport][meta.id];
  const leagueId = mappedKey ?? `${sportId === 'basketball' && sport === 'nba' ? 'nba' : sportId}-${meta.id || slug(meta.name)}`;

  const homeRaw = raw.teams?.home ?? raw.teams?.visitors;
  const awayRaw = sport === 'nba' ? raw.teams?.home : raw.teams?.away;
  // API-NBA swaps: `visitors` is the away side and `home` the home side.
  const home = sport === 'nba' ? raw.teams?.home : raw.teams?.home ?? homeRaw;
  const away = sport === 'nba' ? raw.teams?.visitors : raw.teams?.away ?? awayRaw;

  const homeName = String(home?.name ?? '').trim();
  const awayName = String(away?.name ?? '').trim();
  if (!homeName || !awayName) return null;
  if (Number(home?.id) === Number(away?.id) && homeName === awayName) return null;

  const league: League = registerLeague({
    id: leagueId,
    name: meta.name,
    shortName: meta.name.length <= 6 ? meta.name.toUpperCase() : meta.name.slice(0, 4).toUpperCase(),
    country: meta.country,
    countryCode: COUNTRY_CODE[meta.country] ?? 'INT',
    sport: sportId,
    tier: 1,
    season: meta.season || '2025/26',
    logo: meta.logo,
    colour: '#22463a'
  });

  const homeKey = `${sport}-${home?.id ?? slug(homeName)}`;
  const awayKey = `${sport}-${away?.id ?? slug(awayName)}`;
  const homeTeam = registerTeam(inferredTeam(homeKey, homeName, leagueId, sportId, String(home?.logo ?? '')));
  const awayTeam = registerTeam(inferredTeam(awayKey, awayName, leagueId, sportId, String(away?.logo ?? '')));

  const dateValue =
    (typeof raw.date === 'string' ? raw.date : raw.date?.start ?? '') || raw.fixture?.date || '';
  const timestamp = raw.timestamp ?? raw.fixture?.timestamp ?? 0;
  const kickoff = dateValue ? new Date(dateValue) : new Date(timestamp * 1000);
  if (Number.isNaN(kickoff.getTime())) return null;

  const status = statusOf(raw, sport);
  const score = scoreOf(raw, sport);
  const progress = progressOf(raw, sport, status);
  const venue =
    (typeof raw.venue === 'string' ? raw.venue : [raw.venue?.name, raw.venue?.city].filter(Boolean).join(', ')) ||
    [raw.fixture?.venue?.name, raw.fixture?.venue?.city].filter(Boolean).join(', ') ||
    [raw.arena?.name, raw.arena?.city].filter(Boolean).join(', ') ||
    'Venue to be confirmed';

  const round =
    (raw.league && typeof raw.league === 'object' && raw.league.round) ||
    (raw.week ? `Week ${raw.week}` : '') ||
    '';

  return {
    id: `af_${sport}_${raw.fixture?.id ?? raw.id ?? `${home?.id ?? homeKey}-${away?.id ?? awayKey}`}`,
    sport: sportId,
    leagueId,
    homeId: homeTeam.id,
    awayId: awayTeam.id,
    homeTeam,
    awayTeam,
    league,
    kickoff: kickoff.toISOString(),
    status,
    minute: progress.minute,
    period: progress.period,
    score,
    venue,
    round: round || league.name,
    officials: raw.fixture?.referee ? [raw.fixture.referee] : undefined,
    h2h: { homeWins: 0, draws: 0, awayWins: 0, last: [] },
    source: 'api-football'
  } as Fixture;
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
