import { DATA_SOURCES, MODELS, TEAM_MAP, LEAGUE_MAP } from '#lib/data/catalog';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import {
  getAnalytics,
  getBankroll,
  getDailyBrief,
  getMetrics,
  getModelPerformance,
  getOddsMovers,
  getPaperBets,
  getScrapeJobs,
  getTopValueBets,
  getTrainingRuns
} from '#lib/engine/analytics';
import type { Prediction } from '#lib/types';

export interface SnapshotDoc {
  key: string;
  payload: string;
  counts?: Record<string, number>;
}

export interface PredictionDoc {
  fixtureKey: string;
  payload: string;
}

export interface SnapshotBundle {
  generatedAt: number;
  version: string;
  snapshots: SnapshotDoc[];
  predictions: PredictionDoc[];
  stats: { fixtures: number; predictions: number; valueSelections: number };
}

export type PredictionCard = Pick<
  Prediction,
  | 'fixtureId'
  | 'probabilities'
  | 'confidence'
  | 'valueBets'
  | 'recommended'
  | 'expectedGoals'
  | 'edge'
  | 'insights'
  | 'bothTeamsScore'
  | 'over25'
  | 'topScorelines'
>;

export function cardOf(prediction: Prediction): PredictionCard {
  return {
    fixtureId: prediction.fixtureId,
    probabilities: prediction.probabilities,
    confidence: prediction.confidence,
    valueBets: prediction.valueBets.slice(0, 3),
    recommended: prediction.recommended,
    expectedGoals: prediction.expectedGoals,
    edge: prediction.edge,
    insights: prediction.insights.slice(0, 2),
    bothTeamsScore: prediction.bothTeamsScore,
    over25: prediction.over25,
    topScorelines: prediction.topScorelines.slice(0, 3)
  };
}

/** Build every read-model document from the authoritative local engine. */
export function buildSnapshotBundle(): SnapshotBundle {
  const fixtures = getFixtures();
  const predictions = fixtures.map((fixture) => ({ fixture, prediction: getPrediction(fixture) }));
  const predictionMap = new Map(predictions.map((row) => [row.fixture.id, row.prediction]));
  const cards: Record<string, PredictionCard> = {};
  for (const row of predictions) cards[row.fixture.id] = cardOf(row.prediction);

  const active = predictions.filter((row) => row.fixture.status !== 'finished');
  const topCards = active.slice(0, 8).map((row) => ({ fixture: row.fixture, prediction: cardOf(row.prediction) }));
  const upcoming = fixtures.filter((f) => f.status === 'scheduled').slice(0, 8);
  const live = fixtures.filter((f) => f.status === 'live' || f.status === 'halftime').slice(0, 6);
  const board = getTopValueBets(400, fixtures).map((bet) => ({
    ...bet,
    fixture: bet.fixture,
    fixtureLabel: `${TEAM_MAP[bet.fixture.homeId]?.name} vs ${TEAM_MAP[bet.fixture.awayId]?.name}`,
    leagueLabel: LEAGUE_MAP[bet.fixture.leagueId]?.shortName,
    sport: bet.fixture.sport
  }));
  const brief = getDailyBrief();
  const movers = getOddsMovers().map((m) => ({
    fixtureId: m.fixture.id,
    kickoff: m.fixture.kickoff,
    status: m.fixture.status,
    leagueId: m.fixture.leagueId,
    homeId: m.fixture.homeId,
    awayId: m.fixture.awayId,
    selection: m.selection,
    odds: m.odds,
    drift: m.drift,
    edge: m.edge
  }));
  const runs = getTrainingRuns();
  const performance = getModelPerformance();

  const snapshots: SnapshotDoc[] = [
    { key: 'fixtures', payload: JSON.stringify(fixtures), counts: { fixtures: fixtures.length } },
    { key: 'cards', payload: JSON.stringify(cards), counts: { cards: Object.keys(cards).length } },
    { key: 'board', payload: JSON.stringify(board), counts: { valueSelections: board.length } },
    {
      key: 'dashboard',
      payload: JSON.stringify({
        counts: {
          fixtures: fixtures.length,
          live: live.length,
          upcoming: upcoming.length,
          leagues: new Set(fixtures.map((f) => f.leagueId)).size,
          bookmakers: 8,
          sources: DATA_SOURCES.filter((s) => s.status !== 'planned').length,
          valueBets: board.length,
          avgConfidence: Math.round(active.reduce((a, r) => a + r.prediction.confidence, 0) / Math.max(1, active.length))
        },
        metrics: getMetrics(),
        curve: getBankroll().filter((_, i) => i % 2 === 0),
        live: topCards.filter((r) => live.some((f) => f.id === r.fixture.id)),
        upcoming: upcoming.map((f) => ({ fixture: f, prediction: cards[f.id] })),
        valueBets: board.slice(0, 6),
        brief: { ...brief, live: undefined, upcoming: undefined, value: undefined },
        movers
      }),
      counts: { board: board.length }
    },
    {
      key: 'models',
      payload: JSON.stringify({
        models: performance.map((p) => ({
          ...p.model,
          runs: p.runs.slice(0, 3),
          accuracySeries: p.accuracySeries,
          logLossSeries: p.logLossSeries
        })),
        runs: runs.slice(0, 12),
        allRuns: runs,
        summary: {
          total: MODELS.length,
          production: MODELS.filter((m) => m.status === 'production').length,
          shadow: MODELS.filter((m) => m.status === 'shadow').length,
          avgAccuracy: MODELS.filter((m) => m.accuracy > 0).reduce((a, m) => a + m.accuracy, 0) / MODELS.filter((m) => m.accuracy > 0).length,
          avgRoi: MODELS.filter((m) => m.roi > 0).reduce((a, m) => a + m.roi, 0) / MODELS.filter((m) => m.roi > 0).length,
          features: MODELS.reduce((a, m) => a + m.features, 0),
          samples: MODELS.reduce((a, m) => a + m.sampleSize, 0),
          driftAlerts: MODELS.filter((m) => m.drift > 0.025).length,
          completedRuns: runs.filter((r) => r.status === 'completed').length
        }
      }),
      counts: { models: MODELS.length, runs: runs.length }
    },
    {
      key: 'sources',
      payload: JSON.stringify({ sources: DATA_SOURCES, jobs: getScrapeJobs() }),
      counts: { sources: DATA_SOURCES.length, jobs: getScrapeJobs().length }
    },
    {
      key: 'analytics',
      payload: JSON.stringify({
        analytics: getAnalytics(),
        curve: getBankroll(),
        metrics: getMetrics(),
        bets: getPaperBets()
      })
    },
    {
      key: 'paper',
      payload: JSON.stringify({ bets: getPaperBets(), metrics: getMetrics(), curve: getBankroll() })
    },
    {
      key: 'live',
      payload: JSON.stringify({
        live: live.map((f) => ({ fixture: f, prediction: cards[f.id] })),
        recent: fixtures.filter((f) => f.status === 'finished').slice(-6).reverse().map((f) => ({ fixture: f, prediction: cards[f.id] })),
        upcoming: upcoming.map((f) => ({ fixture: f, prediction: cards[f.id] }))
      })
    }
  ];

  return {
    generatedAt: Date.now(),
    version: 'v7.3-live-1',
    snapshots,
    predictions: predictions.map((row) => ({
      fixtureKey: row.fixture.id,
      payload: JSON.stringify(row.prediction)
    })),
    stats: {
      fixtures: fixtures.length,
      predictions: predictions.length,
      valueSelections: board.length
    }
  };
}
