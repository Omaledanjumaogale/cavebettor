import { json } from '@sveltejs/kit';
import { MODELS } from '#lib/data/catalog';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * GET /api/engine — the in-app intelligence engine: version, coverage, the
 * board's own thresholds and the model registry behind them.
 *
 * The pipeline control room links its internal engine row here, so this has to
 * answer with the same engine the fixture pages price.
 */
export const GET: RequestHandler = () => {
  const fixtures = getFixtures();
  const cards = fixtures.map((fixture) => getPrediction(fixture));
  const selections = cards.reduce((sum, card) => sum + card.recommendations.length, 0);
  const markets = cards.reduce((sum, card) => sum + card.markets.length, 0);
  const mean = (values: number[]) =>
    values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4)) : null;
  const published = cards.flatMap((card) => card.recommendations);

  return json({
    service: 'cavebettor-engine',
    version: cards[0]?.modelVersion ?? null,
    ensembleVersion: cards[0]?.ensembleVersion ?? null,
    time: new Date().toISOString(),
    coverage: {
      fixtures: fixtures.length,
      competitions: new Set(fixtures.map((fixture) => fixture.leagueId)).size,
      sports: [...new Set(fixtures.map((fixture) => fixture.sport))],
      markets,
      selections
    },
    board: {
      probabilityFloor: 0.64,
      edgeFloor: 0.01,
      meanProbability: mean(published.map((row) => row.modelProbability)),
      meanPrice: mean(published.map((row) => row.odds)),
      meanEdge: mean(published.map((row) => row.edge ?? 0))
    },
    models: MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      family: model.family,
      sport: model.sport,
      version: model.version,
      status: model.status,
      accuracy: model.accuracy
    }))
  });
};