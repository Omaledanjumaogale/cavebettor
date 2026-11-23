<script lang="ts">
  import { ArrowUpRight, Sparkles, Activity, TrendingUp, Wallet, Target, Radio, ChevronRight, RefreshCw, Zap, Bot, CircleAlert, Database, ShieldCheck, Clock } from '@lucide/svelte';
  import KpiCard from '#lib/components/KpiCard.svelte';
  import LineChart from '#lib/components/LineChart.svelte';
  import Donut from '#lib/components/Donut.svelte';
  import MatchRow from '#lib/components/MatchRow.svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import Sparkline from '#lib/components/Sparkline.svelte';
  import Gauge from '#lib/components/Gauge.svelte';
  import ConfidenceMeter from '#lib/components/ConfidenceMeter.svelte';
  import FormPills from '#lib/components/FormPills.svelte';
  import { fmtNgn, pct, signed } from '#lib/engine/core';
  import { formatDate, formatKickoff, relativeTime, countdown } from '#lib/format';
  import { LEAGUE_MAP, SPORT_MAP, TEAM_MAP } from '#lib/data/catalog';

  let { data } = $props();
  const m = $derived(data.metrics);
  const labels = $derived(data.curve.map((p: any) => formatDate(p.date, { day: 'numeric', month: 'short', year: undefined })));
  const bankrollValues = $derived(data.curve.map((p: any) => p.bankrollNgn));
  const profitValues = $derived(data.curve.map((p: any) => p.bankrollNgn - m.startingBankrollNgn));

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const sportColours: Record<string, string> = {
    football: '#c9ff4d', basketball: '#f6c453', tennis: '#6fc9ff', icehockey: '#a99bff', baseball: '#ff6478'
  };
  const donutSegments = $derived(
    data.roiBySport.map((s: any) => ({ label: SPORT_MAP[s.sport as keyof typeof SPORT_MAP].name, value: s.bets, colour: sportColours[s.sport] }))
  );

  let refreshing = $state(false);
  let refreshNote = $state('');

  async function refreshModels() {
    refreshing = true;
    refreshNote = '';
    try {
      const res = await fetch('/api/models/train', { method: 'POST' });
      const body = await res.json();
      refreshNote = res.ok ? `Training queued: ${body.run?.modelId ?? 'ensemble'} (${body.run?.status ?? 'queued'})` : body.message;
    } catch {
      refreshNote = 'Could not reach the training endpoint.';
    } finally {
      refreshing = false;
      setTimeout(() => (refreshNote = ''), 6000);
    }
  }
</script>

<svelte:head><title>CaveBettor — Command Centre</title></svelte:head>

<div class="space-y-5">
  <!-- Header -->
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog-dim">
        <span>{formatDate(now.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span class="h-1 w-1 rounded-full bg-fog-dim"></span>
        <span class="text-mint">Engine online</span>
        <span class="h-1 w-1 rounded-full bg-fog-dim"></span>
        <span>Africa/Lagos</span>
      </div>
      <h1 class="display text-[26px] font-bold tracking-tight text-white sm:text-[30px]">{greeting}, Omale.</h1>
      <p class="mt-1 max-w-2xl text-[12.5px] text-fog">
        {data.counts.fixtures} fixtures scanned across {data.counts.leagues} competitions. {data.counts.live} live now,
        {data.counts.valueBets ?? data.valueBets.length} selections clear the edge threshold.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button onclick={refreshModels} class="btn btn-ghost !py-2 text-[11.5px]" disabled={refreshing}>
        <RefreshCw size={13} class={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Queuing…' : 'Retrain models'}
      </button>
      <a href="/predictions" class="btn btn-primary !py-2 text-[11.5px]"><Sparkles size={13} /> Open value board</a>
    </div>
  </div>

  {#if refreshNote}
    <div class="rounded-xl border border-lime/25 bg-lime/[0.07] px-3.5 py-2 text-[11.5px] text-lime">{refreshNote}</div>
  {/if}

  <!-- Hero -->
  <div class="grid gap-4 xl:grid-cols-3">
    <div class="panel relative overflow-hidden p-5 xl:col-span-2">
      <div class="mesh pointer-events-none absolute inset-0 opacity-50"></div>
      <div class="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-lime/10 blur-3xl"></div>
      <div class="relative">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="chip chip-lime"><Zap size={11} /> Live intelligence feed</span>
          <span class="flex items-center gap-1.5 text-[10px] text-fog-dim">
            <span class="h-1.5 w-1.5 rounded-full bg-mint live-dot"></span>Updated {relativeTime(data.brief.generatedAt)}
          </span>
        </div>
        <h2 class="display mt-3 max-w-2xl text-[20px] font-bold leading-snug text-white sm:text-[23px]">
          The market has {data.valueBets.length} <span class="text-gradient">actionable edges</span> right now. Your paper bankroll is {m.profitNgn >= 0 ? 'up' : 'down'}
          <span class="num text-lime">{fmtNgn(Math.abs(m.profitNgn), { compact: true })}</span>.
        </h2>
        <p class="mt-2 max-w-xl text-[12px] leading-relaxed text-fog">{data.brief.body}</p>

        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-xl border border-white/[0.07] bg-black/20 p-3">
            <div class="stat-label">Model confidence</div>
            <div class="num mt-1 text-[19px] font-bold text-white">{data.counts.avgConfidence}%</div>
            <div class="mt-0.5 text-[10px] text-fog-dim">mean across board</div>
          </div>
          <div class="rounded-xl border border-white/[0.07] bg-black/20 p-3">
            <div class="stat-label">Markets priced</div>
            <div class="num mt-1 text-[19px] font-bold text-white">{data.counts.markets}</div>
            <div class="mt-0.5 text-[10px] text-fog-dim">{data.counts.bookmakers} bookmakers</div>
          </div>
          <div class="rounded-xl border border-white/[0.07] bg-black/20 p-3">
            <div class="stat-label">Data sources</div>
            <div class="num mt-1 text-[19px] font-bold text-white">{data.sources.healthy}<span class="text-[11px] text-fog-dim">/{data.sources.total}</span></div>
            <div class="mt-0.5 text-[10px] text-mint">healthy pipeline</div>
          </div>
          <div class="rounded-xl border border-white/[0.07] bg-black/20 p-3">
            <div class="stat-label">Tracked leagues</div>
            <div class="num mt-1 text-[19px] font-bold text-white">{data.counts.leagues}</div>
            <div class="mt-0.5 text-[10px] text-fog-dim">5 sports · global</div>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <a href="/fixtures" class="btn btn-primary !py-2 text-[11.5px]">Browse all fixtures <ArrowUpRight size={13} /></a>
          <a href="/live" class="btn btn-ghost !py-2 text-[11.5px]"><Radio size={12} /> {data.counts.live} live matches</a>
          <a href="/workspace" class="text-[11px] font-medium text-fog hover:text-white">Read the methodology →</a>
        </div>
      </div>
    </div>

    <!-- Daily brief -->
    <div class="panel flex flex-col p-5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="flex h-7 w-7 items-center justify-center rounded-lg border border-violet/25 bg-violet/10 text-violet"><Bot size={14} /></span>
          <div>
            <div class="text-[12px] font-semibold text-white">Analyst briefing</div>
            <div class="text-[9.5px] uppercase tracking-[0.14em] text-fog-dim">LLM · grounded on model output</div>
          </div>
        </div>
        <span class="chip !text-[9px]">v1.4</span>
      </div>
      <div class="mt-4 rounded-xl border border-white/[0.07] bg-black/20 p-3.5">
        <div class="text-[10px] font-semibold uppercase tracking-[0.14em] text-lime/80">{data.brief.headline}</div>
        <p class="mt-1.5 text-[11.5px] leading-relaxed text-white/75">{data.brief.analysis}</p>
      </div>
      <div class="mt-3 space-y-2">
        <div class="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-fog-dim">Watchlist</div>
        <div class="flex flex-wrap gap-1.5">
          {#each data.brief.watchlist as team}
            <span class="chip !text-[10px]">{team}</span>
          {/each}
        </div>
      </div>
      <div class="mt-auto pt-4">
        <div class="flex items-center justify-between text-[10px] text-fog-dim">
          <span>Ensemble v7.3 · 8 models</span>
          <a href="/predictions" class="flex items-center gap-1 font-semibold text-lime hover:underline">Full brief <ChevronRight size={11} /></a>
        </div>
      </div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
    <KpiCard
      label="Paper bankroll"
      value={fmtNgn(m.bankrollNgn, { compact: true })}
      sub={`${fmtNgn(m.profitNgn, { compact: true })} all-time P/L`}
      delta={m.roi}
      deltaLabel="ROI on turnover"
      spark={bankrollValues.slice(-24)}
      colour="#c9ff4d"
    />
    <KpiCard
      label="Yield"
      value={`${m.yield.toFixed(1)}%`}
      sub={`${m.settledBets} settled · ${m.openBets} open`}
      delta={m.clv}
      deltaLabel="closing line value"
      spark={data.curve.slice(-24).map((p: any) => p.yield)}
      colour="#35e7a1"
    />
    <KpiCard
      label="Strike rate"
      value={`${m.strikeRate.toFixed(1)}%`}
      sub={`Avg odds ${m.avgOdds.toFixed(2)}`}
      delta={2.4}
      deltaLabel="vs last 30 days"
      spark={data.accuracySeries.slice(-24)}
      colour="#6fc9ff"
    />
    <KpiCard
      label="Open exposure"
      value={fmtNgn(m.openExposureNgn, { compact: true })}
      sub={`${m.openBets} unsettled selections`}
      delta={-1.2}
      deltaLabel="of bankroll at risk"
      colour="#f6c453"
    />
    <KpiCard
      label="Max drawdown"
      value={`${m.maxDrawdown.toFixed(1)}%`}
      sub="90-day peak-to-trough"
      delta={-0.8}
      deltaLabel="within guardrail"
      colour="#ff6478"
    />
  </div>

  <!-- Charts -->
  <div class="grid gap-4 xl:grid-cols-3">
    <div class="panel p-4 xl:col-span-2">
      <SectionHeader title="Bankroll trajectory" description="₦1.25m paper desk · quarter-Kelly staking · settled selections" eyebrow="Performance" />
      <LineChart
        series={[
          { name: 'Bankroll (₦)', values: bankrollValues, colour: '#c9ff4d', area: true },
          { name: 'Profit vs start (₦)', values: profitValues, colour: '#35e7a1', dashed: true }
        ]}
        labels={labels}
        height={236}
        yFormat={(v) => fmtNgn(v, { compact: true })}
      />
    </div>
    <div class="panel p-4">
      <SectionHeader title="Book of business" description="Settled selections by sport" eyebrow="Allocation" />
      <div class="mt-2">
        <Donut segments={donutSegments} centerLabel="Settled" centerValue={String(m.settledBets)} centerSub="paper bets" size={150} />
      </div>
      <div class="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3">
        {#each data.roiBySport as s}
          <div class="flex items-center justify-between text-[11px]">
            <span class="flex items-center gap-1.5 text-fog">
              <span class="h-1.5 w-1.5 rounded-full" style={`background:${sportColours[s.sport]}`}></span>
              {SPORT_MAP[s.sport as keyof typeof SPORT_MAP].name}
            </span>
            <span class="num font-semibold" class:text-mint={s.roi > 0} class:text-rose={s.roi < 0}>{signed(s.roi)}%</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Live + value -->
  <div class="grid gap-4 xl:grid-cols-5">
    <div class="panel xl:col-span-3">
      <div class="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-4">
        <SectionHeader title="Live & imminent" description="Fixtures in play or kicking off soon" eyebrow="On the pitch" />
        <a href="/fixtures" class="btn btn-ghost !px-2.5 !py-1.5 text-[10.5px]">All fixtures <ChevronRight size={12} /></a>
      </div>
      <div class="mt-2">
        {#if data.live.length}
          {#each data.live as item}
            <div class="relative">
              <div class="absolute left-0 top-0 h-full w-[2px] bg-mint/60"></div>
              <MatchRow fixture={item.fixture} prediction={item.prediction} />
            </div>
          {/each}
        {:else}
          <div class="px-4 py-8 text-center text-[12px] text-fog-dim">No matches currently live. Check the upcoming schedule below.</div>
        {/if}
        {#each data.upcoming.slice(0, 4) as item}
          <MatchRow fixture={item.fixture} prediction={item.prediction} />
        {/each}
      </div>
      <div class="flex items-center justify-between px-4 py-3 text-[10px] text-fog-dim">
        <span>{data.counts.live} live · {data.counts.upcoming} upcoming</span>
        <a href="/live" class="flex items-center gap-1 font-semibold text-mint hover:underline">Live centre <ArrowUpRight size={11} /></a>
      </div>
    </div>

    <div class="panel xl:col-span-2">
      <div class="flex items-center justify-between px-4 pb-2 pt-4">
        <SectionHeader title="Top edges" description="Best model-vs-market gaps" eyebrow="Value board" />
        <a href="/predictions" class="text-[10.5px] font-semibold text-lime hover:underline">All</a>
      </div>
      <div class="divide-y divide-white/[0.05] px-2">
        {#each data.valueBets as bet, i}
          <a href={`/fixtures/${bet.fixtureId}`} class="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.03]">
            <span class="num flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[10px] font-bold text-fog">{i + 1}</span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[12px] font-semibold text-white">{bet.selection}</div>
              <div class="truncate text-[10px] text-fog-dim">{bet.market} · {bet.bookmaker}</div>
            </div>
            <div class="shrink-0 text-right">
              <div class="num text-[13px] font-bold text-lime">{bet.odds.toFixed(2)}</div>
              <div class="num text-[10px] font-semibold text-mint">+{(bet.edge * 100).toFixed(1)}%</div>
            </div>
            <ConfidenceMeter value={bet.confidence} size="sm" showLabel={false} />
          </a>
        {/each}
      </div>
      <div class="border-t border-white/[0.06] px-4 py-3">
        <a href="/predictions" class="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-lime hover:underline">Open the full value board <ArrowUpRight size={12} /></a>
      </div>
    </div>
  </div>

  <!-- Bottom grid -->
  <div class="grid gap-4 lg:grid-cols-3">
    <div class="panel p-4">
      <SectionHeader title="Model health" description="Production champions and drift" eyebrow="Model lab" />
      <div class="space-y-2.5">
        {#each data.models as model}
          <div class="rounded-xl border border-white/[0.06] bg-black/15 p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="truncate text-[12px] font-semibold text-white">{model.name}</div>
                <div class="mt-0.5 text-[10px] text-fog-dim">{model.version} · {model.status}</div>
              </div>
              <span class={`chip !px-2 !py-0.5 !text-[9px] ${model.drift > 0.025 ? 'chip-amber' : 'chip-mint'}`}>{model.drift > 0.025 ? 'Drift watch' : 'Stable'}</span>
            </div>
            <div class="mt-2 flex items-center justify-between text-[10.5px]">
              <span class="text-fog">Accuracy <span class="num font-semibold text-white">{(model.accuracy * 100).toFixed(1)}%</span></span>
              <span class="text-fog">ROI <span class="num font-semibold text-mint">+{model.roi.toFixed(1)}%</span></span>
              <span class="text-fog">Drift <span class="num font-semibold text-white">{(model.drift * 100).toFixed(1)}%</span></span>
            </div>
          </div>
        {/each}
      </div>
      <a href="/models" class="mt-3 flex items-center gap-1 text-[10.5px] font-semibold text-lime hover:underline">Model laboratory <ChevronRight size={11} /></a>
    </div>

    <div class="panel p-4">
      <SectionHeader title="Market movement" description="Where prices are being repriced" eyebrow="Odds radar" />
      <div class="space-y-1">
        {#each data.movers.slice(0, 6) as mover}
          <a href={`/fixtures/${mover.fixtureId}`} class="flex items-center gap-2 rounded-lg px-1.5 py-2 transition hover:bg-white/[0.03]">
            <span class="h-6 w-1 shrink-0 rounded-full" style={`background:${LEAGUE_MAP[mover.leagueId]?.colour}`}></span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[11.5px] font-medium text-white">{TEAM_MAP[mover.homeId]?.shortName} vs {TEAM_MAP[mover.awayId]?.shortName}</div>
              <div class="truncate text-[9.5px] text-fog-dim">{mover.selection}</div>
            </div>
            <div class="text-right">
              <div class="num text-[11.5px] font-semibold text-white">{mover.odds.toFixed(2)}</div>
              <div class={`num text-[9.5px] font-semibold ${mover.drift >= 0 ? 'text-mint' : 'text-rose'}`}>{mover.drift >= 0 ? '▲' : '▼'} {Math.abs(mover.drift * 100).toFixed(1)}%</div>
            </div>
          </a>
        {/each}
      </div>
      <a href="/odds" class="mt-2 flex items-center gap-1 text-[10.5px] font-semibold text-lime hover:underline">Odds & markets <ChevronRight size={11} /></a>
    </div>

    <div class="panel p-4">
      <SectionHeader title="Pipeline health" description="Collection and normalisation" eyebrow="Data ops" />
      <div class="mb-3 flex items-center gap-3">
        <Gauge value={(data.sources.healthy / data.sources.total) * 100} size={118} label="Healthy" colour="#35e7a1" />
        <div class="space-y-2 text-[11px]">
          <div class="flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full bg-mint"></span><span class="text-fog">Healthy</span><span class="num ml-auto font-semibold text-white">{data.sources.healthy}</span></div>
          <div class="flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full bg-amber"></span><span class="text-fog">Degraded</span><span class="num ml-auto font-semibold text-white">{data.sources.degraded}</span></div>
          <div class="flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full bg-sky"></span><span class="text-fog">Needs key</span><span class="num ml-auto font-semibold text-white">{data.sources.needsKey}</span></div>
          <div class="flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full bg-white/30"></span><span class="text-fog">Rows today</span><span class="num ml-auto font-semibold text-white">{(data.sources.records / 1000).toFixed(1)}k</span></div>
        </div>
      </div>
      <div class="rounded-xl border border-white/[0.06] bg-black/20 p-3 text-[10.5px] leading-relaxed text-fog">
        <span class="flex items-center gap-1.5 font-semibold text-white"><Database size={11} class="text-lime" /> Self-training loop active</span>
        <p class="mt-1">Nightly walk-forward retraining, hourly calibration checks and a 4.2% drift rollback guard. Scrapers respect robots and rate limits; API sources activate when keys are set.</p>
      </div>
      <a href="/scrapers" class="mt-2 flex items-center gap-1 text-[10.5px] font-semibold text-lime hover:underline">Pipeline control room <ChevronRight size={11} /></a>
    </div>
  </div>

  <!-- League coverage -->
  <div class="panel p-4">
    <SectionHeader title="League coverage" description="Every competition in the harmonised universe" eyebrow="Coverage" />
    <div class="flex flex-wrap gap-1.5">
      {#each data.leagues as league}
        <a href={`/fixtures?league=${league.id}`} class="group flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[10.5px] text-fog transition hover:border-lime/25 hover:text-white">
          <span class="h-2 w-2 rounded-sm" style={`background:${league.colour}`}></span>
          {league.shortName}
          <span class="text-fog-dim">{league.countryCode}</span>
          {#if league.fixtures > 0}<span class="num rounded bg-white/[0.06] px-1 text-[9px] text-white/60">{league.fixtures}</span>{/if}
        </a>
      {/each}
    </div>
  </div>
</div>
