import { getBankroll, getMetrics, getPaperBets } from '#lib/engine/analytics';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  const bets = getPaperBets();
  const metrics = getMetrics();
  return {
    metrics,
    bets: bets.map((b) => ({ ...b })),
    curve: getBankroll().filter((_, i) => i % 3 === 0),
    summary: {
      open: bets.filter((b) => b.status === 'open').length,
      won: bets.filter((b) => b.status === 'won').length,
      lost: bets.filter((b) => b.status === 'lost').length,
      openStake: bets.filter((b) => b.status === 'open').reduce((a, b) => a + b.stakeNgn, 0),
      turnover: bets.filter((b) => b.status !== 'open').reduce((a, b) => a + b.stakeNgn, 0),
      pnl: bets.filter((b) => b.status !== 'open').reduce((a, b) => a + (b.pnlNgn ?? 0), 0)
    }
  };
};
