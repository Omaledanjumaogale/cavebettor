import { LEAGUES, LEAGUE_MAP, TEAMS, TEAM_MAP } from '#lib/data/catalog';
import { resolveTeam } from '#lib/data/registry';
import type { Fixture, FixtureStatus, FormResult, SportId, Team } from '#lib/types';
import { clamp, hashString, mulberry32, normalCdf, seeded } from './core';

const HOUR = 3600_000;

export const SPORT_DURATION_MIN: Record<SportId, number> = {
  football: 115,
  basketball: 150,
  tennis: 145,
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

export function expectedScore(sport: SportId, home: Team, away: Team, homeAdv = 1) {
  const eloDiff = home.elo - away.elo;
  if (sport === 'football' || sport === 'icehockey') {
    const base = sport === 'football' ? 0.76 : 3.05;
    const h = clamp(Math.pow(home.attack, 1.15) * Math.pow(away.defence, 1.1) * base * homeAdv * (1 + eloDiff / 9000), 0.15, 5.2);
    const a = clamp(Math.pow(away.attack, 1.12) * Math.pow(home.defence, 1.08) * base * 0.86 * (1 - eloDiff / 9000), 0.12, 5);
    return { home: h, away: a };
  }
  if (sport === 'basketball') {
    const base = home.leagueId === 'nba' ? 112.6 : home.leagueId === 'euroleague' ? 82.4 : 74.6;
    const h = clamp(base * (home.attack / 1.06) * (away.defence / 1.02) + eloDiff / 22 + 2.6, base * 0.7, base * 1.35);
    const a = clamp(base * (away.attack / 1.06) * (home.defence / 1.02) - eloDiff / 22, base * 0.68, base * 1.32);
    return { home: h, away: a };
  }
  if (sport === 'baseball') {
    const h = clamp((home.attack / 1.03) * 4.55 * (away.defence / 1.02) * homeAdv + eloDiff / 260, 1.8, 8.4);
    const a = clamp((away.attack / 1.03) * 4.4 * (home.defence / 1.02) - eloDiff / 280, 1.6, 8.2);
    return { home: h, away: a };
  }
  // tennis — expected games won, used for game markets
  return { home: 12.6 + eloDiff / 120, away: 10.9 - eloDiff / 130 };
}

function finalScore(sport: SportId, expected: { home: number; away: number }, seed: string) {
  const rand = mulberry32(hashString(seed));
  if (sport === 'football' || sport === 'icehockey') {
    const poisson = (l: number) => {
      const L = Math.exp(-l);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= rand();
      } while (p > L);
      return k - 1;
    };
    return { home: poisson(expected.home), away: poisson(expected.away) };
  }
  if (sport === 'basketball') {
    const gauss = (mean: number, sd: number) => Math.max(60, Math.round(mean + sd * Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand())));
    return { home: gauss(expected.home, 10.5), away: gauss(expected.away, 10.5) };
  }
  if (sport === 'baseball') {
    const gauss = (mean: number, sd: number) => Math.max(0, Math.round(mean + sd * Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand())));
    return { home: gauss(expected.home, 2.6), away: gauss(expected.away, 2.6) };
  }
  return { home: 2, away: 1 };
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

function makeFixture(leagueId: string, home: Team, away: Team, kickoff: Date, round: string, now: number): Fixture {
  const league = LEAGUE_MAP[leagueId];
  const sport = league.sport;
  const duration = SPORT_DURATION_MIN[sport];
  const elapsed = (now - kickoff.getTime()) / 60000;
  const seed = `${leagueId}-${home.id}-${away.id}-${kickoff.toISOString().slice(0, 13)}`;
  const expected = expectedScore(sport, home, away, 1.06);
  const final = finalScore(sport, expected, seed);

  let status: FixtureStatus = 'scheduled';
  let minute: number | undefined;
  let score = { home: 0, away: 0 };

  if (elapsed >= duration + 8) {
    status = 'finished';
    score = final;
    minute = 90;
  } else if (elapsed >= 0) {
    status = elapsed > duration * 0.52 && sport === 'football' ? 'halftime' : 'live';
    minute = Math.max(1, Math.min(Math.round(duration * 0.92), Math.round((elapsed / duration) * 100)));
    const progress = clamp(elapsed / duration, 0, 1);
    const liveH = Math.min(final.home, Math.round(final.home * progress + seeded(seed + 'h') * 0.9));
    const liveA = Math.min(final.away, Math.round(final.away * progress + seeded(seed + 'a') * 0.7));
    score = { home: liveH, away: liveA };
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
  return fixture;
}

/** Generate the rolling fixture universe, anchored to `now`. */
export function generateFixtures(now = Date.now()): Fixture[] {
  const fixtures: Fixture[] = [];
  const base = new Date(now);
  base.setMinutes(0, 0, 0);
  const offsets = [-27, -2.4, -0.55, 2.5, 27, 51, 75, 99];

  LEAGUES.forEach((league, li) => {
    const teams = TEAMS.filter((t) => t.leagueId === league.id);
    if (teams.length < 2) return;
    const rand = mulberry32(hashString(league.id + new Date(now).toISOString().slice(0, 10)));
    const count = Math.min(6, teams.length);
    for (let i = 0; i < count; i++) {
      const home = teams[i % teams.length];
      const away = teams[(i + 1 + (i % 2)) % teams.length];
      if (home.id === away.id) continue;
      const slot = offsets[(li + i) % offsets.length];
      const kickoff = new Date(base.getTime() + slot * HOUR - rand() * 18 * 60000);
      const round =
        league.sport === 'football'
          ? `Matchday ${28 + ((li + i) % 6)}`
          : league.sport === 'basketball'
            ? `Regular season · Game ${42 + i}`
            : league.sport === 'tennis'
              ? i % 2 === 0
                ? 'Quarter-final'
                : 'Semi-final'
              : league.sport === 'icehockey'
                ? `Game ${34 + i}`
                : `Series game ${i + 1}`;
      fixtures.push(makeFixture(league.id, home, away, kickoff, round, now));
    }
  });

  return fixtures.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
}

let cached: { at: number; fixtures: Fixture[] } | null = null;

export function getFixtures(): Fixture[] {
  const now = Date.now();
  if (!cached || now - cached.at > 60_000) {
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
