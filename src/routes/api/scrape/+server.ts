import { error, json } from '@sveltejs/kit';
import { runScrape, scraperCapabilities } from '#lib/server/scrapers';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = () => json({ sources: scraperCapabilities() });

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!body?.sourceId) throw error(400, 'sourceId is required');
  const result = await runScrape(body.sourceId, { mode: body.mode, limit: body.limit });
  return json(result, { status: result.status === 'failed' ? 502 : 200 });
};
