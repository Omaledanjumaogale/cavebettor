import { ARCHITECTURE_LAYERS, HARMONISATION, SPORT_MARKETS } from '#lib/data/harmonisation';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
  harmonisation: HARMONISATION,
  markets: SPORT_MARKETS,
  architecture: ARCHITECTURE_LAYERS,
  stats: {
    repos: HARMONISATION.filter((h) => h.kind === 'repo').length,
    sites: HARMONISATION.filter((h) => h.kind === 'site').length,
    features: HARMONISATION.reduce((a, h) => a + h.contributions.length, 0),
    modules: new Set(HARMONISATION.flatMap((h) => h.cavebettorModules)).size
  }
});
