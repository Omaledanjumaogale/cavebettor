import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';

const fixtureStatus = v.union(v.literal('scheduled'), v.literal('live'), v.literal('halftime'), v.literal('finished'), v.literal('postponed'));

export const list = query({
  args: {
    sportKey: v.optional(v.string()),
    leagueKey: v.optional(v.string()),
    status: v.optional(fixtureStatus),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 60, 200);
    let fixtures;
    if (args.sportKey && args.status) {
      fixtures = await ctx.db
        .query('fixtures')
        .withIndex('by_sport_status', (q) => q.eq('sportKey', args.sportKey!).eq('status', args.status!))
        .take(limit);
    } else if (args.leagueKey) {
      fixtures = await ctx.db
        .query('fixtures')
        .withIndex('by_league', (q) => q.eq('leagueKey', args.leagueKey!))
        .take(limit);
    } else if (args.status) {
      fixtures = await ctx.db
        .query('fixtures')
        .withIndex('by_status', (q) => q.eq('status', args.status!))
        .take(limit);
    } else {
      fixtures = await ctx.db.query('fixtures').withIndex('by_kickoff').take(limit);
    }

    const enriched = await Promise.all(
      fixtures.map(async (fixture) => {
        const [league, home, away, prediction] = await Promise.all([
          ctx.db.query('leagues').withIndex('by_key', (q) => q.eq('key', fixture.leagueKey)).unique(),
          ctx.db.query('teams').withIndex('by_key', (q) => q.eq('key', fixture.homeKey)).unique(),
          ctx.db.query('teams').withIndex('by_key', (q) => q.eq('key', fixture.awayKey)).unique(),
          ctx.db.query('predictions').withIndex('by_fixture', (q) => q.eq('fixtureKey', fixture.key)).order('desc').first()
        ]);
        return { ...fixture, league, home, away, prediction };
      })
    );
    return enriched;
  }
});

export const live = query({
  args: {},
  handler: async (ctx) => {
    const live = await ctx.db.query('fixtures').withIndex('by_status', (q) => q.eq('status', 'live')).take(40);
    const halftime = await ctx.db.query('fixtures').withIndex('by_status', (q) => q.eq('status', 'halftime')).take(20);
    return [...live, ...halftime];
  }
});

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const fixture = await ctx.db.query('fixtures').withIndex('by_key', (q) => q.eq('key', key)).unique();
    if (!fixture) return null;
    const [league, home, away, prediction, markets] = await Promise.all([
      ctx.db.query('leagues').withIndex('by_key', (q) => q.eq('key', fixture.leagueKey)).unique(),
      ctx.db.query('teams').withIndex('by_key', (q) => q.eq('key', fixture.homeKey)).unique(),
      ctx.db.query('teams').withIndex('by_key', (q) => q.eq('key', fixture.awayKey)).unique(),
      ctx.db.query('predictions').withIndex('by_fixture', (q) => q.eq('fixtureKey', key)).order('desc').first(),
      ctx.db.query('markets').withIndex('by_fixture', (q) => q.eq('fixtureKey', key)).take(40)
    ]);
    const marketPredictions = await ctx.db
      .query('marketPredictions')
      .withIndex('by_fixture', (q) => q.eq('fixtureKey', key))
      .take(200);
    return { fixture, league, home, away, prediction, markets, marketPredictions };
  }
});

/** Ingest a batch of normalised fixtures. Called by the collection worker. */
export const upsertBatch = internalMutation({
  args: {
    fixtures: v.array(
      v.object({
        key: v.string(),
        sportKey: v.string(),
        leagueKey: v.string(),
        homeKey: v.string(),
        awayKey: v.string(),
        kickoff: v.number(),
        status: fixtureStatus,
        score: v.object({ home: v.number(), away: v.number() }),
        venue: v.string(),
        round: v.string(),
        minute: v.optional(v.number()),
        period: v.optional(v.string()),
        weather: v.optional(v.string())
      })
    )
  },
  handler: async (ctx, { fixtures }) => {
    let inserted = 0;
    let updated = 0;
    for (const incoming of fixtures) {
      const existing = await ctx.db.query('fixtures').withIndex('by_key', (q) => q.eq('key', incoming.key)).unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          status: incoming.status,
          score: incoming.score,
          minute: incoming.minute,
          period: incoming.period,
          updatedAt: Date.now()
        });
        updated++;
      } else {
        await ctx.db.insert('fixtures', {
          ...incoming,
          h2h: { homeWins: 0, draws: 0, awayWins: 0, last: [] },
          updatedAt: Date.now()
        });
        inserted++;
      }
    }
    return { inserted, updated };
  }
});
