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

/**
 * Statuses that mean the match is being played right now.
 *
 * Suspended and interrupted matches are deliberately absent: a game that is
 * stopped is not live, and treating it as live is how finished fixtures got
 * stuck on the live board. Half time is handled separately so the clock can
 * show the break.
 */
const LIVE_SHORT = new Set([
  '1H', '2H', 'ET', 'BT', 'P', 'LIVE',
  'Q1', 'Q2', 'Q3', 'Q4', 'OT', 'BT',
  'P1', 'P2', 'P3', 'SO'
]);

/** Codes/strings that mean the match is over, whatever the sport. */
const FINISHED_SHORT = new Set([
  'FT', 'AET', 'PEN', 'AOT', 'AFTER GAME', 'ENDED', 'FINISHED', 'FINAL', 'GAME OVER', 'AP'
]);

/** Strings that mean the match will not be played (or has been abandoned). */
const STOPPED_HINTS = ['POSTPONED', 'CANCEL', 'ABANDON', 'SUSPEND', 'INTERRUPT', 'AWARDED', 'WALKOVER', 'DELAY'];

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
    if (long.includes('HALFTIME') || short === 'HT') return 'halftime';
    if (short === '2' || long.includes('IN PROGRESS')) return 'live';
    if (STOPPED_HINTS.some((hint) => long.includes(hint))) return 'postponed';
    return 'scheduled';
  }

  // Settlement wins over everything: a provider that says "finished" or
  // "after penalties" must never be read as still in play.
  if (FINISHED_SHORT.has(short) || long.includes('FINISHED') || long.includes('FINAL')) return 'finished';
  if (long.includes('AFTER ') || long.includes('ENDED')) return 'finished';
  if (STOPPED_HINTS.some((hint) => long.includes(hint))) return 'postponed';
  if (short === 'HT' || long.includes('HALF TIME') || long.includes('HALFTIME')) return 'halftime';
  if (LIVE_SHORT.has(short) || long.includes('PERIOD') || long.includes('HALF') || long.includes('IN PLAY')) return 'live';
  if (short === 'POST' || short === 'CANC' || short === 'PST' || short === 'SUSP' || short === 'INT') {
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

interface PeriodScore {
  label: string;
  home: number;
  away: number;
}

function pairFrom(value: unknown): { home: number; away: number } | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const parts = value.split(/[-:]/).map((part) => Number(part.trim()));
    if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) return { home: parts[0], away: parts[1] };
    return null;
  }
  if (typeof value === 'object') {
    const record = value as { home?: unknown; away?: unknown };
    const home = numberOrNull(record.home as number);
    const away = numberOrNull(record.away as number);
    if (home !== null && away !== null) return { home, away };
  }
  return null;
}

/** Progressive scores: halves, periods, quarters, sets and innings. */
function periodsOf(raw: ApiFootballFixture, sport: ApiFootballSport): PeriodScore[] | undefined {
  const out: PeriodScore[] = [];
  const push = (label: string, pair: { home: number; away: number } | null) => {
    if (pair) out.push({ label, home: pair.home, away: pair.away });
  };

  if (sport === 'football') {
    push('Half time', pairFrom(raw.score?.halftime));
    push('Extra time', pairFrom(raw.score?.extratime));
    push('Penalties', pairFrom(raw.score?.penalty));
    return out.length ? out : undefined;
  }

  if (sport === 'basketball' || sport === 'nba') {
    const home = raw.scores?.home as Record<string, unknown> | number | undefined;
    const away = raw.scores?.away as Record<string, unknown> | number | undefined;
    if (home && typeof home === 'object' && away && typeof away === 'object') {
      for (let q = 1; q <= 4; q++) {
        const h = numberOrNull(home[`quarter_${q}`] as number);
        const a = numberOrNull(away[`quarter_${q}`] as number);
        if (h !== null && a !== null) out.push({ label: `Q${q}`, home: h, away: a });
      }
      const h1 = numberOrNull(home.quarter_1 as number);
      const h2 = numberOrNull(home.quarter_2 as number);
      const a1 = numberOrNull(away.quarter_1 as number);
      const a2 = numberOrNull(away.quarter_2 as number);
      if (h1 !== null && h2 !== null && a1 !== null && a2 !== null) {
        out.unshift({ label: 'Half time', home: h1 + h2, away: a1 + a2 });
      }
    }
    return out.length ? out : undefined;
  }

  if (sport === 'icehockey') {
    const periods = raw.periods as Record<string, unknown> | undefined;
    if (periods && typeof periods === 'object') {
      const labels: Array<[string, string]> = [
        ['first', '1st period'],
        ['second', '2nd period'],
        ['third', '3rd period'],
        ['overtime', 'Overtime']
      ];
      for (const [key, label] of labels) push(label, pairFrom(periods[key]));
    }
    return out.length ? out : undefined;
  }

  if (sport === 'baseball') {
    const innings = raw.periods as Record<string, unknown> | undefined;
    if (innings && typeof innings === 'object') {
      for (const key of Object.keys(innings).slice(0, 12)) push(`Inn ${key}`, pairFrom(innings[key]));
    }
    return out.length ? out : undefined;
  }

  return out.length ? out : undefined;
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
  const words = name.split(/[\s-]+/).filter(Boolean);
  const initials = words.map((part) => part[0]).join('');
  // Three letters read better than a single initial for one-word clubs.
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return initials.slice(0, 4).toUpperCase() || name.slice(0, 3).toUpperCase();
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
  const periods = periodsOf(raw, sport);
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
    periods,
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
