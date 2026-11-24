import { env as privateEnv } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
  keys: {
    apiFootball: Boolean(process.env.API_FOOTBALL_KEY),
    sportsdb: Boolean(process.env.SPORTSDB_KEY),
    oddsApi: Boolean(process.env.THE_ODDS_API_KEY),
    balldontlie: Boolean(process.env.BALLDONTLIE_KEY),
    llm: Boolean(privateEnv.AGNES_AI_KEY || process.env.AGNES_AI_KEY || privateEnv.OPENAI_API_KEY || process.env.OPENAI_API_KEY),
    paystack: Boolean(privateEnv.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY),
    resend: Boolean(privateEnv.RESEND_API_KEY || process.env.RESEND_API_KEY),
    google: Boolean(privateEnv.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID),
    github: Boolean(privateEnv.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID),
    cloudflare: Boolean(privateEnv.CLOUDFLARE_AI_TOKEN || process.env.CLOUDFLARE_AI_TOKEN),
    r2: Boolean(privateEnv.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID)
  }
});
