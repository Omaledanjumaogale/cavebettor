import { error, json } from '@sveltejs/kit';
import { getFixture } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { generateAnalysis } from '#lib/server/llm';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
  const fixture = getFixture(params.id);
  if (!fixture) throw error(404, 'Fixture not found');
  const analysis = await generateAnalysis(fixture, getPrediction(fixture));
  return json(analysis);
};
