import { redirect } from '@sveltejs/kit';
import { SPORTS } from '#lib/data/catalog';
import { shortlistArchive, shortlistForDate, filterShortlist } from '#lib/server/shortlist';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  // The shortlist board is part of the owner console.
  if (!locals.user || locals.user.role !== 'super_admin') redirect(303, '/auth/admin?next=/admin/shortlist');

  const today = new Date().toISOString().slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') ?? '') ? url.searchParams.get('date')! : today;
  const sport = url.searchParams.get('sport') ?? 'all';
  const league = url.searchParams.get('league') ?? 'all';
  const market = url.searchParams.get('market') ?? 'all';
  const tier = url.searchParams.get('tier') ?? 'all';
  const minProbability = Number(url.searchParams.get('min') ?? '0') || 0;
  const query = url.searchParams.get('q') ?? '';

  const [board, archive] = await Promise.all([shortlistForDate(date), shortlistArchive()]);
  const picks = filterShortlist(board, { sport, league, market, tier, minProbability, query });

  const leagues = [...new Map(board.picks.map((pick) => [pick.leagueId, { id: pick.leagueId, name: pick.league, country: pick.country }])).values()];

  return {
    date,
    today,
    archive: [...new Set([today, ...archive])].slice(0, 14),
    board: { ...board, picks },
    total: board.picks.length,
    filters: { sport, league, market, tier, minProbability, query },
    leagues,
    sports: SPORTS.map((s) => ({ id: s.id, name: s.name }))
  };
};
