import { json } from '@sveltejs/kit';
import { getFixtures } from '#lib/engine/fixtures';
import { DATA_SOURCES, MODELS } from '#lib/data/catalog';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = () => {
  const fixtures = getFixtures();
  return json({
    status: 'ok',
    service: 'cavebettor',
    version: '1.0.0',
    time: new Date().toISOString(),
    engine: 'CaveBettor Ensemble v7.3',
    fixtures: fixtures.length,
    live: fixtures.filter((f) => f.status === 'live' || f.status === 'halftime').length,
    models: MODELS.filter((m) => m.status === 'production').length,
    sources: DATA_SOURCES.length,
    llm: process.env.OPENAI_API_KEY ? 'configured' : 'grounded-template',
    convex: process.env.PUBLIC_CONVEX_URL ? 'configured' : 'local-engine',
    currency: 'NGN'
  });
};
