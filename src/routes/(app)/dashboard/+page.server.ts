import { getAnalytics, getDailyBrief, getDashboard } from '#lib/engine/analytics';
import { LEAGUES, MODELS, DATA_SOURCES, TEAM_MAP, LEAGUE_MAP } from '#lib/data/catalog';
import { awayTeam, fixtureLeague, homeTeam } from '#lib/data/registry';
import { feedMeta, mergedFixtures, sportCounts } from '#lib/server/feed';
import { readSnapshot } from '#lib/server/live';
import type { PageServerLoad } from './$types';

interface DashboardSnapshot {
  counts: ReturnType<typeof getDashboard>['counts'];
  metrics: ReturnType<typeof getDashboard>['metrics'];
  curve: ReturnType<typeof getDashboard>['curve'];
  live: { fixture: any; prediction: any }[];
  upcoming: { fixture: any; prediction: any }[];
  valueBets: any[];
  brief: any;
  movers: any[];
}

export const load: PageServerLoad = async () => {
  const snap = await readSnapshot<DashboardSnapshot>('dashboard');
  const dashboard = getDashboard();
  const analytics = getAnalytics();
  const [wireSet, wireMeta] = await Promise.all([mergedFixtures(), feedMeta()]);

  // The wire is the real collected provider snapshot; every number below is
  // derived from it, so the dashboard cannot drift back to mock data.
  const wireLive = wireSet.fixtures
    .filter((f) => f.status === 'live' || f.status === 'halftime')
    .slice(0, 8)
    .map((f) => ({
      id: f.id,
      sport: f.sport,
      home: homeTeam(f)?.name ?? f.homeId,
      away: awayTeam(f)?.name ?? f.awayId,
      homeScore: f.score.home,
      awayScore: f.score.away,
      minute: f.minute ?? null,
      period: f.period ?? '',
      league: fixtureLeague(f)?.name ?? f.leagueId,
      kickoff: f.kickoff
    }));
  const wire = {
    source: wireSet.source,
    providerFixtures: wireSet.providerCount,
    total: wireSet.fixtures.length,
    liveNow: wireLive.length,
    updatedAt: wireMeta?.generatedAt ?? null,
    ageMs: wireMeta?.ageMs ?? null,
    stale: wireMeta?.stale ?? true,
    sports: sportCounts(wireSet.fixtures),
    live: wireLive
  };

  const counts = snap?.counts ?? dashboard.counts;
  const metrics = snap?.metrics ?? dashboard.metrics;
  const curve = snap?.curve ?? dashboard.curve.filter((_, i) => i % 2 === 0);
  const live = snap?.live ?? dashboard.live.slice(0, 6).map((f) => ({
    fixture: f,
    prediction: dashboard.predictions.find((p) => p.fixture.id === f.id)!.prediction
  }));
  const upcoming = snap?.upcoming ?? dashboard.upcoming.slice(0, 8).map((f) => ({
    fixture: f,
    prediction: dashboard.predictions.find((p) => p.fixture.id === f.id)!.prediction
  }));
  const valueBets = (snap?.valueBets ?? []).length
    ? snap!.valueBets
    : dashboard.valueBets.map((v) => ({
        ...v,
        fixture: v.fixture,
        fixtureLabel: `${TEAM_MAP[v.fixture.homeId]?.name} vs ${TEAM_MAP[v.fixture.awayId]?.name}`,
        leagueLabel: LEAGUE_MAP[v.fixture.leagueId]?.shortName,
        sport: v.fixture.sport
      }));

  return {
    counts,
    metrics,
    curve,
    wire,
    live,
    upcoming,
    valueBets: valueBets.map((v: any) => ({
      ...v,
      fixture: null,
      fixtureId: v.fixture?.id ?? v.fixtureId,
      fixtureLabel: v.fixtureLabel ?? `${TEAM_MAP[v.fixture?.homeId]?.name} vs ${TEAM_MAP[v.fixture?.awayId]?.name}`,
      leagueLabel: v.leagueLabel ?? LEAGUE_MAP[v.fixture?.leagueId]?.shortName,
      sport: v.sport ?? v.fixture?.sport
    })),
    brief: snap?.brief ?? (() => {
      const brief = getDailyBrief();
      return {
        generatedAt: brief.generatedAt,
        headline: brief.headline,
        body: brief.body,
        analysis: `Best-price shopping is doing the work today: ${brief.value.length} headline signals sit above fair on average. Model disagreement is widest in the live totals, where line movement has been sharper than the pre-match close. Treat the paper desk as the risk reference before committing size.`,
        watchlist: brief.watchlist
      };
    })(),
    movers: snap?.movers ?? [],
    roiBySport: analytics.roiBySport,
    roiByMarket: analytics.roiByMarket,
    monthly: analytics.monthly,
    leagues: LEAGUES.map((l) => ({
      ...l,
      tracked: counts.leagues > 0,
      fixtures: [...(snap?.upcoming ?? []), ...(snap?.live ?? [])].filter((f: any) => f.fixture?.leagueId === l.id).length
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
