import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

async function currentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db.query('users').withIndex('by_token', (q: any) => q.eq('tokenIdentifier', identity.subject)).unique();
}

export const list = query({
  args: { status: v.optional(v.union(v.literal('open'), v.literal('won'), v.literal('lost'), v.literal('void'))) },
  handler: async (ctx, { status }) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query('paperBets')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(200);
    return status ? rows.filter((b) => b.status === status) : rows;
  }
});

export const place = mutation({
  args: {
    fixtureKey: v.string(),
    fixtureLabel: v.string(),
    selection: v.string(),
    market: v.string(),
    odds: v.number(),
    stakeNgn: v.number(),
    modelProbability: v.number(),
    edge: v.number()
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error('Not authenticated');
    if (args.stakeNgn <= 0) throw new Error('Stake must be positive');
    if (args.odds <= 1) throw new Error('Decimal odds must be greater than 1');
    const id = await ctx.db.insert('paperBets', {
      userId: user._id,
      ...args,
      status: 'open',
      placedAt: Date.now()
    });
    await ctx.db.insert('auditLogs', {
      actor: user.email,
      action: 'Placed paper selection',
      detail: `${args.selection} @ ${args.odds} · ₦${args.stakeNgn.toLocaleString()}`,
      entity: 'paperBets',
      entityId: id,
      createdAt: Date.now()
    });
    return id;
  }
});

export const settle = mutation({
  args: {
    betId: v.id('paperBets'),
    result: v.union(v.literal('won'), v.literal('lost'), v.literal('void'))
  },
  handler: async (ctx, { betId, result }) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error('Not authenticated');
    const bet = await ctx.db.get(betId);
    if (!bet || bet.userId !== user._id) throw new Error('Bet not found');
    if (bet.status !== 'open') throw new Error('Bet already settled');
    const pnlNgn = result === 'won' ? Math.round(bet.stakeNgn * (bet.odds - 1)) : result === 'lost' ? -bet.stakeNgn : 0;
    await ctx.db.patch(betId, { status: result, settledAt: Date.now(), pnlNgn });
    return { pnlNgn };
  }
});

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const bets = await ctx.db.query('paperBets').withIndex('by_user', (q) => q.eq('userId', user._id)).take(1000);
    const settled = bets.filter((b) => b.status === 'won' || b.status === 'lost');
    const staked = settled.reduce((a, b) => a + b.stakeNgn, 0);
    const profit = settled.reduce((a, b) => a + (b.pnlNgn ?? 0), 0);
    return {
      bets: bets.length,
      open: bets.filter((b) => b.status === 'open').length,
      settled: settled.length,
      staked,
      profit,
      roi: staked ? (profit / staked) * 100 : 0,
      strikeRate: settled.length ? (settled.filter((b) => b.status === 'won').length / settled.length) * 100 : 0
    };
  }
});
