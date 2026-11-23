import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
  keys: {
    apiFootball: Boolean(process.env.API_FOOTBALL_KEY),
    sportsdb: Boolean(process.env.SPORTSDB_KEY),
    oddsApi: Boolean(process.env.THE_ODDS_API_KEY),
    balldontlie: Boolean(process.env.BALLDONTLIE_KEY),
    llm: Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY),
    paystack: Boolean(process.env.PAYSTACK_SECRET_KEY)
  }
});
