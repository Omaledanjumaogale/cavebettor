import { error, json } from '@sveltejs/kit';
import { BOOKMAKERS } from '#lib/data/catalog';
import { getFixture } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ params }) => {
  const fixture = getFixture(params.id);
  if (!fixture) throw error(404, 'Fixture not found');
  const prediction = getPrediction(fixture);
  return json({
    fixtureId: fixture.id,
    bookmakers: BOOKMAKERS,
    markets: prediction.markets.map((m) => ({
      id: m.id,
      label: m.label,
      outcomes: m.outcomes.map((o) => ({
        label: o.label,
        modelProbability: o.modelProbability,
        fairOdds: o.fairOdds,
        bestOdds: o.bookOdds,
        bestBook: o.bestBook,
        edge: o.edge
      }))
    })),
    updatedAt: prediction.generatedAt
  });
};
