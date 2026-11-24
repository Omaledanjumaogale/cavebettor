import type {
  Bookmaker,
  DataSource,
  League,
  ModelVersion,
  Sport,
  SubscriptionPlan,
  Team,
  UserProfile
} from '#lib/types';

export const SPORTS: Sport[] = [
  { id: 'football', name: 'Football', icon: '⚽', accent: '#c6ff4a', hasDraw: true },
  { id: 'basketball', name: 'Basketball', icon: '🏀', accent: '#ff9f45', hasDraw: false },
  { id: 'tennis', name: 'Tennis', icon: '🎾', accent: '#7bdcff', hasDraw: false },
  { id: 'icehockey', name: 'Ice Hockey', icon: '🏒', accent: '#a8b6ff', hasDraw: true },
  { id: 'baseball', name: 'Baseball', icon: '⚾', accent: '#ff7d9c', hasDraw: false }
];

export const SPORT_MAP = Object.fromEntries(SPORTS.map((s) => [s.id, s])) as Record<Sport['id'], Sport>;

const L = (
  id: string,
  name: string,
  shortName: string,
  country: string,
  countryCode: string,
  sport: League['sport'],
  tier: number,
  colour: string,
  logo: string
): League => ({ id, name, shortName, country, countryCode, sport, tier, season: '2025/26', colour, logo });

export const LEAGUES: League[] = [
  L('epl', 'Premier League', 'EPL', 'England', 'GB', 'football', 1, '#3d195b', 'PL'),
  L('laliga', 'La Liga', 'LaLiga', 'Spain', 'ES', 'football', 1, '#ee8707', 'LL'),
  L('seriea', 'Serie A', 'Serie A', 'Italy', 'IT', 'football', 1, '#0b6ab0', 'SA'),
  L('bundesliga', 'Bundesliga', 'BL', 'Germany', 'DE', 'football', 1, '#d20515', 'BL'),
  L('ligue1', 'Ligue 1', 'L1', 'France', 'FR', 'football', 1, '#091c3e', 'L1'),
  L('ucl', 'UEFA Champions League', 'UCL', 'Europe', 'EU', 'football', 1, '#0c2452', 'UCL'),
  L('npfl', 'Nigeria Premier Football League', 'NPFL', 'Nigeria', 'NG', 'football', 1, '#008751', 'NPFL'),
  L('championship', 'English Championship', 'EFL', 'England', 'GB', 'football', 2, '#1c3c78', 'EFL'),
  L('eredivisie', 'Eredivisie', 'ERE', 'Netherlands', 'NL', 'football', 1, '#ff6b00', 'ERE'),
  L('saudi', 'Saudi Pro League', 'SPL', 'Saudi Arabia', 'SA', 'football', 1, '#005c3c', 'SPL'),
  L('nba', 'NBA', 'NBA', 'United States', 'US', 'basketball', 1, '#c8102e', 'NBA'),
  L('euroleague', 'EuroLeague', 'EL', 'Europe', 'EU', 'basketball', 1, '#f36f21', 'EL'),
  L('nbbl', 'NBBF Premier League', 'NBBF', 'Nigeria', 'NG', 'basketball', 1, '#00a651', 'NBBF'),
  L('atp', 'ATP Masters 1000', 'ATP', 'World', 'INT', 'tennis', 1, '#1f6fb2', 'ATP'),
  L('wta', 'WTA 1000', 'WTA', 'World', 'INT', 'tennis', 1, '#8e2d86', 'WTA'),
  L('grandslam', 'Grand Slam', 'GS', 'World', 'INT', 'tennis', 1, '#b18b2b', 'GS'),
  L('nhl', 'National Hockey League', 'NHL', 'United States', 'US', 'icehockey', 1, '#0b1c33', 'NHL'),
  L('shl', 'Swedish Hockey League', 'SHL', 'Sweden', 'SE', 'icehockey', 1, '#004b8d', 'SHL'),
  L('mlb', 'Major League Baseball', 'MLB', 'United States', 'US', 'baseball', 1, '#002d72', 'MLB'),
  L('npb', 'Nippon Professional Baseball', 'NPB', 'Japan', 'JP', 'baseball', 1, '#b31b1b', 'NPB')
];

export const LEAGUE_MAP = Object.fromEntries(LEAGUES.map((l) => [l.id, l])) as Record<string, League>;

function team(
  leagueId: string,
  name: string,
  shortName: string,
  elo: number,
  attack: number,
  defence: number,
  form: string,
  xgFor = 1.4,
  xgAgainst = 1.2
): Team {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    shortName,
    leagueId,
    sport: LEAGUE_MAP[leagueId].sport,
    elo,
    attack,
    defence,
    form: form.split('') as Team['form'],
    xgFor,
    xgAgainst,
    cleanSheets: Math.round(4 + (elo - 1700) / 40),
    badges: []
  };
}

export const TEAMS: Team[] = [
  // Premier League
  team('epl', 'Arsenal', 'ARS', 1945, 1.78, 0.92, 'WWWDW', 1.92, 0.81),
  team('epl', 'Manchester City', 'MCI', 1962, 1.95, 0.98, 'WWLWW', 2.06, 0.88),
  team('epl', 'Liverpool', 'LIV', 1951, 1.9, 1.02, 'WDWWW', 2.01, 0.94),
  team('epl', 'Chelsea', 'CHE', 1866, 1.62, 1.12, 'WLWDW', 1.74, 1.05),
  team('epl', 'Newcastle United', 'NEW', 1858, 1.55, 1.04, 'WWDLW', 1.61, 0.98),
  team('epl', 'Tottenham Hotspur', 'TOT', 1834, 1.66, 1.28, 'LWWLD', 1.79, 1.31),
  team('epl', 'Aston Villa', 'AVL', 1824, 1.5, 1.13, 'DWWLD', 1.55, 1.09),
  team('epl', 'Manchester United', 'MUN', 1802, 1.42, 1.24, 'LDLWW', 1.48, 1.22),
  // La Liga
  team('laliga', 'Real Madrid', 'RMA', 1974, 1.92, 0.86, 'WWWWD', 2.04, 0.79),
  team('laliga', 'Barcelona', 'BAR', 1948, 2.02, 1.04, 'WWWLW', 2.21, 0.96),
  team('laliga', 'Atletico Madrid', 'ATM', 1878, 1.46, 0.82, 'WDWWL', 1.49, 0.77),
  team('laliga', 'Athletic Club', 'ATH', 1818, 1.38, 0.92, 'DWWDL', 1.4, 0.89),
  team('laliga', 'Villarreal', 'VIL', 1786, 1.44, 1.14, 'WDLWW', 1.5, 1.11),
  team('laliga', 'Real Sociedad', 'RSO', 1762, 1.22, 0.99, 'LWDWL', 1.24, 0.96),
  // Serie A
  team('seriea', 'Inter Milan', 'INT', 1904, 1.76, 0.83, 'WWWDL', 1.85, 0.78),
  team('seriea', 'Napoli', 'NAP', 1882, 1.55, 0.84, 'WDWWD', 1.6, 0.8),
  team('seriea', 'Juventus', 'JUV', 1852, 1.38, 0.81, 'DDWWD', 1.41, 0.76),
  team('seriea', 'AC Milan', 'MIL', 1844, 1.52, 1.02, 'WLDWW', 1.58, 0.98),
  team('seriea', 'Atalanta', 'ATA', 1836, 1.72, 1.08, 'WWLWD', 1.81, 1.02),
  team('seriea', 'AS Roma', 'ROM', 1786, 1.34, 1.01, 'LWWDW', 1.37, 0.97),
  // Bundesliga
  team('bundesliga', 'Bayern Munich', 'FCB', 1954, 2.24, 0.92, 'WWWWW', 2.42, 0.85),
  team('bundesliga', 'Bayer Leverkusen', 'B04', 1902, 1.86, 0.96, 'WWWDW', 1.97, 0.9),
  team('bundesliga', 'Borussia Dortmund', 'BVB', 1858, 1.68, 1.18, 'WDLWW', 1.76, 1.12),
  team('bundesliga', 'RB Leipzig', 'RBL', 1844, 1.62, 1.08, 'LWWDL', 1.68, 1.03),
  team('bundesliga', 'VfB Stuttgart', 'VFB', 1794, 1.55, 1.24, 'WWLDL', 1.6, 1.19),
  team('bundesliga', 'Eintracht Frankfurt', 'SGE', 1772, 1.49, 1.27, 'DWLWW', 1.52, 1.22),
  // Ligue 1
  team('ligue1', 'Paris Saint-Germain', 'PSG', 1942, 2.06, 0.85, 'WWWWD', 2.18, 0.8),
  team('ligue1', 'AS Monaco', 'MON', 1832, 1.62, 1.14, 'WLDWW', 1.7, 1.08),
  team('ligue1', 'Olympique Marseille', 'OM', 1812, 1.58, 1.12, 'WLWDL', 1.64, 1.07),
  team('ligue1', 'Lille OSC', 'LIL', 1794, 1.42, 1.02, 'DWWLD', 1.45, 0.98),
  team('ligue1', 'Olympique Lyonnais', 'OL', 1762, 1.36, 1.18, 'LDWWD', 1.39, 1.14),
  team('ligue1', 'OGC Nice', 'NIC', 1744, 1.18, 1.12, 'DLWDL', 1.2, 1.08),
  // UCL (cross-league elite)
  team('ucl', 'Real Madrid', 'RMA', 1974, 1.92, 0.86, 'WWWWD', 2.04, 0.79),
  team('ucl', 'Manchester City', 'MCI', 1962, 1.95, 0.98, 'WWLWW', 2.06, 0.88),
  team('ucl', 'Bayern Munich', 'FCB', 1954, 2.24, 0.92, 'WWWWW', 2.42, 0.85),
  team('ucl', 'Inter Milan', 'INT', 1904, 1.76, 0.83, 'WWWDL', 1.85, 0.78),
  team('ucl', 'Arsenal', 'ARS', 1945, 1.78, 0.92, 'WWWDW', 1.92, 0.81),
  team('ucl', 'Barcelona', 'BAR', 1948, 2.02, 1.04, 'WWWLW', 2.21, 0.96),
  // NPFL
  team('npfl', 'Enyimba', 'ENY', 1620, 1.42, 0.94, 'WWWDW', 1.45, 0.9),
  team('npfl', 'Rangers International', 'RAN', 1592, 1.31, 0.98, 'WDWWL', 1.33, 0.95),
  team('npfl', 'Remo Stars', 'REM', 1604, 1.38, 0.91, 'WWDLW', 1.41, 0.88),
  team('npfl', 'Shooting Stars', '3SC', 1554, 1.18, 1.04, 'DLWDW', 1.2, 1.0),
  team('npfl', 'Kano Pillars', 'KAN', 1546, 1.14, 1.06, 'LWDWL', 1.16, 1.02),
  team('npfl', 'Rivers United', 'RIV', 1572, 1.24, 0.97, 'WWDWD', 1.26, 0.93),
  // Championship
  team('championship', 'Leeds United', 'LEE', 1722, 1.52, 1.04, 'WWWDW', 1.58, 0.99),
  team('championship', 'Burnley', 'BUR', 1708, 1.34, 0.92, 'WDWWD', 1.37, 0.88),
  team('championship', 'Sheffield United', 'SHU', 1686, 1.31, 1.08, 'WLWDL', 1.34, 1.03),
  team('championship', 'Sunderland', 'SUN', 1662, 1.24, 1.02, 'DWWLD', 1.26, 0.98),
  team('championship', 'Middlesbrough', 'MID', 1648, 1.28, 1.14, 'LWDWW', 1.3, 1.09),
  team('championship', 'Norwich City', 'NOR', 1636, 1.26, 1.19, 'WLDWL', 1.28, 1.15),
  // Eredivisie
  team('eredivisie', 'Ajax', 'AJA', 1802, 1.7, 1.06, 'WWWDL', 1.79, 1.0),
  team('eredivisie', 'PSV Eindhoven', 'PSV', 1832, 1.92, 0.94, 'WWWWD', 2.02, 0.88),
  team('eredivisie', 'Feyenoord', 'FEY', 1788, 1.66, 1.08, 'WWDWW', 1.73, 1.02),
  team('eredivisie', 'AZ Alkmaar', 'AZ', 1722, 1.48, 1.16, 'DWLWD', 1.52, 1.11),
  team('eredivisie', 'FC Twente', 'TWE', 1698, 1.4, 1.12, 'WDLWL', 1.43, 1.08),
  team('eredivisie', 'FC Utrecht', 'UTR', 1672, 1.32, 1.07, 'LWDWD', 1.34, 1.03),
  // Saudi
  team('saudi', 'Al Hilal', 'HIL', 1808, 1.94, 0.88, 'WWWWW', 2.04, 0.83),
  team('saudi', 'Al Nassr', 'NAS', 1786, 1.82, 0.98, 'WWDWW', 1.9, 0.93),
  team('saudi', 'Al Ittihad', 'ITT', 1762, 1.62, 0.96, 'WLWWD', 1.68, 0.91),
  team('saudi', 'Al Ahli', 'AHL', 1742, 1.54, 0.99, 'DWWLW', 1.59, 0.95),
  team('saudi', 'Al Shabab', 'SHB', 1682, 1.36, 1.12, 'LWDWL', 1.39, 1.07),
  team('saudi', 'Al Ettifaq', 'ETT', 1654, 1.22, 1.18, 'DLLWD', 1.24, 1.14),
  // NBA
  team('nba', 'Boston Celtics', 'BOS', 1902, 1.16, 0.97, 'WWLWW', 118.4, 108.2),
  team('nba', 'Denver Nuggets', 'DEN', 1878, 1.12, 1.0, 'WLWWW', 116.8, 110.1),
  team('nba', 'Oklahoma City Thunder', 'OKC', 1896, 1.14, 0.95, 'WWWWL', 117.6, 106.9),
  team('nba', 'Milwaukee Bucks', 'MIL', 1842, 1.1, 1.06, 'LWWDL', 115.2, 112.6),
  team('nba', 'Los Angeles Lakers', 'LAL', 1816, 1.06, 1.09, 'WDLWW', 113.9, 114.2),
  team('nba', 'Golden State Warriors', 'GSW', 1804, 1.05, 1.08, 'LWWLW', 113.1, 112.8),
  team('nba', 'New York Knicks', 'NYK', 1854, 1.09, 1.02, 'WWLWD', 114.6, 110.4),
  team('nba', 'Dallas Mavericks', 'DAL', 1826, 1.08, 1.07, 'LLWWW', 114.1, 112.9),
  // EuroLeague
  team('euroleague', 'Real Madrid Baloncesto', 'RMB', 1794, 1.12, 0.98, 'WWLWW', 86.2, 78.9),
  team('euroleague', 'Panathinaikos', 'PAO', 1782, 1.1, 1.0, 'WLWWW', 85.1, 80.2),
  team('euroleague', 'Olympiacos', 'OLY', 1776, 1.08, 1.01, 'WWDWL', 84.4, 80.6),
  team('euroleague', 'Fenerbahce', 'FEN', 1758, 1.06, 1.03, 'LWWLD', 83.2, 81.4),
  team('euroleague', 'Barcelona Basket', 'FCB', 1742, 1.04, 1.04, 'DWLWW', 82.6, 82.1),
  team('euroleague', 'AS Monaco Basket', 'ASM', 1736, 1.03, 1.05, 'WWLLW', 82.1, 82.7),
  // NBBF
  team('nbbl', 'Rivers Hoopers', 'RHO', 1522, 1.08, 0.96, 'WWWLW', 78.4, 71.2),
  team('nbbl', 'Gombe Bulls', 'GOM', 1504, 1.04, 0.99, 'WLWWL', 76.2, 73.1),
  team('nbbl', 'Kwara Falcons', 'KWA', 1492, 1.01, 1.02, 'LWDWW', 74.8, 74.6),
  team('nbbl', 'Mark Mentors', 'MAR', 1476, 0.98, 1.05, 'WLLWD', 73.1, 76.2),
  team('nbbl', 'Nigeria Customs', 'CUS', 1462, 0.96, 1.07, 'LLWDL', 72.4, 77.8),
  team('nbbl', 'Police Baton', 'POL', 1448, 0.94, 1.09, 'LWLLW', 71.2, 79.1),
  // Tennis
  team('atp', 'Jannik Sinner', 'SIN', 2182, 1.18, 0.9, 'WWWWW', 2.1, 0.7),
  team('atp', 'Carlos Alcaraz', 'ALC', 2164, 1.16, 0.92, 'WWLWW', 2.05, 0.74),
  team('atp', 'Novak Djokovic', 'DJO', 2118, 1.12, 0.96, 'WLWWW', 1.98, 0.8),
  team('atp', 'Alexander Zverev', 'ZVE', 2054, 1.08, 1.0, 'WWLWL', 1.9, 0.86),
  team('atp', 'Daniil Medvedev', 'MED', 2036, 1.06, 1.02, 'LWWLD', 1.86, 0.89),
  team('atp', 'Holger Rune', 'RUN', 1988, 1.02, 1.06, 'WLWLW', 1.78, 0.94),
  team('wta', 'Aryna Sabalenka', 'SAB', 2102, 1.15, 0.92, 'WWWLW', 2.0, 0.72),
  team('wta', 'Iga Swiatek', 'SWI', 2148, 1.18, 0.88, 'WWWWL', 2.08, 0.68),
  team('wta', 'Coco Gauff', 'GAU', 2024, 1.08, 0.99, 'WLWWW', 1.86, 0.82),
  team('wta', 'Elena Rybakina', 'RYB', 2012, 1.07, 1.0, 'LWWLW', 1.84, 0.84),
  team('wta', 'Jessica Pegula', 'PEG', 1968, 1.03, 1.04, 'WLWLW', 1.76, 0.9),
  team('wta', 'Zheng Qinwen', 'ZHE', 1984, 1.05, 1.02, 'WWLLW', 1.8, 0.87),
  team('grandslam', 'Jannik Sinner', 'SIN', 2182, 1.18, 0.9, 'WWWWW', 2.1, 0.7),
  team('grandslam', 'Carlos Alcaraz', 'ALC', 2164, 1.16, 0.92, 'WWLWW', 2.05, 0.74),
  team('grandslam', 'Aryna Sabalenka', 'SAB', 2102, 1.15, 0.92, 'WWWLW', 2.0, 0.72),
  team('grandslam', 'Iga Swiatek', 'SWI', 2148, 1.18, 0.88, 'WWWWL', 2.08, 0.68),
  team('grandslam', 'Novak Djokovic', 'DJO', 2118, 1.12, 0.96, 'WLWWW', 1.98, 0.8),
  team('grandslam', 'Coco Gauff', 'GAU', 2024, 1.08, 0.99, 'WLWWW', 1.86, 0.82),
  // NHL
  team('nhl', 'Florida Panthers', 'FLA', 1798, 1.14, 0.95, 'WWLWW', 3.42, 2.71),
  team('nhl', 'Edmonton Oilers', 'EDM', 1782, 1.16, 1.02, 'WLWWW', 3.61, 3.04),
  team('nhl', 'New York Rangers', 'NYR', 1764, 1.08, 0.99, 'WWDWL', 3.18, 2.86),
  team('nhl', 'Boston Bruins', 'BOS', 1752, 1.05, 0.98, 'LWWLD', 3.08, 2.82),
  team('nhl', 'Colorado Avalanche', 'COL', 1776, 1.12, 1.04, 'WWLWL', 3.47, 3.12),
  team('nhl', 'Toronto Maple Leafs', 'TOR', 1738, 1.09, 1.06, 'WLWLW', 3.29, 3.18),
  // SHL
  team('shl', 'Frolunda HC', 'FRO', 1652, 1.08, 0.96, 'WWLWW', 3.12, 2.68),
  team('shl', 'Skelleftea AIK', 'SKE', 1644, 1.06, 0.98, 'WLWWL', 3.04, 2.76),
  team('shl', 'Lulea HF', 'LUL', 1632, 1.04, 0.99, 'WWDWL', 2.94, 2.81),
  team('shl', 'Farjestad BK', 'FAR', 1620, 1.02, 1.01, 'LWWLD', 2.88, 2.87),
  team('shl', 'Rogle BK', 'ROG', 1604, 0.99, 1.04, 'WLWLL', 2.79, 2.98),
  team('shl', 'Vaxjo Lakers', 'VAX', 1592, 0.97, 1.06, 'LLWDW', 2.71, 3.06),
  // MLB
  team('mlb', 'Los Angeles Dodgers', 'LAD', 1822, 1.12, 0.96, 'WWLWW', 5.42, 4.31),
  team('mlb', 'New York Yankees', 'NYY', 1804, 1.1, 0.98, 'WLWWW', 5.28, 4.46),
  team('mlb', 'Atlanta Braves', 'ATL', 1786, 1.08, 1.0, 'WWDWL', 5.11, 4.58),
  team('mlb', 'Houston Astros', 'HOU', 1762, 1.05, 1.02, 'LWWLD', 4.92, 4.67),
  team('mlb', 'Philadelphia Phillies', 'PHI', 1774, 1.07, 1.01, 'WWLWL', 5.02, 4.62),
  team('mlb', 'Baltimore Orioles', 'BAL', 1748, 1.03, 1.04, 'WLWLW', 4.81, 4.74),
  // NPB
  team('npb', 'Yomiuri Giants', 'YOM', 1702, 1.05, 0.97, 'WWLWW', 4.62, 4.08),
  team('npb', 'Hanshin Tigers', 'HAN', 1694, 1.03, 0.98, 'WLWWL', 4.51, 4.12),
  team('npb', 'Fukuoka SoftBank Hawks', 'SBH', 1688, 1.04, 1.0, 'WWDWL', 4.58, 4.21),
  team('npb', 'Orix Buffaloes', 'ORI', 1676, 1.01, 1.01, 'LWWLD', 4.42, 4.28),
  team('npb', 'Yokohama BayStars', 'YOK', 1662, 0.99, 1.03, 'WLWLL', 4.31, 4.39),
  team('npb', 'Hiroshima Carp', 'HIR', 1654, 0.97, 1.05, 'LLWDW', 4.22, 4.47)
];

export const TEAM_MAP = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<string, Team>;

export const BOOKMAKERS: Bookmaker[] = [
  { id: 'bet9ja', name: 'Bet9ja', shortName: 'B9', margin: 0.065, licence: 'Lagos State Lotteries', naira: true, colour: '#00a651', rating: 4.4 },
  { id: 'sportybet', name: 'SportyBet', shortName: 'SB', margin: 0.052, licence: 'National Lottery Regulatory Commission', naira: true, colour: '#e4002b', rating: 4.5 },
  { id: 'betking', name: 'BetKing', shortName: 'BK', margin: 0.06, licence: 'NLRC / Lagos State', naira: true, colour: '#f9b000', rating: 4.3 },
  { id: '1xbet', name: '1xBet', shortName: '1X', margin: 0.045, licence: 'Curacao eGaming', naira: true, colour: '#0a8ee2', rating: 4.0 },
  { id: 'bet365', name: 'bet365', shortName: '365', margin: 0.058, licence: 'Gibraltar Gambling Commission', naira: false, colour: '#027b5b', rating: 4.7 },
  { id: 'melbet', name: 'Melbet', shortName: 'MB', margin: 0.048, licence: 'Curacao eGaming', naira: true, colour: '#ffd400', rating: 3.9 },
  { id: 'bangbet', name: 'BangBet', shortName: 'BB', margin: 0.062, licence: 'NLRC', naira: true, colour: '#ff5000', rating: 4.1 },
  { id: 'premierbet', name: 'Premier Bet', shortName: 'PB', margin: 0.067, licence: 'NLRC', naira: true, colour: '#e6007e', rating: 4.0 }
];

/* ── Data source registry ────────────────────────────────────────────────── */

const src = (
  id: string,
  name: string,
  kind: DataSource['kind'],
  url: string,
  sport: DataSource['sport'],
  status: DataSource['status'],
  coverage: number,
  markets: number,
  latencyMs: number,
  reliability: number,
  requiresKey: boolean,
  note: string,
  recordsToday = 0
): DataSource => ({
  id,
  name,
  kind,
  url,
  sport,
  status,
  coverage,
  markets,
  latencyMs,
  lastChecked: new Date(Date.now() - Math.round(latencyMs * 3.4)).toISOString(),
  recordsToday,
  reliability,
  requiresKey,
  note
});

export const DATA_SOURCES: DataSource[] = [
  src('odds-harvester', 'OddsHarvester (OddsPortal)', 'repo', 'https://github.com/jordantete/OddsHarvester', 'multi', 'healthy', 92, 48, 1840, 0.96, false, 'Historical + in-play odds snapshots, 1X2, totals, handicaps, correct score and community tips.', 14620),
  src('bet365-scraper', 'bet365-scraper', 'repo', 'https://github.com/cvidan/bet365-scraper', 'multi', 'degraded', 64, 22, 4120, 0.81, false, 'Selenium collector for bet365 pre-match markets. Slower and more brittle than the API sources.', 2840),
  src('oddshub', 'oddshub', 'repo', 'https://github.com/dos-2/oddshub', 'multi', 'healthy', 88, 36, 1260, 0.93, false, 'Multi-sport odds aggregation across football, basketball, tennis, hockey, baseball, golf and MMA.', 9310),
  src('nba-ml', 'NBA Machine Learning Sports Betting', 'repo', 'https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting', 'basketball', 'healthy', 95, 14, 940, 0.95, false, 'NBA feature pipeline, neural network + XGBoost models and Flask reporting patterns.', 1820),
  src('sports-betting-py', 'sports-betting (georgedouzas)', 'repo', 'https://github.com/georgedouzas/sports-betting', 'football', 'healthy', 90, 18, 1120, 0.96, false, 'Scikit-learn model registry, backtesting, value-bet generation and MCP server interface.', 4620),
  src('sports-betting-fr', 'Sports-betting (pretrehr)', 'repo', 'https://github.com/pretrehr/Sports-betting', 'football', 'healthy', 71, 12, 1510, 0.9, false, 'Free-bet and bonus conversion mathematics, arbitrage combinations and staking optimisation.', 640),
  src('wagerbrain', 'WagerBrain', 'repo', 'https://github.com/sedemmler/WagerBrain', 'multi', 'healthy', 84, 20, 1180, 0.92, false, 'Odds conversion, vig removal, Kelly staking, Poisson and implied-probability utilities.', 2210),
  src('penaltyblog', 'penaltyblog', 'repo', 'https://github.com/martineastwood/penaltyblog', 'football', 'healthy', 94, 26, 880, 0.97, false, 'Dixon-Coles, Poisson, Elo, xG and football data loaders used as a modelling reference.', 5140),
  src('lets-bet', 'lets-bet', 'repo', 'https://github.com/nutcas3/lets-bet', 'multi', 'healthy', 76, 30, 1620, 0.91, false, 'Production betting-engine architecture: wallets, settlement, risk, compliance and observability.', 980),
  src('nba-ai', 'NBA_AI', 'repo', 'https://github.com/NBA-Betting/NBA_AI', 'basketball', 'healthy', 91, 16, 1310, 0.94, false, 'Deep-learning + traditional ensemble for NBA spreads and totals with explainability dashboard.', 3120),
  src('databall', 'databall', 'repo', 'https://github.com/klane/databall', 'basketball', 'planned', 58, 10, 2020, 0.86, false, 'NBA lineup, pace and four-factor analysis patterns for pre-game modelling.', 0),
  src('sportsbook', 'sports-betting-sportsbook', 'repo', 'https://github.com/elonbiz/sports-betting-sportsbook', 'multi', 'healthy', 68, 34, 1440, 0.89, false, 'Sportsbook back-office, wallet, bonus and cashier workflow patterns (reference only).', 0),
  src('prophitbet', 'ProphitBet v3', 'repo', 'https://github.com/kochlisGit/ProphitBet-Soccer-Bets-Predictor', 'football', 'healthy', 89, 24, 1580, 0.93, false, 'Soccer prediction GUI patterns: form matrices, graph visualisations and bet recommendation.', 3410),
  src('sports-predictor', 'Sports-Predictor', 'repo', 'https://github.com/anthonyevans29/Sports-Predictor', 'multi', 'healthy', 72, 18, 1690, 0.9, false, 'Agent-orchestrated prediction chains with source-of-truth reconciliation.', 760),
  src('baseball-predictions', 'baseball-predictions', 'repo', 'https://github.com/gmalbert/baseball-predictions', 'baseball', 'healthy', 82, 12, 1870, 0.91, false, 'MLB daily predictions, live odds, backtests and bankroll charts.', 1240),
  src('betting-analytics', 'sports-betting-analytics', 'repo', 'https://github.com/JonJonz7/sports-betting-analytics', 'football', 'healthy', 87, 16, 1230, 0.94, false, 'Walk-forward NFL model-vs-market edge analysis and calibration reporting.', 540),
  src('sportbook', 'Sportbook', 'repo', 'https://github.com/openbookie/sportbook', 'football', 'planned', 44, 8, 2400, 0.78, false, 'Open bookmaker ledger and market-settlement reference patterns.', 0),
  src('btfstats', 'btfstats.com', 'scraper', 'https://btfstats.com', 'football', 'healthy', 86, 18, 2100, 0.9, false, 'Team form, xG and statistical previews used to enrich the feature store.', 2480),
  src('packball', 'packball.com', 'scraper', 'https://packball.com/en/matches', 'football', 'healthy', 81, 22, 2260, 0.88, false, 'Fixture list, live score and market snapshot collector.', 3190),
  src('redscores', 'redscores.com', 'scraper', 'https://redscores.com/football-predictions', 'football', 'healthy', 84, 20, 2380, 0.87, false, 'Consensus prediction percentages and tipster confidence for model comparison.', 4060),
  src('sports-iq', 'sports-iq.co.uk', 'scraper', 'https://sports-iq.co.uk', 'football', 'degraded', 62, 16, 3120, 0.82, false, 'Advanced football analytics and matchup ratings; occasional challenge pages.', 720),
  src('sbostats', 'sbostats.com', 'scraper', 'https://www.sbostats.com/partite', 'football', 'healthy', 79, 24, 2640, 0.86, false, 'Bookmaker odds movement and market comparison snapshots.', 2860),
  src('statschecker', 'statschecker.com', 'scraper', 'https://www.statschecker.com', 'multi', 'healthy', 83, 30, 2410, 0.87, false, 'Multi-sport team statistics, streaks and encounter history.', 3380),
  src('tennisbrain', 'tennisbrain.com', 'scraper', 'https://www.tennisbrain.com/predictions', 'tennis', 'healthy', 88, 12, 1980, 0.89, false, 'Tennis match win probabilities, surface form and set-market signals.', 1820),
  src('progsport', 'progsport.com', 'scraper', 'https://www.progsport.com', 'football', 'degraded', 58, 14, 3280, 0.8, false, 'Statistical football forecasts. Rate-limited; collected on a slower cadence.', 460),
  src('forebet', 'forebet.com', 'scraper', 'https://www.forebet.com/en/basketball/predictions-today', 'basketball', 'healthy', 77, 12, 2760, 0.84, false, 'Basketball probability forecasts and correct-score style distributions.', 1440),
  src('api-football', 'API-Football', 'api', 'https://www.api-football.com', 'football', 'needs-key', 97, 52, 420, 0.98, true, 'Fixtures, lineups, injuries, live events and odds. Add API_FOOTBALL_KEY to activate.', 0),
  src('sportsdb', 'TheSportsDB', 'api', 'https://www.thesportsdb.com', 'multi', 'needs-key', 90, 12, 510, 0.95, true, 'Team badges, venues, schedules and league metadata.', 0),
  src('odds-api', 'The Odds API', 'api', 'https://the-odds-api.com', 'multi', 'needs-key', 94, 60, 380, 0.97, true, 'Bookmaker odds feed with movement history. Add THE_ODDS_API_KEY.', 0),
  src('balldontlie', 'BallDontLie', 'api', 'https://www.balldontlie.io', 'basketball', 'needs-key', 92, 10, 460, 0.95, true, 'NBA box scores and advanced player availability.', 0),
  src('tennis-api', 'Tennis API', 'api', 'https://www.tennis-data.co.uk', 'tennis', 'planned', 80, 12, 600, 0.9, true, 'Historical ATP/WTA results, prices and ranking data.', 0),
  src('internal-engine', 'CaveBettor Intelligence Engine', 'internal', '/api/engine', 'multi', 'healthy', 100, 84, 82, 0.99, false, 'Deterministic ensemble, calibration, staking and self-training pipeline running in-app.', 24880)
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceNgn: 0,
    interval: 'month',
    tagline: 'Explore the intelligence',
    features: ['Today’s fixtures and public model probabilities', '3 leagues tracked', 'Basic odds comparison', 'Paper bankroll — ₦50,000', 'Community insights'],
    limits: { watchlists: 1, apiCalls: 250, seats: 1, llmReports: 3 },
    featured: false
  },
  {
    id: 'pro',
    name: 'CaveBettor Pro',
    priceNgn: 5000,
    interval: 'month',
    tagline: 'Everything. Every market. Every sport.',
    features: [
      'All 20 leagues, 5 sports and 84 markets',
      'Full value-edge engine and Kelly staking',
      'Live in-play probabilities and odds movement',
      'Self-training model registry and calibration',
      'LLM match analyst and daily briefings',
      'Scraper control room and API keys',
      'Unlimited watchlists and paper bankroll',
      'Up to 5 analyst seats with a shared workspace, notes and decision log',
      'Custom model retraining windows',
      'Webhook and CSV exports',
      'Priority data-source slots',
      'Role-based access and audit trail',
      'API access — 100,000 calls / month'
    ],
    limits: { watchlists: 999, apiCalls: 100000, seats: 5, llmReports: 5000 },
    featured: true
  },
  {
    id: 'owner',
    name: 'Owner Access',
    priceNgn: 0,
    interval: 'forever',
    tagline: 'Free forever — the whole platform and the admin console',
    features: [
      'Every league, sport and market, with no usage ceiling',
      'Admin console, shortlist boards and provider controls',
      'Model registry, calibration and retraining windows',
      'All future releases included for life'
    ],
    limits: { watchlists: 9999, apiCalls: 1000000, seats: 25, llmReports: 100000 },
    featured: false
  },
];

export const DEMO_USER: UserProfile = {
  id: 'usr_demo_001',
  name: 'Omale Danjuma',
  email: 'omale@cavebettor.ng',
  role: 'owner',
  plan: SUBSCRIPTION_PLANS[1],
  planStatus: 'active',
  renewsAt: new Date(Date.now() + 18 * 864e5).toISOString(),
  workspace: 'Lagos Value Desk',
  timezone: 'Africa/Lagos',
  currency: 'NGN',
  avatar: 'OD',
  createdAt: new Date(Date.now() - 214 * 864e5).toISOString()
};

/* ── Model registry ──────────────────────────────────────────────────────── */

const calibration = [
  { bucket: '50–60%', predicted: 0.55, observed: 0.548, count: 812 },
  { bucket: '60–70%', predicted: 0.65, observed: 0.641, count: 686 },
  { bucket: '70–80%', predicted: 0.75, observed: 0.756, count: 472 },
  { bucket: '80–90%', predicted: 0.85, observed: 0.839, count: 248 },
  { bucket: '90–100%', predicted: 0.95, observed: 0.944, count: 96 }
];

const importance = (pairs: [string, number][]) => pairs.map(([name, weight]) => ({ name, weight }));

export const MODELS: ModelVersion[] = [
  {
    id: 'mdl_dixon_coles',
    name: 'Dixon–Coles Bivariate Poisson',
    family: 'statistical',
    sport: 'football',
    version: '3.4.1',
    status: 'production',
    accuracy: 0.581,
    logLoss: 0.912,
    brier: 0.176,
    roi: 4.8,
    sampleSize: 41280,
    trainedAt: new Date(Date.now() - 2 * 3600e3).toISOString(),
    features: 38,
    drift: 0.012,
    calibration,
    featureImportance: importance([['Rolling xG for', 0.21], ['Rolling xG against', 0.18], ['Home advantage', 0.14], ['Rest days', 0.11], ['Opponent Elo', 0.1], ['Set-piece xG', 0.08], ['Lineup strength', 0.07], ['Travel distance', 0.05], ['Referee card rate', 0.03], ['Weather', 0.03]]),
    description: 'Low-score corrected Poisson model estimated with exponential time decay. Core baseline for every football market.'
  },
  {
    id: 'mdl_elo',
    name: 'Dynamic Elo + Surface Rating',
    family: 'statistical',
    sport: 'multi',
    version: '2.9.0',
    status: 'production',
    accuracy: 0.684,
    logLoss: 0.621,
    brier: 0.142,
    roi: 3.6,
    sampleSize: 86420,
    trainedAt: new Date(Date.now() - 9 * 3600e3).toISOString(),
    features: 16,
    drift: 0.008,
    calibration,
    featureImportance: importance([['Elo difference', 0.34], ['Surface adjustment', 0.19], ['Recent form', 0.16], ['Head-to-head', 0.11], ['Fatigue index', 0.1], ['Home court', 0.1]]),
    description: 'Cross-sport rating engine with sport-specific K-factors, surface and travel adjustments for tennis.'
  },
  {
    id: 'mdl_gbm',
    name: 'CaveBoost Gradient Ensemble',
    family: 'machine-learning',
    sport: 'multi',
    version: '5.1.2',
    status: 'production',
    accuracy: 0.612,
    logLoss: 0.884,
    brier: 0.169,
    roi: 6.2,
    sampleSize: 128400,
    trainedAt: new Date(Date.now() - 43 * 60e3).toISOString(),
    features: 142,
    drift: 0.021,
    calibration,
    featureImportance: importance([['Market-implied probability', 0.27], ['xG differential (10)', 0.16], ['Elo differential', 0.14], ['Availability index', 0.11], ['Pace / possessions', 0.09], ['Rest differential', 0.08], ['Travel + altitude', 0.06], ['Umpire / referee', 0.05], ['Weather', 0.04]]),
    description: 'Gradient-boosted trees trained per sport family with monotonic market priors and early stopping.'
  },
  {
    id: 'mdl_sequence',
    name: 'Temporal Sequence Net',
    family: 'machine-learning',
    sport: 'football',
    version: '1.8.0',
    status: 'shadow',
    accuracy: 0.596,
    logLoss: 0.901,
    brier: 0.171,
    roi: 5.1,
    sampleSize: 38620,
    trainedAt: new Date(Date.now() - 6 * 3600e3).toISOString(),
    features: 96,
    drift: 0.034,
    calibration,
    featureImportance: importance([['Sequence xG trend', 0.24], ['In-play momentum', 0.2], ['Lineup embedding', 0.17], ['Fatigue sequence', 0.13], ['Opponent press profile', 0.12], ['Set-piece sequence', 0.08], ['Market drift', 0.06]]),
    description: 'GRU over the last 12 matches with attention pooling. Runs in shadow mode until it beats the ensemble for 6 weeks.'
  },
  {
    id: 'mdl_market',
    name: 'Consensus Market Prior',
    family: 'market',
    sport: 'multi',
    version: '4.0.3',
    status: 'production',
    accuracy: 0.701,
    logLoss: 0.592,
    brier: 0.134,
    roi: 0,
    sampleSize: 284000,
    trainedAt: new Date(Date.now() - 12 * 60e3).toISOString(),
    features: 12,
    drift: 0.004,
    calibration,
    featureImportance: importance([['Closing price', 0.48], ['Opening price', 0.22], ['Best available price', 0.16], ['Market volume proxy', 0.09], ['Book count', 0.05]]),
    description: 'Vig-free consensus of eight bookmakers. Anchors the ensemble so the model never drifts far from the crowd.'
  },
  {
    id: 'mdl_hockey',
    name: 'NHL Shot-Volume Model',
    family: 'machine-learning',
    sport: 'icehockey',
    version: '2.2.0',
    status: 'production',
    accuracy: 0.594,
    logLoss: 0.932,
    brier: 0.181,
    roi: 5.4,
    sampleSize: 18240,
    trainedAt: new Date(Date.now() - 14 * 3600e3).toISOString(),
    features: 64,
    drift: 0.017,
    calibration,
    featureImportance: importance([['Expected goals share', 0.24], ['Save % (10)', 0.21], ['Power-play rate', 0.16], ['Goalie rest', 0.12], ['Shot volume', 0.11], ['Travel', 0.09], ['Back-to-back flag', 0.07]]),
    description: 'Shot-based hockey model with goalie and special-teams adjustments; produces 60-minute 1X2 and puck-line edges.'
  },
  {
    id: 'mdl_baseball',
    name: 'MLB Run-Environment Model',
    family: 'machine-learning',
    sport: 'baseball',
    version: '3.0.1',
    status: 'production',
    accuracy: 0.577,
    logLoss: 0.948,
    brier: 0.188,
    roi: 4.2,
    sampleSize: 24680,
    trainedAt: new Date(Date.now() - 20 * 3600e3).toISOString(),
    features: 78,
    drift: 0.022,
    calibration,
    featureImportance: importance([['Starting pitcher xFIP', 0.26], ['Bullpen fatigue', 0.18], ['Park factor', 0.15], ['Lineup wRC+', 0.14], ['Weather / wind', 0.11], ['Umpire zone', 0.08], ['Rest', 0.08]]),
    description: 'Pitcher-led run distribution model with park and weather adjustments for moneyline, run line and totals.'
  },
  {
    id: 'mdl_llm',
    name: 'CaveBettor Match Analyst (LLM)',
    family: 'llm',
    sport: 'multi',
    version: '1.4.0',
    status: 'production',
    accuracy: 0,
    logLoss: 0,
    brier: 0,
    roi: 0,
    sampleSize: 0,
    trainedAt: new Date(Date.now() - 30 * 60e3).toISOString(),
    features: 0,
    drift: 0,
    calibration: [],
    featureImportance: [],
    description: 'Retrieval-augmented analyst that turns verified numbers into plain-English reasoning. It never invents probabilities; all figures come from the numeric ensemble.'
  }
];

export const MODEL_MAP = Object.fromEntries(MODELS.map((m) => [m.id, m])) as Record<string, ModelVersion>;
