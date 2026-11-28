<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowLeft, ArrowUpRight, Sparkles, Bot, ShieldAlert, TrendingUp, MapPin, CloudSun, Users, BarChart3, Layers, GitCompareArrows, Star, Copy, Check, LoaderCircle, ChevronRight, Info, Target, Radio } from '@lucide/svelte';
  import TeamBadge from '#lib/components/TeamBadge.svelte';
  import SportGlyph from '#lib/components/SportGlyph.svelte';
  import KickoffClock from '#lib/components/KickoffClock.svelte';
  import TeamNameLink from '#lib/components/TeamNameLink.svelte';
  import AddToBetslip from '#lib/components/AddToBetslip.svelte';
  import ProbabilityBar from '#lib/components/ProbabilityBar.svelte';
  import Heatmap from '#lib/components/Heatmap.svelte';
  import LineChart from '#lib/components/LineChart.svelte';
  import ConfidenceMeter from '#lib/components/ConfidenceMeter.svelte';
  import Gauge from '#lib/components/Gauge.svelte';
  import FormPills from '#lib/components/FormPills.svelte';
  import Sparkline from '#lib/components/Sparkline.svelte';
  import { fmtNgn, pct, signed } from '#lib/engine/core';
  import { formatKickoff, formatDate, relativeTime } from '#lib/format';

  let { data } = $props();
  const { fixture, prediction, home, away, league } = $derived(data);
  const live = $derived(fixture.status === 'live' || fixture.status === 'halftime');
  const finished = $derived(fixture.status === 'finished');
  let tab = $state<'analysis' | 'markets' | 'stats' | 'lineups' | 'models'>('analysis');
  let starred = $state(false);
  let copied = $state(false);
  let analysis = $state<any>(null);
  let analysisLoading = $state(false);
  let marketFilter = $state('all');

  const tabs = $derived([
    { id: 'analysis', label: 'Analysis', icon: Sparkles },
    { id: 'markets', label: `Markets (${prediction.markets.length})`, icon: Layers },
    { id: 'stats', label: 'Stats & form', icon: BarChart3 },
    { id: 'lineups', label: 'Lineups', icon: Users },
    { id: 'models', label: 'Models', icon: GitCompareArrows }
  ] as const);

  const main = $derived(prediction.markets.find((m: any) => m.id === '1x2' || m.id === 'ml'));
  const bestEdge = $derived([...prediction.markets.flatMap((m: any) => m.outcomes.map((o: any) => ({ ...o, market: m.label })))].sort((a: any, b: any) => b.edge - a.edge));
  const valueBets = $derived(prediction.valueBets);
  const rankedSelections = $derived(
    (prediction.recommendations ?? prediction.valueBets ?? [])
      .slice()
      .sort((a: any, b: any) => b.modelProbability - a.modelProbability || b.edge - a.edge)
      .slice(0, 10)
      .map((row: any) => ({ ...row, bestBook: row.bestBook ?? row.bookmaker }))
  );
  const topScores = $derived(prediction.topScorelines);
  const marketGroups = $derived(Array.from(new Set(prediction.markets.map((m: any) => m.group))));
  const shownMarkets = $derived(marketFilter === 'all' ? prediction.markets : prediction.markets.filter((m: any) => m.group === marketFilter));

  /** The side of a market the consensus desk rates highest, when we have one. */
  function consensus(market: any) {
    let best: any = null;
    for (const outcome of market.outcomes) {
      if (typeof outcome.prior !== 'number') continue;
      if (!best || outcome.prior > best.prior) best = outcome;
    }
    return best;
  }

  const sportsbookProb = $derived(main ? main.outcomes.map((o: any) => ({ label: o.label, prob: o.modelProbability, odds: o.bookOdds, edge: o.edge })) : []);

  async function loadAnalysis() {
    if (analysisLoading) return;
    analysisLoading = true;
    try {
      const res = await fetch(`/api/analysis/${fixture.id}`);
      analysis = await res.json();
    } catch {
      analysis = { provider: 'error', headline: 'Analyst unavailable', summary: 'Could not reach the analysis endpoint.', sections: [] };
    } finally {
      analysisLoading = false;
    }
  }

  onMount(loadAnalysis);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      copied = false;
    }
  }

  const overUnderRows = $derived([
    { label: 'Over 1.5', value: prediction.over15 },
    { label: 'Over 2.5', value: prediction.over25 },
    { label: 'Over 3.5', value: prediction.over35 },
    { label: 'BTTS', value: prediction.bothTeamsScore }
  ]);
</script>

<svelte:head><title>{home.name} vs {away.name} — CaveBettor analysis</title></svelte:head>

<div class="space-y-4">
  <!-- Breadcrumb -->
  <div class="flex flex-wrap items-center justify-between gap-2">
    <a href="/fixtures" class="flex items-center gap-1.5 text-[11px] font-medium text-fog hover:text-white"><ArrowLeft size={13} /> All fixtures</a>
    <div class="flex items-center gap-2">
      <button onclick={() => (starred = !starred)} class={`btn btn-ghost !px-2.5 !py-1.5 text-[10.5px] ${starred ? '!border-amber/30 !text-amber' : ''}`}>
        <Star size={12} fill={starred ? 'currentColor' : 'none'} /> {starred ? 'Watching' : 'Watchlist'}
      </button>
      <button onclick={copyLink} class="btn btn-ghost !px-2.5 !py-1.5 text-[10.5px]">
        {#if copied}<Check size={12} class="text-mint" /> Copied{:else}<Copy size={12} /> Share{/if}
      </button>
      <a href={`/api/predictions/${fixture.id}`} target="_blank" class="btn btn-ghost !px-2.5 !py-1.5 text-[10.5px]">API <ArrowUpRight size={11} /></a>
    </div>
  </div>

  <!-- Match header -->
  <div class="panel relative overflow-hidden">
    <div class="mesh pointer-events-none absolute inset-0 opacity-40"></div>
    <div class="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full opacity-[0.12] blur-3xl" style={`background:${league.colour}`}></div>
    <div class="relative p-4 sm:p-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <SportGlyph sport={fixture.sport} size="md" />
          <span class="h-5 w-1.5 rounded-full" style={`background:${league.colour}`}></span>
          <span class="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fog">
            {league.name}{#if league.country} · {league.country}{/if}{#if fixture.round} · {fixture.round}{/if}
          </span>
          {#if live}
            <span class="chip chip-mint"><span class="live-dot h-1.5 w-1.5 rounded-full bg-mint"></span>{fixture.period} · {fixture.minute}′</span>
          {:else if finished}
            <span class="chip">Full time</span>
          {:else}
            <span class="chip chip-sky"><KickoffClock kickoff={fixture.kickoff} showLabel /></span>
          {/if}
        </div>
        <div class="flex items-center gap-3 text-[10.5px] text-fog-dim">
          <span class="flex items-center gap-1"><MapPin size={11} /> {fixture.venue}</span>
          <span class="hidden items-center gap-1 sm:flex"><CloudSun size={11} /> {fixture.weather}</span>
        </div>
      </div>

      <div class="mt-5 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div class="flex items-center gap-3 sm:justify-end">
          <div class="order-2 min-w-0 text-left sm:order-1 sm:text-right">
            <span class="display block truncate text-[15px] font-bold text-white sm:text-[22px]"><TeamNameLink team={home} size="lg" class="justify-end" /></span>
            <div class="mt-1 flex items-center gap-2 sm:justify-end">
              <FormPills form={home.form} size="xs" />
              <span class="text-[9.5px] text-fog-dim">Elo {home.elo}</span>
            </div>
          </div>
          <div class="order-1 shrink-0 sm:order-2"><span class="block sm:hidden"><TeamBadge team={home} size={40} /></span><span class="hidden sm:block"><TeamBadge team={home} size={54} /></span></div>
        </div>

        <div class="flex flex-col items-center justify-center px-2">
          {#if live || finished}
            <div class="display num text-[28px] font-bold leading-none text-white sm:text-[36px]">{fixture.score.home}<span class="mx-1.5 text-fog-dim">–</span>{fixture.score.away}</div>
            <div class="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-fog-dim">{live ? `${fixture.period} · ${fixture.minute}′` : 'Final score'}</div>
            {#if fixture.periods?.length}
              <div class="mt-2 flex max-w-[190px] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[9.5px] text-fog-dim sm:max-w-none">
                {#each fixture.periods as period}
                  <span class="inline-flex items-center gap-1">
                    <span class="uppercase tracking-[0.05em]">{period.label}</span>
                    <span class="num font-semibold text-fog">{period.home}–{period.away}</span>
                  </span>
                {/each}
              </div>
            {/if}
          {:else}
            <div class="num text-[19px] font-bold text-white">{new Date(fixture.kickoff).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
            <div class="mt-1 text-center text-[9.5px] font-semibold uppercase tracking-[0.12em] text-fog-dim">
              {new Date(fixture.kickoff).toLocaleDateString('en-NG', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <div class="mt-0.5 text-center text-[9px] uppercase tracking-[0.12em] text-fog-dim">Kick-off · WAT</div>
          {/if}
        </div>

        <div class="flex items-center gap-3">
          <div class="shrink-0"><span class="block sm:hidden"><TeamBadge team={away} size={40} /></span><span class="hidden sm:block"><TeamBadge team={away} size={54} /></span></div>
          <div class="min-w-0">
            <span class="display block truncate text-[15px] font-bold text-white sm:text-[22px]"><TeamNameLink team={away} size="lg" /></span>
            <div class="mt-1 flex items-center gap-2">
              <FormPills form={away.form} size="xs" />
              <span class="text-[9.5px] text-fog-dim">Elo {away.elo}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div class="rounded-xl border border-white/[0.07] bg-black/20 p-3.5">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[10px] font-semibold uppercase tracking-[0.14em] text-fog-dim">Model probability split</span>
            <span class="chip chip-lime !px-2 !py-0.5 !text-[9px]">Ensemble {prediction.modelVersion.split(' ').pop()}</span>
          </div>
          <ProbabilityBar
            home={prediction.probabilities.home}
            draw={prediction.probabilities.draw}
            away={prediction.probabilities.away}
            homeLabel={home.name}
            drawLabel="Draw"
            awayLabel={away.name}
          />
          <div class="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
            {#each sportsbookProb as outcome}
              <div class="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-center">
                <div class="truncate text-[9.5px] text-fog-dim">{outcome.label}</div>
                <div class="num mt-0.5 text-[13px] font-bold text-white sm:text-[15px]">{(outcome.prob * 100).toFixed(1)}%</div>
                <div class="num mt-0.5 text-[10px] text-fog">Best {outcome.odds.toFixed(2)} <span class={outcome.edge > 0.025 ? 'text-mint' : 'text-fog-dim'}>({signed(outcome.edge * 100)}%)</span></div>
              </div>
            {/each}
          </div>
        </div>
        <div class="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/[0.07] bg-black/20 px-5 py-3">
          <Gauge value={prediction.confidence} size={132} label="Confidence" colour={prediction.confidence >= 75 ? '#35e7a1' : '#f6c453'} />
          <div class="mt-2 flex items-center gap-2 text-[10px] text-fog-dim">
            <span>Data {Math.round(prediction.dataQuality * 100)}%</span>
            <span>·</span>
            <span>{prediction.markets.length} markets</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="scrollbar-none flex gap-1 overflow-x-auto border-b border-white/[0.07] pb-px">
    {#each tabs as t}
      <button
        onclick={() => (tab = t.id)}
        class={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[11.5px] font-semibold transition ${tab === t.id ? 'border-lime text-lime' : 'border-transparent text-fog hover:text-white'}`}
      >
        <t.icon size={13} /> {t.label}
      </button>
    {/each}
  </div>

  {#if tab === 'analysis'}
    <div class="grid gap-4 xl:grid-cols-3">
      <div class="space-y-4 xl:col-span-2">
        <!-- Recommendation -->
        <div class="panel relative overflow-hidden p-4">
          <div class="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime/10 blur-2xl"></div>
          <div class="relative flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-lime"><Target size={12} /> Model recommendation</div>
              <h2 class="display mt-1.5 text-[20px] font-bold text-white">{prediction.recommended.selection}</h2>
              <p class="mt-0.5 text-[11.5px] text-fog">{prediction.recommended.market} · {(prediction.recommended.modelProbability * 100).toFixed(1)}% model probability</p>
              <p class="mt-2 max-w-xl text-[11.5px] leading-relaxed text-white/70">{prediction.recommended.rationale}</p>
            </div>
            <div class="flex w-full flex-wrap items-end gap-x-4 gap-y-2 sm:w-auto">
              <div class="text-right">
                <div class="stat-label">Best odds</div>
                <div class="num text-[22px] font-bold text-lime sm:text-[26px]">{prediction.recommended.odds.toFixed(2)}</div>
              </div>
              <div class="text-right">
                <div class="stat-label">Suggested stake</div>
                <div class="num text-[18px] font-bold text-white sm:text-[20px]">{fmtNgn(prediction.recommended.stakeNgn)}</div>
                <div class="text-[9.5px] text-fog-dim">quarter-Kelly · ₦1.25m</div>
              </div>
              <span class={`chip ${prediction.recommended.risk === 'low' ? 'chip-mint' : prediction.recommended.risk === 'medium' ? 'chip-amber' : 'chip-rose'}`}>{prediction.recommended.risk} risk</span>
            </div>
          </div>
        </div>

        <!-- Ranked model selections: highest strike rate first -->
        <div class="panel overflow-hidden">
          <div class="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-4">
            <div>
              <h3 class="text-[13px] font-semibold text-white">Ranked model selections</h3>
              <p class="text-[10.5px] text-fog-dim">Every positive selection across the markets, ordered by model strike rate — not by price</p>
            </div>
            <span class="chip chip-lime !text-[9.5px]">{rankedSelections.length} qualifying</span>
          </div>
          <div class="divide-y divide-white/[0.05]">
            {#each rankedSelections as row, index (row.marketId + row.selection)}
              <div class="flex items-start gap-2.5 px-4 py-2.5">
                <span class="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[10px] font-bold text-fog">{index + 1}</span>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span class="truncate text-[12px] font-semibold text-white">{row.selection}</span>
                    <span class="chip !px-1.5 !py-0 !text-[9px] capitalize">{row.marketGroup ?? 'market'}</span>
                  </div>
                  <div class="truncate text-[10px] text-fog-dim">{row.market}</div>
                </div>
                <div class="shrink-0 text-right">
                  <div class="num text-[12.5px] font-bold text-lime">{(row.modelProbability * 100).toFixed(1)}%</div>
                  <div class="num text-[9.5px] text-fog-dim">{row.odds.toFixed(2)} · +{(row.edge * 100).toFixed(1)}%</div>
                </div>
                <div class="hidden shrink-0 text-right sm:block">
                  <div class="num text-[10.5px] text-white">{row.confidence}% conf.</div>
                  <div class="text-[9px] text-fog-dim">{row.bestBook ?? ''}</div>
                </div>
              </div>
            {:else}
              <p class="px-4 py-6 text-center text-[11.5px] text-fog">The model has no selection clearing its strike-rate and value thresholds for this fixture. Passing is the disciplined call.</p>
            {/each}
          </div>
        </div>

        <!-- Value table -->
        <div class="panel overflow-hidden">
          <div class="flex items-center justify-between px-4 pb-1 pt-4">
            <div>
              <h3 class="text-[13px] font-semibold text-white">Positive-EV selections</h3>
              <p class="text-[10.5px] text-fog-dim">Model probability vs best available price after margin</p>
            </div>
            <span class="chip chip-mint !text-[9.5px]">{valueBets.length} edges</span>
          </div>
          {#if valueBets.length}
            <div class="table-wrap mt-2">
              <table class="data-table">
                <thead>
                  <tr><th>Market</th><th>Selection</th><th class="text-right">Model</th><th class="text-right">Implied</th><th class="text-right">Best price</th><th class="text-right">Edge</th><th class="text-right">Stake</th></tr>
                </thead>
                <tbody>
                  {#each valueBets as bet}
                    <tr>
                      <td class="max-w-[160px] truncate text-[11px] text-fog">{bet.market}</td>
                      <td class="text-[11.5px] font-medium text-white">{bet.selection}</td>
                      <td class="num text-right text-[11.5px]">{(bet.modelProbability * 100).toFixed(1)}%</td>
                      <td class="num text-right text-[11.5px] text-fog">{(bet.impliedProbability * 100).toFixed(1)}%</td>
                      <td class="num text-right text-[11.5px] font-semibold text-lime">{bet.odds.toFixed(2)} <span class="text-[9px] text-fog-dim">{bet.bookmaker}</span></td>
                      <td class="num text-right text-[11.5px] font-bold text-mint">+{(bet.edge * 100).toFixed(1)}%</td>
                      <td class="num text-right text-[11px] text-white">{fmtNgn(bet.stakeNgn)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="px-4 py-6 text-center text-[11.5px] text-fog">No selection clears the 2.5% edge threshold. The disciplined play is to pass or wait for a better price.</div>
          {/if}
        </div>

        <!-- Scoreline + totals -->
        <div class="grid gap-4 md:grid-cols-2">
          <div class="panel p-4">
            <h3 class="text-[13px] font-semibold text-white">Correct score heatmap</h3>
            <p class="mb-3 text-[10.5px] text-fog-dim">Probability of each final scoreline (%)</p>
            {#if prediction.scoreGrid.length}
              <Heatmap cells={prediction.scoreGrid} homeShort={home.name} awayShort={away.name} />
            {:else}
              <p class="py-6 text-center text-[11px] text-fog">Scoreline distribution is not modelled for this sport.</p>
            {/if}
          </div>
          <div class="space-y-4">
            <div class="panel p-4">
              <h3 class="text-[13px] font-semibold text-white">Goals & totals</h3>
              <p class="mb-3 text-[10.5px] text-fog-dim">Ensemble probabilities</p>
              <div class="space-y-2.5">
                {#each overUnderRows as row}
                  <div>
                    <div class="mb-1 flex justify-between text-[11px]"><span class="text-fog">{row.label}</span><span class="num font-semibold text-white">{(row.value * 100).toFixed(1)}%</span></div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div class="h-full rounded-full bg-gradient-to-r from-mint to-lime" style={`width:${row.value * 100}%`}></div></div>
                  </div>
                {/each}
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-[10.5px]">
                <div><span class="text-fog-dim">Expected goals</span><div class="num mt-0.5 text-[13px] font-semibold text-white">{prediction.expectedGoals.home.toFixed(2)} – {prediction.expectedGoals.away.toFixed(2)}</div></div>
                <div><span class="text-fog-dim">Total</span><div class="num mt-0.5 text-[13px] font-semibold text-white">{prediction.expectedGoals.total.toFixed(2)}</div></div>
              </div>
            </div>
            <div class="panel p-4">
              <h3 class="text-[13px] font-semibold text-white">Top projected scorelines</h3>
              <div class="mt-2 space-y-1.5">
                {#each topScores.slice(0, 5) as score, i}
                  <div class="flex items-center gap-2">
                    <span class="num flex h-5 w-5 items-center justify-center rounded bg-white/[0.05] text-[9px] text-fog">{i + 1}</span>
                    <span class="num text-[12px] font-semibold text-white">{score.home} – {score.away}</span>
                    <div class="ml-auto h-1.5 w-14 overflow-hidden rounded-full bg-white/[0.06] sm:w-24"><div class="h-full rounded-full bg-lime" style={`width:${Math.min(100, score.probability * 800)}%`}></div></div>
                    <span class="num w-10 text-right text-[10.5px] text-fog">{(score.probability * 100).toFixed(1)}%</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>

        <!-- Insights -->
        <div class="panel p-4">
          <h3 class="text-[13px] font-semibold text-white">Signals & reasoning</h3>
          <div class="mt-3 space-y-2.5">
            {#each prediction.insights as insight}
              <div class="flex gap-2.5 rounded-xl border border-white/[0.06] bg-black/15 p-3">
                <span class={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${insight.impact === 'positive' ? 'bg-mint/10 text-mint' : insight.impact === 'negative' ? 'bg-rose/10 text-rose' : 'bg-white/[0.05] text-fog'}`}>
                  {#if insight.kind === 'warning'}<ShieldAlert size={12} />{:else if insight.kind === 'market'}<TrendingUp size={12} />{:else}<Sparkles size={12} />{/if}
                </span>
                <div class="min-w-0">
                  <div class="text-[11.5px] font-semibold text-white">{insight.title}</div>
                  <p class="mt-0.5 text-[11px] leading-relaxed text-fog">{insight.body}</p>
                </div>
                <span class="num ml-auto shrink-0 text-[9.5px] text-fog-dim">{insight.confidence}%</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Right rail -->
      <div class="space-y-4">
        <div class="panel p-4">
          <div class="flex items-center justify-between">
            <h3 class="flex items-center gap-1.5 text-[13px] font-semibold text-white"><Bot size={14} class="text-violet" /> Match analyst</h3>
            {#if analysis}<span class="chip !text-[8.5px]">{analysis.provider === 'llm' ? 'LLM' : 'Grounded'}</span>{/if}
          </div>
          {#if analysisLoading}
            <div class="mt-3 space-y-2">
              <div class="skeleton h-3 w-4/5 rounded"></div>
              <div class="skeleton h-3 w-full rounded"></div>
              <div class="skeleton h-3 w-2/3 rounded"></div>
              <div class="skeleton h-20 w-full rounded-lg"></div>
            </div>
          {:else if analysis}
            <div class="mt-3">
              <div class="text-[11.5px] font-semibold leading-snug text-white">{analysis.headline}</div>
              <p class="mt-1.5 text-[11px] leading-relaxed text-fog">{analysis.summary}</p>
              <div class="mt-3 space-y-2">
                {#each analysis.sections as section}
                  <details class="group rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2">
                    <summary class="cursor-pointer list-none text-[10.5px] font-semibold text-white/80">{section.heading}<span class="float-right text-fog-dim group-open:rotate-90 transition">›</span></summary>
                    <p class="mt-1.5 text-[10.5px] leading-relaxed text-fog">{section.body}</p>
                  </details>
                {/each}
              </div>
              <p class="mt-3 text-[9px] leading-relaxed text-fog-dim">{analysis.disclaimer}</p>
            </div>
          {/if}
        </div>

        <div class="panel p-4">
          <h3 class="text-[13px] font-semibold text-white">Model consensus</h3>
          <p class="mb-3 text-[10.5px] text-fog-dim">Weighted components feeding the ensemble</p>
          <div class="space-y-3">
            {#each prediction.components as c}
              <div>
                <div class="mb-1 flex items-center justify-between gap-2">
                  <span class="truncate text-[11px] text-white/85">{c.name}</span>
                  <span class="num shrink-0 text-[10px] text-fog">{(c.weight * 100).toFixed(0)}%</span>
                </div>
                <div class="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div class="h-full rounded-full" style={`width:${c.homeProbability * 100}%;background:${c.family === 'market' ? '#6fc9ff' : c.family === 'machine-learning' ? '#c9ff4d' : '#35e7a1'}`}></div></div>
                <div class="mt-1 flex justify-between text-[9.5px] text-fog-dim"><span>{c.note}</span><span class="num">{c.confidence}%</span></div>
              </div>
            {/each}
          </div>
        </div>

        <div class="panel p-4">
          <h3 class="text-[13px] font-semibold text-white">Head to head</h3>
          <div class="mt-2 grid grid-cols-3 gap-1.5 text-center sm:gap-2">
            <div class="rounded-lg bg-white/[0.03] p-2"><div class="num text-[16px] font-bold text-lime">{fixture.h2h.homeWins}</div><div class="text-[9px] text-fog-dim">{home.name} wins</div></div>
            <div class="rounded-lg bg-white/[0.03] p-2"><div class="num text-[16px] font-bold text-white/70">{fixture.h2h.draws}</div><div class="text-[9px] text-fog-dim">Draws</div></div>
            <div class="rounded-lg bg-white/[0.03] p-2"><div class="num text-[16px] font-bold text-sky">{fixture.h2h.awayWins}</div><div class="text-[9px] text-fog-dim">{away.name} wins</div></div>
          </div>
          <div class="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
            {#each fixture.h2h.last.slice(0, 4) as match}
              <div class="text-[10px] text-fog">{match}</div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {:else if tab === 'markets'}
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button onclick={() => (marketFilter = 'all')} class={`chip shrink-0 ${marketFilter === 'all' ? '!border-lime/35 !bg-lime/10 !text-lime' : ''}`}>All markets</button>
          {#each marketGroups as group}
            <button onclick={() => (marketFilter = group)} class={`chip shrink-0 capitalize ${marketFilter === group ? '!border-lime/35 !bg-lime/10 !text-lime' : ''}`}>{group}</button>
          {/each}
        </div>
        <span class="text-[10px] text-fog-dim">
          {data.bookmakers.length} bookmakers compared · totals and handicaps set from this fixture's own projection
          ({prediction.expectedGoals.home.toFixed(1)}–{prediction.expectedGoals.away.toFixed(1)}, {prediction.expectedGoals.total.toFixed(1)} {prediction.scoreUnit})
        </span>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        {#each shownMarkets as market}
          <div class="panel overflow-hidden">
            <div class="flex items-start justify-between gap-2 border-b border-white/[0.06] px-3.5 py-3">
              <div>
                <div class="text-[12px] font-semibold text-white">{market.label}</div>
                <div class="text-[9.5px] text-fog-dim">{market.description}</div>
              </div>
              <span class="chip !text-[8.5px] capitalize">{market.group}</span>
            </div>
            <div class="p-2">
              <div class="mb-1 grid grid-cols-[1fr_42px_42px_38px] gap-1 px-1.5 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-fog-dim sm:grid-cols-[1fr_52px_52px_44px] sm:gap-1.5">
                <span>Selection</span><span class="text-right">Model</span><span class="text-right">Best</span><span class="text-right">Edge</span>
              </div>
              {#each market.outcomes as o}
                <div class={`grid grid-cols-[1fr_42px_42px_38px_24px] items-center gap-1 rounded-lg px-1.5 py-2 text-[11px] sm:grid-cols-[1fr_52px_52px_44px_26px] sm:gap-1.5 ${o.value ? 'bg-lime/[0.06]' : ''}`}>
                  <span class="truncate text-white/85">{o.label} {#if o.trend > 0.02}<span class="text-[8px] text-rose">▼</span>{:else if o.trend < -0.02}<span class="text-[8px] text-mint">▲</span>{/if}</span>
                  <span class="num text-right text-fog">{(o.modelProbability * 100).toFixed(1)}%</span>
                  <span class="num text-right font-semibold text-lime">{o.bookOdds.toFixed(2)}</span>
                  <span class={`num text-right font-semibold ${o.edge > 0.025 ? 'text-mint' : 'text-fog-dim'}`}>{signed(o.edge * 100)}%</span>
                  <AddToBetslip
                    size="xs"
                    leg={{
                      fixtureId: fixture.id,
                      fixtureLabel: `${home.name} vs ${away.name}`,
                      league: league?.name ?? fixture.leagueId,
                      leagueId: fixture.leagueId,
                      sport: fixture.sport,
                      kickoff: fixture.kickoff,
                      marketId: market.id,
                      marketLabel: market.label,
                      marketGroup: market.group,
                      outcomeId: o.id,
                      label: o.label,
                      odds: o.bookOdds,
                      probability: o.modelProbability,
                      edge: o.edge,
                      bestBook: o.bestBook
                    }}
                  />
                </div>
              {/each}
              <div class="px-1.5 pb-1 pt-1 text-[8.5px] leading-snug text-fog-dim">
                {#if consensus(market)}
                  {@const c = consensus(market)}
                  Consensus {c.label} {(c.prior * 100).toFixed(0)}% · model {(c.modelProbability * 100).toFixed(0)}%
                {:else}
                  Best price via {market.outcomes[0]?.bestBook} · updated {relativeTime(market.updatedAt)}
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if tab === 'stats'}
    <div class="grid gap-4 lg:grid-cols-3">
      <div class="panel p-4 lg:col-span-2">
        <h3 class="text-[13px] font-semibold text-white">Team profile</h3>
        <div class="mt-3 overflow-x-auto">
          <table class="data-table">
            <thead><tr><th>Metric</th><th class="text-right">{home.name}</th><th class="text-right">{away.name}</th><th class="text-right">Edge</th></tr></thead>
            <tbody>
              {#each [
                { label: 'Elo rating', h: String(home.elo), a: String(away.elo), better: home.elo > away.elo ? 'h' : 'a' },
                { label: 'Form (last 5)', h: home.form.join(''), a: away.form.join(''), better: '' },
                { label: 'xG per match', h: home.xgFor.toFixed(2), a: away.xgFor.toFixed(2), better: home.xgFor > away.xgFor ? 'h' : 'a' },
                { label: 'xGA per match', h: home.xgAgainst.toFixed(2), a: away.xgAgainst.toFixed(2), better: home.xgAgainst < away.xgAgainst ? 'h' : 'a' },
                { label: 'Clean sheets', h: String(home.cleanSheets), a: String(away.cleanSheets), better: home.cleanSheets > away.cleanSheets ? 'h' : 'a' }
              ] as row}
                <tr>
                  <td class="text-[11.5px] text-fog">{row.label}</td>
                  <td class={`num text-right text-[12px] font-semibold ${row.better === 'h' ? 'text-lime' : 'text-white/80'}`}>{row.h}</td>
                  <td class={`num text-right text-[12px] font-semibold ${row.better === 'a' ? 'text-lime' : 'text-white/80'}`}>{row.a}</td>
                  <td class="text-right text-[10px] text-fog-dim">{row.better === 'h' ? home.name : row.better === 'a' ? away.name : '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if fixture.stats}
          <h3 class="mt-5 text-[13px] font-semibold text-white">Live match stats</h3>
          <div class="mt-2 space-y-2.5">
            {#each [
              { label: 'Possession', h: fixture.stats.possession[0], a: fixture.stats.possession[1], suffix: '%' },
              { label: 'Shots', h: fixture.stats.shots[0], a: fixture.stats.shots[1], suffix: '' },
              { label: 'On target', h: fixture.stats.shotsOnTarget[0], a: fixture.stats.shotsOnTarget[1], suffix: '' },
              { label: 'Corners', h: fixture.stats.corners[0], a: fixture.stats.corners[1], suffix: '' },
              { label: 'Fouls', h: fixture.stats.fouls[0], a: fixture.stats.fouls[1], suffix: '' },
              { label: 'xG', h: fixture.stats.xg[0], a: fixture.stats.xg[1], suffix: '' }
            ] as stat}
              <div>
                <div class="mb-1 flex justify-between text-[10.5px]"><span class="num font-semibold text-white">{stat.h}{stat.suffix}</span><span class="text-fog-dim">{stat.label}</span><span class="num font-semibold text-white">{stat.a}{stat.suffix}</span></div>
                <div class="flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div class="h-full bg-lime" style={`width:${(stat.h / Math.max(1, stat.h + stat.a)) * 100}%`}></div>
                  <div class="h-full bg-sky" style={`width:${(stat.a / Math.max(1, stat.h + stat.a)) * 100}%`}></div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="space-y-4">
        <div class="panel p-4">
          <h3 class="text-[13px] font-semibold text-white">Match information</h3>
          <div class="mt-2">
            <div class="field-row"><span class="text-fog">Competition</span><span class="text-right text-white">{league.name}</span></div>
            <div class="field-row"><span class="text-fog">Round</span><span class="text-right text-white">{fixture.round}</span></div>
            <div class="field-row"><span class="text-fog">Kick-off</span><span class="text-right text-white">{formatKickoff(fixture.kickoff)}</span></div>
            <div class="field-row"><span class="text-fog">Venue</span><span class="text-right text-white">{fixture.venue}</span></div>
            <div class="field-row"><span class="text-fog">Weather</span><span class="text-right text-white">{fixture.weather}</span></div>
            {#if fixture.attendance}<div class="field-row"><span class="text-fog">Attendance</span><span class="num text-right text-white">{fixture.attendance.toLocaleString()}</span></div>{/if}
            {#if fixture.officials}<div class="field-row"><span class="text-fog">Officials</span><span class="text-right text-white">{fixture.officials.join(', ')}</span></div>{/if}
          </div>
        </div>
        {#if data.table.length}
          <div class="panel p-4">
            <h3 class="text-[13px] font-semibold text-white">League table</h3>
            <div class="mt-2 space-y-1">
              {#each data.table as row}
                <div class="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[11px] hover:bg-white/[0.03]">
                  <span class="num w-4 text-fog-dim">{row.position}</span>
                  <TeamBadge team={row.team} size={18} />
                  <span class="min-w-0 flex-1 truncate text-white/80">{row.team.name}</span>
                  <span class="num text-fog-dim">{row.played}</span>
                  <span class="num w-5 text-right font-semibold text-white">{row.points}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else if tab === 'lineups'}
    <div class="panel p-4">
      <div class="flex items-center justify-between">
        <h3 class="text-[13px] font-semibold text-white">Projected lineups</h3>
        <span class="chip !text-[9px]">Confirmed 60 min before kick-off</span>
      </div>
      {#if fixture.lineups}
        <div class="mt-4 grid gap-6 sm:grid-cols-2">
          {#each [{ team: home, list: fixture.lineups.home }, { team: away, list: fixture.lineups.away }] as side}
            <div>
              <div class="mb-2 flex items-center gap-2"><TeamBadge team={side.team} size={22} /><span class="text-[12px] font-semibold text-white">{side.team.name}</span></div>
              <div class="grid grid-cols-2 gap-x-4">
                {#each side.list as player, i}
                  <div class="flex items-center gap-2 border-b border-white/[0.04] py-1.5 text-[10.5px]">
                    <span class="num flex h-4 w-4 items-center justify-center rounded bg-white/[0.05] text-[8px] text-fog-dim">{i + 1}</span>
                    <span class="truncate text-white/80">{player}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="py-8 text-center text-[11.5px] text-fog">Lineup data is not collected for this sport. Player availability feeds the model through the availability index instead.</p>
      {/if}
    </div>
  {:else if tab === 'models'}
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="panel p-4">
        <h3 class="text-[13px] font-semibold text-white">Ensemble decomposition</h3>
        <p class="mb-3 text-[10.5px] text-fog-dim">Each component's probability and weight in the final blend</p>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Component</th><th>Family</th><th class="text-right">H</th><th class="text-right">D</th><th class="text-right">A</th><th class="text-right">Weight</th></tr></thead>
            <tbody>
              {#each prediction.components as c}
                <tr>
                  <td class="text-[11.5px] font-medium text-white">{c.name}<div class="text-[9px] text-fog-dim">{c.note}</div></td>
                  <td class="text-[10px] capitalize text-fog">{c.family.replace('-', ' ')}</td>
                  <td class="num text-right text-[11px]">{(c.homeProbability * 100).toFixed(1)}%</td>
                  <td class="num text-right text-[11px] text-fog">{(c.drawProbability * 100).toFixed(1)}%</td>
                  <td class="num text-right text-[11px]">{(c.awayProbability * 100).toFixed(1)}%</td>
                  <td class="num text-right text-[11px] font-semibold text-lime">{(c.weight * 100).toFixed(0)}%</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel p-4">
        <h3 class="text-[13px] font-semibold text-white">Calibration reference</h3>
        <p class="mb-3 text-[10.5px] text-fog-dim">Predicted vs observed frequency for the production football model</p>
        <div class="space-y-2">
          {#each data.models[0].calibration as bucket}
            <div class="flex items-center gap-2 text-[10.5px]">
              <span class="w-14 shrink-0 text-fog">{bucket.bucket}</span>
              <div class="relative h-2 flex-1 rounded-full bg-white/[0.06]">
                <div class="absolute inset-y-0 left-0 rounded-full bg-lime/35" style={`width:${bucket.predicted * 100}%`}></div>
                <div class="absolute -top-1 h-4 w-1 rounded bg-white" style={`left:${bucket.observed * 100}%`}></div>
              </div>
              <span class="num w-10 text-right text-white">{(bucket.observed * 100).toFixed(0)}%</span>
              <span class="num w-10 text-right text-fog-dim">{bucket.count}</span>
            </div>
          {/each}
        </div>
        <div class="mt-3 flex items-center gap-3 text-[9.5px] text-fog-dim"><span class="flex items-center gap-1"><span class="h-1.5 w-3 rounded bg-lime/40"></span>Predicted</span><span class="flex items-center gap-1"><span class="h-2 w-1 rounded bg-white"></span>Observed</span><span>· sample size shown right</span></div>
      </div>
    </div>
  {/if}
</div>
