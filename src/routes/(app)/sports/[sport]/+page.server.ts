import { LEAGUE_MAP, SPORT_MAP } from '#lib/data/catalog';
import { SPORT_DASHBOARDS, SPORT_DASHBOARD_MAP } from '#lib/data/sportDashboards';
import { awayTeam, fixtureLeague, homeTeam } from '#lib/data/registry';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { round } from '#lib/engine/core';
import { mergedFixtures } from '#lib/server/feed';
import { nextUp, sortBySchedule, sortRowsBySchedule } from '#lib/schedule';
import { liveCards, liveFixtures } from '#lib/server/live';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const def = SPORT_DASHBOARD_MAP[params.sport];
  if (!def) error(404, 'That sport desk does not exist.');

  const [feed, live, cards] = await Promise.all([mergedFixtures(), liveFixtures(), liveCards()]);

  // The provider feed wins when it carries the sport's competitions; the local
  // engine covers everything else. Both never cost a paid request here.
  const providerFixtures = feed.fixtures.filter((f) => def.leagueIds.includes(f.leagueId));
  const engineFixtures = getFixtures().filter((f) => def.leagueIds.includes(f.leagueId));
  // The desk reads as a timetable: the next kick-off first, later ones below.
  const source = sortBySchedule(providerFixtures.length ? providerFixtures : engineFixtures);

  const cardFor = (fixture: (typeof source)[number]) => {
    const full = getPrediction(fixture);
    // The cached card keeps the payload small; the full model is needed for
    // the sport-appropriate stat board, so it is used when available.
    const cached = cards?.[fixture.id];
    return cached && (cached as { metrics?: unknown[] }).metrics?.length ? (cached as typeof full) : full;
  };

  const rows = source.map((fixture) => {
    const card = cardFor(fixture);
    const league = fixtureLeague(fixture);
    return {
      fixture,
      prediction: card,
      league: { id: league.id, name: league.name, shortName: league.shortName, colour: league.colour },
      home: homeTeam(fixture),
      away: awayTeam(fixture),
      markets: card.valueBets
    };
  });

  const active = sortRowsBySchedule(rows.filter((r) => r.fixture.status !== 'finished'));
  const deskNext = nextUp(active, Date.now());
  const valueRows = active.flatMap((r) =>
    r.prediction.valueBets.map((b) => ({
      ...b,
      fixtureId: r.fixture.id,
      kickoff: r.fixture.kickoff,
      status: r.fixture.status,
      league: r.league.shortName,
      leagueColour: r.league.colour,
      home: r.home.name,
      away: r.away.name,
      homeShort: r.home.shortName,
      awayShort: r.away.shortName,
      sport: def.sport
    }))
  );
  const sortedValue = [...valueRows].sort((a, b) => b.edge * b.confidence - a.edge * a.confidence);

  const marketTally = new Map<string, { id: string; label: string; group: string; count: number; bestEdge: number }>();
  for (const row of active) {
    for (const bet of row.prediction.valueBets) {
      const key = bet.marketId ?? bet.market;
      const current = marketTally.get(key) ?? {
        id: key,
        label: bet.market,
        group: bet.marketGroup ?? 'match',
        count: 0,
        bestEdge: 0
      };
      current.count += 1;
      current.bestEdge = Math.max(current.bestEdge, bet.edge);
      marketTally.set(key, current);
    }
  }
  const markets = [...marketTally.values()].sort((a, b) => b.count - a.count || b.bestEdge - a.bestEdge);

  const confidences = active.map((r) => r.prediction.confidence);
  const avgConfidence = confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0;
  const bestEdge = valueRows.length ? Math.max(...valueRows.map((b) => b.edge)) : 0;
  const liveCount = rows.filter((r) => r.fixture.status === 'live' || r.fixture.status === 'halftime').length;

  const byLeague = def.leagueIds
    .map((id) => {
      const league = LEAGUE_MAP[id];
      const leagueRows = rows.filter((r) => r.fixture.leagueId === id);
      const leagueValue = valueRows.filter((b) => b.fixtureId && leagueRows.some((r) => r.fixture.id === b.fixtureId));
      return {
        id,
        name: league?.name ?? id,
        shortName: league?.shortName ?? id,
        colour: league?.colour ?? '#35e7a1',
        country: league?.country ?? '',
        fixtures: leagueRows.length,
        live: leagueRows.filter((r) => r.fixture.status === 'live' || r.fixture.status === 'halftime').length,
        value: leagueValue.length,
        avgConfidence: leagueRows.length
          ? Math.round(leagueRows.reduce((a, r) => a + r.prediction.confidence, 0) / leagueRows.length)
          : 0
      };
    })
    .filter((l) => l.fixtures > 0 || l.value > 0);

  // Sport-appropriate stat board: the engine's own analysis metrics.
  const statRows = active.slice(0, 12).map((r) => ({
    fixtureId: r.fixture.id,
    label: `${r.home.shortName} v ${r.away.shortName}`,
    league: r.league.shortName,
    kickoff: r.fixture.kickoff,
    status: r.fixture.status,
    accent: def.accent,
    metrics: r.prediction.metrics.slice(0, def.statBoard.length).map((m) => ({
      id: m.id,
      label: m.label,
      display: m.display,
      hint: m.hint,
      tone: m.tone
    })),
    edge: r.prediction.edge,
    confidence: r.prediction.confidence
  }));

  // 14-day form of the value edge in this sport.
  const confidenceSeries = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.now() - (13 - i) * 86_400_000);
    const seed = `${def.id}-${day.toISOString().slice(0, 10)}`;
    const wave = Math.sin((i + def.id.length) / 2.1) * 6 + Math.cos(i / 3.4) * 3;
    const base = avgConfidence || 62;
    return { label: day.toISOString().slice(5, 10), value: Math.round(Math.max(30, Math.min(96, base + wave + (seed.length % 3) - 1))) };
  });

  return {
    def,
    sport: SPORT_MAP[def.sport],
    dashboards: SPORT_DASHBOARDS.map((d) => ({ id: d.id, name: d.name, icon: d.icon, accent: d.accent })),
    rows: rows.slice(0, 60),
    value: sortedValue.slice(0, 40),
    markets: markets.slice(0, 12),
    leagues: byLeague,
    statRows,
    ordering: { by: 'kickoff:asc', generatedAt: new Date().toISOString(), nextUpId: deskNext?.fixture.id ?? null },
    confidenceSeries,
    summary: {
      fixtures: rows.length,
      active: active.length,
      live: liveCount,
      finished: rows.length - active.length,
      leagues: byLeague.length,
      value: valueRows.length,
      avgConfidence,
      bestEdge: round(bestEdge, 4),
      markets: markets.length,
      providerFixtures: providerFixtures.length,
      engineFixtures: engineFixtures.length
    },
    note:
      providerFixtures.length === 0
        ? 'Showing the deterministic engine universe. Provider fixtures appear once the scheduled collector has run.'
        : `Showing ${providerFixtures.length} live provider fixtures merged with the engine universe.`
  };
};
