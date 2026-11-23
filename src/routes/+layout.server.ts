import { getDashboard } from '#lib/engine/analytics';
import { DEMO_USER } from '#lib/data/catalog';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
  const dashboard = getDashboard();
  return {
    counts: {
      live: dashboard.counts.live,
      upcoming: dashboard.counts.upcoming,
      value: dashboard.counts.valueBets,
      fixtures: dashboard.counts.fixtures
    },
    user: DEMO_USER
  };
};
