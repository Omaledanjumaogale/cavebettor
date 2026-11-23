import { v } from 'convex/values';
import { internalMutation, mutation } from './_generated/server';

const SPORTS = [
  { key: 'football', name: 'Football', icon: '⚽', accent: '#c9ff4d', hasDraw: true },
  { key: 'basketball', name: 'Basketball', icon: '🏀', accent: '#ff9f45', hasDraw: false },
  { key: 'tennis', name: 'Tennis', icon: '🎾', accent: '#7bdcff', hasDraw: false },
  { key: 'icehockey', name: 'Ice Hockey', icon: '🏒', accent: '#a8b6ff', hasDraw: true },
  { key: 'baseball', name: 'Baseball', icon: '⚾', accent: '#ff7d9c', hasDraw: false }
];

const LEAGUES = [
  ['epl', 'Premier League', 'EPL', 'England', 'GB', 'football', 1, '#3d195b', 'PL'],
  ['laliga', 'La Liga', 'LaLiga', 'Spain', 'ES', 'football', 1, '#ee8707', 'LL'],
  ['seriea', 'Serie A', 'Serie A', 'Italy', 'IT', 'football', 1, '#0b6ab0', 'SA'],
  ['bundesliga', 'Bundesliga', 'BL', 'Germany', 'DE', 'football', 1, '#d20515', 'BL'],
  ['ligue1', 'Ligue 1', 'L1', 'France', 'FR', 'football', 1, '#091c3e', 'L1'],
  ['ucl', 'UEFA Champions League', 'UCL', 'Europe', 'EU', 'football', 1, '#0c2452', 'UCL'],
  ['npfl', 'Nigeria Premier Football League', 'NPFL', 'Nigeria', 'NG', 'football', 1, '#008751', 'NPFL'],
  ['championship', 'English Championship', 'EFL', 'England', 'GB', 'football', 2, '#1c3c78', 'EFL'],
  ['eredivisie', 'Eredivisie', 'ERE', 'Netherlands', 'NL', 'football', 1, '#ff6b00', 'ERE'],
  ['saudi', 'Saudi Pro League', 'SPL', 'Saudi Arabia', 'SA', 'football', 1, '#005c3c', 'SPL'],
  ['nba', 'NBA', 'NBA', 'United States', 'US', 'basketball', 1, '#c8102e', 'NBA'],
  ['euroleague', 'EuroLeague', 'EL', 'Europe', 'EU', 'basketball', 1, '#f36f21', 'EL'],
  ['nbbl', 'NBBF Premier League', 'NBBF', 'Nigeria', 'NG', 'basketball', 1, '#00a651', 'NBBF'],
  ['atp', 'ATP Masters 1000', 'ATP', 'World', 'INT', 'tennis', 1, '#1f6fb2', 'ATP'],
  ['wta', 'WTA 1000', 'WTA', 'World', 'INT', 'tennis', 1, '#8e2d86', 'WTA'],
  ['grandslam', 'Grand Slam', 'GS', 'World', 'INT', 'tennis', 1, '#b18b2b', 'GS'],
  ['nhl', 'National Hockey League', 'NHL', 'United States', 'US', 'icehockey', 1, '#0b1c33', 'NHL'],
  ['shl', 'Swedish Hockey League', 'SHL', 'Sweden', 'SE', 'icehockey', 1, '#004b8d', 'SHL'],
  ['mlb', 'Major League Baseball', 'MLB', 'United States', 'US', 'baseball', 1, '#002d72', 'MLB'],
  ['npb', 'Nippon Professional Baseball', 'NPB', 'Japan', 'JP', 'baseball', 1, '#b31b1b', 'NPB']
] as const;

const TEAMS = [
  ['arsenal', 'Arsenal', 'ARS', 'epl', 'football', 1945, 1.78, 0.92, 1.92, 0.81, 'WWWDW'],
  ['manchester-city', 'Manchester City', 'MCI', 'epl', 'football', 1962, 1.95, 0.98, 2.06, 0.88, 'WWLWW'],
  ['liverpool', 'Liverpool', 'LIV', 'epl', 'football', 1951, 1.9, 1.02, 2.01, 0.94, 'WDWWW'],
  ['real-madrid', 'Real Madrid', 'RMA', 'laliga', 'football', 1974, 1.92, 0.86, 2.04, 0.79, 'WWWWD'],
  ['barcelona', 'Barcelona', 'BAR', 'laliga', 'football', 1948, 2.02, 1.04, 2.21, 0.96, 'WWWLW'],
  ['inter-milan', 'Inter Milan', 'INT', 'seriea', 'football', 1904, 1.76, 0.83, 1.85, 0.78, 'WWWDL'],
  ['bayern-munich', 'Bayern Munich', 'FCB', 'bundesliga', 'football', 1954, 2.24, 0.92, 2.42, 0.85, 'WWWWW'],
  ['psg', 'Paris Saint-Germain', 'PSG', 'ligue1', 'football', 1942, 2.06, 0.85, 2.18, 0.8, 'WWWWD'],
  ['enyimba', 'Enyimba', 'ENY', 'npfl', 'football', 1620, 1.42, 0.94, 1.45, 0.9, 'WWWDW'],
  ['remo-stars', 'Remo Stars', 'REM', 'npfl', 'football', 1604, 1.38, 0.91, 1.41, 0.88, 'WWDLW'],
  ['celtics', 'Boston Celtics', 'BOS', 'nba', 'basketball', 1902, 1.16, 0.97, 118.4, 108.2, 'WWLWW'],
  ['nuggets', 'Denver Nuggets', 'DEN', 'nba', 'basketball', 1878, 1.12, 1.0, 116.8, 110.1, 'WLWWW'],
  ['thunder', 'Oklahoma City Thunder', 'OKC', 'nba', 'basketball', 1896, 1.14, 0.95, 117.6, 106.9, 'WWWWL'],
  ['real-madrid-bc', 'Real Madrid Baloncesto', 'RMB', 'euroleague', 'basketball', 1794, 1.12, 0.98, 86.2, 78.9, 'WWLWW'],
  ['rivers-hoopers', 'Rivers Hoopers', 'RHO', 'nbbl', 'basketball', 1522, 1.08, 0.96, 78.4, 71.2, 'WWWLW'],
  ['sinner', 'Jannik Sinner', 'SIN', 'atp', 'tennis', 2182, 1.18, 0.9, 2.1, 0.7, 'WWWWW'],
  ['alcaraz', 'Carlos Alcaraz', 'ALC', 'atp', 'tennis', 2164, 1.16, 0.92, 2.05, 0.74, 'WWLWW'],
  ['sabalenka', 'Aryna Sabalenka', 'SAB', 'wta', 'tennis', 2102, 1.15, 0.92, 2.0, 0.72, 'WWWLW'],
  ['swiatek', 'Iga Swiatek', 'SWI', 'wta', 'tennis', 2148, 1.18, 0.88, 2.08, 0.68, 'WWWWL'],
  ['panthers', 'Florida Panthers', 'FLA', 'nhl', 'icehockey', 1798, 1.14, 0.95, 3.42, 2.71, 'WWLWW'],
  ['oilers', 'Edmonton Oilers', 'EDM', 'nhl', 'icehockey', 1782, 1.16, 1.02, 3.61, 3.04, 'WLWWW'],
  ['frolunda', 'Frolunda HC', 'FRO', 'shl', 'icehockey', 1652, 1.08, 0.96, 3.12, 2.68, 'WWLWW'],
  ['dodgers', 'Los Angeles Dodgers', 'LAD', 'mlb', 'baseball', 1822, 1.12, 0.96, 5.42, 4.31, 'WWLWW'],
  ['yankees', 'New York Yankees', 'NYY', 'mlb', 'baseball', 1804, 1.1, 0.98, 5.28, 4.46, 'WLWWW'],
  ['giants', 'Yomiuri Giants', 'YOM', 'npb', 'baseball', 1702, 1.05, 0.97, 4.62, 4.08, 'WWLWW']
] as const;

const MODELS = [
  ['mdl_dixon_coles', 'Dixon–Coles Bivariate Poisson', 'statistical', 'football', '3.4.1', 'production', 0.581, 0.912, 0.176, 4.8, 41280, 38, 0.012, 'Low-score corrected Poisson with exponential time decay.'],
  ['mdl_elo', 'Dynamic Elo + Surface Rating', 'statistical', 'multi', '2.9.0', 'production', 0.684, 0.621, 0.142, 3.6, 86420, 16, 0.008, 'Cross-sport rating engine with surface and travel adjustments.'],
  ['mdl_gbm', 'CaveBoost Gradient Ensemble', 'machine-learning', 'multi', '5.1.2', 'production', 0.612, 0.884, 0.169, 6.2, 128400, 142, 0.021, 'Gradient-boosted trees with monotonic market priors.'],
  ['mdl_sequence', 'Temporal Sequence Net', 'machine-learning', 'football', '1.8.0', 'shadow', 0.596, 0.901, 0.171, 5.1, 38620, 96, 0.034, 'GRU over the last twelve matches with attention pooling.'],
  ['mdl_market', 'Consensus Market Prior', 'market', 'multi', '4.0.3', 'production', 0.701, 0.592, 0.134, 0, 284000, 12, 0.004, 'Vig-free consensus of eight bookmakers.'],
  ['mdl_hockey', 'NHL Shot-Volume Model', 'machine-learning', 'icehockey', '2.2.0', 'production', 0.594, 0.932, 0.181, 5.4, 18240, 64, 0.017, 'Shot-based hockey model with goalie adjustments.'],
  ['mdl_baseball', 'MLB Run-Environment Model', 'machine-learning', 'baseball', '3.0.1', 'production', 0.577, 0.948, 0.188, 4.2, 24680, 78, 0.022, 'Pitcher-led run distribution with park and weather adjustments.'],
  ['mdl_llm', 'CaveBettor Match Analyst (LLM)', 'llm', 'multi', '1.4.0', 'production', 0, 0, 0, 0, 0, 0, 0, 'Retrieval-augmented analyst grounded on verified numbers.']
] as const;

const SOURCES = [
  ['odds-harvester', 'OddsHarvester (OddsPortal)', 'repo', 'https://github.com/jordantete/OddsHarvester', 'multi', 'healthy', 92, 48, 1840, 0.96, false, 'Historical and in-play odds snapshots.'],
  ['oddshub', 'oddshub', 'repo', 'https://github.com/dos-2/oddshub', 'multi', 'healthy', 88, 36, 1260, 0.93, false, 'Multi-sport aggregation.'],
  ['nba-ml', 'NBA Machine Learning', 'repo', 'https://github.com/kyleskom/NBA-Machine-Learning-Sports-Betting', 'basketball', 'healthy', 95, 14, 940, 0.95, false, 'NBA feature pipeline and model comparison.'],
  ['penaltyblog', 'penaltyblog', 'repo', 'https://github.com/martineastwood/penaltyblog', 'football', 'healthy', 94, 26, 880, 0.97, false, 'Dixon–Coles, Elo and xG reference.'],
  ['wagerbrain', 'WagerBrain', 'repo', 'https://github.com/sedemmler/WagerBrain', 'multi', 'healthy', 84, 20, 1180, 0.92, false, 'Odds conversion, vig removal and Kelly staking.'],
  ['btfstats', 'btfstats.com', 'scraper', 'https://btfstats.com', 'football', 'healthy', 86, 18, 2100, 0.9, false, 'Team form and xG previews.'],
  ['packball', 'packball.com', 'scraper', 'https://packball.com/en/matches', 'football', 'healthy', 81, 22, 2260, 0.88, false, 'Fixture and live score collector.'],
  ['tennisbrain', 'tennisbrain.com', 'scraper', 'https://www.tennisbrain.com/predictions', 'tennis', 'healthy', 88, 12, 1980, 0.89, false, 'Tennis win probabilities.'],
  ['api-football', 'API-Football', 'api', 'https://www.api-football.com', 'football', 'needs-key', 97, 52, 420, 0.98, true, 'Fixtures, lineups, injuries and odds.'],
  ['odds-api', 'The Odds API', 'api', 'https://the-odds-api.com', 'multi', 'needs-key', 94, 60, 380, 0.97, true, 'Bookmaker odds with movement history.'],
  ['internal-engine', 'CaveBettor Intelligence Engine', 'internal', '/api/engine', 'multi', 'healthy', 100, 84, 82, 0.99, false, 'Deterministic ensemble and self-training pipeline.']
] as const;

function daysFromNow(days: number) {
  return Date.now() + days * 86_400_000;
}

export const seedDemo = internalMutation({
  args: { reset: v.optional(v.boolean()) },
  handler: async (ctx, { reset }) => {
    if (reset) {
      for (const table of ['predictions', 'marketPredictions', 'valueSelections', 'markets', 'odds', 'fixtures', 'teams', 'leagues', 'sports', 'modelVersions', 'trainingRuns', 'dataSources', 'scrapeJobs', 'paperBets', 'analysisReports', 'watchlists', 'subscriptions', 'settings', 'apiKeys', 'auditLogs', 'users'] as const) {
        const rows = await ctx.db.query(table).collect();
        for (const row of rows) await ctx.db.delete(row._id);
      }
    }

    const existing = await ctx.db.query('sports').first();
    if (existing) return { skipped: true, reason: 'Seed data already present. Pass reset:true to rebuild.' };

    for (const sport of SPORTS) await ctx.db.insert('sports', sport);

    for (const [key, name, shortName, country, countryCode, sportKey, tier, colour, logo] of LEAGUES) {
      await ctx.db.insert('leagues', { key, name, shortName, country, countryCode, sportKey, tier, season: '2025/26', colour, logo });
    }

    for (const [key, name, shortName, leagueKey, sportKey, elo, attack, defence, xgFor, xgAgainst, form] of TEAMS) {
      await ctx.db.insert('teams', {
        key,
        name,
        shortName,
        leagueKey,
        sportKey,
        elo,
        attack,
        defence,
        xgFor,
        xgAgainst,
        cleanSheets: Math.round(4 + (elo - 1700) / 40),
        form: form.split('') as ('W' | 'D' | 'L')[],
        updatedAt: Date.now()
      });
    }

    for (const [key, name, family, sport, version, status, accuracy, logLoss, brier, roi, sampleSize, features, drift, description] of MODELS) {
      await ctx.db.insert('modelVersions', {
        key,
        name,
        family: family as 'statistical' | 'machine-learning' | 'market' | 'llm',
        sport,
        version,
        status: status as 'production' | 'shadow',
        accuracy,
        logLoss,
        brier,
        roi,
        sampleSize,
        features,
        drift,
        calibration: [
          { bucket: '50–60%', predicted: 0.55, observed: 0.548, count: 812 },
          { bucket: '60–70%', predicted: 0.65, observed: 0.641, count: 686 },
          { bucket: '70–80%', predicted: 0.75, observed: 0.756, count: 472 },
          { bucket: '80–90%', predicted: 0.85, observed: 0.839, count: 248 },
          { bucket: '90–100%', predicted: 0.95, observed: 0.944, count: 96 }
        ],
        featureImportance: [
          { name: 'Market-implied probability', weight: 0.27 },
          { name: 'xG differential (10)', weight: 0.16 },
          { name: 'Elo differential', weight: 0.14 },
          { name: 'Availability index', weight: 0.11 }
        ],
        description,
        trainedAt: Date.now() - 3600_000
      });
    }

    for (const [key, name, kind, url, sport, status, coverage, markets, latencyMs, reliability, requiresKey, note] of SOURCES) {
      await ctx.db.insert('dataSources', {
        key,
        name,
        kind: kind as 'repo' | 'scraper' | 'api' | 'internal',
        url,
        sport,
        status: status as 'healthy' | 'needs-key',
        coverage,
        markets,
        latencyMs,
        lastChecked: Date.now() - 120_000,
        recordsToday: status === 'healthy' ? 1200 + coverage * 30 : 0,
        reliability,
        requiresKey,
        note
      });
    }

    const pairings: [string, string, string][] = [
      ['epl', 'arsenal', 'liverpool'],
      ['laliga', 'real-madrid', 'barcelona'],
      ['seriea', 'inter-milan', 'bayern-munich'],
      ['npfl', 'enyimba', 'remo-stars'],
      ['nba', 'celtics', 'thunder'],
      ['euroleague', 'real-madrid-bc', 'nuggets'],
      ['atp', 'sinner', 'alcaraz'],
      ['wta', 'sabalenka', 'swiatek'],
      ['nhl', 'panthers', 'oilers'],
      ['mlb', 'dodgers', 'yankees']
    ];

    for (let i = 0; i < pairings.length; i++) {
      const [leagueKey, homeKey, awayKey] = pairings[i];
      const league = LEAGUES.find((l) => l[0] === leagueKey)!;
      const sportKey = league[5];
      const kickoff = daysFromNow(i % 3 === 0 ? -0.02 : (i % 4) + 0.2);
      const isLive = i % 3 === 0;
      const homeWin = 0.42 + (i % 5) * 0.03;
      const draw = sportKey === 'football' || sportKey === 'icehockey' ? 0.25 : 0;
      const awayWin = 1 - homeWin - draw;
      const fixtureKey = `fx_${leagueKey}_${homeKey}_${awayKey}`;

      await ctx.db.insert('fixtures', {
        key: fixtureKey,
        sportKey,
        leagueKey,
        homeKey,
        awayKey,
        kickoff,
        status: isLive ? 'live' : 'scheduled',
        minute: isLive ? 63 : undefined,
        period: isLive ? (sportKey === 'football' ? '2nd half' : 'Q3') : undefined,
        score: { home: isLive ? 1 : 0, away: isLive ? 1 : 0 },
        venue: `${homeKey.replace(/-/g, ' ')} arena`,
        round: `Matchday ${28 + i}`,
        weather: 'Clear · 24°C',
        h2h: { homeWins: 4, draws: 2, awayWins: 3, last: ['2–1', '1–1', '0–2'] },
        updatedAt: Date.now()
      });

      const predictionId = await ctx.db.insert('predictions', {
        fixtureKey,
        modelVersion: 'CaveBettor Ensemble v7.3',
        ensembleVersion: '2026.02.1',
        probabilities: { home: homeWin, draw, away: awayWin },
        fairOdds: { home: 1 / homeWin, draw: draw ? 1 / draw : 999, away: 1 / awayWin },
        expectedGoals: { home: sportKey === 'basketball' ? 112 : 1.6, away: sportKey === 'basketball' ? 108 : 1.2, total: sportKey === 'basketball' ? 220 : 2.8 },
        bothTeamsScore: 0.56,
        over15: 0.78,
        over25: 0.54,
        over35: 0.31,
        scoreGrid: [{ home: 1, away: 1, probability: 0.12 }, { home: 2, away: 1, probability: 0.11 }, { home: 1, away: 0, probability: 0.1 }],
        confidence: 72,
        dataQuality: 0.9,
        edge: 0.048,
        components: [
          { id: 'mdl_dixon_coles', name: 'Dixon–Coles Poisson', family: 'statistical', weight: 0.34, homeProbability: homeWin, drawProbability: draw, awayProbability: awayWin, confidence: 78 },
          { id: 'mdl_gbm', name: 'CaveBoost GBM', family: 'machine-learning', weight: 0.28, homeProbability: homeWin - 0.01, drawProbability: draw, awayProbability: awayWin + 0.01, confidence: 84 },
          { id: 'mdl_market', name: 'Market consensus', family: 'market', weight: 0.2, homeProbability: homeWin + 0.01, drawProbability: draw, awayProbability: awayWin - 0.01, confidence: 88 }
        ],
        insights: [
          { kind: 'model', title: 'Home side holds the model edge', body: 'The ensemble favours the home team on venue and form.', impact: 'neutral', confidence: 72 }
        ],
        recommended: {
          selection: `${homeKey.replace(/-/g, ' ')} win`,
          market: 'Match result — 1X2',
          odds: 2.05,
          modelProbability: homeWin,
          stakeNgn: 15000,
          confidence: 72,
          rationale: 'Positive edge against the best available price with quarter-Kelly sizing.',
          risk: 'medium'
        },
        generatedAt: Date.now()
      });

      const outcomes = [
        { marketKey: '1x2', marketLabel: 'Match result — 1X2', outcomeId: 'home', outcomeLabel: `${homeKey} win`, p: homeWin },
        ...(draw ? [{ marketKey: '1x2', marketLabel: 'Match result — 1X2', outcomeId: 'draw', outcomeLabel: 'Draw', p: draw }] : []),
        { marketKey: '1x2', marketLabel: 'Match result — 1X2', outcomeId: 'away', outcomeLabel: `${awayKey} win`, p: awayWin },
        { marketKey: 'ou25', marketLabel: 'Total goals — 2.5', outcomeId: 'over', outcomeLabel: 'Over 2.5', p: 0.54 },
        { marketKey: 'ou25', marketLabel: 'Total goals — 2.5', outcomeId: 'under', outcomeLabel: 'Under 2.5', p: 0.46 }
      ];

      for (const outcome of outcomes) {
        const bestOdds = Number((1 / (outcome.p * 0.98)).toFixed(2));
        const edge = Number((outcome.p * bestOdds - 1).toFixed(4));
        await ctx.db.insert('marketPredictions', {
          fixtureKey,
          marketKey: outcome.marketKey,
          marketLabel: outcome.marketLabel,
          outcomeId: outcome.outcomeId,
          outcomeLabel: outcome.outcomeLabel,
          modelProbability: outcome.p,
          fairOdds: Number((1 / outcome.p).toFixed(2)),
          bestOdds,
          bestBook: 'SportyBet',
          edge,
          kelly: 0.02,
          confidence: Math.round(55 + outcome.p * 30),
          value: edge > 0.025
        });
        if (edge > 0.025) {
          await ctx.db.insert('valueSelections', {
            fixtureKey,
            sportKey,
            leagueKey,
            market: outcome.marketLabel,
            selection: outcome.outcomeLabel,
            odds: bestOdds,
            modelProbability: outcome.p,
            impliedProbability: 1 / bestOdds,
            edge,
            stakeNgn: 15000,
            confidence: Math.round(55 + outcome.p * 30),
            bookmaker: 'SportyBet',
            kickoff,
            createdAt: Date.now()
          });
        }
      }
      await ctx.db.insert('analysisReports', {
        fixtureKey,
        provider: 'grounded-template',
        model: 'CaveBettor grounded analyst',
        headline: 'Model edge is visible but the price is fair',
        summary: 'The ensemble favours the home side at a modest probability. Value exists only at the best available price.',
        sections: [
          { heading: 'Model view', body: 'The market prior and the statistical model agree within two percentage points.' },
          { heading: 'Value', body: 'One selection clears the edge threshold. Size with quarter-Kelly.' },
          { heading: 'Risk', body: 'Team news is unconfirmed. Treat the edge as provisional.' }
        ],
        generatedAt: Date.now()
      });

      await ctx.db.insert('markets', {
        key: `${fixtureKey}_1x2`,
        fixtureKey,
        group: 'match',
        label: 'Match result — 1X2',
        description: 'Full-time three-way result'
      });
    }

    const userId = await ctx.db.insert('users', {
      name: 'Omale Danjuma',
      email: 'omale@cavebettor.ng',
      role: 'owner',
      workspace: 'Lagos Value Desk',
      timezone: 'Africa/Lagos',
      currency: 'NGN',
      avatar: 'OD',
      createdAt: Date.now() - 214 * 86_400_000,
      lastSeenAt: Date.now()
    });
    await ctx.db.insert('subscriptions', {
      userId,
      planId: 'pro',
      planName: 'CaveBettor Pro',
      priceNgn: 5000,
      interval: 'month',
      status: 'active',
      seats: 1,
      startedAt: Date.now() - 180 * 86_400_000,
      renewsAt: Date.now() + 18 * 86_400_000
    });
    await ctx.db.insert('settings', {
      userId,
      oddsFormat: 'decimal',
      staking: 'quarter',
      minEdgePct: 2.5,
      maxStakePct: 5,
      notifyValue: true,
      notifyResults: true,
      notifyDrift: true,
      dailyBrief: true
    });

    return { seeded: true, leagues: LEAGUES.length, teams: TEAMS.length, fixtures: pairings.length, models: MODELS.length, sources: SOURCES.length };
  }
});

export const clearAll = internalMutation({
  args: { confirm: v.literal('DELETE') },
  handler: async (ctx) => {
    let deleted = 0;
    for (const table of ['predictions', 'marketPredictions', 'valueSelections', 'markets', 'odds', 'fixtures'] as const) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted };
  }
});
