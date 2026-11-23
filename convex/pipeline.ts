import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';

export const sources = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query('dataSources').collect();
    return Promise.all(
      sources.map(async (source) => {
        const job = await ctx.db
          .query('scrapeJobs')
          .withIndex('by_source', (q) => q.eq('sourceKey', source.key))
          .order('desc')
          .first();
        return { ...source, lastJob: job };
      })
    );
  }
});

export const jobs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) =>
    ctx.db.query('scrapeJobs').withIndex('by_started').order('desc').take(limit ?? 30)
});

export const logJob = mutation({
  args: {
    sourceKey: v.string(),
    status: v.union(v.literal('queued'), v.literal('running'), v.literal('succeeded'), v.literal('failed'), v.literal('skipped')),
    durationMs: v.number(),
    records: v.number(),
    rejected: v.number(),
    message: v.string(),
    warnings: v.optional(v.array(v.string()))
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('scrapeJobs', { ...args, startedAt: Date.now() });
    const source = await ctx.db.query('dataSources').withIndex('by_key', (q) => q.eq('key', args.sourceKey)).unique();
    if (source) {
      await ctx.db.patch(source._id, {
        lastChecked: Date.now(),
        recordsToday: source.recordsToday + args.records,
        status: args.status === 'failed' ? 'degraded' : args.status === 'skipped' ? 'needs-key' : 'healthy'
      });
    }
    return id;
  }
});

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db.query('dataSources').collect();
    return {
      total: sources.length,
      healthy: sources.filter((s) => s.status === 'healthy').length,
      degraded: sources.filter((s) => s.status === 'degraded').length,
      needsKey: sources.filter((s) => s.status === 'needs-key').length,
      records: sources.reduce((a, s) => a + s.recordsToday, 0),
      coverage: sources.length ? sources.reduce((a, s) => a + s.coverage, 0) / sources.length : 0
    };
  }
});


export const pruneOldOdds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 86_400_000;
    const stale = await ctx.db.query('odds').withIndex('by_captured').take(500);
    let deleted = 0;
    for (const row of stale) {
      if (row.capturedAt < cutoff) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted, cutoff };
  }
});
