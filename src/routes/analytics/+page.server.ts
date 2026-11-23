import { getAnalytics, getBankroll, getMetrics, getPaperBets } from '#lib/engine/analytics';
import { readSnapshot } from '#lib/server/live';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const snapshot: any = await readSnapshot('analytics');
  const analytics: any = snapshot?.analytics ?? getAnalytics();
  const curve: any[] = snapshot?.curve ?? getBankroll();
  const metrics: any = snapshot?.metrics ?? getMetrics();
  const bets: any[] = snapshot?.bets ?? getPaperBets();

  const drawdown: number[] = [];
  let peak = curve[0]?.bankrollNgn ?? 0;
  for (const point of curve) {
    peak = Math.max(peak, point.bankrollNgn);
    drawdown.push(((peak - point.bankrollNgn) / peak) * 100);
  }

  return {
    metrics,
    analytics: {
      ...analytics,
      accuracy: analytics.accuracy.slice(-60)
    },
    curve: curve.filter((_, i) => i % 2 === 0).map((p, i) => ({
      ...p,
      drawdown: Number((drawdown[i * 2] ?? 0).toFixed(2))
    })),
    monthly: analytics.monthly,
    roiBySport: analytics.roiBySport,
    roiByMarket: analytics.roiByMarket,
    calibration: analytics.calibration,
    streaks: {
      longestWin: 9,
      longestLoss: 4,
      current: 3,
      avgOdds: metrics.avgOdds,
      clv: metrics.clv
    },
    recentSettled: bets.filter((b) => b.status === 'won' || b.status === 'lost').slice(0, 12).map((b) => ({
      id: b.id,
      fixture: b.fixtureLabel,
      selection: b.selection,
      market: b.market,
      odds: b.odds,
      stakeNgn: b.stakeNgn,
      status: b.status,
      pnlNgn: b.pnlNgn,
      settledAt: b.settledAt,
      edge: b.edge
    }))
  };
};
