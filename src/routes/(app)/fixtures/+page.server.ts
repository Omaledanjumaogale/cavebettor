import { LEAGUES, SPORTS, TEAM_MAP } from '#lib/data/catalog';
import { fixtureLeague, homeTeam, awayTeam } from '#lib/data/registry';
import { getPrediction } from '#lib/engine/predictions';
import { cardOf } from '#lib/snapshot';
import { liveCards } from '#lib/server/live';
import { feedMeta, pageFixtureUniverse, sportCounts } from '#lib/server/feed';
import { FINISHED_TTL_MS, lifecycleOf } from '#lib/server/lifecycle';
import { compareSchedule, nextUp, sortBySchedule } from '#lib/schedule';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 48;

export const load: PageServerLoad = async ({ url }) => {
  const sport = url.searchParams.get('sport') ?? 'all';
  const league = url.searchParams.get('league') ?? 'all';
  const status = url.searchParams.get('status') ?? 'all';
  const q = (url.searchParams.get('q') ?? '').toLowerCase();
  const view = url.searchParams.get('view') === 'table' ? 'table' : 'grid';
  const day = url.searchParams.get('day') ?? 'all';
  // Kick-off window: "next hour" through "next 24 hours".
  const within = url.searchParams.get('within') ?? 'all';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);

  const [universe, cards, meta] = await Promise.all([pageFixtureUniverse(), liveCards(), feedMeta()]);
  const all = universe.fixtures;

  const dayKey = (iso: string) => iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const days = [...new Set(all.map((f) => dayKey(f.kickoff)))].sort();

  const WINDOWS: Record<string, number> = { '1h': 1, '3h': 3, '6h': 6, '12h': 12, '24h': 24 };
  const windowHours = WINDOWS[within] ?? 0;
  const now = Date.now();

  // A result is only listed while it is inside the retention window; after
  // that it has been archived for retraining and leaves the interface.
  const inResultsWindow = (f: (typeof all)[number]) => {
    const life = lifecycleOf(f);
    return life.state === 'finished' && !life.expired;
  };

  const filtered = all.filter((f) => {
    if (sport !== 'all' && f.sport !== sport) return false;
    if (league !== 'all' && f.leagueId !== league) return false;
    if (day !== 'all' && dayKey(f.kickoff) !== day) return false;
    // "All fixtures" means everything still to play or in play — results live
    // in the Finished tab, never in the upcoming list.
    if (status === 'all' && f.status === 'finished') return false;
    if (status === 'live' && f.status !== 'live' && f.status !== 'halftime') return false;
    if (status === 'upcoming' && f.status !== 'scheduled') return false;
    if (status === 'finished' && !inResultsWindow(f)) return false;
    if (windowHours) {
      const kickoff = +new Date(f.kickoff);
      if (f.status === 'finished') return false;
      if (f.status === 'scheduled' && (kickoff < now || kickoff > now + windowHours * 3_600_000)) return false;
    }
    if (q) {
      const hay = `${homeTeam(f).name} ${awayTeam(f).name} ${fixtureLeague(f).name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Rank by the schedule before slicing: the page must show the next matches,
  // not the most likely ones. Probability ranks the value board instead.
  const scheduled = status === 'finished' ? [...filtered].sort((a, b) => compareSchedule(b, a)) : sortBySchedule(filtered);

  // Predictions are only computed for the slice that is actually rendered.
  const pageCount = Math.max(1, Math.ceil(scheduled.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const window = scheduled.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rows = window
    .map((fixture) => ({ fixture, prediction: cards?.[fixture.id] ?? cardOf(getPrediction(fixture)) }))
    .filter((row) => (status === 'value' ? row.prediction.valueBets.length > 0 : true));

  // The single earliest kick-off that has not started yet, marked on the page.
  const upcomingNext = nextUp(rows, Date.now());
  const nextUpId = upcomingNext?.fixture.id ?? null;

  // Every competition that actually has fixtures — provider leagues included.
  const leagueCounts = new Map<string, { id: string; name: string; shortName: string; sport: string; country: string; colour: string; count: number }>();
  for (const fixture of all) {
    const record = fixtureLeague(fixture);
    const existing = leagueCounts.get(record.id);
    if (existing) existing.count += 1;
    else
      leagueCounts.set(record.id, {
        id: record.id,
        name: record.name,
        shortName: record.shortName,
        sport: record.sport,
        country: record.country,
        colour: record.colour,
        count: 1
      });
  }
  // Catalogue leagues with no fixtures today are still listed so the filter
  // does not silently change shape between refreshes.
  for (const catalogue of LEAGUES) {
    if (!leagueCounts.has(catalogue.id)) {
      leagueCounts.set(catalogue.id, {
        id: catalogue.id,
        name: catalogue.name,
        shortName: catalogue.shortName,
        sport: catalogue.sport,
        country: catalogue.country,
        colour: catalogue.colour,
        count: 0
      });
    }
  }
  const leagues = [...leagueCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const counts = sportCounts(all);
  const upcoming = all.filter((f) => f.status === 'scheduled').length;
  const live = all.filter((f) => f.status === 'live' || f.status === 'halftime').length;
  const finished = all.filter(inResultsWindow).length;

  return {
    filters: { sport, league, status, q, view, day, within },
    ordering: {
      by: status === 'finished' ? 'finishedAt:desc' : 'kickoff:asc',
      generatedAt: new Date().toISOString(),
      nextUpId
    },
    total: all.length,
    filteredTotal: filtered.length,
    stats: { live, upcoming, finished, leagues: leagueCounts.size, provider: universe.source === 'provider' },
    finishedWindowHours: FINISHED_TTL_MS / 3_600_000,
    sportCounts: counts,
    page: safePage,
    pageCount,
    fixtures: rows,
    leagues: leagues.slice(0, 400),
    days,
    today,
    sports: SPORTS,
    feed: {
      source: universe.source,
      generatedAt: meta?.generatedAt ?? null,
      ageMs: meta?.ageMs ?? null,
      stale: meta?.stale ?? false,
      leagues: meta?.leagues ?? leagueCounts.size,
      liveCount: meta?.liveCount ?? live
    }
  };
};
