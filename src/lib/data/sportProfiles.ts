import type { MarketGroup, SportId } from '#lib/types';

export interface SportProfile {
  id: SportId;
  name: string;
  icon: string;
  accent: string;
  scoreUnit: 'goals' | 'points' | 'runs' | 'games' | 'sets';
  scoreUnitPlural: string;
  scoreLabel: string;
  totalLabel: string;
  spreadLabel: string;
  lineLabel: string;
  drawLabel: string | null;
  periodLabel: string;
  overtimeLabel: string;
  matchLabel: string;
  marketGroups: { id: MarketGroup | 'all'; label: string }[];
  markets: { id: string; label: string; group: MarketGroup }[];
  stats: { id: string; label: string; hint: string }[];
  backtest: {
    model: string;
    version: string;
    seasons: string;
    benchmark: string;
    settlement: string;
    description: string;
  };
  filters: {
    id: 'homeAway' | 'surface' | 'line' | 'venue';
    label: string;
    options: { value: string; label: string }[];
  }[];
}

const ALL_GROUPS: { id: MarketGroup | 'all'; label: string }[] = [
  { id: 'all', label: 'All markets' },
  { id: 'match', label: 'Match result' },
  { id: 'handicap', label: 'Handicap / line' },
  { id: 'totals', label: 'Totals' },
  { id: 'sets', label: 'Sets' },
  { id: 'score', label: 'Correct score' }
];

export const SPORT_PROFILES: SportProfile[] = [
  {
    id: 'football',
    name: 'Football',
    icon: '⚽',
    accent: '#c9ff4d',
    scoreUnit: 'goals',
    scoreUnitPlural: 'goals',
    scoreLabel: 'Expected goals',
    totalLabel: 'Total goals',
    spreadLabel: 'Asian handicap',
    lineLabel: 'Goal line',
    drawLabel: 'Draw',
    periodLabel: 'Half',
    overtimeLabel: 'Stoppage time',
    matchLabel: 'Full-time result',
    marketGroups: ALL_GROUPS,
    markets: [
      { id: '1x2', label: '1X2', group: 'match' },
      { id: 'dc', label: 'Double chance', group: 'match' },
      { id: 'dnb', label: 'Draw no bet', group: 'match' },
      { id: 'btts', label: 'Both teams to score', group: 'totals' },
      { id: 'ou15', label: 'Total goals 1.5', group: 'totals' },
      { id: 'ou25', label: 'Total goals 2.5', group: 'totals' },
      { id: 'ou35', label: 'Total goals 3.5', group: 'totals' },
      { id: 'ah', label: 'Asian handicap', group: 'handicap' },
      { id: 'cs', label: 'Correct score', group: 'score' }
    ],
    stats: [
      { id: 'xg', label: 'Expected goals', hint: 'Projected goals for each side' },
      { id: 'shots', label: 'Shots / on target', hint: 'Shot volume and accuracy' },
      { id: 'possession', label: 'Possession', hint: 'Share of the ball' },
      { id: 'btts', label: 'BTTS', hint: 'Both teams to score' },
      { id: 'goals', label: 'Goal environment', hint: 'Projected total goals' }
    ],
    backtest: {
      model: 'Dixon–Coles bivariate Poisson + CaveBoost',
      version: 'football-v7.3',
      seasons: '2023/24 – 2025/26 · 10 competitions',
      benchmark: 'Closing 1X2 market, vig removed',
      settlement: '90 minutes plus stoppage time; no extra time in league games',
      description: 'Low-score corrected goal matrix, Asian handicap settlement with pushes, BTTS and correct-score calibration.'
    },
    filters: [
      { id: 'homeAway', label: 'Side', options: [{ value: 'all', label: 'Home & away' }, { value: 'home', label: 'Home only' }, { value: 'away', label: 'Away only' }] },
      { id: 'venue', label: 'Venue effect', options: [{ value: 'all', label: 'All venues' }, { value: 'home', label: 'Home advantage' }, { value: 'neutral', label: 'Neutral' }] }
    ]
  },
  {
    id: 'basketball',
    name: 'Basketball',
    icon: '🏀',
    accent: '#ff9f45',
    scoreUnit: 'points',
    scoreUnitPlural: 'points',
    scoreLabel: 'Projected points',
    totalLabel: 'Total points',
    spreadLabel: 'Points spread',
    lineLabel: 'Point line',
    drawLabel: null,
    periodLabel: 'Quarter',
    overtimeLabel: 'Overtime',
    matchLabel: 'Moneyline',
    marketGroups: ALL_GROUPS.filter((g) => !['sets', 'score'].includes(g.id)),
    markets: [
      { id: 'ml', label: 'Moneyline', group: 'match' },
      { id: 'spread', label: 'Points spread', group: 'handicap' },
      { id: 'total', label: 'Total points', group: 'totals' },
      { id: 'teamtotal', label: 'Team total', group: 'totals' },
      { id: 'q1', label: 'First quarter', group: 'period' }
    ],
    stats: [
      { id: 'points', label: 'Projected points', hint: 'Full-game points including overtime' },
      { id: 'pace', label: 'Pace', hint: 'Possessions per 48 minutes' },
      { id: 'spread', label: 'Spread', hint: 'Model point margin' },
      { id: 'total', label: 'Total', hint: 'Combined points line' },
      { id: 'rating', label: 'Offensive rating', hint: 'Points per 100 possessions' }
    ],
    backtest: {
      model: 'Normal margin + pace/rating regression',
      version: 'basketball-v4.1',
      seasons: '2023/24 – 2025/26 · NBA, EuroLeague, NBBF',
      benchmark: 'Closing spread and total, vig removed',
      settlement: 'Regulation plus overtime; no draw is possible',
      description: 'Margin and total are modelled separately. Spread pushes are returned; team totals use each side’s own point distribution.'
    },
    filters: [
      { id: 'homeAway', label: 'Side', options: [{ value: 'all', label: 'Home & away' }, { value: 'home', label: 'Home only' }, { value: 'away', label: 'Away only' }] },
      { id: 'line', label: 'Spread band', options: [{ value: 'all', label: 'All spreads' }, { value: 'small', label: '0 to 4.5' }, { value: 'mid', label: '5 to 9.5' }, { value: 'large', label: '10+' }] }
    ]
  },
  {
    id: 'icehockey',
    name: 'Ice Hockey',
    icon: '🏒',
    accent: '#a8b6ff',
    scoreUnit: 'goals',
    scoreUnitPlural: 'goals',
    scoreLabel: 'Projected goals',
    totalLabel: 'Total goals',
    spreadLabel: 'Puck line',
    lineLabel: 'Puck line',
    drawLabel: 'Draw after 60 min',
    periodLabel: 'Period',
    overtimeLabel: 'Overtime / shootout',
    matchLabel: '60-minute result',
    marketGroups: ALL_GROUPS.filter((g) => !['sets', 'score'].includes(g.id)),
    markets: [
      { id: '1x2', label: '60-minute result', group: 'match' },
      { id: 'ml', label: 'Moneyline incl. OT', group: 'match' },
      { id: 'puck', label: 'Puck line', group: 'handicap' },
      { id: 'total', label: 'Total goals', group: 'totals' },
      { id: 'teamtotal', label: 'Team total', group: 'totals' },
      { id: 'p1', label: 'First period', group: 'period' }
    ],
    stats: [
      { id: 'xg', label: 'Expected goals', hint: 'Shot-quality weighted goals' },
      { id: 'shots', label: 'Shots', hint: 'Shot volume at 5v5 and special teams' },
      { id: 'save', label: 'Goalie save %', hint: 'Starter-adjusted save percentage' },
      { id: 'pp', label: 'Power play', hint: 'Conversion and chances' },
      { id: 'total', label: 'Goal environment', hint: 'Projected regulation goals' }
    ],
    backtest: {
      model: 'Shot-volume Poisson + goalie adjustment',
      version: 'hockey-v3.4',
      seasons: '2023/24 – 2025/26 · NHL and SHL',
      benchmark: 'Closing 60-minute and puck-line markets',
      settlement: 'Three-way market settles on 60 minutes; moneyline includes overtime and shootout',
      description: 'Regulation goals use a Poisson process. Tied games are resolved by an overtime/shootout winner, and the puck line uses the final score.'
    },
    filters: [
      { id: 'homeAway', label: 'Side', options: [{ value: 'all', label: 'Home & away' }, { value: 'home', label: 'Home only' }, { value: 'away', label: 'Away only' }] },
      { id: 'line', label: 'Puck line', options: [{ value: 'all', label: 'All lines' }, { value: '-1.5', label: 'Home −1.5' }, { value: '+1.5', label: 'Away +1.5' }] }
    ]
  },
  {
    id: 'baseball',
    name: 'Baseball',
    icon: '⚾',
    accent: '#ff7d9c',
    scoreUnit: 'runs',
    scoreUnitPlural: 'runs',
    scoreLabel: 'Projected runs',
    totalLabel: 'Total runs',
    spreadLabel: 'Run line',
    lineLabel: 'Run line',
    drawLabel: null,
    periodLabel: 'Inning',
    overtimeLabel: 'Extra innings',
    matchLabel: 'Moneyline',
    marketGroups: ALL_GROUPS.filter((g) => !['sets', 'score'].includes(g.id)),
    markets: [
      { id: 'ml', label: 'Moneyline', group: 'match' },
      { id: 'runline', label: 'Run line', group: 'handicap' },
      { id: 'total', label: 'Total runs', group: 'totals' },
      { id: 'f5', label: 'First 5 innings', group: 'period' },
      { id: 'teamtotal', label: 'Team total', group: 'totals' }
    ],
    stats: [
      { id: 'runs', label: 'Projected runs', hint: 'Full-game run expectancy' },
      { id: 'starter', label: 'Starter', hint: 'Starting pitcher run prevention' },
      { id: 'bullpen', label: 'Bullpen', hint: 'Relief run prevention' },
      { id: 'park', label: 'Park factor', hint: 'Run environment at the venue' },
      { id: 'total', label: 'Run environment', hint: 'Combined runs line' }
    ],
    backtest: {
      model: 'Run-environment Poisson + pitcher xFIP',
      version: 'baseball-v3.0',
      seasons: '2023 – 2025 · MLB and NPB',
      benchmark: 'Closing moneyline, run line and total',
      settlement: 'Nine innings; extra innings break any tie',
      description: 'Each half-inning is a run-scoring process. The run line uses the final score, and first-five markets settle before the bullpen game.'
    },
    filters: [
      { id: 'homeAway', label: 'Side', options: [{ value: 'all', label: 'Home & away' }, { value: 'home', label: 'Home only' }, { value: 'away', label: 'Away only' }] },
      { id: 'line', label: 'Run line', options: [{ value: 'all', label: 'All lines' }, { value: '-1.5', label: 'Home −1.5' }, { value: '+1.5', label: 'Away +1.5' }] }
    ]
  },
  {
    id: 'tennis',
    name: 'Tennis',
    icon: '🎾',
    accent: '#7bdcff',
    scoreUnit: 'sets',
    scoreUnitPlural: 'sets',
    scoreLabel: 'Projected sets',
    totalLabel: 'Total games',
    spreadLabel: 'Game handicap',
    lineLabel: 'Game line',
    drawLabel: null,
    periodLabel: 'Set',
    overtimeLabel: 'Tie-break',
    matchLabel: 'Match winner',
    marketGroups: ALL_GROUPS.filter((g) => !['score'].includes(g.id)),
    markets: [
      { id: 'ml', label: 'Match winner', group: 'match' },
      { id: 'sets', label: 'Correct set score', group: 'sets' },
      { id: 'games', label: 'Total games', group: 'totals' },
      { id: 'gamehcp', label: 'Game handicap', group: 'handicap' },
      { id: 'set1', label: 'First set winner', group: 'sets' }
    ],
    stats: [
      { id: 'hold', label: 'Hold %', hint: 'Service games held' },
      { id: 'break', label: 'Break %', hint: 'Return games won' },
      { id: 'serve', label: 'First-serve points', hint: 'Points won behind first serve' },
      { id: 'sets', label: 'Set spread', hint: 'Projected set margin' },
      { id: 'games', label: 'Total games', hint: 'Projected games in the match' }
    ],
    backtest: {
      model: 'Serve/return point model + set simulation',
      version: 'tennis-v2.8',
      seasons: '2023 – 2025 · ATP, WTA, Grand Slams',
      benchmark: 'Closing match winner, set and games markets',
      settlement: 'Best-of-three or best-of-five; final set tie-break where applicable',
      description: 'Points, holds and breaks are simulated to build set and game markets. Football goal models are never used for tennis.'
    },
    filters: [
      { id: 'homeAway', label: 'Player side', options: [{ value: 'all', label: 'Both players' }, { value: 'home', label: 'First listed' }, { value: 'away', label: 'Second listed' }] },
      { id: 'surface', label: 'Surface', options: [{ value: 'all', label: 'All surfaces' }, { value: 'hard', label: 'Hard' }, { value: 'clay', label: 'Clay' }, { value: 'grass', label: 'Grass' }, { value: 'indoor', label: 'Indoor' }] },
      { id: 'line', label: 'Match format', options: [{ value: 'all', label: 'All formats' }, { value: 'bo3', label: 'Best of 3' }, { value: 'bo5', label: 'Best of 5' }] }
    ]
  }
];

export const SPORT_PROFILE_MAP = Object.fromEntries(SPORT_PROFILES.map((p) => [p.id, p])) as Record<SportId, SportProfile>;

export function sportProfile(sport: SportId): SportProfile {
  return SPORT_PROFILE_MAP[sport];
}

export function scoreUnit(sport: SportId, plural = true): string {
  const p = SPORT_PROFILE_MAP[sport];
  return plural ? p.scoreUnitPlural : p.scoreUnit;
}
