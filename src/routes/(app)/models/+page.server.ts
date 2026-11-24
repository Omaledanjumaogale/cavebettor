import { MODELS } from '#lib/data/catalog';
import { getModelPerformance, getTrainingRuns } from '#lib/engine/analytics';
import { readSnapshot } from '#lib/server/live';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const snapshot: any = await readSnapshot('models');
  const performance = getModelPerformance();
  const runs = getTrainingRuns();
  return {
    models: snapshot?.models ?? performance.map((p) => ({
      ...p.model,
      runs: p.runs.slice(0, 3),
      accuracySeries: p.accuracySeries,
      logLossSeries: p.logLossSeries
    })),
    runs: snapshot?.runs ?? runs.slice(0, 12),
    summary: snapshot?.summary ?? {
      total: MODELS.length,
      production: MODELS.filter((m) => m.status === 'production').length,
      shadow: MODELS.filter((m) => m.status === 'shadow').length,
      avgAccuracy: MODELS.filter((m) => m.accuracy > 0).reduce((a, m) => a + m.accuracy, 0) / MODELS.filter((m) => m.accuracy > 0).length,
      avgRoi: MODELS.filter((m) => m.roi > 0).reduce((a, m) => a + m.roi, 0) / MODELS.filter((m) => m.roi > 0).length,
      features: MODELS.reduce((a, m) => a + m.features, 0),
      samples: MODELS.reduce((a, m) => a + m.sampleSize, 0),
      driftAlerts: MODELS.filter((m) => m.drift > 0.025).length,
      completedRuns: runs.filter((r) => r.status === 'completed').length
    },
    pipeline: snapshot?.pipeline ?? [
      { step: '01', title: 'Collect', detail: 'Fixtures, odds and team statistics arrive from scrapers and licensed APIs every 15 minutes.' },
      { step: '02', title: 'Normalise', detail: 'Team aliases, market names and prices are mapped to one canonical schema with validation gates.' },
      { step: '03', title: 'Featurise', detail: 'Rolling xG, Elo, rest, travel, availability and market priors form 142 sport-aware features.' },
      { step: '04', title: 'Train', detail: 'Walk-forward training with exponential decay, early stopping and strict time-based splits.' },
      { step: '05', title: 'Validate', detail: 'A challenger must beat the champion on accuracy, log-loss and ROI across 8 windows.' },
      { step: '06', title: 'Promote', detail: 'Champion swaps atomically; the previous model is retained for rollback and shadow comparison.' }
    ]
  };
};
