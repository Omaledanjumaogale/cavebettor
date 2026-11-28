<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Radio, RefreshCw, ArrowUpRight, Activity, Sparkles, Clock, ChevronRight, Zap } from '@lucide/svelte';
  import TeamBadge from '#lib/components/TeamBadge.svelte';
  import SportGlyph from '#lib/components/SportGlyph.svelte';
  import KickoffClock from '#lib/components/KickoffClock.svelte';
  import ProbabilityBar from '#lib/components/ProbabilityBar.svelte';
  import Sparkline from '#lib/components/Sparkline.svelte';
  import ConfidenceMeter from '#lib/components/ConfidenceMeter.svelte';
  import FormPills from '#lib/components/FormPills.svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import { clock } from '#lib/now.svelte';
  import { schedulePhase, sortRowsBySchedule } from '#lib/schedule';
  import { formatKickoff, relativeTime } from '#lib/format';
  import { fmtNgn } from '#lib/engine/core';

  let { data } = $props();
  let sport = $state('all');
  let auto = $state(true);
  let refreshing = $state(false);
  let lastUpdate = $state(new Date().toISOString());

  // The live centre reads in kick-off order: the match that started first is
  // at the top, and a new kick-off slots in without reshuffling the rest.
  const orderedLive = $derived(sortRowsBySchedule(data.live as any[]));
  const orderedUpcoming = $derived(sortRowsBySchedule(data.upcoming as any[]));
  const shown = $derived((orderedLive as any[]).filter((m: any) => sport === 'all' || m.fixture.sport === sport));
  const nextKickoff = $derived.by(() => {
    const now = clock.now;
    return (orderedUpcoming as any[]).find((row: any) => schedulePhase(row.fixture, now) !== 'past') ?? null;
  });
  const allEdges = $derived(
    [...data.live.flatMap((m: any) => m.prediction.valueBets.map((b: any) => ({ ...b, fixture: m.fixture, home: m.home, away: m.away, league: m.league })))].sort((a, b) => b.edge - a.edge).slice(0, 8)
  );

  async function refresh() {
    refreshing = true;
    await invalidateAll();
    lastUpdate = new Date().toISOString();
    refreshing = false;
  }

  onMount(() => {
    const timer = setInterval(() => {
      if (auto && document.visibilityState === 'visible') refresh();
    }, 30_000);
    return () => clearInterval(timer);
  });
</script>

<svelte:head><title>Live matches & in-play probabilities — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mint">
        <span class="live-dot h-1.5 w-1.5 rounded-full bg-mint"></span> Live centre
      </div>
      <h1 class="display text-[22px] font-bold tracking-tight text-white sm:text-[26px]">In-play intelligence</h1>
      <p class="mt-1 text-[12.5px] text-fog">Kickoff calls stay frozen. The scoreboard is live context; the recommended markets and confidence you see are the ones published before the first whistle.</p>
      <div class="mt-2 flex flex-wrap items-center gap-2 text-[10.5px] text-fog-dim">
        <span class="chip {data.origin === 'provider' ? 'chip-lime' : 'chip-amber'}">
          {data.origin === 'provider' ? 'API-Sports live feed' : data.origin === 'convex' ? 'cached snapshot' : 'engine fallback'}
        </span>
        {#if data.meta.updatedAt}
          <span class="flex items-center gap-1"><Clock size={10} /> synced {relativeTime(data.meta.updatedAt)}</span>
        {/if}
        <span class="num">{data.meta.providerFixtures} fixtures · {data.meta.leagues} competitions on file</span>
      </div>
    </div>
    <div class="flex w-full items-center gap-2 sm:w-auto">
      <button onclick={() => (auto = !auto)} class={`btn btn-ghost !py-2 text-[11px] ${auto ? '!border-mint/30 !text-mint' : ''}`}>
        <span class={`h-1.5 w-1.5 rounded-full ${auto ? 'bg-mint live-dot' : 'bg-fog-dim'}`}></span>{auto ? 'Auto-refresh on' : 'Paused'}
      </button>
      <button onclick={refresh} class="btn btn-ghost flex-1 !py-2 text-[11px] sm:flex-none" disabled={refreshing}><RefreshCw size={12} class={refreshing ? 'animate-spin' : ''} /> Refresh</button>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
    {#each [
      { label: 'Live matches', value: String(data.counts.live), sub: `${data.counts.leagues} competitions`, colour: '#35e7a1' },
      { label: 'Goals in play', value: String(data.counts.goals), sub: 'across all live games', colour: '#c9ff4d' },
      { label: 'Value calls', value: String(data.counts.value), sub: 'clearing 0.5% threshold', colour: '#f6c453' },
      { label: 'Last refresh', value: relativeTime(lastUpdate), sub: 'Africa/Lagos', colour: '#6fc9ff' }
    ] as kpi}
      <div class="panel p-3.5">
        <div class="stat-label">{kpi.label}</div>
        <div class="display num mt-1.5 text-[22px] font-bold" style={`color:${kpi.colour}`}>{kpi.value}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">{kpi.sub}</div>
      </div>
    {/each}
  </div>

  <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
    <button onclick={() => (sport = 'all')} class={`chip shrink-0 ${sport === 'all' ? '!border-lime/35 !bg-lime/10 !text-lime' : ''}`}>All sports</button>
    {#each data.sports as s}
      <button onclick={() => (sport = s.id)} class={`chip shrink-0 ${sport === s.id ? '!border-lime/35 !bg-lime/10 !text-lime' : ''}`}>{s.icon} {s.name}</button>
    {/each}
  </div>

  <div class="grid gap-4 xl:grid-cols-3">
    <div class="space-y-3 xl:col-span-2">
      {#if shown.length === 0}
        <div class="panel flex flex-col items-center justify-center py-16 text-center">
          <Radio size={26} class="text-fog-dim" />
          <h3 class="mt-3 text-[15px] font-semibold text-white">No live matches in this sport</h3>
          <p class="mt-1 text-[12px] text-fog">Check upcoming fixtures or switch sports.</p>
          <a href="/fixtures" class="btn btn-primary mt-4 !py-2 text-[11.5px]">Upcoming fixtures</a>
        </div>
      {/if}
      {#each shown as match}
        <div class="panel overflow-hidden">
          <div class="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
            <div class="flex min-w-0 items-center gap-2">
              <SportGlyph sport={match.fixture.sport} size="xs" />
              <span class="h-3.5 w-1 rounded-full" style={`background:${match.league.colour}`}></span>
              <span class="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fog">{match.league.name}</span>
              <span class="hidden truncate text-[10px] text-fog-dim sm:inline">· {match.fixture.venue}</span>
            </div>
            <span class="chip chip-mint shrink-0 !py-0.5"><span class="live-dot h-1.5 w-1.5 rounded-full bg-mint"></span>{match.fixture.period} · {match.fixture.minute}′</span>
          </div>

          <div class="p-3 sm:p-4">
            <a href={`/fixtures/${match.fixture.id}`} class="block">
              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2.5">
                    <TeamBadge team={match.home} size={34} />
                    <div class="min-w-0">
                      <div class="truncate text-[14px] font-semibold text-white">{match.home.name}</div>
                      <FormPills form={match.home.form} size="xs" />
                    </div>
                  </div>
                  <div class="mt-2.5 flex items-center gap-2.5">
                    <TeamBadge team={match.away} size={34} />
                    <div class="min-w-0">
                      <div class="truncate text-[14px] font-semibold text-white">{match.away.name}</div>
                      <FormPills form={match.away.form} size="xs" />
                    </div>
                  </div>
                </div>
                <div class="shrink-0 text-center">
                  <div class="display num text-[24px] font-bold leading-none text-white sm:text-[30px]">{match.fixture.score.home}<span class="mx-1 text-[16px] text-fog-dim">–</span>{match.fixture.score.away}</div>
                  <div class="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-mint">Live score</div>
                </div>
              </div>
            </a>

            <div class="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3">
              <div class="mb-2 flex items-center justify-between">
                <span class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim">Win probability</span>
                <div class="flex items-center gap-1.5 text-[9.5px] text-fog-dim"><Activity size={10} /> {match.prediction.confidence}% confidence</div>
              </div>
              <ProbabilityBar
                home={match.prediction.probabilities.home}
                draw={match.prediction.probabilities.draw}
                away={match.prediction.probabilities.away}
                homeLabel={match.home.name}
                awayLabel={match.away.name}
              />
              <div class="mt-3 flex items-center gap-3 border-t border-white/[0.05] pt-2.5">
                <span class="text-[9px] uppercase tracking-wider text-fog-dim">Drift</span>
                <Sparkline values={match.history} width={100} height={22} colour="#35e7a1" strokeWidth={1.6} />
                <span class="num text-[10px] text-fog">{match.history[match.history.length - 1].toFixed(0)}% now</span>
                {#if match.prediction.bothTeamsScore > 0.5}
                  <span class="chip chip-lime ml-auto !py-0 !text-[8.5px]">BTTS {(match.prediction.bothTeamsScore * 100).toFixed(0)}%</span>
                {/if}
              </div>
            </div>

            {#if match.prediction.valueBets.length}
              <div class="mt-3 flex flex-wrap gap-2">
                {#each match.prediction.valueBets.slice(0, 2) as bet}
                  <a href={`/fixtures/${match.fixture.id}`} class="flex items-center gap-2 rounded-lg border border-mint/20 bg-mint/[0.06] px-2.5 py-1.5 text-[10.5px] transition hover:bg-mint/[0.1]">
                    <span class="font-semibold text-white">{bet.selection}</span>
                    <span class="num text-lime">{bet.odds.toFixed(2)}</span>
                    <span class="num font-semibold text-mint">+{(bet.edge * 100).toFixed(1)}%</span>
                  </a>
                {/each}
              </div>
            {:else}
              <div class="mt-3 text-[10.5px] text-fog-dim">No live edge available — market is efficient at the current score.</div>
            {/if}

            <div class="mt-3 flex items-center justify-between text-[10px]">
              <span class="text-fog-dim">Model {match.prediction.recommended.selection} · {match.prediction.recommended.odds.toFixed(2)}</span>
              <a href={`/fixtures/${match.fixture.id}`} class="flex items-center gap-1 font-semibold text-lime hover:underline">Full analysis <ChevronRight size={11} /></a>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <div class="space-y-4">
      <div class="panel p-4">
        <SectionHeader title="Live value" description="Edges that exist right now" eyebrow="In-play" />
        <div class="space-y-1">
          {#each allEdges as bet}
            <a href={`/fixtures/${bet.fixture.id}`} class="flex items-center gap-2 rounded-lg px-1.5 py-2 transition hover:bg-white/[0.03]">
              <div class="min-w-0 flex-1">
                <div class="truncate text-[11px] font-semibold text-white">{bet.selection}</div>
                <div class="truncate text-[9.5px] text-fog-dim">{bet.home.name} vs {bet.away.name} · {bet.market}</div>
              </div>
              <div class="text-right">
                <div class="num text-[11.5px] font-bold text-lime">{bet.odds.toFixed(2)}</div>
                <div class="num text-[9.5px] font-semibold text-mint">+{(bet.edge * 100).toFixed(1)}%</div>
              </div>
              <span class="hidden shrink-0 sm:block"><ConfidenceMeter value={bet.confidence} size="sm" showLabel={false} /></span>
            </a>
          {/each}
          {#if allEdges.length === 0}
            <p class="py-4 text-center text-[11px] text-fog-dim">No live value right now.</p>
          {/if}
        </div>
      </div>

      <div class="panel p-4">
        <SectionHeader title="Just finished" description={`Full time · kept ${data.finishedWindowHours}h, then archived for retraining`} eyebrow="Results" />
        <div class="space-y-1.5">
          {#each data.recent as match}
            <a href={`/fixtures/${match.fixture.id}`} class="flex items-center gap-2 rounded-lg px-1.5 py-2 text-[10.5px] transition hover:bg-white/[0.03]">
              <SportGlyph sport={match.fixture.sport} size="xs" />
              <span class="h-5 w-1 rounded-full" style={`background:${match.league.colour}`}></span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-white/80">{match.home.name} vs {match.away.name}</div>
                <div class="text-[9px] text-fog-dim">{match.league.name} · {relativeTime(match.fixture.finishedAt ?? match.fixture.kickoff)}</div>
              </div>
              <span class="num font-semibold text-white">{match.fixture.score.home}–{match.fixture.score.away}</span>
            </a>
          {/each}
          {#if data.recent.length === 0}
            <p class="py-4 text-center text-[11px] text-fog-dim">No match has finished in the last {data.finishedWindowHours} hours.</p>
          {/if}
        </div>
      </div>

      <div class="panel p-4">
        <SectionHeader title="Kicking off soon" description="Next matches, earliest first" eyebrow="Upcoming" />
        <div class="space-y-1.5">
          {#each orderedUpcoming.slice(0, 5) as match}
            <a href={`/fixtures/${match.fixture.id}`} class={`flex items-center gap-2 rounded-lg px-1.5 py-2 text-[10.5px] transition hover:bg-white/[0.03] ${nextKickoff && match.fixture.id === nextKickoff.fixture.id ? 'bg-lime/[0.06]' : ''}`}>
              <SportGlyph sport={match.fixture.sport} size="xs" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-white/80">{match.home.name} vs {match.away.name}</div>
                <div class="flex flex-wrap items-center gap-1.5 text-[9px] text-fog-dim">
                  <span>{formatKickoff(match.fixture.kickoff)}</span>
                  <KickoffClock kickoff={match.fixture.kickoff} />
                  {#if nextKickoff && match.fixture.id === nextKickoff.fixture.id}<span class="text-lime">· next up</span>{/if}
                </div>
              </div>
              <ChevronRight size={11} class="text-fog-dim" />
            </a>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>
