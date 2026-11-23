import { DATA_SOURCES } from '#lib/data/catalog';
import { getScrapeJobs } from '#lib/engine/analytics';
import { scraperCapabilities } from '#lib/server/scrapers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  const jobs = getScrapeJobs();
  const sources = DATA_SOURCES;
  return {
    sources,
    jobs,
    capabilities: scraperCapabilities(),
    summary: {
      total: sources.length,
      healthy: sources.filter((s) => s.status === 'healthy').length,
      degraded: sources.filter((s) => s.status === 'degraded').length,
      needsKey: sources.filter((s) => s.status === 'needs-key').length,
      planned: sources.filter((s) => s.status === 'planned').length,
      records: sources.reduce((a, s) => a + s.recordsToday, 0),
      markets: Math.max(...sources.map((s) => s.markets)),
      avgCoverage: sources.reduce((a, s) => a + s.coverage, 0) / sources.length,
      avgReliability: sources.reduce((a, s) => a + s.reliability, 0) / sources.length,
      scrapers: sources.filter((s) => s.kind === 'scraper' || s.kind === 'repo').length,
      apis: sources.filter((s) => s.kind === 'api').length
    },
    keys: {
      apiFootball: Boolean(process.env.API_FOOTBALL_KEY),
      sportsdb: Boolean(process.env.SPORTSDB_KEY),
      oddsApi: Boolean(process.env.THE_ODDS_API_KEY),
      balldontlie: Boolean(process.env.BALLDONTLIE_KEY),
      llm: Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY),
      paystack: Boolean(process.env.PAYSTACK_SECRET_KEY)
    }
  };
};
