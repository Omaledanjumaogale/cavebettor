import { error } from '@sveltejs/kit';
import { fixtureLeague, resolveTeam, homeTeam, awayTeam } from '#lib/data/registry';
import { feedMeta, mergedFixtures } from '#lib/server/feed';
import { getPrediction } from '#lib/engine/predictions';
import { round } from '#lib/engine/core';
import { formatKickoff } from '#lib/format';
import type { Fixture } from '#lib/types';
import type { PageServerLoad } from './$types';

/**
 * Team profile.
 *
 * Everything here is derived from the collected fixture window in the isolate
 * memo, so opening a team page costs no provider request and no Convex call.
 */
export const load: PageServerLoad = async ({ params }) => {
  const id = decodeURIComponent(params.id);
  const [wire, meta] = await Promise.all([mergedFixtures(), feedMeta()]);

  const involved = wire.fixtures.filter((fixture) => fixture.homeId === id || fixture.awayId === id);
  if (!involved.length) {
    const fallback = resolveTeam(id);
    if (fallback.name === id) throw error(404, 'That team is not in the current collection window.');
  }

  const first = involved[0];
  const team = resolveTeam(id, first?.leagueId);
  const league = first ? fixtureLeague(first) : null;

  const shape = (fixture: Fixture) => {
    const home = homeTeam(fixture);
    const away = awayTeam(fixture);
    const view = fixtureLeague(fixture);
    return {
      id: fixture.id,
      home: home.name,
      away: away.name,
      league: view?.name ?? fixture.leagueId,
      country: view?.country ?? '',
      kickoff: fixture.kickoff,
      kickoffLabel: formatKickoff(fixture.kickoff),
      status: fixture.status,
      homeScore: fixture.score?.home ?? 0,
      awayScore: fixture.score?.away ?? 0
    };
  };

  const now = Date.now();
  const upcoming = involved
    .filter((fixture) => fixture.status === 'scheduled' && +new Date(fixture.kickoff) >= now)
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff))
    .slice(0, 8)
    .map(shape);
  const live = involved
    .filter((fixture) => fixture.status === 'live' || fixture.status === 'halftime')
    .map(shape);
  const finished = involved
    .filter((fixture) => fixture.status === 'finished')
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff))
    .slice(0, 8)
    .map(shape);

  // A short read on the next fixture, computed only for the profile page.
  let prediction: string | null = null;
  if (first && first.status !== 'finished') {
    const card = getPrediction(first);
    const opponent = first.homeId === id ? awayTeam(first).name : homeTeam(first).name;
    const best = card.recommendations?.[0];
    prediction = best
      ? `${team.name} host ${opponent}: ${(card.probabilities.home * 100).toFixed(0)}% home / ${(card.probabilities.draw * 100).toFixed(0)}% draw / ${(card.probabilities.away * 100).toFixed(0)}% away. Highest-confidence selection is ${best.selection} at ${best.odds.toFixed(2)} (${(best.modelProbability * 100).toFixed(1)}% model strike rate).`
      : `${team.name} against ${opponent}: the model has no selection clearing its probability and value thresholds.`;
  }

  return {
    team: { ...team, elo: round(team.elo, 0) },
    league,
    record: { upcoming, live, finished, prediction },
    meta: { updatedAt: meta?.generatedAt ?? null, stale: meta?.stale ?? true }
  };
};
