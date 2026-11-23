import { json } from '@sveltejs/kit';
import { listRuns, queueRun } from '#lib/server/training';
import { MODELS } from '#lib/data/catalog';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = () =>
  json({
    runs: listRuns().slice(0, 20),
    production: MODELS.filter((m) => m.status === 'production').map((m) => ({ id: m.id, name: m.name, sport: m.sport, accuracy: m.accuracy }))
  });

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const run = queueRun(body?.modelId, body?.sport);
  return json({
    ok: true,
    message: 'Training run queued. The current champion stays live until the challenger wins the walk-forward gate.',
    run
  });
};
