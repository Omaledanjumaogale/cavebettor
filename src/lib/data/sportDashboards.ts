import type { MarketGroup, SportId } from '#lib/types';

/**
 * Sport dashboards.
 *
 * Every sport gets its own operating view: its own engine description, its
 * own headline metrics, its own market vocabulary and its own competition
 * set. NBA is separated from the wider basketball family because it runs on
 * a different provider host (v2.nba.api-sports.io), a different pace regime
 * and a different calendar.
 */

export interface SportDashboardDef {
  /** Route segment. */
  id: string;
  /** Underlying engine sport. */
  sport: SportId;
  name: string;
  icon: string;
  accent: string;
  tagline: string;
  /** Competitions covered by this dashboard. */
  leagueIds: string[];
  /** Provider host family used for collection. */
  providerHost: string;
  /** Engine identity shown on the dashboard. */
  engine: { name: string; version: string; family: string; settlements: string };
  /** Headline metric definitions, evaluated against the live board. */
  metrics: { id: string; label: string; hint: string; tone: 'mint' | 'lime' | 'sky' | 'amber' | 'rose' }[];
  /** Markets that are the primary surface for this sport. */
  primaryMarkets: { id: string; label: string; group: MarketGroup }[];
  /** Secondary markets listed below the primary ones. */
  secondaryMarkets: { id: string; label: string; group: MarketGroup }[];
  /** Form fields used by the sport-appropriate stat board. */
  statBoard: { id: string; label: string; hint: string; better: 'higher' | 'lower' }[];
  /** Advice shown in the "how we model this" panel. */
  modelling: string[];
  /** Settlement and data notes surfaced to the user. */
  notes: string[];
}

export const SPORT_DASHBOARDS: SportDashboardDef[] = [
  {
    id: 'football',
    sport: 'football',
    name: 'Football',
    icon: '⚽',
    accent: '#c9ff4d',
    tagline: 'Dixon–Coles goal models, market-anchored edges and Asian handicap settlement.',
    leagueIds: ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'ucl', 'npfl', 'championship', 'eredivisie', 'saudi'],
    providerHost: 'v3.football.api-sports.io',
    engine: {
      name: 'Dixon–Coles bivariate Poisson + CaveBoost GBM',
      version: 'football-v7.3',
      family: 'Goal-generating process with a low-score correction',
      settlements: '90 minutes plus stoppage time; overtime excluded from league markets'
    },
    metrics: [
      { id: 'fixtures', label: 'Fixtures', hint: 'Matches in the football universe', tone: 'lime' },
      { id: 'live', label: 'Live now', hint: 'Matches in progress', tone: 'mint' },
      { id: 'confidence', label: 'Avg confidence', hint: 'Mean ensemble confidence', tone: 'sky' },
      { id: 'value', label: 'Value picks', hint: 'Selections clearing the 2.5% edge threshold', tone: 'amber' },
      { id: 'edge', label: 'Best edge', hint: 'Largest positive edge available', tone: 'mint' },
      { id: 'markets', label: 'Markets priced', hint: 'Distinct football markets on the board', tone: 'sky' }
    ],
    primaryMarkets: [
      { id: '1x2', label: 'Match result (1X2)', group: 'match' },
      { id: 'ah', label: 'Asian handicap', group: 'handicap' },
      { id: 'ou25', label: 'Total goals 2.5', group: 'totals' },
      { id: 'btts', label: 'Both teams to score', group: 'totals' },
      { id: 'cs', label: 'Correct score', group: 'score' }
    ],
    secondaryMarkets: [
      { id: 'dc', label: 'Double chance', group: 'match' },
      { id: 'dnb', label: 'Draw no bet', group: 'match' },
      { id: 'ht', label: 'Half-time result', group: 'period' },
      { id: 'ou15', label: 'Total goals 1.5', group: 'totals' },
      { id: 'ou35', label: 'Total goals 3.5', group: 'totals' },
      { id: 'ah15', label: 'Asian handicap 1.5', group: 'handicap' }
    ],
    statBoard: [
      { id: 'xg', label: 'Expected goals', hint: 'Projected goals per side', better: 'higher' },
      { id: 'shots', label: 'Shots', hint: 'Attempts per side', better: 'higher' },
      { id: 'possession', label: 'Possession', hint: 'Ball share', better: 'higher' },
      { id: 'btts', label: 'BTTS probability', hint: 'Both sides to score', better: 'higher' },
      { id: 'goals', label: 'Goal environment', hint: 'Projected combined goals', better: 'lower' }
    ],
    modelling: [
      'Low-score correction is applied to the goal matrix so 0-0, 1-0 and 1-1 are not underpriced.',
      'Asian handicap outcomes are de-vigged with pushes removed from the denominator.',
      'Draw probability is boosted in cups and low-league fixtures where the market prior is thin.',
      'Weather and venue are folded into the totals leg rather than the result leg.'
    ],
    notes: [
      'Results settle on regulation time only.',
      'Correct-score prices are indicative — the model list is truncated to the top scorelines.',
      'Handicap pushes return the stake.'
    ]
  },
  {
    id: 'basketball',
    sport: 'basketball',
    name: 'Basketball',
    icon: '🏀',
    accent: '#ff9f45',
    tagline: 'Margin and total modelled separately, with pace and offensive rating in the blend.',
    leagueIds: ['euroleague', 'nbbl'],
    providerHost: 'v1.basketball.api-sports.io',
    engine: {
      name: 'Normal margin + pace/rating regression',
      version: 'basketball-v4.1',
      family: 'Margin and total modelled as separate normal distributions',
      settlements: 'Regulation plus overtime; a draw is impossible'
    },
    metrics: [
      { id: 'fixtures', label: 'Fixtures', hint: 'Matches in the basketball universe', tone: 'lime' },
      { id: 'live', label: 'Live now', hint: 'Matches in progress', tone: 'mint' },
      { id: 'confidence', label: 'Avg confidence', hint: 'Mean ensemble confidence', tone: 'sky' },
      { id: 'value', label: 'Value picks', hint: 'Selections clearing the 2.5% edge threshold', tone: 'amber' },
      { id: 'edge', label: 'Best edge', hint: 'Largest positive edge available', tone: 'mint' },
      { id: 'markets', label: 'Markets priced', hint: 'Distinct basketball markets on the board', tone: 'sky' }
    ],
    primaryMarkets: [
      { id: 'ml', label: 'Moneyline', group: 'match' },
      { id: 'spread', label: 'Points spread', group: 'handicap' },
      { id: 'total', label: 'Total points', group: 'totals' },
      { id: 'teamtotal-home', label: 'Home team total', group: 'totals' },
      { id: 'margin', label: 'Winning margin', group: 'score' }
    ],
    secondaryMarkets: [
      { id: 'teamtotal-away', label: 'Away team total', group: 'totals' },
      { id: 'totalband', label: 'Total points band', group: 'score' }
    ],
    statBoard: [
      { id: 'points', label: 'Projected points', hint: 'Full-game scoring including overtime', better: 'higher' },
      { id: 'pace', label: 'Pace', hint: 'Possessions per 48 minutes', better: 'higher' },
      { id: 'spread', label: 'Model margin', hint: 'Projected point difference', better: 'higher' },
      { id: 'total', label: 'Total line', hint: 'Combined points line', better: 'lower' },
      { id: 'rating', label: 'Offensive rating', hint: 'Points per 100 possessions', better: 'higher' }
    ],
    modelling: [
      'Margin and combined total are modelled separately and then reconciled.',
      'Point spread outcomes remove the push case instead of paying it out.',
      'Team totals use each side’s own scoring distribution, not a share of the game total.',
      'Rest days and travel are visible to the ensemble as pace modifiers.'
    ],
    notes: [
      'All markets include overtime.',
      'Spread pushes return the stake.',
      'EuroLeague and NBBF use a lower scoring baseline than the NBA.'
    ]
  },
  {
    id: 'nba',
    sport: 'basketball',
    name: 'NBA',
    icon: '🏀',
    accent: '#ff7a45',
    tagline: 'Dedicated NBA desk: league-specific pace, three-point volume and rest-day rotation effects.',
    leagueIds: ['nba'],
    providerHost: 'v2.nba.api-sports.io',
    engine: {
      name: 'NBA margin model with pace and rotation adjustment',
      version: 'nba-v2.6',
      family: 'Margin/total normals with a higher pace regime and rest-day priors',
      settlements: 'Regulation plus overtime; a draw is impossible'
    },
    metrics: [
      { id: 'fixtures', label: 'NBA games', hint: 'Games on the NBA slate', tone: 'lime' },
      { id: 'live', label: 'Live now', hint: 'Games in progress', tone: 'mint' },
      { id: 'pace', label: 'League pace', hint: 'Possessions per 48 minutes', tone: 'sky' },
      { id: 'value', label: 'Value picks', hint: 'NBA selections clearing the edge threshold', tone: 'amber' },
      { id: 'edge', label: 'Best edge', hint: 'Largest positive edge available', tone: 'mint' },
      { id: 'markets', label: 'Markets priced', hint: 'Distinct NBA markets on the board', tone: 'sky' }
    ],
    primaryMarkets: [
      { id: 'ml', label: 'Moneyline', group: 'match' },
      { id: 'spread', label: 'Points spread', group: 'handicap' },
      { id: 'total', label: 'Total points', group: 'totals' },
      { id: 'teamtotal-home', label: 'Home team total', group: 'totals' },
      { id: 'margin', label: 'Winning margin', group: 'score' }
    ],
    secondaryMarkets: [
      { id: 'teamtotal-away', label: 'Away team total', group: 'totals' },
      { id: 'totalband', label: 'Total points band', group: 'score' }
    ],
    statBoard: [
      { id: 'points', label: 'Projected points', hint: 'Full-game scoring including overtime', better: 'higher' },
      { id: 'pace', label: 'Pace', hint: 'Possessions per 48 minutes', better: 'higher' },
      { id: 'spread', label: 'Model margin', hint: 'Projected point difference', better: 'higher' },
      { id: 'total', label: 'Total line', hint: 'Combined points line', better: 'lower' },
      { id: 'rating', label: 'Offensive rating', hint: 'Points per 100 possessions', better: 'higher' }
    ],
    modelling: [
      'The NBA baseline scoring environment (roughly 112 points per side) is used instead of the European one.',
      'Margin dispersion is widened to reflect deeper rotations and late-game garbage time.',
      'Back-to-back sets and three-in-four schedules move the pace prior before the market is consulted.',
      'The market prior carries more weight in the NBA because the closing line is consistently sharp.'
    ],
    notes: [
      'All markets include overtime.',
      'Collection uses the dedicated NBA provider host.',
      'Spread pushes return the stake.'
    ]
  },
  {
    id: 'icehockey',
    sport: 'icehockey',
    name: 'Ice Hockey',
    icon: '🏒',
    accent: '#a8b6ff',
    tagline: 'Shot-volume Poisson with goalie adjustment — regulation and overtime priced separately.',
    leagueIds: ['nhl', 'shl'],
    providerHost: 'v1.hockey.api-sports.io',
    engine: {
      name: 'Shot-volume Poisson + goalie adjustment',
      version: 'hockey-v3.4',
      family: 'Regulation goal process with starter-adjusted save percentage',
      settlements: 'Three-way markets settle on 60 minutes; moneyline includes overtime and shootout'
    },
    metrics: [
      { id: 'fixtures', label: 'Fixtures', hint: 'Games in the hockey universe', tone: 'lime' },
      { id: 'live', label: 'Live now', hint: 'Games in progress', tone: 'mint' },
      { id: 'confidence', label: 'Avg confidence', hint: 'Mean ensemble confidence', tone: 'sky' },
      { id: 'value', label: 'Value picks', hint: 'Selections clearing the 2.5% edge threshold', tone: 'amber' },
      { id: 'edge', label: 'Best edge', hint: 'Largest positive edge available', tone: 'mint' },
      { id: 'markets', label: 'Markets priced', hint: 'Distinct hockey markets on the board', tone: 'sky' }
    ],
    primaryMarkets: [
      { id: '1x2', label: '60-minute result', group: 'match' },
      { id: 'ml', label: 'Moneyline incl. OT', group: 'match' },
      { id: 'puck', label: 'Puck line', group: 'handicap' },
      { id: 'total', label: 'Total goals', group: 'totals' },
      { id: 'teamtotal-home', label: 'Home team total', group: 'totals' }
    ],
    secondaryMarkets: [
      { id: 'teamtotal-away', label: 'Away team total', group: 'totals' },
      { id: 'totalexact', label: 'Total goals — exact', group: 'totals' }
    ],
    statBoard: [
      { id: 'xg', label: 'Expected goals', hint: 'Shot-quality weighted goals', better: 'higher' },
      { id: 'shots', label: 'Shots', hint: 'Shot volume at 5v5 and special teams', better: 'higher' },
      { id: 'save', label: 'Goalie save %', hint: 'Starter-adjusted save percentage', better: 'higher' },
      { id: 'pp', label: 'Power play', hint: 'Conversion rate', better: 'higher' },
      { id: 'total', label: 'Goal environment', hint: 'Projected regulation goals', better: 'lower' }
    ],
    modelling: [
      'Regulation goals follow a Poisson process driven by shot quality rather than raw shot volume.',
      'The starting goalie’s adjusted save percentage is applied before the outcome distribution is built.',
      'Tied games split into an overtime/shootout branch for the moneyline, while three-way markets stay on regulation.',
      'The puck line uses the final score, including overtime.'
    ],
    notes: [
      'Three-way markets settle after 60 minutes.',
      'Moneyline includes overtime and shootout.',
      'The puck line settles on the final score.'
    ]
  },
  {
    id: 'baseball',
    sport: 'baseball',
    name: 'Baseball',
    icon: '⚾',
    accent: '#ff7d9c',
    tagline: 'Pitcher-led run environment with park factors and first-five-inning markets.',
    leagueIds: ['mlb', 'npb'],
    providerHost: 'v1.baseball.api-sports.io',
    engine: {
      name: 'Run-environment Poisson + pitcher xFIP',
      version: 'baseball-v3.0',
      family: 'Half-inning run process with starter and bullpen run prevention',
      settlements: 'Nine innings; extra innings break any tie'
    },
    metrics: [
      { id: 'fixtures', label: 'Fixtures', hint: 'Games in the baseball universe', tone: 'lime' },
      { id: 'live', label: 'Live now', hint: 'Games in progress', tone: 'mint' },
      { id: 'confidence', label: 'Avg confidence', hint: 'Mean ensemble confidence', tone: 'sky' },
      { id: 'value', label: 'Value picks', hint: 'Selections clearing the 2.5% edge threshold', tone: 'amber' },
      { id: 'edge', label: 'Best edge', hint: 'Largest positive edge available', tone: 'mint' },
      { id: 'markets', label: 'Markets priced', hint: 'Distinct baseball markets on the board', tone: 'sky' }
    ],
    primaryMarkets: [
      { id: 'ml', label: 'Moneyline', group: 'match' },
      { id: 'runline', label: 'Run line', group: 'handicap' },
      { id: 'total', label: 'Total runs', group: 'totals' },
      { id: 'teamtotal-home', label: 'Home team total', group: 'totals' },
      { id: 'f5', label: 'First 5 innings', group: 'period' }
    ],
    secondaryMarkets: [
      { id: 'teamtotal-away', label: 'Away team total', group: 'totals' },
      { id: 'totalexact', label: 'Total runs — exact', group: 'totals' }
    ],
    statBoard: [
      { id: 'runs', label: 'Projected runs', hint: 'Full-game run expectancy', better: 'higher' },
      { id: 'starter', label: 'Starter xFIP', hint: 'Starting pitcher run prevention', better: 'lower' },
      { id: 'bullpen', label: 'Bullpen ERA', hint: 'Relief run prevention', better: 'lower' },
      { id: 'park', label: 'Park factor', hint: 'Run environment at the venue', better: 'lower' },
      { id: 'total', label: 'Run environment', hint: 'Combined runs line', better: 'lower' }
    ],
    modelling: [
      'Each half-inning is a separate run-scoring step, so late-inning leverage is represented.',
      'Starting pitcher xFIP and bullpen run prevention are applied before the run expectation is formed.',
      'Park factors adjust the venue’s run environment in both directions.',
      'First-five markets stop before the bullpen game, so they use a different starter-only distribution.'
    ],
    notes: [
      'Games settle after nine innings; extra innings break a tie.',
      'The run line uses the final score.',
      'First-five markets settle before the bullpen game.'
    ]
  }
];

export const SPORT_DASHBOARD_MAP = Object.fromEntries(
  SPORT_DASHBOARDS.map((d) => [d.id, d])
) as Record<string, SportDashboardDef>;

export function sportDashboard(id: string): SportDashboardDef | undefined {
  return SPORT_DASHBOARD_MAP[id];
}
