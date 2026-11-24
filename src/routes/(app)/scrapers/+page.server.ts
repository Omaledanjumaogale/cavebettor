import { DATA_SOURCES } from '#lib/data/catalog';
import { getScrapeJobs } from '#lib/engine/analytics';
import { scraperCapabilities } from '#lib/server/scrapers';
import { readSnapshot } from '#lib/server/live';
import { apiFootballSportUsage, budgetSnapshot } from '#lib/server/providers/budget';
import type { DataSource } from '#lib/types';
import { env as privateEnv } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const snapshot: any = await readSnapshot('sources');
  const jobs: any[] = snapshot?.jobs ?? getScrapeJobs();
  const sources: DataSource[] = snapshot?.sources ?? DATA_SOURCES;
  const [budgets, sportUsage] = await Promise.all([budgetSnapshot(), apiFootballSportUsage()]);
  return {
    sources,
    jobs,
    budgets: budgets.map((b) => ({
      provider: b.provider,
      limit: b.limit,
      used: b.used,
      reserved: b.reserved,
      remaining: b.remaining,
      period: b.period,
      unit: b.unit,
      percent: b.limit ? Math.round((b.used / b.limit) * 100) : 0
    })),
    apiFootballBySport: sportUsage,
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
      oddApi: Boolean(process.env.ODD_API_KEY),
      balldontlie: Boolean(process.env.BALLDONTLIE_KEY),
      llm: Boolean(privateEnv.AGNES_AI_KEY || process.env.AGNES_AI_KEY || privateEnv.OPENAI_API_KEY || process.env.OPENAI_API_KEY),
      paystack: Boolean(privateEnv.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY),
      resend: Boolean(privateEnv.RESEND_API_KEY || process.env.RESEND_API_KEY),
      r2: Boolean(privateEnv.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID)
    }
  };
};
