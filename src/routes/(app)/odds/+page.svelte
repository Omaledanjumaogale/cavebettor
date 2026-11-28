<script lang="ts">
  import { goto } from '$app/navigation';
  import { Coins, ArrowUpRight, TrendingUp, TrendingDown, Scale, Info, ChevronRight, RefreshCw, Radio } from '@lucide/svelte';
  import TeamBadge from '#lib/components/TeamBadge.svelte';
  import SportGlyph from '#lib/components/SportGlyph.svelte';
  import KickoffClock from '#lib/components/KickoffClock.svelte';
  import ProbabilityBar from '#lib/components/ProbabilityBar.svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import { fmtNgn, signed } from '#lib/engine/core';
  import { formatKickoff, relativeTime } from '#lib/format';

  let { data } = $props();
  let tab = $state<'comparison' | 'movement' | 'arbitrage'>('comparison');
  let marketFilter = $state('all');
  const selected = $derived(data.selected);
  const groups = $derived(['all', ...new Set(selected.markets.map((m: any) => m.group))]);
  const shownMarkets = $derived(marketFilter === 'all' ? selected.markets : selected.markets.filter((m: any) => m.group === marketFilter));

  function choose(id: string) {
    goto(`/odds?id=${id}`, { keepFocus: true, noScroll: true });
  }
</script>

<svelte:head><title>Odds comparison & market movement — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-sky"><Coins size={12} /> Odds & markets</div>
      <h1 class="display text-[22px] font-bold tracking-tight text-white sm:text-[26px]">Eight books. One fair price.</h1>
      <p class="mt-1 text-[12.5px] text-fog">Compare every market, spot price movement and check the board for arbitrage. All odds are decimal and NGN-ready.</p>
      {#if data.marketFeed.prices > 0}
        <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-fog-dim">
          <span class="chip chip-mint !px-1.5 !py-0 !text-[8.5px]"><Radio size={8} /> {data.marketFeed.provider}</span>
          <span>{data.marketFeed.prices} live prices applied to the engine</span>
          {#if data.marketFeed.collectedAt}<span>· {relativeTime(data.marketFeed.collectedAt)}</span>{/if}
        </div>
      {/if}
    </div>
    <select class="input !w-full !py-2 text-[11.5px] sm:!w-auto sm:max-w-[320px]" value={selected.fixture.id} onchange={(e) => choose((e.target as HTMLSelectElement).value)} aria-label="Select fixture">
      {#each data.fixtures as f}
        <option value={f.id}>{f.league} · {f.label}</option>
      {/each}
    </select>
  </div>

  <div class="panel p-3 sm:p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <SportGlyph sport={selected.fixture.sport} size="md" />
        <TeamBadge team={selected.home} size={38} />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <div class="truncate text-[14px] font-semibold text-white">{selected.home.name} vs {selected.away.name}</div>
            {#if selected.fixture.status === 'live' || selected.fixture.status === 'halftime'}
              <span class="chip chip-rose !text-[9px]"><span class="live-dot h-1 w-1 rounded-full bg-rose"></span> {selected.fixture.minute}′ · {selected.fixture.score.home}–{selected.fixture.score.away}</span>
            {:else if selected.fixture.status === 'scheduled'}
              <KickoffClock kickoff={selected.fixture.kickoff} showLabel />
            {/if}
          </div>
          <div class="text-[10px] text-fog-dim">{selected.league.name} · {formatKickoff(selected.fixture.kickoff)} · {selected.fixture.round}</div>
        </div>
        <TeamBadge team={selected.away} size={38} />
      </div>
      <div class="w-full min-w-0 flex-1 sm:max-w-sm">
        <ProbabilityBar home={selected.probabilities.home} draw={selected.probabilities.draw} away={selected.probabilities.away} homeLabel={selected.home.name} awayLabel={selected.away.name} compact />
        <div class="mt-1.5 flex justify-between text-[9.5px] text-fog-dim">
          <span>Model {selected.confidence}% confidence</span>
          <span>Priced {relativeTime(selected.generatedAt)}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="scrollbar-none flex gap-1 overflow-x-auto border-b border-white/[0.07] pb-px">
    {#each [{ id: 'comparison', label: 'Price comparison', icon: Scale }, { id: 'movement', label: 'Market movement', icon: TrendingUp }, { id: 'arbitrage', label: 'Arbitrage scan', icon: Coins }] as t}
      <button onclick={() => (tab = t.id as any)} class={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[11.5px] font-semibold ${tab === t.id ? 'border-lime text-lime' : 'border-transparent text-fog hover:text-white'}`}>
        <t.icon size={13} /> {t.label}
      </button>
    {/each}
  </div>

  {#if tab === 'comparison'}
    <div class="flex flex-wrap items-center gap-1.5">
      {#each groups as group}
        <button onclick={() => (marketFilter = group)} class={`chip ${marketFilter === group ? '!border-lime/35 !bg-lime/10 !text-lime' : ''}`}>{group === 'all' ? 'All markets' : group}</button>
      {/each}
      <span class="ml-auto text-[10px] text-fog-dim">{data.bookmakers.length} bookmakers · best price highlighted in green</span>
    </div>

    <div class="space-y-3">
      {#each shownMarkets as market}
        <div class="panel overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5">
            <div class="text-[12px] font-semibold text-white">{market.label}</div>
            <span class="chip !text-[9px] capitalize">{market.group}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] border-collapse text-[11px]">
              <thead>
                <tr class="border-y border-white/[0.06] bg-white/[0.02]">
                  <th class="sticky left-0 z-10 bg-pitch-900 px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-[0.1em] text-fog-dim">Selection</th>
                  <th class="px-2 py-2 text-right text-[9px] font-semibold uppercase tracking-[0.1em] text-fog-dim">Model</th>
                  <th class="px-2 py-2 text-right text-[9px] font-semibold uppercase tracking-[0.1em] text-fog-dim">Fair</th>
                  {#each data.bookmakers as book}
                    <th class="px-2 py-2 text-center text-[9px] font-semibold text-fog" title={book.name}><span style={`color:${book.colour}`}>{book.shortName}</span></th>
                  {/each}
                  <th class="px-2 py-2 text-right text-[9px] font-semibold uppercase tracking-[0.1em] text-fog-dim">Edge</th>
                </tr>
              </thead>
              <tbody>
                {#each market.outcomes as outcome}
                  <tr class="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td class="sticky left-0 z-10 bg-pitch-900 px-3 py-2.5 font-medium text-white">{outcome.label}</td>
                    <td class="num px-2 py-2.5 text-right text-fog">{(outcome.modelProbability * 100).toFixed(1)}%</td>
                    <td class="num px-2 py-2.5 text-right text-fog-dim">{outcome.fairOdds.toFixed(2)}</td>
                    {#each outcome.prices as price}
                      {@const isBest = price.odds === outcome.bestOdds}
                      <td class={`num px-2 py-2.5 text-center ${isBest ? 'font-bold text-lime' : 'text-white/70'}`}>
                        <span class={isBest ? 'rounded bg-lime/10 px-1.5 py-0.5' : ''}>{price.odds.toFixed(2)}</span>
                      </td>
                    {/each}
                    <td class={`num px-2 py-2.5 text-right font-semibold ${outcome.edge > 0.025 ? 'text-mint' : 'text-fog-dim'}`}>{signed(outcome.edge * 100)}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="px-4 py-2 text-[9px] text-fog-dim">Best price on this market: {market.outcomes[0]?.bestBook} · Compare all books before staking.</div>
        </div>
      {/each}
    </div>
  {:else if tab === 'movement'}
    <div class="panel overflow-hidden">
      <div class="flex items-center justify-between px-4 pb-1 pt-4">
        <SectionHeader title="Biggest repricing" description="Opening vs current best price across the board" eyebrow="Movement" />
        <span class="chip !text-[9px]"><RefreshCw size={9} /> live</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Fixture</th><th>Selection</th><th class="text-right">Current</th><th class="text-right">Drift</th><th class="text-right">Edge</th><th>Direction</th></tr></thead>
          <tbody>
            {#each data.movers as mover}
              <tr class="cursor-pointer" onclick={() => choose(mover.fixtureId)}>
                <td><div class="text-[11.5px] font-medium text-white">{mover.home} vs {mover.away}</div><div class="text-[9.5px] text-fog-dim">{mover.league} · {formatKickoff(mover.kickoff)}</div></td>
                <td class="text-[11px] text-white/80">{mover.selection}</td>
                <td class="num text-right text-[11.5px] font-semibold text-lime">{mover.odds.toFixed(2)}</td>
                <td class={`num text-right text-[11.5px] font-semibold ${mover.drift >= 0 ? 'text-mint' : 'text-rose'}`}>{signed(mover.drift * 100)}%</td>
                <td class="num text-right text-[11px] text-fog">{signed(mover.edge * 100)}%</td>
                <td>
                  <span class={`flex items-center gap-1 text-[10px] font-semibold ${mover.drift >= 0 ? 'text-mint' : 'text-rose'}`}>
                    {#if mover.drift >= 0}<TrendingUp size={12} /> Shortening{:else}<TrendingDown size={12} /> Drifting{/if}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="border-t border-white/[0.06] px-4 py-3 text-[10px] leading-relaxed text-fog">
        A shortening price means money is arriving on that selection. A drifting price means the market is losing faith. CaveBettor compares the move with its own probability — if the drift creates an edge, it appears on the value board.
      </div>
    </div>
  {:else}
    <div class="grid gap-3 lg:grid-cols-2">
      {#each data.arbs as arb}
        <div class="panel p-4">
          <div class="flex items-center justify-between">
            <div class="text-[12px] font-semibold text-white">{arb.home} vs {arb.away}</div>
            <span class={`chip ${arb.margin > 0 ? 'chip-mint' : 'chip-amber'} !text-[9px]`}>{arb.margin > 0 ? 'Arbitrage' : 'No arb'}</span>
          </div>
          <div class="mt-0.5 text-[9.5px] text-fog-dim">{arb.league} · {arb.market} · {formatKickoff(arb.kickoff)}</div>
          <div class="mt-3 space-y-1.5">
            {#each arb.outcomes as o}
              <div class="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-1.5 text-[10.5px]">
                <span class="text-white/80">{o.label}</span>
                <span class="text-fog-dim">{o.book}</span>
                <span class="num font-semibold text-lime">{o.odds.toFixed(2)}</span>
                <span class="num text-[9px] text-fog-dim">{(o.implied * 100).toFixed(1)}%</span>
              </div>
            {/each}
          </div>
          <div class="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[10.5px]">
            <span class="text-fog">Combined implied</span>
            <span class="num font-semibold text-white">{(arb.totalImplied * 100).toFixed(2)}%</span>
            <span class={`num font-bold ${arb.margin > 0 ? 'text-mint' : 'text-rose'}`}>{signed(arb.margin * 100, 2)}%</span>
          </div>
        </div>
      {/each}
    </div>
    <div class="panel p-4">
      <div class="flex items-center gap-2 text-[11.5px] font-semibold text-white"><Info size={13} class="text-sky" /> Reading the arbitrage scan</div>
      <p class="mt-1.5 text-[11px] leading-relaxed text-fog">
        A true arbitrage exists when the sum of implied probabilities across the best prices is below 100% (margin above zero). The scan uses live best prices only — it does not account for stake limits, account restrictions, or the time it takes to place all legs. Most markets here are correctly priced with a small overround, which is expected. Treat a positive margin as a signal to verify manually, not a guarantee.
      </p>
    </div>
  {/if}
</div>
