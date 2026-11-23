import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

/**
 * Scheduled maintenance. Collection itself runs on Cloudflare Workers because
 * it needs outbound HTTP and per-source rate limits; these jobs keep the
 * Convex store honest and trigger the self-training audit.
 */
crons.hourly('calibration and drift audit', { minuteUTC: 5 }, internal.models.audit, {});
crons.daily('prune stale odds snapshots', { hourUTC: 2, minuteUTC: 30 }, internal.pipeline.pruneOldOdds, {});

export default crons;
