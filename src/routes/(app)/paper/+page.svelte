<script lang="ts">
  import { WalletCards, ArrowUpRight, Download, Filter, Clock, CheckCircle2, XCircle, Search, Plus, TrendingUp, ShieldCheck, Info } from '@lucide/svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import Sparkline from '#lib/components/Sparkline.svelte';
  import SportGlyph from '#lib/components/SportGlyph.svelte';
  import LineChart from '#lib/components/LineChart.svelte';
  import { fmtNgn, signed } from '#lib/engine/core';
  import { formatDate, relativeTime } from '#lib/format';

  let { data } = $props();
  let filter = $state<'all' | 'open' | 'won' | 'lost'>('all');
  let query = $state('');
  const shown = $derived(
    data.bets.filter((b: any) => {
      if (filter !== 'all' && b.status !== filter) return false;
      if (query && !`${b.fixtureLabel} ${b.selection} ${b.market}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    })
  );
  const labels = $derived(data.curve.map((p: any) => formatDate(p.date, { day: 'numeric', month: 'short', year: undefined })));
</script>

<svelte:head><title>Paper desk — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-lime"><WalletCards size={12} /> Paper desk</div>
      <h1 class="display text-[22px] font-bold tracking-tight text-white sm:text-[26px]">Track the process, not the noise.</h1>
      <p class="mt-1 max-w-2xl text-[12.5px] text-fog">
        CaveBettor is not a sportsbook. This paper ledger records only the calls the board published, at the price it quoted, settled against the result the match lab shows — so the edge can be measured honestly.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <a href="/api/paper/export" download="cavebettor-paper-ledger.csv" class="btn btn-ghost !py-2 text-[11px]"><Download size={12} /> Export</a>
      <a href="/predictions" class="btn btn-primary !py-2 text-[11.5px]"><Plus size={12} /> Find a selection</a>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
    {#each [
      { label: 'Bankroll', value: fmtNgn(data.metrics.bankrollNgn, { compact: true }), sub: 'current paper balance', colour: '#c9ff4d' },
      { label: 'Open stake', value: fmtNgn(data.summary.openStake, { compact: true }), sub: `${data.summary.open} open bets`, colour: '#f6c453' },
      { label: 'Settled P/L', value: fmtNgn(data.summary.pnl, { compact: true }), sub: `${data.summary.won}W · ${data.summary.lost}L`, colour: data.summary.pnl >= 0 ? '#35e7a1' : '#ff6478' },
      { label: 'Turnover', value: fmtNgn(data.summary.turnover, { compact: true }), sub: 'all settled stakes', colour: '#6fc9ff' },
      { label: 'Yield', value: `${signed(data.metrics.yield)}%`, sub: 'profit per stake', colour: '#a99bff' },
      { label: 'Open exposure', value: `${((data.summary.openStake / data.metrics.bankrollNgn) * 100).toFixed(1)}%`, sub: 'of bankroll at risk', colour: '#ff9f45' }
    ] as kpi}
      <div class="panel p-3.5">
        <div class="stat-label">{kpi.label}</div>
        <div class="display num mt-1.5 text-[20px] font-bold" style={`color:${kpi.colour}`}>{kpi.value}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">{kpi.sub}</div>
      </div>
    {/each}
  </div>

  <div class="grid gap-4 xl:grid-cols-3">
    <div class="panel p-4 xl:col-span-2">
      <SectionHeader title="Paper equity" description="90-day bankroll at ₦1.25m starting capital" eyebrow="Curve" />
      <LineChart
        series={[{ name: 'Bankroll (₦)', values: data.curve.map((p: any) => p.bankrollNgn), colour: '#c9ff4d', area: true }]}
        labels={labels}
        height={210}
        yFormat={(v) => fmtNgn(v, { compact: true })}
      />
    </div>
    <div class="panel p-4">
      <SectionHeader title="Discipline rules" description="How this ledger is managed" eyebrow="Policy" />
      <div class="space-y-2 text-[10.5px]">
        {#each [
          ['Stake sizing', 'Quarter-Kelly, capped at 5% of bankroll'],
          ['Minimum edge', '0.5% after de-vigging'],
          ['Price policy', 'Best available across 8 books'],
          ['Settlement', 'Closing line and final result'],
          ['No chasing', 'Losing days never change unit size'],
          ['Review', 'Weekly calibration and CLV audit']
        ] as rule}
          <div class="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-1.5">
            <span class="text-fog">{rule[0]}</span>
            <span class="text-right font-medium text-white/80">{rule[1]}</span>
          </div>
        {/each}
      </div>
      <div class="mt-3 rounded-lg border border-mint/15 bg-mint/[0.05] p-2.5 text-[9.5px] leading-relaxed text-fog">
        <span class="flex items-center gap-1 font-semibold text-mint"><ShieldCheck size={10} /> No real money changes hands.</span>
        <p class="mt-1">The ledger exists to prove the model before capital is exposed. It is a research instrument.</p>
      </div>
    </div>
  </div>

  <div class="panel overflow-hidden">
    <div class="flex flex-wrap items-center gap-2 px-4 pb-2 pt-4">
      <SectionHeader title="Selection ledger" description={`${data.bets.length} recorded selections`} eyebrow="Ledger" />
      <div class="ml-auto flex flex-wrap items-center gap-1.5">
        {#each [{ id: 'all', label: 'All' }, { id: 'open', label: `Open ${data.summary.open}` }, { id: 'won', label: `Won ${data.summary.won}` }, { id: 'lost', label: `Lost ${data.summary.lost}` }] as f}
          <button onclick={() => (filter = f.id as any)} class={`chip !text-[9.5px] ${filter === f.id ? '!border-lime/35 !bg-lime/10 !text-lime' : ''}`}>{f.label}</button>
        {/each}
        <div class="relative">
          <Search size={11} class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fog-dim" />
          <input class="input !w-40 !py-1.5 pl-7 text-[10.5px]" placeholder="Filter ledger…" bind:value={query} />
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Fixture</th><th>Selection</th><th class="text-right">Odds</th><th class="text-right">Model</th><th class="text-right">Edge</th><th class="text-right">Stake</th><th class="text-right">P/L</th><th>Status</th><th>Placed</th></tr>
        </thead>
        <tbody>
          {#each shown as bet}
            <tr>
              <td>
                <div class="flex items-center gap-1.5">
                  <SportGlyph sport={bet.sport} size="xs" />
                  <div class="text-[10.5px] font-medium text-white/85">{bet.fixtureLabel}</div>
                </div>
                <div class="text-[9px] text-fog-dim">#{bet.fixtureId.slice(0, 8)}</div>
              </td>
              <td><div class="text-[10.5px] text-white/80">{bet.selection}</div><div class="text-[9px] text-fog-dim">{bet.market}</div></td>
              <td class="num text-right text-[10.5px] font-semibold text-lime">{bet.odds.toFixed(2)}</td>
              <td class="num text-right text-[10px] text-fog">{(bet.modelProbability * 100).toFixed(0)}%</td>
              <td class={`num text-right text-[10px] font-semibold ${bet.edge > 0 ? 'text-mint' : 'text-fog'}`}>{signed(bet.edge * 100)}%</td>
              <td class="num text-right text-[10.5px] text-white/80">{fmtNgn(bet.stakeNgn)}</td>
              <td class={`num text-right text-[10.5px] font-semibold ${(bet.pnlNgn ?? 0) > 0 ? 'text-mint' : (bet.pnlNgn ?? 0) < 0 ? 'text-rose' : 'text-fog-dim'}`}>{bet.pnlNgn !== undefined ? fmtNgn(bet.pnlNgn) : '—'}</td>
              <td>
                <span class={`chip !px-1.5 !py-0 !text-[8.5px] ${bet.status === 'won' ? 'chip-mint' : bet.status === 'lost' ? 'chip-rose' : bet.status === 'open' ? 'chip-amber' : ''}`}>
                  {bet.status === 'open' ? 'open' : bet.status}
                </span>
              </td>
              <td class="text-[9px] text-fog-dim">{relativeTime(bet.placedAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if shown.length === 0}
      <div class="px-4 py-10 text-center text-[11.5px] text-fog-dim">No selections match this filter.</div>
    {/if}
    <div class="border-t border-white/[0.06] px-4 py-3 text-[9.5px] text-fog-dim">
      Prices are the best available at the time of recording. Settlement uses official results. Paper stakes are not real money.
    </div>
  </div>
</div>
