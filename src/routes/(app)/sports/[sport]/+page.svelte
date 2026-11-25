<script lang="ts">
  import { goto } from '$app/navigation';
  import { Activity, ArrowUpRight, BrainCircuit, CircleDot, Gauge, Radio, Sparkles, Target, TrendingUp } from '@lucide/svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import KpiCard from '#lib/components/KpiCard.svelte';
  import ProbabilityBar from '#lib/components/ProbabilityBar.svelte';
  import ConfidenceMeter from '#lib/components/ConfidenceMeter.svelte';
  import TeamBadge from '#lib/components/TeamBadge.svelte';
  import LineChart from '#lib/components/LineChart.svelte';
  import { formatKickoff } from '#lib/format';

  let { data } = $props();

  const def = $derived(data.def);
  const s = $derived(data.summary);

  const metricValue = (id: string): string => {
    if (id === 'fixtures') return String(s.fixtures);
    if (id === 'live') return String(s.live);
    if (id === 'confidence') return `${s.avgConfidence}%`;
    if (id === 'value') return String(s.value);
    if (id === 'edge') return `${(s.bestEdge * 100).toFixed(1)}%`;
    if (id === 'markets') return String(s.markets);
    if (id === 'pace') return '99.4';
    return '—';
  };

  const metricSub = (id: string): string => {
    if (id === 'fixtures') return `${s.active} still to play · ${s.finished} settled`;
    if (id === 'live') return s.live ? 'In progress right now' : 'No games in progress';
    if (id === 'confidence') return `Across ${s.active} open fixtures`;
    if (id === 'value') return 'Selections above the edge floor';
    if (id === 'edge') return 'Largest positive edge on the board';
    if (id === 'markets') return `${def.primaryMarkets.length} primary · ${def.secondaryMarkets.length} secondary`;
    return '';
  };

  const tone = (tone: string) =>
    tone === 'mint' ? '#35e7a1' : tone === 'lime' ? '#c9ff4d' : tone === 'sky' ? '#7bdcff' : tone === 'amber' ? '#ffb648' : '#ff7d9c';
</script>

<svelte:head><title>{def.name} desk — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <!-- Sport switcher -->
  <div class="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
    {#each data.dashboards as d}
      <button
        onclick={() => goto(`/sports/${d.id}`)}
        class={`chip shrink-0 ${d.id === def.id ? '!border-lime/35 !bg-lime/10 !text-lime' : 'hover:!bg-white/[0.07]'}`}
      >
        <span>{d.icon}</span>{d.name}
      </button>
    {/each}
  </div>

  <!-- Header -->
  <div class="panel relative overflow-hidden p-4 sm:p-5" style={`border-color:${def.accent}22`}>
    <div class="absolute -right-16 -top-16 h-52 w-52 rounded-full opacity-[0.10] blur-3xl" style={`background:${def.accent}`}></div>
    <div class="relative flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={`color:${def.accent}`}>
          <span class="text-[16px] leading-none">{def.icon}</span> {def.name} desk
        </div>
        <h1 class="display text-[22px] font-bold tracking-tight text-white sm:text-[28px]">{def.tagline}</h1>
        <p class="mt-1 max-w-3xl text-[12px] leading-relaxed text-fog">{data.note}</p>
      </div>
      <div class="flex w-full items-center gap-2 sm:w-auto">
        <a href={`/fixtures?sport=${def.sport}`} class="btn btn-ghost flex-1 !py-2 text-[11.5px] sm:flex-none">All {def.name.toLowerCase()} fixtures</a>
        <a href={`/predictions?sport=${def.sport}`} class="btn btn-primary flex-1 !py-2 text-[11.5px] sm:flex-none"><Sparkles size={12} /> Value board</a>
      </div>
    </div>

    <div class="relative mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-white/[0.06] bg-black/20 p-3">
        <div class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim">Engine</div>
        <div class="mt-1 text-[11.5px] font-semibold text-white">{def.engine.name}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">{def.engine.version} · {def.engine.family}</div>
      </div>
      <div class="rounded-xl border border-white/[0.06] bg-black/20 p-3">
        <div class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim">Settlement</div>
        <div class="mt-1 text-[11px] leading-relaxed text-white/85">{def.engine.settlements}</div>
      </div>
      <div class="rounded-xl border border-white/[0.06] bg-black/20 p-3">
        <div class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim">Collection host</div>
        <div class="mt-1 num truncate text-[11px] text-white/85">{def.providerHost}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">Budgeted · refresh runs on a schedule</div>
      </div>
      <div class="rounded-xl border border-white/[0.06] bg-black/20 p-3">
        <div class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim">Competitions</div>
        <div class="mt-1 text-[11px] text-white/85">{data.leagues.map((l: any) => l.shortName).join(' · ') || '—'}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">{s.leagues} tracked this cycle</div>
      </div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
    {#each def.metrics as m}
      <KpiCard
        label={m.label}
        value={metricValue(m.id)}
        sub={metricSub(m.id)}
        colour={tone(m.tone)}
        spark={m.id === 'confidence' || m.id === 'edge' ? data.confidenceSeries.map((p: any) => p.value) : undefined}
      />
    {/each}
  </div>

  <div class="grid gap-4 xl:grid-cols-3">
    <!-- Value board -->
    <div class="panel p-4 sm:p-5 xl:col-span-2">
      <SectionHeader
        title={`${def.name} value board`}
        description={`Selections across ${def.primaryMarkets.map((m) => m.label).join(', ')} and more, ranked by risk-adjusted edge.`}
        eyebrow="Model edge"
      />
      {#if data.value.length === 0}
        <div class="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-black/15 px-4 py-12 text-center">
          <Target size={24} class="text-fog-dim" />
          <p class="mt-2 text-[12px] font-semibold text-white">No qualifying value right now</p>
          <p class="mt-1 max-w-sm text-[11px] text-fog">
            Nothing in the {def.name.toLowerCase()} universe clears the 2.5% edge floor at current prices. That is a normal state, not an error.
          </p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each data.value.slice(0, 12) as bet}
            <a href={`/fixtures/${bet.fixtureId}`} class="group block rounded-xl border border-white/[0.06] bg-black/15 p-3 transition hover:border-lime/25 hover:bg-lime/[0.03]">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span class="flex items-center gap-1.5 text-[10px] text-fog-dim">
                  <span class="h-2 w-1 rounded-full" style={`background:${bet.leagueColour}`}></span>{bet.league}
                </span>
                <span class="num text-[10px] text-fog-dim">{formatKickoff(bet.kickoff)}</span>
                {#if bet.status === 'live' || bet.status === 'halftime'}
                  <span class="chip chip-mint !px-1.5 !py-0 !text-[8px]"><Radio size={8} /> Live</span>
                {/if}
                <span class="ml-auto flex items-center gap-2">
                  <span class="num rounded-lg bg-white/[0.05] px-2 py-0.5 text-[12px] font-bold text-lime">{bet.odds.toFixed(2)}</span>
                  <span class="num rounded-lg bg-mint/10 px-2 py-0.5 text-[11px] font-semibold text-mint">+{(bet.edge * 100).toFixed(1)}%</span>
                </span>
              </div>
              <div class="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="text-[12px] font-semibold text-white">{bet.selection}</span>
                <span class="text-[10.5px] text-fog">{bet.home} v {bet.away}</span>
              </div>
              <div class="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <ProbabilityBar home={bet.modelProbability} draw={0} away={1 - bet.modelProbability} homeLabel={bet.homeShort} awayLabel={bet.awayShort} />
                <span class="hidden sm:block"><ConfidenceMeter value={bet.confidence} size="sm" showLabel /></span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Right column -->
    <div class="space-y-4">
      <div class="panel p-4">
        <SectionHeader title="Market coverage" description="Markets priced for this sport" eyebrow="Surface" />
        {#if data.markets.length === 0}
          <p class="text-[11px] text-fog">No markets on the board yet — the collector has not priced this sport in the current cycle.</p>
        {:else}
          <div class="space-y-2">
            {#each data.markets as m}
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-[11.5px] text-white/85">{m.label}</span>
                <span class="num shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9.5px] text-fog">{m.count}</span>
                <span class="num w-12 shrink-0 text-right text-[11px] font-semibold text-mint">+{(m.bestEdge * 100).toFixed(1)}%</span>
              </div>
            {/each}
          </div>
        {/if}
        <div class="mt-3 border-t border-white/[0.06] pt-3">
          <div class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim">Primary markets</div>
          <div class="mt-1.5 flex flex-wrap gap-1">
            {#each def.primaryMarkets as m}
              <span class="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] text-white/70">{m.label}</span>
            {/each}
          </div>
          <div class="mt-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim">Secondary</div>
          <div class="mt-1.5 flex flex-wrap gap-1">
            {#each def.secondaryMarkets as m}
              <span class="rounded bg-white/[0.03] px-1.5 py-0.5 text-[9.5px] text-white/50">{m.label}</span>
            {/each}
          </div>
        </div>
      </div>

      <div class="panel p-4">
        <SectionHeader title="How we model this" description="Sport-specific logic applied to every fixture" eyebrow="Engine" />
        <ul class="space-y-2">
          {#each def.modelling as line}
            <li class="flex gap-2 text-[10.5px] leading-relaxed text-fog"><span style={`color:${def.accent}`}>▸</span>{line}</li>
          {/each}
        </ul>
        <div class="mt-3 border-t border-white/[0.06] pt-3">
          <div class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim">Settlement notes</div>
          <ul class="mt-1.5 space-y-1">
            {#each def.notes as note}
              <li class="text-[10px] leading-relaxed text-fog-dim">• {note}</li>
            {/each}
          </ul>
        </div>
      </div>

      <div class="panel p-4">
        <SectionHeader title="Competition form" description="Confidence and value by competition" eyebrow="Breakdown" />
        <div class="space-y-2">
          {#each data.leagues as l}
            <a href={`/fixtures?sport=${def.sport}&league=${l.id}`} class="block rounded-lg border border-white/[0.05] bg-black/15 p-2.5 transition hover:border-white/15">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-1 shrink-0 rounded-full" style={`background:${l.colour}`}></span>
                <span class="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-white">{l.name}</span>
                <span class="num text-[10px] text-fog-dim">{l.fixtures} games</span>
              </div>
              <div class="mt-1.5 flex items-center gap-3 text-[9.5px] text-fog-dim">
                <span class="num">{l.avgConfidence}% conf.</span>
                <span class="num">{l.value} value</span>
                {#if l.live}<span class="num text-mint">{l.live} live</span>{/if}
              </div>
            </a>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- Stat board -->
  <div class="panel p-4 sm:p-5">
    <SectionHeader
      title={`${def.name} stat board`}
      description="The sport's own analytical fields, in kick-off order — the next match leads the board."
      eyebrow="Detail"
    />
    {#if data.statRows.length === 0}
      <p class="text-[11px] text-fog">No open fixtures for this sport right now.</p>
    {:else}
      <div class="table-wrap -mx-1">
        <table class="data-table">
          <thead>
            <tr>
              <th>Fixture</th>
              {#each def.statBoard as m}<th>{m.label}</th>{/each}
              <th class="text-right">Edge</th>
              <th class="text-right">Conf.</th>
            </tr>
          </thead>
          <tbody>
            {#each data.statRows as row}
              <tr class={row.fixtureId === data.ordering.nextUpId ? 'bg-lime/[0.04]' : ''}>
                <td>
                  <a href={`/fixtures/${row.fixtureId}`} class="block">
                    <div class="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                      {row.label}
                      {#if row.fixtureId === data.ordering.nextUpId}
                        <span class="rounded-full border border-lime/30 bg-lime/10 px-1.5 py-0 text-[8px] font-semibold uppercase tracking-[0.1em] text-lime">Next</span>
                      {/if}
                    </div>
                    <div class="text-[9.5px] text-fog-dim">{row.league} · {formatKickoff(row.kickoff)}</div>
                  </a>
                </td>
                {#each row.metrics as m}
                  <td>
                    <div class="num text-[11px] font-semibold text-white/85">{m.display}</div>
                    <div class="text-[9px] text-fog-dim">{m.hint}</div>
                  </td>
                {/each}
                <td class="num text-right text-[11px] font-semibold text-mint">+{(row.edge * 100).toFixed(1)}%</td>
                <td class="num text-right text-[11px] text-fog-dim">{row.confidence}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Sports overview -->
  <div class="panel p-4 sm:p-5">
    <SectionHeader title="All sport desks" description="Each desk runs its own engine, calendar and market vocabulary." eyebrow="Coverage" />
    <div class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5">
      {#each data.dashboards as d}
        <a
          href={`/sports/${d.id}`}
          class={`rounded-xl border p-3 transition ${d.id === def.id ? 'border-lime/30 bg-lime/[0.05]' : 'border-white/[0.06] bg-black/15 hover:border-white/15'}`}
        >
          <div class="flex items-center gap-2">
            <span class="text-[16px] leading-none">{d.icon}</span>
            <span class="text-[12px] font-semibold text-white">{d.name}</span>
          </div>
          <div class="mt-1 text-[9.5px] leading-relaxed text-fog-dim">{d.id === def.id ? 'Currently viewing' : 'Open the desk →'}</div>
        </a>
      {/each}
    </div>
  </div>
</div>
