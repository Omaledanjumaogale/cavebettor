import { json } from '@sveltejs/kit';
import { syncSecret } from '#lib/server/live';
import { archiveRetainedResults, readRetainedResults } from '#lib/server/training/history';
import { runNightlyEvaluation } from '#lib/server/training/retrain';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * POST /api/models/retrain
 *
 * Nightly self-training (04:00 Africa/Lagos). Requires the machine-to-machine
 * sync secret. Evaluates candidate models chronologically against the
 * retained results and promotes a candidate only when it passes every
 * improvement check; otherwise the current champion stays in production.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const expected = syncSecret();
  const supplied = request.headers.get('x-cavebettor-sync-secret') ?? '';
  let diff = expected.length ^ supplied.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  const authorized = Boolean(expected) && diff === 0;
  if (!authorized && locals.user?.role !== 'super_admin') {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const archived = await archiveRetainedResults();
  const history = await readRetainedResults();
  const evaluation = runNightlyEvaluation(history);

  return json({
    ok: true,
    ranAt: new Date().toISOString(),
    schedule: '04:00 Africa/Lagos daily (03:00 UTC)',
    retainedResults: archived.rows,
    archiveChanged: archived.changed,
    champion: evaluation.champion,
    promoted: evaluation.promoted,
    results: evaluation.results,
    note:
      'Evaluation used retained stored results and existing historical exports only. No paid sports or odds request was consumed.'
  });
};

/** GET /api/models/retrain — read-only view of the last evaluation. */
export const GET: RequestHandler = async () => {
  const history = await readRetainedResults();
  const evaluation = runNightlyEvaluation(history);
  return json({
    ok: true,
    retainedResults: history.length,
    champion: evaluation.champion,
    promoted: evaluation.promoted,
    results: evaluation.results
  });
};
