import { json } from '@sveltejs/kit';
import { syncSecret } from '#lib/server/live';
import { budgetSnapshot } from '#lib/server/providers/budget';
import type { RequestHandler } from './$types';

export const prerender = false;

/** GET /api/providers/budget — current usage against every paid ceiling. */
export const GET: RequestHandler = async () => {
  const snapshot = await budgetSnapshot();
  return json({
    ok: true,
    snapshot,
    generatedAt: new Date().toISOString()
  });
};

/**
 * POST /api/providers/budget
 *
 * Ask for permission to spend one unit of a provider's allowance. Used by the
 * Convex collection action before it calls out to a paid provider, so the
 * daily and monthly ceilings are enforced in one place.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const body = (await request.json().catch(() => ({}))) as { provider?: string; units?: number };
  const provider = body.provider as 'api-football' | 'the-odds-api' | 'odd-api';
  const units = Math.max(1, Number(body.units ?? 1));

  const expected = syncSecret();
  const supplied = request.headers.get('x-cavebettor-sync-secret') ?? '';
  let diff = expected.length ^ supplied.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  const trusted = Boolean(expected) && diff === 0;

  const snapshot = await budgetSnapshot();
  const row = snapshot.find((r) => r.provider === provider);
  if (!row) return json({ ok: false, error: 'Unknown provider' }, { status: 400 });

  if (!trusted) {
    // Untrusted callers can inspect but not spend.
    return json({ ok: false, allowed: false, remaining: row.remaining, error: 'Unauthorized' }, { status: 401 });
  }

  const { reserve } = await import('#lib/server/providers/budget');
  const permission = await reserve(provider, units);
  return json({
    ok: true,
    allowed: Boolean(permission),
    remaining: permission?.remaining ?? 0,
    limit: row.limit,
    period: row.period
  });
};
