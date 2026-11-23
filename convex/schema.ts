import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * CaveBettor — Convex schema.
 *
 * The local deterministic engine can render the entire product without a
 * deployment, but this schema is the production source of truth once
 * PUBLIC_CONVEX_URL is configured. All money is stored in NGN (numbers, whole
 * naira) and all odds are decimal.
 */

const score = v.object({ home: v.number(), away: v.number() });
const probabilitySet = v.object({ home: v.number(), draw: v.number(), away: v.number() });

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal('owner'), v.literal('analyst'), v.literal('viewer'), v.literal('admin')),
    workspace: v.string(),
    timezone: v.string(),
    currency: v.literal('NGN'),
    avatar: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number())
  })
    .index('by_email', ['email'])
    .index('by_token', ['tokenIdentifier']),

  subscriptions: defineTable({
    userId: v.id('users'),
    planId: v.union(v.literal('starter'), v.literal('pro'), v.literal('desk')),
    planName: v.string(),
    priceNgn: v.number(),
    interval: v.literal('month'),
    status: v.union(v.literal('active'), v.literal('trialing'), v.literal('past_due'), v.literal('cancelled')),
    seats: v.number(),
    startedAt: v.number(),
    renewsAt: v.number(),
    paystackReference: v.optional(v.string()),
    cancelledAt: v.optional(v.number())
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status']),

  settings: defineTable({
    userId: v.id('users'),
    oddsFormat: v.union(v.literal('decimal'), v.literal('american'), v.literal('fractional')),
    staking: v.union(v.literal('quarter'), v.literal('half'), v.literal('flat')),
    minEdgePct: v.number(),
    maxStakePct: v.number(),
    notifyValue: v.boolean(),
    notifyResults: v.boolean(),
    notifyDrift: v.boolean(),
    dailyBrief: v.boolean()
  }).index('by_user', ['userId']),

  sports: defineTable({
    key: v.string(),
    name: v.string(),
    icon: v.string(),
    accent: v.string(),
    hasDraw: v.boolean()
  }).index('by_key', ['key']),

  leagues: defineTable({
    key: v.string(),
    name: v.string(),
    shortName: v.string(),
    country: v.string(),
    countryCode: v.string(),
    sportKey: v.string(),
    tier: v.number(),
    season: v.string(),
    colour: v.string(),
    logo: v.string()
  })
    .index('by_key', ['key'])
    .index('by_sport', ['sportKey']),

  teams: defineTable({
    key: v.string(),
    name: v.string(),
    shortName: v.string(),
    leagueKey: v.string(),
    sportKey: v.string(),
    elo: v.number(),
    attack: v.number(),
    defence: v.number(),
    xgFor: v.number(),
    xgAgainst: v.number(),
    cleanSheets: v.number(),
    form: v.array(v.union(v.literal('W'), v.literal('D'), v.literal('L'))),
    updatedAt: v.number()
  })
    .index('by_key', ['key'])
    .index('by_league', ['leagueKey'])
    .index('by_sport', ['sportKey']),

  fixtures: defineTable({
    key: v.string(),
    sportKey: v.string(),
    leagueKey: v.string(),
    homeKey: v.string(),
    awayKey: v.string(),
    kickoff: v.number(),
    status: v.union(v.literal('scheduled'), v.literal('live'), v.literal('halftime'), v.literal('finished'), v.literal('postponed')),
    minute: v.optional(v.number()),
    period: v.optional(v.string()),
    score: score,
    venue: v.string(),
    round: v.string(),
    weather: v.optional(v.string()),
    attendance: v.optional(v.number()),
    h2h: v.object({ homeWins: v.number(), draws: v.number(), awayWins: v.number(), last: v.array(v.string()) }),
    stats: v.optional(
      v.object({
        possession: v.array(v.number()),
        shots: v.array(v.number()),
        shotsOnTarget: v.array(v.number()),
        corners: v.array(v.number()),
        fouls: v.array(v.number()),
        yellow: v.array(v.number()),
        red: v.array(v.number()),
        xg: v.array(v.number())
      })
    ),
    updatedAt: v.number()
  })
    .index('by_key', ['key'])
    .index('by_league', ['leagueKey'])
    .index('by_sport_status', ['sportKey', 'status'])
    .index('by_kickoff', ['kickoff'])
    .index('by_status', ['status']),

  markets: defineTable({
    key: v.string(),
    fixtureKey: v.string(),
    group: v.union(
      v.literal('match'),
      v.literal('handicap'),
      v.literal('totals'),
      v.literal('score'),
      v.literal('goalscorer'),
      v.literal('period'),
      v.literal('sets'),
      v.literal('special')
    ),
    label: v.string(),
    description: v.optional(v.string())
  })
    .index('by_fixture', ['fixtureKey'])
    .index('by_key', ['key']),

  odds: defineTable({
    fixtureKey: v.string(),
    marketKey: v.string(),
    outcomeId: v.string(),
    outcomeLabel: v.string(),
    bookmaker: v.string(),
    price: v.number(),
    implied: v.number(),
    capturedAt: v.number()
  })
    .index('by_fixture_market', ['fixtureKey', 'marketKey'])
    .index('by_captured', ['capturedAt']),

  predictions: defineTable({
    fixtureKey: v.string(),
    modelVersion: v.string(),
    ensembleVersion: v.string(),
    probabilities: probabilitySet,
    fairOdds: probabilitySet,
    expectedGoals: v.object({ home: v.number(), away: v.number(), total: v.number() }),
    bothTeamsScore: v.number(),
    over15: v.number(),
    over25: v.number(),
    over35: v.number(),
    scoreGrid: v.array(v.object({ home: v.number(), away: v.number(), probability: v.number() })),
    confidence: v.number(),
    dataQuality: v.number(),
    edge: v.number(),
    components: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        family: v.string(),
        weight: v.number(),
        homeProbability: v.number(),
        drawProbability: v.number(),
        awayProbability: v.number(),
        confidence: v.number()
      })
    ),
    insights: v.array(
      v.object({
        kind: v.string(),
        title: v.string(),
        body: v.string(),
        impact: v.string(),
        confidence: v.number()
      })
    ),
    recommended: v.object({
      selection: v.string(),
      market: v.string(),
      odds: v.number(),
      modelProbability: v.number(),
      stakeNgn: v.number(),
      confidence: v.number(),
      rationale: v.string(),
      risk: v.string()
    }),
    generatedAt: v.number()
  })
    .index('by_fixture', ['fixtureKey'])
    .index('by_generated', ['generatedAt']),

  marketPredictions: defineTable({
    fixtureKey: v.string(),
    marketKey: v.string(),
    marketLabel: v.string(),
    outcomeId: v.string(),
    outcomeLabel: v.string(),
    modelProbability: v.number(),
    fairOdds: v.number(),
    bestOdds: v.number(),
    bestBook: v.string(),
    edge: v.number(),
    kelly: v.number(),
    confidence: v.number(),
    value: v.boolean()
  })
    .index('by_fixture', ['fixtureKey'])
    .index('by_value', ['value']),

  valueSelections: defineTable({
    fixtureKey: v.string(),
    sportKey: v.string(),
    leagueKey: v.string(),
    market: v.string(),
    selection: v.string(),
    odds: v.number(),
    modelProbability: v.number(),
    impliedProbability: v.number(),
    edge: v.number(),
    stakeNgn: v.number(),
    confidence: v.number(),
    bookmaker: v.string(),
    kickoff: v.number(),
    createdAt: v.number()
  })
    .index('by_edge', ['edge'])
    .index('by_fixture', ['fixtureKey'])
    .index('by_created', ['createdAt']),

  modelVersions: defineTable({
    key: v.string(),
    name: v.string(),
    family: v.union(v.literal('statistical'), v.literal('machine-learning'), v.literal('market'), v.literal('ensemble'), v.literal('llm')),
    sport: v.string(),
    version: v.string(),
    status: v.union(v.literal('production'), v.literal('shadow'), v.literal('training'), v.literal('archived')),
    accuracy: v.number(),
    logLoss: v.number(),
    brier: v.number(),
    roi: v.number(),
    sampleSize: v.number(),
    features: v.number(),
    drift: v.number(),
    calibration: v.array(v.object({ bucket: v.string(), predicted: v.number(), observed: v.number(), count: v.number() })),
    featureImportance: v.array(v.object({ name: v.string(), weight: v.number() })),
    description: v.string(),
    trainedAt: v.number()
  })
    .index('by_key', ['key'])
    .index('by_status', ['status']),

  trainingRuns: defineTable({
    modelKey: v.string(),
    sport: v.string(),
    status: v.union(v.literal('queued'), v.literal('running'), v.literal('completed'), v.literal('failed')),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    epochs: v.number(),
    currentEpoch: v.number(),
    trainRows: v.number(),
    validationRows: v.number(),
    metrics: v.object({ accuracy: v.number(), logLoss: v.number(), brier: v.number(), roi: v.number() }),
    walkForward: v.array(v.object({ window: v.string(), accuracy: v.number(), roi: v.number(), bets: v.number() })),
    notes: v.string(),
    triggeredBy: v.optional(v.string())
  })
    .index('by_model', ['modelKey'])
    .index('by_status', ['status'])
    .index('by_started', ['startedAt']),

  dataSources: defineTable({
    key: v.string(),
    name: v.string(),
    kind: v.union(v.literal('scraper'), v.literal('api'), v.literal('repo'), v.literal('internal')),
    url: v.string(),
    sport: v.string(),
    status: v.union(v.literal('healthy'), v.literal('degraded'), v.literal('offline'), v.literal('needs-key'), v.literal('planned')),
    coverage: v.number(),
    markets: v.number(),
    latencyMs: v.number(),
    lastChecked: v.number(),
    recordsToday: v.number(),
    reliability: v.number(),
    requiresKey: v.boolean(),
    note: v.string()
  }).index('by_key', ['key']),

  scrapeJobs: defineTable({
    sourceKey: v.string(),
    status: v.union(v.literal('queued'), v.literal('running'), v.literal('succeeded'), v.literal('failed'), v.literal('skipped')),
    startedAt: v.number(),
    durationMs: v.number(),
    records: v.number(),
    rejected: v.number(),
    message: v.string(),
    warnings: v.optional(v.array(v.string()))
  })
    .index('by_source', ['sourceKey'])
    .index('by_started', ['startedAt']),

  paperBets: defineTable({
    userId: v.id('users'),
    fixtureKey: v.string(),
    fixtureLabel: v.string(),
    selection: v.string(),
    market: v.string(),
    odds: v.number(),
    stakeNgn: v.number(),
    status: v.union(v.literal('open'), v.literal('won'), v.literal('lost'), v.literal('void')),
    modelProbability: v.number(),
    edge: v.number(),
    placedAt: v.number(),
    settledAt: v.optional(v.number()),
    pnlNgn: v.optional(v.number())
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status'])
    .index('by_placed', ['placedAt']),

  watchlists: defineTable({
    userId: v.id('users'),
    name: v.string(),
    fixtureKeys: v.array(v.string()),
    teamKeys: v.array(v.string()),
    createdAt: v.number()
  }).index('by_user', ['userId']),

  analysisReports: defineTable({
    fixtureKey: v.string(),
    provider: v.union(v.literal('llm'), v.literal('grounded-template')),
    model: v.string(),
    headline: v.string(),
    summary: v.string(),
    sections: v.array(v.object({ heading: v.string(), body: v.string() })),
    generatedAt: v.number()
  })
    .index('by_fixture', ['fixtureKey'])
    .index('by_generated', ['generatedAt']),

  apiKeys: defineTable({
    userId: v.id('users'),
    label: v.string(),
    prefix: v.string(),
    hashedKey: v.string(),
    quota: v.number(),
    calls: v.number(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
    revokedAt: v.optional(v.number())
  }).index('by_user', ['userId']),

  auditLogs: defineTable({
    actor: v.string(),
    action: v.string(),
    detail: v.string(),
    entity: v.optional(v.string()),
    entityId: v.optional(v.string()),
    createdAt: v.number()
  }).index('by_created', ['createdAt'])
});
