import { LEAGUES, LEAGUE_MAP, TEAMS, TEAM_MAP } from '#lib/data/catalog';
import { resolveTeam } from '#lib/data/registry';
import type { Fixture, FixtureStatus, FormResult, SportId, Team } from '#lib/types';
import { clamp, hashString, mulberry32, normalCdf, seeded } from './core';
import { scoringProfile } from './scoring';

const HOUR = 3600_000;

export const SPORT_DURATION_MIN: Record<SportId, number> = {
  football: 108,
  basketball: 144,
  tennis: 144,
  icehockey: 150,
  baseball: 190
};

const VENUES: Record<string, string> = {
  arsenal: 'Emirates Stadium, London',
  'manchester-city': 'Etihad Stadium, Manchester',
  liverpool: 'Anfield, Liverpool',
  chelsea: 'Stamford Bridge, London',
  'newcastle-united': 'St James’ Park, Newcastle',
  'tottenham-hotspur': 'Tottenham Hotspur Stadium, London',
  'aston-villa': 'Villa Park, Birmingham',
  'manchester-united': 'Old Trafford, Manchester',
  'real-madrid': 'Santiago Bernabéu, Madrid',
  barcelona: 'Spotify Camp Nou, Barcelona',
  'atletico-madrid': 'Metropolitano, Madrid',
  'inter-milan': 'San Siro, Milan',
  napoli: 'Stadio Diego Armando Maradona, Naples',
  juventus: 'Allianz Stadium, Turin',
  'bayern-munich': 'Allianz Arena, Munich',
  'bayer-leverkusen': 'BayArena, Leverkusen',
  'borussia-dortmund': 'Signal Iduna Park, Dortmund',
  'paris-saint-germain': 'Parc des Princes, Paris',
  enyimba: 'Enyimba International Stadium, Aba',
  'rangers-international': 'Nnamdi Azikiwe Stadium, Enugu',
  'remo-stars': 'Remo Stars Stadium, Ikenne',
  'shooting-stars': 'Lekan Salami Stadium, Ibadan',
  'kano-pillars': 'Sani Abacha Stadium, Kano',
  'rivers-united': 'Adokiye Amiesimaka Stadium, Port Harcourt',
  'boston-celtics': 'TD Garden, Boston',
  'denver-nuggets': 'Ball Arena, Denver',
  'oklahoma-city-thunder': 'Paycom Center, Oklahoma City',
  'los-angeles-lakers': 'Crypto.com Arena, Los Angeles',
  'golden-state-warriors': 'Chase Center, San Francisco',
  'new-york-knicks': 'Madison Square Garden, New York',
  'florida-panthers': 'Amerant Bank Arena, Sunrise',
  'edmonton-oilers': 'Rogers Place, Edmonton',
  'los-angeles-dodgers': 'Dodger Stadium, Los Angeles',
  'new-york-yankees': 'Yankee Stadium, New York',
  'yomiuri-giants': 'Tokyo Dome, Tokyo',
  'jannik-sinner': 'Centre Court',
  'carlos-alcaraz': 'Centre Court',
  'aryna-sabalenka': 'Rod Laver Arena',
  'iga-swiatek': 'Philippe Chatrier'
};

const SURNAMES = [
  'Okafor', 'Adeyemi', 'Balogun', 'Eze', 'Mensah', 'Silva', 'Fernandes', 'Garcia', 'Martinez', 'Lopez',
  'Rossi', 'Bianchi', 'Müller', 'Schmidt', 'Dubois', 'Moreau', 'Smith', 'Walker', 'Brown', 'Wilson',
  'Johnson', 'Williams', 'Diallo', 'Traoré', 'Kalu', 'Ibrahim', 'Musa', 'Chukwu', 'Nwosu', 'Obi'
];
const FIRST = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.', 'I.', 'J.', 'K.', 'L.', 'M.', 'N.', 'O.', 'P.'];

function lineup(team: Team, salt: string): string[] {
  const rand = mulberry32(hashString(team.id + salt));
  const out: string[] = [];
  for (let i = 0; i < 11; i++) {
    const s = SURNAMES[Math.floor(rand() * SURNAMES.length)];
    const f = FIRST[Math.floor(rand() * FIRST.length)];
    out.push(`${f} ${s}`);
  }
  return out;
}

function venue(team: Team): string {
  return VENUES[team.id] ?? `${team.name} Stadium`;
}

function formString(rand: () => number): FormResult[] {
  return Array.from({ length: 5 }, () => {
    const r = rand();
    return r > 0.55 ? 'W' : r > 0.33 ? 'D' : 'L';
  });
}

/**
 * Expected score for a fixture, scaled by its competition.
 *
 * `base` is the competition's own per-team scoring rate, never a global
 * constant, so a Bundesliga side is expected to score more than a Serie A side
 * and an NBA team far more than a NCAA or women's league team.
 */
export function expectedScore(sport: SportId, home: Team, away: Team, homeAdv = 1, leagueName?: string) {
  const eloDiff = home.elo - away.elo;
  const profile = scoringProfile(sport, home.leagueId, leagueName);

  if (sport === 'football' || sport === 'icehockey') {
    // Team strength moves the split, the competition sets the total. Exponents
    // above 1 used to compound a 1.2 attack into a four-goal expectation.
    const attackH = 1 + (home.attack - 1) * 0.45;
    const attackA = 1 + (away.attack - 1) * 0.45;
    const defH = 1 + (home.defence - 1) * 0.45;
    const defA = 1 + (away.defence - 1) * 0.45;
    const h = clamp(profile.perTeam * attackH * defA * homeAdv * (1 + eloDiff / 14000), profile.perTeam * 0.28, profile.perTeam * 2.05);
    const a = clamp(profile.perTeam * attackA * defH * 0.9 * (1 - eloDiff / 14000), profile.perTeam * 0.24, profile.perTeam * 1.95);
    // Never let one fixture escape its competition's scoring envelope.
    const total = h + a;
    const ceiling = profile.total * 1.3;
    const floor = profile.total * 0.62;
    if (total > ceiling || total < floor) {
      const scale = clamp(total > ceiling ? ceiling / total : floor / total, 0.6, 1.7);
      return { home: h * scale, away: a * scale };
    }
    return { home: h, away: a };
  }

  if (sport === 'basketball') {
    // Possession-based: the competition sets the pace, the teams shift it.
    const pace = (1 + (home.attack - 1) * 0.42) * (1 + (away.defence - 1) * 0.42);
    const paceA = (1 + (away.attack - 1) * 0.42) * (1 + (home.defence - 1) * 0.42);
    const eloPoints = eloDiff / 30;
    const h = clamp(profile.perTeam * pace + eloPoints + 2.2, profile.perTeam * 0.78, profile.perTeam * 1.16);
    const a = clamp(profile.perTeam * paceA - eloPoints, profile.perTeam * 0.76, profile.perTeam * 1.14);
    const total = h + a;
    const ceiling = profile.total * 1.12;
    if (total > ceiling) {
      const scale = ceiling / total;
      return { home: h * scale, away: a * scale };
    }
    return { home: h, away: a };
  }

  if (sport === 'baseball') {
    const h = clamp((home.attack / 1.03) * profile.perTeam * (away.defence / 1.02) * homeAdv + eloDiff / 260, profile.perTeam * 0.45, profile.perTeam * 1.9);
    const a = clamp((away.attack / 1.03) * profile.perTeam * (home.defence / 1.02) - eloDiff / 280, profile.perTeam * 0.4, profile.perTeam * 1.8);
    return { home: h, away: a };
  }

  // tennis — expected games won, used for game markets
  return { home: profile.perTeam + 1.3 + eloDiff / 120, away: profile.perTeam - 1.3 - eloDiff / 130 };
}


type PeriodLine = { label: string; home: number; away: number };

interface MatchScript {
  final: { home: number; away: number };
  periods: PeriodLine[];
  /** Score at a wall-clock minute after kick-off; monotonic, exact at full time. */
  scoreAt: (elapsed: number) => { home: number; away: number };
  /** Period scores that have actually happened by that minute. */
  periodsAt: (elapsed: number) => PeriodLine[];
}

/** Wall-clock windows the score is dealt into, in minutes after kick-off. */
function scoreWindows(sport: SportId): { label: string; start: number; end: number }[] {
  if (sport === 'football') {
    return [
      { label: '1st half', start: 0, end: 45 },
      { label: '2nd half', start: 60, end: 105 }
    ];
  }
  if (sport === 'basketball') {
    return [0, 1, 2, 3].map((i) => ({ label: `Q${i + 1}`, start: i * 36, end: (i + 1) * 36 }));
  }
  if (sport === 'icehockey') {
    return [0, 1, 2].map((i) => ({ label: `Period ${i + 1}`, start: i * 50, end: (i + 1) * 50 }));
  }
  if (sport === 'baseball') {
    return Array.from({ length: 9 }, (_, i) => ({ label: `Inn ${i + 1}`, start: i * 21, end: (i + 1) * 21 }));
  }
  return [0, 1, 2].map((i) => ({ label: `Set ${i + 1}`, start: i * 48, end: (i + 1) * 48 }));
}

/** Split an integer total across parts, largest-remainder so the sum is exact. */
function deal(total: number, parts: number, rand: () => number): number[] {
  const weights = Array.from({ length: parts }, () => 0.6 + rand() * 0.8);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / sum);
  const counts = raw.map((v) => Math.floor(v));
  let remainder = total - counts.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    counts[i] += 1;
    remainder -= 1;
  }
  return counts;
}

/** Minutes inside a window at which a goal/point lands, sorted. */
function moments(count: number, start: number, end: number, rand: () => number): number[] {
  return Array.from({ length: count }, () => start + 0.5 + rand() * Math.max(0.5, end - start - 1)).sort((a, b) => a - b);
}

/** A Poisson draw; the score a model with these goal expectancies really produces. */
function poissonDraw(lambda: number, rand: () => number, cap = 9): number {
  const L = Math.exp(-Math.max(0.04, lambda));
  let k = 0;
  let pass = 1;
  do {
    k += 1;
    pass *= rand();
  } while (pass > L && k < cap);
  return Math.min(cap, k - 1);
}

/** A rounded normal draw for the scoring sports where a goal is a point. */
function gaussDraw(mean: number, sd: number, rand: () => number, floor = 0): number {
  const u = Math.max(1e-9, rand());
  const value = mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  return Math.max(floor, Math.round(value));
}

function sampleFinal(sport: SportId, expected: { home: number; away: number }, rand: () => number) {
  if (sport === 'football' || sport === 'icehockey') {
    return { home: poissonDraw(expected.home, rand), away: poissonDraw(expected.away, rand) };
  }
  if (sport === 'basketball') {
    return { home: gaussDraw(expected.home, 10.5, rand, 60), away: gaussDraw(expected.away, 10.5, rand, 60) };
  }
  if (sport === 'baseball') {
    return { home: gaussDraw(expected.home, 2.6, rand, 0), away: gaussDraw(expected.away, 2.6, rand, 0) };
  }
  return { home: 2, away: 1 };
}

function tennisScript(expected: { home: number; away: number }, seed: string): MatchScript {
  const rand = mulberry32(hashString(`${seed}-sets`));
  const strength = clamp(expected.home / Math.max(0.2, expected.home + expected.away), 0.12, 0.88);
  const windows = scoreWindows('tennis');
  const periods: PeriodLine[] = [];
  let homeSets = 0;
  let awaySets = 0;
  for (let i = 0; i < 3 && homeSets < 2 && awaySets < 2; i++) {
    const homeWins = rand() < strength;
    // 7-5 or a 6-x scoreline; the loser never reaches six.
    const tight = rand() < 0.32;
    const loser = tight ? 5 : Math.floor(rand() * 5);
    periods.push(
      homeWins
        ? { label: `Set ${i + 1}`, home: tight ? 7 : 6, away: loser }
        : { label: `Set ${i + 1}`, home: loser, away: tight ? 7 : 6 }
    );
    if (homeWins) homeSets += 1;
    else awaySets += 1;
  }
  const final = {
    home: periods.filter((p) => p.home > p.away).length,
    away: periods.filter((p) => p.away > p.home).length
  };
  const finishedSets = (elapsed: number) => windows.filter((w) => elapsed >= w.end).length;
  const scoreAt = (elapsed: number) => {
    const done = periods.slice(0, finishedSets(elapsed));
    return { home: done.filter((p) => p.home > p.away).length, away: done.filter((p) => p.away > p.home).length };
  };
  const periodsAt = (elapsed: number): PeriodLine[] => {
    const done = finishedSets(elapsed);
    const lines = periods.slice(0, done).map((p) => ({ ...p }));
    const current = periods[done];
    const window = windows[done];
    if (current && window) {
      const progress = clamp((elapsed - window.start) / (window.end - window.start), 0, 1);
      // Games accumulate through the set; the scoreline only lands at the end.
      lines.push({
        label: current.label,
        home: Math.min(current.home, Math.floor(current.home * progress)),
        away: Math.min(current.away, Math.floor(current.away * progress))
      });
    }
    return lines;
  };
  return { final, periods, scoreAt, periodsAt };
}

/**
 * One deterministic match script per fixture: the final score, the periods it
 * is built from, and the score on the board at any minute. The score only ever
 * moves forward and always lands on the final, so a match that finished 3-1 can
 * never be shown as 1-1 an hour later.
 */
function buildScript(sport: SportId, expected: { home: number; away: number }, seed: string): MatchScript {
  if (sport === 'tennis') return tennisScript(expected, seed);
  const rand = mulberry32(hashString(`${seed}-script`));
  const windows = scoreWindows(sport);
  // Sample the final from the same distribution the model prices, then deal
  // it across the periods. Rounding the expectation would have produced
  // "every match has two goals", which is not what the model says.
  const sampled = sampleFinal(sport, expected, rand);
  const homeCounts = deal(sampled.home, windows.length, rand);
  const awayCounts = deal(sampled.away, windows.length, rand);
  const homeTimeline = windows.flatMap((w, i) => moments(homeCounts[i], w.start, w.end, rand));
  const awayTimeline = windows.flatMap((w, i) => moments(awayCounts[i], w.start, w.end, rand));
  const fullPeriods: PeriodLine[] = windows.map((w, i) => ({
    label: sport === 'football' ? 'Half time' : w.label,
    home: homeCounts[i],
    away: awayCounts[i]
  }));
  const final = {
    home: homeCounts.reduce((a, b) => a + b, 0),
    away: awayCounts.reduce((a, b) => a + b, 0)
  };
  const count = (list: number[], elapsed: number) => list.filter((m) => m <= elapsed).length;
  const scoreAt = (elapsed: number) => ({ home: count(homeTimeline, elapsed), away: count(awayTimeline, elapsed) });
  const periodsAt = (elapsed: number): PeriodLine[] => {
    if (sport === 'football') {
      if (elapsed < 45) return [];
      return [{ label: 'Half time', home: count(homeTimeline, 45), away: count(awayTimeline, 45) }];
    }
    return windows
      .filter((w) => elapsed > w.start)
      .map((w) => ({
        label: w.label,
        home: count(homeTimeline, Math.min(elapsed, w.end)),
        away: count(awayTimeline, Math.min(elapsed, w.end))
      }));
  };
  // Football shows the half-time line only; the other sports show every period.
  const periods = sport === 'football' ? fullPeriods.slice(0, 1) : fullPeriods;
  return { final, periods, scoreAt, periodsAt };
}

function liveStats(sport: SportId, fixture: Fixture, seed: string) {
  const rand = mulberry32(hashString(seed));
  const progress = clamp((fixture.minute ?? 45) / 90, 0.05, 1);
  const possessionHome = Math.round(50 + (fixture.score.home - fixture.score.away) * 2 + (rand() - 0.5) * 16);
  const shotsHome = Math.max(fixture.score.home, Math.round(4 + progress * 9 * (possessionHome / 50) + rand() * 3));
  const shotsAway = Math.max(fixture.score.away, Math.round(3 + progress * 8 * ((100 - possessionHome) / 50) + rand() * 3));
  return {
    possession: [possessionHome, 100 - possessionHome] as [number, number],
    shots: [shotsHome, shotsAway] as [number, number],
    shotsOnTarget: [Math.min(shotsHome, fixture.score.home + Math.round(1 + rand() * 3)), Math.min(shotsAway, fixture.score.away + Math.round(rand() * 3))] as [number, number],
    corners: [Math.round(progress * 6 + rand() * 2), Math.round(progress * 5 + rand() * 2)] as [number, number],
    fouls: [Math.round(progress * 11 + rand() * 3), Math.round(progress * 12 + rand() * 3)] as [number, number],
    yellow: [Math.round(progress * 2 + rand()), Math.round(progress * 2 + rand())] as [number, number],
    red: [0, 0] as [number, number],
    xg: [Number((progress * (0.9 + rand() * 1.1)).toFixed(2)), Number((progress * (0.7 + rand() * 1.1)).toFixed(2))] as [number, number]
  };
}

export function periodLabel(sport: SportId, elapsedMin: number): string {
  if (sport === 'football') {
    if (elapsedMin < 45) return '1st half';
    if (elapsedMin < 60) return 'Half-time';
    return '2nd half';
  }
  if (sport === 'basketball') {
    const q = Math.min(4, Math.max(1, Math.ceil(elapsedMin / 36)));
    return `Q${q}`;
  }
  if (sport === 'icehockey') {
    const p = Math.min(3, Math.max(1, Math.ceil(elapsedMin / 45)));
    return p === 3 ? '3rd period' : `P${p}`;
  }
  if (sport === 'baseball') {
    const inning = Math.min(9, Math.max(1, Math.ceil(elapsedMin / 20)));
    return `Inning ${inning}`;
  }
  const set = Math.min(3, Math.max(1, Math.ceil(elapsedMin / 45)));
  return `Set ${set}`;
}

function h2h(home: Team, away: Team, seed: string) {
  const rand = mulberry32(hashString(seed));
  const homeWins = Math.round(rand() * 5 + 2);
  const draws = Math.round(rand() * 3);
  const awayWins = Math.round(rand() * 4 + 1);
  const last = Array.from({ length: 5 }, (_, i) => {
    const hs = Math.round(rand() * 3);
    const as = Math.round(rand() * 3);
    const year = 2025 - Math.floor(i / 2);
    return `${home.shortName} ${hs}–${as} ${away.shortName} · ${year}`;
  });
  return { homeWins, draws, awayWins, last };
}

/**
 * Match clock as the boards read it: football and hockey show the playing
 * minute, the other sports the wall clock since kick-off.
 */
function matchClock(sport: SportId, elapsed: number): { halftime: boolean; minute: number } {
  if (sport === 'football') {
    if (elapsed < 45) return { halftime: false, minute: Math.max(1, Math.round(elapsed)) };
    if (elapsed < 60) return { halftime: true, minute: 45 };
    return { halftime: false, minute: Math.min(95, Math.round(elapsed - 15)) };
  }
  if (sport === 'icehockey') {
    return { halftime: false, minute: clamp(Math.round((elapsed / SPORT_DURATION_MIN.icehockey) * 90), 1, 90) };
  }
  return { halftime: false, minute: Math.max(1, Math.round(elapsed)) };
}

function makeFixture(leagueId: string, home: Team, away: Team, kickoff: Date, round: string, now: number): Fixture {
  const league = LEAGUE_MAP[leagueId];
  const sport = league.sport;
  // Calendar kick-offs hold the seed still: same id, same script, same final
  // score for as long as the fixture is in the window.
  const seed = `${leagueId}-${home.id}-${away.id}-${kickoff.toISOString()}`;
  const expected = expectedScore(sport, home, away, 1.06);
  const script = buildScript(sport, expected, seed);
  const final = script.final;
  const duration = SPORT_DURATION_MIN[sport];
  const elapsed = (now - kickoff.getTime()) / 60000;

  let status: FixtureStatus = 'scheduled';
  let minute: number | undefined;
  let score = { home: 0, away: 0 };
  let periods: Fixture['periods'];

  if (elapsed >= duration) {
    status = 'finished';
    score = final;
    minute = 90;
    periods = script.periods;
  } else if (elapsed >= 0) {
    const clock = matchClock(sport, elapsed);
    status = clock.halftime ? 'halftime' : 'live';
    minute = clock.minute;
    score = script.scoreAt(elapsed);
    const shown = script.periodsAt(elapsed);
    periods = shown.length ? shown : undefined;
  }

  const fixture: Fixture = {
    id: `fx_${hashString(seed).toString(36)}`,
    sport,
    leagueId,
    homeId: home.id,
    awayId: away.id,
    kickoff: kickoff.toISOString(),
    status,
    minute: status === 'live' || status === 'halftime' ? minute : undefined,
    period: status === 'live' || status === 'halftime' ? periodLabel(sport, minute ?? 0) : undefined,
    score,
    periods,
    venue: venue(home),
    round,
    attendance: sport === 'football' ? Math.round(12_000 + seeded(seed + 'att') * 46_000) : undefined,
    weather: ['Clear · 24°C', 'Light rain · 21°C', 'Overcast · 23°C', 'Warm · 28°C', 'Breezy · 20°C'][Math.floor(seeded(seed + 'w') * 5)],
    officials: sport === 'football' ? ['M. Oliver', 'A. Taylor', 'S. Hooper'].slice(0, 1 + Math.floor(seeded(seed + 'o') * 3)) : undefined,
    h2h: h2h(home, away, seed + 'h2h'),
    lineups: sport === 'football' ? { home: lineup(home, 'lineup'), away: lineup(away, 'lineup') } : undefined
  };
  if (status === 'live' || status === 'halftime') {
    fixture.stats = liveStats(sport, fixture, seed + 'stats');
  }
  if (status === 'finished') {
    // Stamp the whistle against the same duration that produced the score, so
    // the result archive and the board agree on when the match ended.
    fixture.finishedAt = new Date(kickoff.getTime() + duration * 60_000).toISOString();
  }
  return fixture;
}

const DAY_MS = 24 * HOUR;
const SCHEDULE_DAYS = [-1, 0, 1, 2];
/**
 * Twelve two-hour windows. With matches lasting a little over two hours the
 * next window starts before the previous one empties, so the live board is
 * never blank in the middle of the day.
 */
const KICKOFF_SLOTS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

/**
 * Generate the fixture universe from a fixed calendar.
 *
 * Every competition plays two matches a day in one of eight three-hour slots,
 * and the kick-off is a real calendar timestamp. That is what makes a match a
 * match: the id, the final score and the goal script are pinned to the
 * kick-off, so refreshing the board an hour later shows the same fixture
 * further along, not a new fixture with a new score.
 */
export function generateFixtures(now = Date.now()): Fixture[] {
  const fixtures: Fixture[] = [];
  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);
  const today = Math.floor(midnight.getTime() / DAY_MS);

  LEAGUES.forEach((league, li) => {
    const teams = TEAMS.filter((t) => t.leagueId === league.id);
    if (teams.length < 2) return;
    for (const offset of SCHEDULE_DAYS) {
      const day = today + offset;
      const rand = mulberry32(hashString(`${league.id}-${day}`));
      const perDay = Math.min(2, teams.length);
      for (let i = 0; i < perDay; i++) {
        const slot = KICKOFF_SLOTS[(li * 2 + i + day * 5 + 24) % KICKOFF_SLOTS.length];
        const kickoff = new Date(day * DAY_MS + (slot * 60 + Math.floor(rand() * 15)) * 60_000);
        const home = teams[(day + i * 2) % teams.length];
        const away = teams[(day + i * 2 + 1) % teams.length];
        if (home.id === away.id) continue;
        const round =
          league.sport === 'football'
            ? `Matchday ${28 + ((day + i) % 6)}`
            : league.sport === 'basketball'
              ? `Regular season · Game ${42 + ((day + i) % 30)}`
              : league.sport === 'tennis'
                ? i % 2 === 0
                  ? 'Quarter-final'
                  : 'Semi-final'
                : league.sport === 'icehockey'
                  ? `Game ${34 + ((day + i) % 40)}`
                  : `Series game ${i + 1}`;
        fixtures.push(makeFixture(league.id, home, away, kickoff, round, now));
      }
    }
  });

  return fixtures.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
}

let cached: { at: number; fixtures: Fixture[] } | null = null;

/** The live centre refreshes every 30s, so the engine cache matches it. */
const FIXTURE_CACHE_MS = 30_000;

export function getFixtures(): Fixture[] {
  const now = Date.now();
  if (!cached || now - cached.at > FIXTURE_CACHE_MS) {
    cached = { at: now, fixtures: generateFixtures(now) };
  }
  return cached.fixtures;
}

export function getFixture(id: string): Fixture | undefined {
  return getFixtures().find((f) => f.id === id);
}

export function fixtureLabel(fixture: Fixture): string {
  const home = resolveTeam(fixture.homeId, fixture.leagueId);
  const away = resolveTeam(fixture.awayId, fixture.leagueId);
  return `${home?.name ?? fixture.homeId} vs ${away?.name ?? fixture.awayId}`;
}

export function teamOf(id: string, leagueId?: string): Team | undefined {
  return TEAM_MAP[id] ?? resolveTeam(id, leagueId);
}

export function formPoints(form: FormResult[]): number {
  return form.reduce((sum, r) => sum + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
}

export function sportLabel(sport: SportId): string {
  return sport === 'icehockey' ? 'Ice Hockey' : sport.charAt(0).toUpperCase() + sport.slice(1);
}

/** Scoreline probability helpers shared by the UI and the engine. */
export function resultFromGrid(grid: { home: number; draw: number; away: number }) {
  return grid;
}

export function winProbabilityFromElo(homeElo: number, awayElo: number, homeAdv = 45): number {
  return 1 / (1 + Math.pow(10, -(homeElo + homeAdv - awayElo) / 400));
}

export function coverProbability(margin: number, line: number, sd: number): number {
  // P(home margin + line > 0)
  return normalCdf((margin + line) / sd);
}
