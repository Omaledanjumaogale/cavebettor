import { SPORT_DASHBOARDS } from '#lib/data/sportDashboards';
import { mergedFixtures } from '#lib/server/feed';
import { getFixtures } from '#lib/engine/fixtures';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const feed = await mergedFixtures();
  const engine = getFixtures();

  const desks = SPORT_DASHBOARDS.map((def) => {
    const provider = feed.fixtures.filter((f) => def.leagueIds.includes(f.leagueId));
    const local = engine.filter((f) => def.leagueIds.includes(f.leagueId));
    const universe = provider.length ? provider : local;
    const live = universe.filter((f) => f.status === 'live' || f.status === 'halftime').length;
    return {
      id: def.id,
      name: def.name,
      icon: def.icon,
      accent: def.accent,
      tagline: def.tagline,
      engine: def.engine,
      providerHost: def.providerHost,
      leagues: def.leagueIds
        .map((id) => ({ id, fixtures: universe.filter((f) => f.leagueId === id).length }))
        .filter((l) => l.fixtures > 0),
      fixtures: universe.length,
      live,
      totalLive: feed.providerCount,
      providerBacked: provider.length > 0
    };
  });

  return { desks };
};
