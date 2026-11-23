import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';

export const byFixture = query({
  args: { fixtureKey: v.string() },
  handler: async (ctx, { fixtureKey }) => {
    const prediction = await ctx.db
      .query('predictions')
      .withIndex('by_fixture', (q) => q.eq('fixtureKey', fixtureKey))
      .order('desc')
      .first();
    const markets = await ctx.db
      .query('marketPredictions')
      .withIndex('by_fixture', (q) => q.eq('fixtureKey', fixtureKey))
      .take(200);
    const values = await ctx.db
      .query('valueSelections')
      .withIndex('by_fixture', (q) => q.eq('fixtureKey', fixtureKey))
      .take(30);
    return { prediction, markets, values };
  }
});

export const board = query({
  args: { sportKey: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 40, 120);
    const rows = await ctx.db.query('valueSelections').withIndex('by_edge').order('desc').take(limit * 2);
    return args.sportKey ? rows.filter((r) => r.sportKey === args.sportKey).slice(0, limit) : rows.slice(0, limit);
  }
});

export const history = query({
  args: { fixtureKey: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { fixtureKey, limit }) =>
    ctx.db
      .query('predictions')
      .withIndex('by_fixture', (q) => q.eq('fixtureKey', fixtureKey))
      .order('desc')
      .take(limit ?? 20)
});

export const save = internalMutation({
  args: {
    fixtureKey: v.string(),
    modelVersion: v.string(),
    ensembleVersion: v.string(),
    probabilities: v.object({ home: v.number(), draw: v.number(), away: v.number() }),
    fairOdds: v.object({ home: v.number(), draw: v.number(), away: v.number() }),
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
      v.object({ kind: v.string(), title: v.string(), body: v.string(), impact: v.string(), confidence: v.number() })
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
    markets: v.array(
      v.object({
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
    )
  },
  handler: async (ctx, args) => {
    const { markets, ...prediction } = args;
    const existing = await ctx.db
      .query('predictions')
      .withIndex('by_fixture', (q) => q.eq('fixtureKey', args.fixtureKey))
      .order('desc')
      .first();

    const predictionId = existing
      ? (await ctx.db.patch(existing._id, { ...prediction, generatedAt: Date.now() }), existing._id)
      : await ctx.db.insert('predictions', { ...prediction, generatedAt: Date.now() });

    for (const market of markets) {
      await ctx.db.insert('marketPredictions', {
        fixtureKey: args.fixtureKey,
        ...market
      });
      if (market.value) {
        await ctx.db.insert('valueSelections', {
          fixtureKey: args.fixtureKey,
          sportKey: '',
          leagueKey: '',
          market: market.marketLabel,
          selection: market.outcomeLabel,
          odds: market.bestOdds,
          modelProbability: market.modelProbability,
          impliedProbability: 1 / market.bestOdds,
          edge: market.edge,
          stakeNgn: 0,
          confidence: market.confidence,
          bookmaker: market.bestBook,
          kickoff: Date.now(),
          createdAt: Date.now()
        });
      }
    }

    return predictionId;
  }
});

/** Manual value-selection insert used by the worker after joining fixture metadata. */
export const upsertValueSelections = internalMutation({
  args: {
    selections: v.array(
      v.object({
        fixtureKey: v.string(),
        sportKey: v.string(),
        leagueKey: v.string(),
        market: v.string(),
        selection: v.string(),
        odds: v.number(),
        modelProbability: v.number(),
        edge: v.number(),
        stakeNgn: v.number(),
        confidence: v.number(),
        bookmaker: v.string(),
        kickoff: v.number()
      })
    )
  },
  handler: async (ctx, { selections }) => {
    for (const selection of selections) {
      await ctx.db.insert('valueSelections', {
        ...selection,
        impliedProbability: 1 / selection.odds,
        createdAt: Date.now()
      });
    }
    return selections.length;
  }
});
