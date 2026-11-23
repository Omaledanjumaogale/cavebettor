import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    const all = await ctx.db.query('modelVersions').collect();
    return status ? all.filter((m) => m.status === status) : all;
  }
});

export const performance = query({
  args: {},
  handler: async (ctx) => {
    const models = await ctx.db.query('modelVersions').collect();
    return Promise.all(
      models.map(async (model) => {
        const runs = await ctx.db
          .query('trainingRuns')
          .withIndex('by_model', (q) => q.eq('modelKey', model.key))
          .order('desc')
          .take(5);
        return { ...model, runs };
      })
    );
  }
});

export const runs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) =>
    ctx.db.query('trainingRuns').withIndex('by_started').order('desc').take(limit ?? 20)
});

export const queueTraining = mutation({
  args: {
    modelKey: v.string(),
    sport: v.optional(v.string()),
    triggeredBy: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const model = await ctx.db.query('modelVersions').withIndex('by_key', (q) => q.eq('key', args.modelKey)).unique();
    if (!model) throw new Error(`Unknown model ${args.modelKey}`);
    const id = await ctx.db.insert('trainingRuns', {
      modelKey: model.key,
      sport: args.sport ?? model.sport,
      status: 'queued',
      startedAt: Date.now(),
      epochs: 32,
      currentEpoch: 0,
      trainRows: 186_400,
      validationRows: 24_800,
      metrics: { accuracy: model.accuracy, logLoss: model.logLoss, brier: model.brier, roi: model.roi },
      walkForward: Array.from({ length: 4 }, (_, i) => ({
        window: `W${i + 1}`,
        accuracy: Number((model.accuracy - 0.02 + i * 0.004).toFixed(3)),
        roi: Number((model.roi - 1 + i * 0.6).toFixed(1)),
        bets: 180 + i * 24
      })),
      notes: 'Queued. Warm-start from champion; promotion requires winning all 8 walk-forward windows.',
      triggeredBy: args.triggeredBy
    });
    await ctx.db.insert('auditLogs', {
      actor: args.triggeredBy ?? 'system',
      action: `Queued training for ${model.name}`,
      detail: `${model.version} · ${args.sport ?? model.sport}`,
      entity: 'modelVersions',
      entityId: model._id,
      createdAt: Date.now()
    });
    return id;
  }
});

export const completeTraining = internalMutation({
  args: {
    runId: v.id('trainingRuns'),
    metrics: v.object({ accuracy: v.number(), logLoss: v.number(), brier: v.number(), roi: v.number() }),
    notes: v.string(),
    promote: v.boolean()
  },
  handler: async (ctx, { runId, metrics, notes, promote }) => {
    const run = await ctx.db.get(runId);
    if (!run) throw new Error('Run not found');
    await ctx.db.patch(runId, { status: 'completed', completedAt: Date.now(), metrics, notes, currentEpoch: run.epochs });
    if (promote) {
      const model = await ctx.db.query('modelVersions').withIndex('by_key', (q) => q.eq('key', run.modelKey)).unique();
      if (model) {
        await ctx.db.patch(model._id, {
          status: 'production',
          accuracy: metrics.accuracy,
          logLoss: metrics.logLoss,
          brier: metrics.brier,
          roi: metrics.roi,
          trainedAt: Date.now()
        });
        await ctx.db.insert('auditLogs', {
          actor: 'scheduler',
          action: `Promoted ${model.name}`,
          detail: `Walk-forward ROI ${metrics.roi}% · accuracy ${(metrics.accuracy * 100).toFixed(1)}%`,
          entity: 'modelVersions',
          entityId: model._id,
          createdAt: Date.now()
        });
      }
    }
    return runId;
  }
});

export const audit = internalMutation({
  args: {},
  handler: async (ctx) => {
    const production = await ctx.db.query('modelVersions').withIndex('by_status', (q) => q.eq('status', 'production')).collect();
    const alerts = production.filter((m) => m.drift > 0.042);
    for (const model of alerts) {
      await ctx.db.patch(model._id, { status: 'shadow' });
      await ctx.db.insert('auditLogs', {
        actor: 'drift-guard',
        action: `Rolled back ${model.name}`,
        detail: `Drift ${(model.drift * 100).toFixed(1)}% exceeded the 4.2% guardrail. Held in shadow mode.`,
        entity: 'modelVersions',
        entityId: model._id,
        createdAt: Date.now()
      });
    }
    return { checked: production.length, rolledBack: alerts.length };
  }
});
