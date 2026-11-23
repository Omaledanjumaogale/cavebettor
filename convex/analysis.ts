import { v } from 'convex/values';
import { internalMutation, query } from './_generated/server';

export const byFixture = query({
  args: { fixtureKey: v.string() },
  handler: async (ctx, { fixtureKey }) =>
    ctx.db.query('analysisReports').withIndex('by_fixture', (q) => q.eq('fixtureKey', fixtureKey)).order('desc').first()
});

export const save = internalMutation({
  args: {
    fixtureKey: v.string(),
    provider: v.union(v.literal('llm'), v.literal('grounded-template')),
    model: v.string(),
    headline: v.string(),
    summary: v.string(),
    sections: v.array(v.object({ heading: v.string(), body: v.string() }))
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('analysisReports', { ...args, generatedAt: Date.now() });
    return id;
  }
});
