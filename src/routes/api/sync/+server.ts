import { json } from '@sveltejs/kit';
import { syncLiveData, syncSecret } from '#lib/server/live';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ request, locals }) => {
  const expected = syncSecret();
  const supplied = request.headers.get('x-cavebettor-sync-secret') ?? '';
  let diff = expected.length ^ supplied.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  const authorized = Boolean(expected) && diff === 0;
  if (!authorized && locals.user?.role !== 'super_admin') {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncLiveData();
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Sync failed' }, { status: 500 });
  }
};
