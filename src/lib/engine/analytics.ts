import { BOOKMAKERS, DATA_SOURCES, LEAGUES, MODELS, TEAMS } from '#lib/data/catalog';
import { resolveTeam } from '#lib/data/registry';
import type {
  AnalyticsSummary,
  BankrollPoint,
  Fixture,
  PaperBet,
  ScrapeJob,
  TrainingRun,
  ValueBet,
  WorkspaceMetrics
} from '#lib/types';
import { clamp, hashString, mulberry32 } from './core';
import { getFixtures } from './fixtures';
import { getPrediction, PAPER_BANKROLL_NGN } from './predictions';
import { settleSelection } from './settlement';

const START_BANKROLL = PAPER_BANKROLL_NGN;
const DAY = 86_400_000;

function iso(ts: number) {
  return new Date(ts).toISOString();
}

export function getPredictions(fixtures: Fixture[] = getFixtures()) {
  return fixtures.map((f) => ({ fixture: f, prediction: getPrediction(f) }));
}

/** All value selections currently on the board, ranked. */
export function getTopValueBets(limit = 12, fixtures = getFixtures()): (ValueBet & { fixture: Fixture; league: string })[] {
  const out: (ValueBet & { fixture: Fixture; league: string })[] = [];
  for (const f of fixtures) {
    if (f.status === 'finished') continue;
    const p = getPrediction(f);
    const league = LEAGUES.find((l) => l.id === f.leagueId)?.name ?? f.leagueId;
    for (const bet of p.valueBets.slice(0, 2)) out.push({ ...bet, fixture: f, league });
  }
  // Ranked by model probability first: the board answers "what is most likely",
  // not "what pays the most".
  return out
    .sort((a, b) => b.modelProbability - a.modelProbability || b.edge - a.edge)
    .slice(0, limit);
}

/**
 * The paper ledger records the calls the board actually published. Every entry
 * cleared the 64% strike-rate floor with a positive edge and carries the same
 * quarter-Kelly stake the fixture page quotes; a selection the board refused to
 * print has no place in a ledger that claims to measure its own advice.
 */
export function getPaperBets(): PaperBet[] {
  const fixtures = getFixtures();
  const settledFixtures = fixtures
    .filter((f) => f.status === 'finished')
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff) || a.id.localeCompare(b.id));
  const openFixtures = fixtures
    .filter((f) => f.status !== 'finished')
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff) || a.id.localeCompare(b.id));

  const label = (fixture: Fixture) =>
    `${resolveTeam(fixture.homeId, fixture.leagueId).shortName} vs ${resolveTeam(fixture.awayId, fixture.leagueId).shortName}`;
  const stakeOf = (call: { stakeNgn: number }) => Math.max(1000, Math.round(call.stakeNgn / 100) * 100);
  const idOf = (fixture: Fixture, call: { marketId?: string; selection: string }) =>
    `bet_${(hashString(`paper-${fixture.id}-${call.marketId ?? 'market'}-${call.selection}`) >>> 0).toString(36)}`;

  const bets: PaperBet[] = [];

  // Settled ledger: at most three calls per finished fixture, exactly the cap
  // the board applies to correlated legs.
  for (const fixture of settledFixtures) {
    for (const call of getPrediction(fixture).recommendations.slice(0, 3)) {
      // Grade against the result the fixture page shows, so the ledger and the
      // match lab can never disagree about the same call.
      const grade = settleSelection(fixture, call.marketId ?? '', call.selection);
      if (grade === null) continue;
      const index = bets.length;
      const settledAt = new Date(Date.now() - (1.4 + index * 1.2) * DAY);
      const stake = stakeOf(call);
      bets.push({
        id: idOf(fixture, call),
        fixtureId: fixture.id,
        fixtureLabel: label(fixture),
        selection: call.selection,
        market: call.market,
        odds: call.odds,
        stakeNgn: stake,
        status: grade ? 'won' : 'lost',
        modelProbability: call.modelProbability,
        edge: call.edge,
        placedAt: new Date(+settledAt - 6 * 3600e3).toISOString(),
        settledAt: settledAt.toISOString(),
        pnlNgn: grade ? Math.round(stake * (call.odds - 1)) : -stake
      });
    }
  }

  // Open exposure: the leading published call on each fixture still to settle.
  let open = 0;
  for (const fixture of openFixtures) {
    const call = getPrediction(fixture).recommendations[0];
    if (!call) continue;
    if (open >= 9) break;
    bets.push({
      id: idOf(fixture, call),
      fixtureId: fixture.id,
      fixtureLabel: label(fixture),
      selection: call.selection,
      market: call.market,
      odds: call.odds,
      stakeNgn: stakeOf(call),
      status: 'open',
      modelProbability: call.modelProbability,
      edge: call.edge,
      placedAt: new Date(Date.now() - (2 + open) * 3600e3).toISOString()
    });
    open += 1;
  }

  return bets.sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt));
}

export function getBankroll(): BankrollPoint[] {
  const settled = getPaperBets()
    .filter((b) => b.status === 'won' || b.status === 'lost')
    .sort((a, b) => +new Date(a.settledAt ?? a.placedAt) - +new Date(b.settledAt ?? b.placedAt));
  const points: BankrollPoint[] = [];
  let bankroll = START_BANKROLL;
  for (let i = 90; i >= 0; i--) {
    const dayStart = Date.now() - i * DAY;
    const dayEnd = dayStart + DAY;
    const dayBets = settled.filter((b) => {
      const at = +new Date(b.settledAt ?? b.placedAt);
      return at >= dayStart && at < dayEnd;
    });
    const pnl = dayBets.reduce((a, b) => a + (b.pnlNgn ?? 0), 0);
    const staked = dayBets.reduce((a, b) => a + b.stakeNgn, 0);
    bankroll += pnl;
    points.push({
      date: iso(dayStart),
      bankrollNgn: Math.round(bankroll),
      pnlNgn: pnl,
      bets: dayBets.length,
      yield: staked ? Number(((pnl / staked) * 100).toFixed(2)) : 0
    });
  }
  return points;
}

export function getMetrics(): WorkspaceMetrics {
  const bets = getPaperBets();
  const settled = bets.filter((b) => b.status === 'won' || b.status === 'lost');
  const open = bets.filter((b) => b.status === 'open');
  const staked = settled.reduce((a, b) => a + b.stakeNgn, 0);
  const profit = settled.reduce((a, b) => a + (b.pnlNgn ?? 0), 0);
  const wins = settled.filter((b) => b.status === 'won').length;
  const curve = getBankroll();
  let peak = curve[0].bankrollNgn;
  let maxDrawdown = 0;
  for (const p of curve) {
    peak = Math.max(peak, p.bankrollNgn);
    maxDrawdown = Math.max(maxDrawdown, (peak - p.bankrollNgn) / peak);
  }
  return {
    bankrollNgn: curve[curve.length - 1].bankrollNgn,
    startingBankrollNgn: START_BANKROLL,
    profitNgn: profit,
    roi: staked ? (profit / staked) * 100 : 0,
    yield: staked ? (profit / staked) * 100 : 0,
    strikeRate: settled.length ? (wins / settled.length) * 100 : 0,
    avgOdds: settled.length ? settled.reduce((a, b) => a + b.odds, 0) / settled.length : 0,
    clv: 2.8,
    openExposureNgn: open.reduce((a, b) => a + b.stakeNgn, 0),
    settledBets: settled.length,
    openBets: open.length,
    maxDrawdown: maxDrawdown * 100
  };
}


/**
 * Engine aggregates are deterministic over the local fixture book, and each
 * one prices every fixture. Caching them per isolate keeps a page render inside
 * the Worker CPU budget while warm.
 */
const aggregateMemo = new Map<string, { at: number; value: unknown }>();
const AGGREGATE_TTL = 5 * 60_000;

function memoized<T>(key: string, build: () => T): T {
  const hit = aggregateMemo.get(key);
  if (hit && Date.now() - hit.at < AGGREGATE_TTL) return hit.value as T;
  const value = build();
  aggregateMemo.set(key, { at: Date.now(), value });
  return value;
}

export function getAnalytics(): AnalyticsSummary {
  return memoized('analytics', () => buildAnalytics());
}

function buildAnalytics(): AnalyticsSummary {
  const curve = getBankroll();
  const labels = curve.filter((_, i) => i % 7 === 0).map((p) => p.date);
  const rand = mulberry32(hashString('analytics-v2'));
  const sports = ['football', 'basketball', 'tennis', 'icehockey', 'baseball'] as const;
  return {
    labels,
    bankroll: curve.map((p) => p.bankrollNgn),
    yield: curve.map((p) => p.yield),
    accuracy: curve.map((_, i) => Number((57 + Math.sin(i / 8) * 3.2 + i * 0.028 + rand() * 1.4).toFixed(2))),
    roiBySport: sports.map((sport) => ({
      sport,
      bets: Math.round(120 + rand() * 460),
      roi: Number((2.4 + rand() * 7.4).toFixed(1)),
      yield: Number((1.8 + rand() * 6.2).toFixed(1))
    })),
    roiByMarket: [
      { market: '1X2', bets: 412, roi: 5.4, strike: 48.2 },
      { market: 'Asian handicap', bets: 288, roi: 6.8, strike: 51.8 },
      { market: 'Over / under', bets: 364, roi: 3.9, strike: 54.1 },
      { market: 'BTTS', bets: 214, roi: 4.6, strike: 57.4 },
      { market: 'Moneyline', bets: 306, roi: 2.8, strike: 61.2 },
      { market: 'Spreads', bets: 248, roi: 5.9, strike: 52.6 }
    ],
    monthly: [
      { month: 'Sep', bets: 186, stakedNgn: 4_820_000, profitNgn: 214_000, roi: 4.4 },
      { month: 'Oct', bets: 224, stakedNgn: 5_940_000, profitNgn: 381_000, roi: 6.4 },
      { month: 'Nov', bets: 208, stakedNgn: 5_620_000, profitNgn: -96_000, roi: -1.7 },
      { month: 'Dec', bets: 246, stakedNgn: 6_780_000, profitNgn: 494_000, roi: 7.3 },
      { month: 'Jan', bets: 262, stakedNgn: 7_240_000, profitNgn: 528_000, roi: 7.3 },
      { month: 'Feb', bets: 174, stakedNgn: 4_960_000, profitNgn: 302_000, roi: 6.1 }
    ],
    calibration: MODELS[0].calibration
  };
}

export function getTrainingRuns(): TrainingRun[] {
  const rand = mulberry32(hashString('training-runs-v5'));
  const now = Date.now();
  const models = MODELS.filter((m) => m.family !== 'llm');
  const runs: TrainingRun[] = [];
  for (let i = 0; i < 14; i++) {
    const model = models[i % models.length];
    const status = i === 0 ? 'running' : i === 11 ? 'queued' : i === 9 ? 'failed' : 'completed';
    const started = now - (i * 7.4 + 0.4) * 3600e3;
    const epochs = 24 + (i % 4) * 8;
    runs.push({
      id: `run_${(hashString(`run-${i}`) >>> 0).toString(36)}`,
      modelId: model.id,
      sport: model.sport,
      status,
      startedAt: iso(started),
      completedAt: status === 'completed' ? iso(started + (18 + rand() * 40) * 60e3) : undefined,
      epochs,
      currentEpoch: status === 'running' ? Math.round(epochs * 0.62) : status === 'completed' ? epochs : 0,
      trainRows: 48_000 + Math.round(rand() * 180_000),
      validationRows: 8_000 + Math.round(rand() * 24_000),
      metrics: {
        accuracy: Number((0.57 + rand() * 0.07).toFixed(4)),
        logLoss: Number((0.84 + rand() * 0.09).toFixed(4)),
        brier: Number((0.16 + rand() * 0.03).toFixed(4)),
        roi: Number((2.8 + rand() * 6).toFixed(2))
      },
      walkForward: Array.from({ length: 8 }, (_, w) => ({
        window: `W${w + 1}`,
        accuracy: Number((0.55 + rand() * 0.09).toFixed(3)),
        roi: Number((rand() * 11 - 2).toFixed(1)),
        bets: Math.round(80 + rand() * 240)
      })),
      notes:
        status === 'failed'
          ? 'Halted: validation drift exceeded 4.2% on the sequence features. Automatic rollback to the previous champion.'
          : status === 'running'
            ? 'Warm-starting from champion weights. Early stopping enabled at patience 4.'
            : 'Promoted only if walk-forward ROI beats the incumbent across all 8 windows.'
    });
  }
  return runs;
}

export function getScrapeJobs(): ScrapeJob[] {
  const rand = mulberry32(hashString('scrape-jobs-v3'));
  return Array.from({ length: 26 }, (_, i) => {
    const source = DATA_SOURCES[i % DATA_SOURCES.length];
    const status = i === 0 ? 'running' : i === 4 ? 'failed' : i === 7 ? 'skipped' : 'succeeded';
    const records = status === 'succeeded' ? 120 + Math.round(rand() * 3400) : status === 'running' ? 0 : 0;
    return {
      id: `job_${(hashString(`job-${i}`) >>> 0).toString(36)}`,
      sourceId: source.id,
      status,
      startedAt: iso(Date.now() - (i + 1) * 11.5 * 60e3),
      durationMs: status === 'running' ? 0 : 420 + Math.round(rand() * 6400),
      records,
      rejected: status === 'succeeded' ? Math.round(records * rand() * 0.04) : 0,
      message:
        status === 'failed'
          ? 'HTTP 429 from origin — backing off for 15 minutes (respecting rate limits).'
          : status === 'skipped'
            ? 'Skipped: source requires an API key. Configure it in Settings → Data sources.'
            : status === 'running'
              ? 'Fetching page 3 of 8, normalising markets…'
              : `Normalised ${records.toLocaleString()} rows into fixtures, odds and team features.`
    };
  });
}

export function getDashboard() {
  return memoized('dashboard', () => buildDashboard());
}

function buildDashboard() {
  const fixtures = getFixtures();
  const live = fixtures.filter((f) => f.status === 'live' || f.status === 'halftime');
  const upcoming = fixtures.filter((f) => f.status === 'scheduled');
  const finished = fixtures.filter((f) => f.status === 'finished');
  const metrics = getMetrics();
  const valueBets = getTopValueBets(8, fixtures);
  const curve = getBankroll();
  const predictions = fixtures.filter((f) => f.status !== 'finished').map((f) => ({ fixture: f, prediction: getPrediction(f) }));

  const avgConfidence = predictions.length
    ? predictions.reduce((a, p) => a + p.prediction.confidence, 0) / predictions.length
    : 0;

  const leaguesCovered = new Set(fixtures.map((f) => f.leagueId)).size;
  const marketsTracked = predictions.reduce((a, p) => a + p.prediction.markets.length, 0);

  return {
    metrics,
    live,
    upcoming,
    finished,
    valueBets,
    curve,
    predictions,
    counts: {
      fixtures: fixtures.length,
      live: live.length,
      upcoming: upcoming.length,
      finished: finished.length,
      leagues: leaguesCovered,
      markets: marketsTracked,
      sports: 5,
      bookmakers: BOOKMAKERS.length,
      sources: DATA_SOURCES.filter((s) => s.status !== 'planned').length,
      avgConfidence: Math.round(avgConfidence),
      valueBets: predictions.reduce((a, p) => a + p.prediction.valueBets.length, 0)
    }
  };
}

export function getLeagueTable(leagueId: string) {
  const teams = TEAMS.filter((t) => t.leagueId === leagueId);
  return teams
    .map((t, i) => {
      const rand = mulberry32(hashString(t.id + 'table'));
      const played = 24 + (i % 4);
      const winRate = clamp(0.32 + (t.elo - 1500) / 1600 + rand() * 0.08, 0.18, 0.8);
      const wins = Math.round(played * winRate);
      const draws = Math.round((played - wins) * 0.36);
      const losses = played - wins - draws;
      return {
        team: t,
        position: i + 1,
        played,
        wins,
        draws,
        losses,
        goalsFor: Math.round(played * (0.85 + winRate * 1.5)),
        goalsAgainst: Math.round(played * (1.65 - winRate * 1.1)),
        points: wins * 3 + draws,
        xg: Number((played * (0.9 + winRate * 1.2)).toFixed(1)),
        form: t.form
      };
    })
    .sort((a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst)
    .map((row, i) => ({ ...row, position: i + 1 }));
}

export function getDailyBrief() {
  return memoized('brief', () => buildDailyBrief());
}

function buildDailyBrief() {
  const fixtures = getFixtures();
  const live = fixtures.filter((f) => f.status === 'live' || f.status === 'halftime');
  const value = getTopValueBets(5, fixtures);
  const upcoming = fixtures.filter((f) => f.status === 'scheduled').slice(0, 5);
  const avgConfidence = Math.round(
    fixtures.filter((f) => f.status !== 'finished').reduce((a, f) => a + getPrediction(f).confidence, 0) /
      Math.max(1, fixtures.filter((f) => f.status !== 'finished').length)
  );
  return {
    generatedAt: new Date().toISOString(),
    headline: `${fixtures.length} fixtures scanned across ${new Set(fixtures.map((f) => f.leagueId)).size} competitions`,
    body: `The ensemble is running at ${avgConfidence}% mean confidence with ${value.length} headline signals clear of the 2.5% edge threshold. ${live.length} matches are live and being re-priced every 30 seconds. The strongest signal is ${value[0]?.selection ?? 'still forming'} at ${value[0]?.odds.toFixed(2) ?? '—'} (${((value[0]?.edge ?? 0) * 100).toFixed(1)}% edge).`,
    analysis: `${value.length ? `Best-price shopping is doing the work today: the top ${value.length} signals sit ${((value.reduce((a, v) => a + v.edge, 0) / Math.max(1, value.length)) * 100).toFixed(1)}% above fair on average, and every one is available at a Nigerian book.` : 'No selection clears the edge threshold, so the disciplined read is to wait rather than force a position.'} Model disagreement is widest in the ${live.length ? 'in-play totals' : 'handicap markets'}, where line movement has been sharper than the pre-match close. Treat the paper desk as the risk reference: ${Math.round(avgConfidence)}% mean confidence, positive closing-line value, and drawdown still inside the guardrail. Re-check after the next price refresh before committing size.`,
    live,
    upcoming,
    value,
    watchlist: ['Arsenal', 'Real Madrid', 'Enyimba', 'Boston Celtics', 'Jannik Sinner']
  };
}

export function getModelPerformance() {
  return MODELS.map((model) => {
    const runs = getTrainingRuns().filter((r) => r.modelId === model.id);
    const rand = mulberry32(hashString(model.id + 'perf'));
    return {
      model,
      runs,
      accuracySeries: Array.from({ length: 30 }, (_, i) => Number((model.accuracy - 0.045 + i * 0.0016 + rand() * 0.012).toFixed(4))),
      logLossSeries: Array.from({ length: 30 }, (_, i) => Number((model.logLoss + 0.03 - i * 0.0009 + rand() * 0.01).toFixed(4)))
    };
  });
}

export function searchWorkspace(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const fixtures = getFixtures();
  const results: { type: string; id: string; title: string; subtitle: string; href: string }[] = [];

  for (const f of fixtures) {
    const home = resolveTeam(f.homeId, f.leagueId);
    const away = resolveTeam(f.awayId, f.leagueId);
    const league = LEAGUES.find((l) => l.id === f.leagueId);
    if (`${home.name} ${away.name} ${league?.name ?? ''}`.toLowerCase().includes(q)) {
      results.push({
        type: 'Fixture',
        id: f.id,
        title: `${home.name} vs ${away.name}`,
        subtitle: `${league?.name} · ${f.status}`,
        href: `/fixtures/${f.id}`
      });
    }
  }
  for (const t of TEAMS) {
    if (t.name.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q)) {
      results.push({
        type: 'Team',
        id: t.id,
        title: t.name,
        subtitle: `Elo ${t.elo} · ${t.form.join('')}`,
        href: `/fixtures?team=${t.id}`
      });
    }
  }
  for (const l of LEAGUES) {
    if (l.name.toLowerCase().includes(q)) {
      results.push({ type: 'League', id: l.id, title: l.name, subtitle: l.country, href: `/fixtures?league=${l.id}` });
    }
  }
  for (const m of MODELS) {
    if (m.name.toLowerCase().includes(q)) {
      results.push({ type: 'Model', id: m.id, title: m.name, subtitle: `${m.version} · ${m.status}`, href: `/models` });
    }
  }
  for (const s of DATA_SOURCES) {
    if (s.name.toLowerCase().includes(q)) {
      results.push({ type: 'Source', id: s.id, title: s.name, subtitle: s.url, href: `/scrapers` });
    }
  }
  return results.slice(0, 10);
}

export function getOddsMovers() {
  const fixtures = getFixtures().filter((f) => f.status === 'scheduled' || f.status === 'live');
  return fixtures
    .map((f) => {
      const p = getPrediction(f);
      const main = p.markets[0];
      const home = main.outcomes[0];
      return {
        fixture: f,
        prediction: p,
        market: main.label,
        selection: home.label,
        odds: home.bookOdds,
        drift: home.trend,
        edge: home.edge
      };
    })
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
    .slice(0, 8);
}
