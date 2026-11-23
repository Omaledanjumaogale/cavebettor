import { json } from '@sveltejs/kit';
import { searchWorkspace } from '#lib/engine/analytics';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
  const q = url.searchParams.get('q') ?? '';
  return json(searchWorkspace(q));
};
