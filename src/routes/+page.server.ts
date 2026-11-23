import { getAnalytics, getDashboard, getDailyBrief, getOddsMovers, getTopValueBets } from '#lib/engine/analytics';
import { LEAGUES, MODELS, DATA_SOURCES, TEAM_MAP, LEAGUE_MAP } from '#lib/data/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  const dashboard = getDashboard();
  const analytics = getAnalytics();
  const brief = getDailyBrief();
  const movers = getOddsMovers();

  return {
    counts: dashboard.counts,
    metrics: dashboard.metrics,
    curve: dashboard.curve.filter((_, i) => i % 2 === 0),
    live: dashboard.live.slice(0, 6).map((f) => ({
      fixture: f,
      prediction: dashboard.predictions.find((p) => p.fixture.id === f.id)!.prediction
    })),
    upcoming: dashboard.upcoming.slice(0, 8).map((f) => ({
      fixture: f,
      prediction: dashboard.predictions.find((p) => p.fixture.id === f.id)!.prediction
    })),
    valueBets: getTopValueBets(6).map((v) => ({
      ...v,
      fixture: null,
      fixtureLabel: `${TEAM_MAP[v.fixture.homeId]?.name} vs ${TEAM_MAP[v.fixture.awayId]?.name}`,
      fixtureId: v.fixture.id,
      leagueLabel: LEAGUE_MAP[v.fixture.leagueId]?.shortName,
      sport: v.fixture.sport
    })),
    brief: {
      ...brief,
      live: undefined,
      upcoming: undefined,
      value: undefined
    },
    movers: movers.map((m) => ({
      fixtureId: m.fixture.id,
      kickoff: m.fixture.kickoff,
      status: m.fixture.status,
      leagueId: m.fixture.leagueId,
      homeId: m.fixture.homeId,
      awayId: m.fixture.awayId,
      selection: m.selection,
      odds: m.odds,
      drift: m.drift,
      edge: m.edge
    })),
    roiBySport: analytics.roiBySport,
    roiByMarket: analytics.roiByMarket,
    monthly: analytics.monthly,
    leagues: LEAGUES.map((l) => ({
      ...l,
      tracked: dashboard.counts.leagues > 0,
      fixtures: dashboard.upcoming.filter((f) => f.leagueId === l.id).length + dashboard.live.filter((f) => f.leagueId === l.id).length
    })),
    models: MODELS.slice(0, 4).map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      accuracy: m.accuracy,
      roi: m.roi,
      version: m.version,
      drift: m.drift
    })),
    sources: {
      total: DATA_SOURCES.length,
      healthy: DATA_SOURCES.filter((s) => s.status === 'healthy').length,
      degraded: DATA_SOURCES.filter((s) => s.status === 'degraded').length,
      needsKey: DATA_SOURCES.filter((s) => s.status === 'needs-key').length,
      records: DATA_SOURCES.reduce((a, s) => a + s.recordsToday, 0)
    },
    accuracySeries: analytics.accuracy.slice(-30)
  };
};
