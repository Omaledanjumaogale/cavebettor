<script lang="ts">
  import { ChartNoAxesCombined, TrendingUp, TrendingDown, Wallet, Target, Percent, Activity, Calculator, ArrowUpRight, Info, ShieldCheck } from '@lucide/svelte';
  import LineChart from '#lib/components/LineChart.svelte';
  import BarChart from '#lib/components/BarChart.svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import Gauge from '#lib/components/Gauge.svelte';
  import { fmtNgn, signed, pct } from '#lib/engine/core';
  import { formatDate } from '#lib/format';
  import { SPORT_MAP } from '#lib/data/catalog';

  let { data } = $props();
  const m = $derived(data.metrics);
  const labels = $derived(data.curve.map((p: any) => formatDate(p.date, { day: 'numeric', month: 'short', year: undefined })));
  const sportColours: Record<string, string> = { football: '#c9ff4d', basketball: '#f6c453', tennis: '#6fc9ff', icehockey: '#a99bff', baseball: '#ff6478' };

  // Staking simulator
  let bankroll = $state(1250000);
  let edgePct = $state(4.5);
  let odds = $state(2.1);
  let fraction = $state(0.25);
  const implied = $derived(1 / odds);
  const modelProb = $derived(Math.min(0.98, implied + edgePct / 100));
  const fullKelly = $derived(Math.max(0, (modelProb * (odds - 1) - (1 - modelProb)) / (odds - 1)));
  const stake = $derived(bankroll * fullKelly * fraction);
  const ev = $derived(stake * ((modelProb * (odds - 1)) - (1 - modelProb)));
  const evPct = $derived(stake > 0 ? (ev / stake) * 100 : 0);
  const potential = $derived(stake * (odds - 1));
  const growth = $derived(bankroll > 0 ? (ev / bankroll) * 100 : 0);
</script>

<svelte:head><title>Performance analytics — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-sky"><ChartNoAxesCombined size={12} /> Performance</div>
      <h1 class="display text-[22px] font-bold tracking-tight text-white sm:text-[26px]">Evidence, not anecdotes.</h1>
      <p class="mt-1 max-w-2xl text-[12.5px] text-fog">
        90-day paper desk at ₦1.25m starting capital. Every settled selection, closing-line value and drawdown is measured against the model’s own probabilities.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <span class="chip chip-mint">CLV +{data.streaks.clv.toFixed(1)}%</span>
      <a href="/paper" class="btn btn-ghost !py-2 text-[11px]">Paper desk <ArrowUpRight size={11} /></a>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
    {#each [
      { label: 'Bankroll', value: fmtNgn(m.bankrollNgn, { compact: true }), sub: `${signed(m.profitNgn / 1000)}k profit`, colour: '#c9ff4d' },
      { label: 'ROI', value: `${signed(m.roi)}%`, sub: 'on turnover', colour: '#35e7a1' },
      { label: 'Yield', value: `${signed(m.yield)}%`, sub: 'per bet', colour: '#6fc9ff' },
      { label: 'Strike rate', value: `${m.strikeRate.toFixed(1)}%`, sub: `${m.settledBets} settled`, colour: '#f6c453' },
      { label: 'Max drawdown', value: `${m.maxDrawdown.toFixed(1)}%`, sub: '90-day peak-trough', colour: '#ff6478' },
      { label: 'Avg odds', value: m.avgOdds.toFixed(2), sub: 'quarter-Kelly', colour: '#a99bff' }
    ] as kpi}
      <div class="panel p-3.5">
        <div class="stat-label">{kpi.label}</div>
        <div class="display num mt-1.5 text-[17px] font-bold sm:text-[20px]" style={`color:${kpi.colour}`}>{kpi.value}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">{kpi.sub}</div>
      </div>
    {/each}
  </div>

  <div class="grid gap-4 xl:grid-cols-3">
    <div class="panel p-4 xl:col-span-2">
      <SectionHeader title="Equity curve & drawdown" description="Bankroll in NGN with peak-to-trough drawdown overlay" eyebrow="Bankroll" />
      <LineChart
        series={[
          { name: 'Bankroll (₦)', values: data.curve.map((p: any) => p.bankrollNgn), colour: '#c9ff4d', area: true },
          { name: 'Drawdown (%)', values: data.curve.map((p: any) => -p.drawdown * 12000 + 1180000), colour: '#ff6478', dashed: true }
        ]}
        labels={labels}
        height={250}
        yFormat={(v) => fmtNgn(v, { compact: true })}
      />
      <p class="mt-1 text-[9px] text-fog-dim">Drawdown is scaled onto the bankroll axis for comparison; read the percentage from the tooltip series.</p>
    </div>

    <div class="panel p-4">
      <SectionHeader title="Quality scorecard" description="Does the edge survive the market?" eyebrow="Diagnostics" />
      <div class="grid grid-cols-2 gap-2 sm:gap-3">
        <div class="flex flex-col items-center rounded-xl border border-white/[0.06] bg-black/15 p-2.5">
          <Gauge value={m.strikeRate} size={96} label="Strike" colour="#35e7a1" />
        </div>
        <div class="flex flex-col items-center rounded-xl border border-white/[0.06] bg-black/15 p-2.5">
          <Gauge value={Math.min(100, 50 + m.roi * 5)} size={96} label="Edge quality" colour="#c9ff4d" />
        </div>
      </div>
      <div class="mt-3 space-y-1.5 text-[10.5px]">
        <div class="field-row"><span class="text-fog">Closing-line value</span><span class="num font-semibold text-mint">+{data.streaks.clv.toFixed(1)}%</span></div>
        <div class="field-row"><span class="text-fog">Longest win streak</span><span class="num font-semibold text-white">{data.streaks.longestWin}</span></div>
        <div class="field-row"><span class="text-fog">Longest losing run</span><span class="num font-semibold text-white">{data.streaks.longestLoss}</span></div>
        <div class="field-row"><span class="text-fog">Current streak</span><span class="num font-semibold text-mint">{data.streaks.current} wins</span></div>
        <div class="field-row"><span class="text-fog">Open exposure</span><span class="num font-semibold text-white">{fmtNgn(m.openExposureNgn)}</span></div>
      </div>
      <div class="mt-3 rounded-lg border border-sky/15 bg-sky/[0.05] p-2.5 text-[9.5px] leading-relaxed text-fog">
        <span class="flex items-center gap-1 font-semibold text-sky"><Info size={10} /> Positive CLV is the strongest leading indicator.</span>
        <p class="mt-1">Beating the closing price consistently usually precedes long-run profit, even through losing streaks.</p>
      </div>
    </div>
  </div>

  <div class="grid gap-4 lg:grid-cols-2">
    <div class="panel p-4">
      <SectionHeader title="Monthly performance" description="Staked, profit and ROI by month" eyebrow="Monthly" />
      <BarChart
        data={data.monthly.map((mo: any) => ({ label: mo.month, value: mo.profitNgn, colour: mo.profitNgn >= 0 ? '#35e7a1' : '#ff6478' }))}
        height={170}
        format={(v) => fmtNgn(v, { compact: true })}
      />
      <div class="mt-3 table-wrap">
        <table class="data-table">
          <thead><tr><th>Month</th><th class="text-right">Bets</th><th class="text-right">Staked</th><th class="text-right">P/L</th><th class="text-right">ROI</th></tr></thead>
          <tbody>
            {#each data.monthly as mo}
              <tr><td class="text-[11px] text-white/80">{mo.month}</td><td class="num text-right text-[10.5px] text-fog">{mo.bets}</td><td class="num text-right text-[10.5px] text-fog">{fmtNgn(mo.stakedNgn, { compact: true })}</td><td class={`num text-right text-[10.5px] font-semibold ${mo.profitNgn >= 0 ? 'text-mint' : 'text-rose'}`}>{fmtNgn(mo.profitNgn, { compact: true })}</td><td class={`num text-right text-[10.5px] font-semibold ${mo.roi >= 0 ? 'text-mint' : 'text-rose'}`}>{signed(mo.roi)}%</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="space-y-4">
      <div class="panel p-4">
        <SectionHeader title="ROI by sport" description="Where the model actually earns" eyebrow="Attribution" />
        <BarChart horizontal data={data.roiBySport.map((s: any) => ({ label: SPORT_MAP[s.sport as keyof typeof SPORT_MAP].name, value: s.roi, colour: sportColours[s.sport], sub: `${s.bets} bets · yield ${signed(s.yield)}%` }))} format={(v) => `${signed(v)}%`} />
      </div>
      <div class="panel p-4">
        <SectionHeader title="ROI by market" description="Strike rate and return per market family" eyebrow="Markets" />
        <div class="space-y-2">
          {#each data.roiByMarket as row}
            <div>
              <div class="mb-1 flex items-center justify-between text-[10.5px]">
                <span class="text-fog">{row.market} <span class="text-[9px] text-fog-dim">· {row.bets} bets</span></span>
                <span class="num font-semibold text-mint">+{row.roi.toFixed(1)}%</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div class="h-full rounded-full bg-gradient-to-r from-lime to-mint" style={`width:${(row.roi / 8) * 100}%`}></div></div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-4 xl:grid-cols-3">
    <div class="panel p-4 xl:col-span-2">
      <SectionHeader title="Calibration audit" description="Predicted probability vs observed frequency — the model's honesty check" eyebrow="Reliability" />
      <div class="mt-2 space-y-3">
        {#each data.calibration as bucket}
          <div class="flex items-center gap-3">
            <span class="w-14 shrink-0 text-[10px] text-fog">{bucket.bucket}</span>
            <div class="relative h-3 flex-1 rounded-full bg-white/[0.05]">
              <div class="absolute inset-y-0 left-0 rounded-full bg-lime/35" style={`width:${bucket.predicted * 100}%`}></div>
              <div class="absolute -top-1 h-5 w-1 rounded bg-white" style={`left:${bucket.observed * 100}%`}></div>
            </div>
            <span class="num w-12 text-right text-[10px] text-white">{(bucket.observed * 100).toFixed(1)}%</span>
            <span class="num w-14 text-right text-[9px] text-fog-dim">{bucket.count} bets</span>
          </div>
        {/each}
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-3 text-[9px] text-fog-dim">
        <span class="flex items-center gap-1"><span class="h-1.5 w-4 rounded bg-lime/40"></span>Predicted</span>
        <span class="flex items-center gap-1"><span class="h-3 w-1 rounded bg-white"></span>Observed</span>
        <span>· well-calibrated models track the diagonal</span>
      </div>
    </div>

    <div class="panel p-4">
      <SectionHeader title="Staking simulator" description="Size a bet from bankroll and edge" eyebrow="Calculator" />
      <div class="space-y-2.5">
        <div>
          <label class="label" for="bank">Bankroll (₦)</label>
          <input id="bank" class="input" type="number" min="1000" step="1000" bind:value={bankroll} />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div><label class="label" for="edge">Edge %</label><input id="edge" class="input" type="number" step="0.1" min="0" max="30" bind:value={edgePct} /></div>
          <div><label class="label" for="odds">Decimal odds</label><input id="odds" class="input" type="number" step="0.01" min="1.01" bind:value={odds} /></div>
        </div>
        <div>
          <label class="label" for="fraction">Kelly fraction — {(fraction * 100).toFixed(0)}%</label>
          <input id="fraction" type="range" min="0.05" max="1" step="0.05" bind:value={fraction} class="w-full accent-[#c9ff4d]" />
        </div>
      </div>
      <div class="mt-3 space-y-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-3 text-[10.5px]">
        <div class="flex justify-between"><span class="text-fog">Model probability</span><span class="num font-semibold text-white">{(modelProb * 100).toFixed(2)}%</span></div>
        <div class="flex justify-between"><span class="text-fog">Full Kelly</span><span class="num font-semibold text-white">{(fullKelly * 100).toFixed(2)}%</span></div>
        <div class="flex justify-between"><span class="text-fog">Stake</span><span class="num text-[13px] font-bold text-lime">{fmtNgn(stake)}</span></div>
        <div class="flex justify-between"><span class="text-fog">Expected value</span><span class="num font-semibold text-mint">{fmtNgn(ev)}</span></div>
        <div class="flex justify-between"><span class="text-fog">EV per stake</span><span class="num font-semibold text-mint">{signed(evPct)}%</span></div>
        <div class="flex justify-between"><span class="text-fog">Bankroll growth</span><span class="num font-semibold text-white">{growth.toFixed(3)}%</span></div>
        <div class="flex justify-between border-t border-white/[0.06] pt-1.5"><span class="text-fog">Potential return</span><span class="num font-semibold text-white">{fmtNgn(stake + potential)}</span></div>
      </div>
      <p class="mt-2 text-[9px] leading-relaxed text-fog-dim">Quarter-Kelly is the default. Full Kelly maximises growth but produces deep drawdowns and assumes the probability is exact.</p>
    </div>
  </div>

  <div class="panel overflow-hidden">
    <div class="flex items-center justify-between px-4 pb-1 pt-4">
      <SectionHeader title="Recently settled" description="The last twelve graded selections" eyebrow="Ledger" />
      <a href="/paper" class="text-[10.5px] font-semibold text-lime hover:underline">Full ledger →</a>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Fixture</th><th>Selection</th><th class="text-right">Odds</th><th class="text-right">Stake</th><th class="text-right">P/L</th><th>Result</th></tr></thead>
        <tbody>
          {#each data.recentSettled as bet}
            <tr>
              <td class="text-[10.5px] text-white/80">{bet.fixture}</td>
              <td><div class="text-[10.5px] text-white/80">{bet.selection}</div><div class="text-[9px] text-fog-dim">{bet.market}</div></td>
              <td class="num text-right text-[10.5px] text-fog">{bet.odds.toFixed(2)}</td>
              <td class="num text-right text-[10.5px] text-fog">{fmtNgn(bet.stakeNgn)}</td>
              <td class={`num text-right text-[10.5px] font-semibold ${(bet.pnlNgn ?? 0) >= 0 ? 'text-mint' : 'text-rose'}`}>{fmtNgn(bet.pnlNgn ?? 0)}</td>
              <td><span class={`chip !px-1.5 !py-0 !text-[8.5px] ${bet.status === 'won' ? 'chip-mint' : 'chip-rose'}`}>{bet.status}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
