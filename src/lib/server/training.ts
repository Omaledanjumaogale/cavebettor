import { MODELS } from '#lib/data/catalog';
import { getTrainingRuns } from '#lib/engine/analytics';
import type { TrainingRun } from '#lib/types';

const store = globalThis as unknown as { __cavebettorRuns?: TrainingRun[] };
if (!store.__cavebettorRuns) store.__cavebettorRuns = getTrainingRuns();

export function listRuns(): TrainingRun[] {
  return store.__cavebettorRuns!;
}

export function queueRun(modelId?: string, sport?: string): TrainingRun {
  const model = MODELS.find((m) => m.id === modelId) ?? MODELS.find((m) => m.family !== 'llm' && m.status === 'production')!;
  const run: TrainingRun = {
    id: `run_live_${Date.now().toString(36)}`,
    modelId: model.id,
    sport: (sport as TrainingRun['sport']) ?? model.sport,
    status: 'queued',
    startedAt: new Date().toISOString(),
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
    notes: 'Queued from the workspace. Self-training will warm-start from the current champion, then validate across the last 8 walk-forward windows before promotion.'
  };
  store.__cavebettorRuns = [run, ...store.__cavebettorRuns!].slice(0, 60);
  return run;
}
