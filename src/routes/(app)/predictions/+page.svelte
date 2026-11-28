<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { Sparkles, ArrowUpRight, TrendingUp, Target, ShieldCheck, Info, ChevronRight, CircleSlash, Layers, Zap } from '@lucide/svelte';
  import ConfidenceMeter from '#lib/components/ConfidenceMeter.svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import AddToBetslip from '#lib/components/AddToBetslip.svelte';
  import SportGlyph from '#lib/components/SportGlyph.svelte';
  import KickoffClock from '#lib/components/KickoffClock.svelte';
  import { fmtNgn, signed } from '#lib/engine/core';
  import { formatKickoff } from '#lib/format';

  let { data } = $props();

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams({ sport: data.filters.sport, sort: data.filters.sort, mode: data.filters.mode, ...patch });
    for (const [k, v] of [...params.entries()]) if (!v || v === 'all') params.delete(k);
    goto(`/predictions${params.size ? `?${params}` : ''}`, { keepFocus: true, noScroll: true });
  }

  const top = $derived(data.page === 1 ? data.bets.slice(0, 3) : []);
  const isAll = $derived(data.filters.mode === 'all');
  const kpis = $derived([
    { label: isAll ? 'Projected fixtures' : 'Positive edges', value: String(data.summary.count), sub: isAll ? 'one frozen call each' : 'after margin', colour: '#c9ff4d' },
    { label: 'Average edge', value: `${signed(data.summary.avgEdge * 100)}%`, sub: isAll ? 'value and no-value' : 'per selection', colour: '#35e7a1' },
    { label: 'Best edge', value: `${signed(data.summary.bestEdge * 100)}%`, sub: 'highest on board', colour: '#f6c453' },
    { label: 'Mean confidence', value: `${data.summary.avgConfidence}%`, sub: 'selected call', colour: '#6fc9ff' },
    { label: 'Suggested exposure', value: fmtNgn(data.summary.exposure, { compact: true }), sub: 'staked value calls', colour: '#a99bff' }
  ]);
  let sort = $state(untrack(() => data.filters.sort));
</script>

<svelte:head><title>Model board — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-lime"><Sparkles size={12} /> {isAll ? 'Model board' : 'Value board'}</div>
      <h1 class="display text-[22px] font-bold tracking-tight text-white sm:text-[26px]">{isAll ? 'Every fixture, projected.' : 'Model edge, ranked.'}</h1>
      <p class="mt-1 max-w-2xl text-[12.5px] text-fog">
        {#if isAll}
          The frozen pre-match call for all {data.total} fixtures in the window. Value tags mark calls whose price also clears the 0.5% edge; page {data.page} of {data.pageCount}.
        {:else}
          Every selection whose model probability beats the de-vigged market price. {data.total} edges across {data.summary.fixtures} fixtures, page {data.page} of {data.pageCount}.
        {/if}
      </p>
    </div>
    <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <div class="inline-flex rounded-lg border border-white/[0.08] bg-black/20 p-0.5">
        <button onclick={() => update({ mode: 'all' })} class={`rounded-md px-2.5 py-1.5 text-[10.5px] font-semibold transition ${isAll ? 'bg-lime/15 text-lime' : 'text-fog hover:text-white'}`}>All projections</button>
        <button onclick={() => update({ mode: 'value' })} class={`rounded-md px-2.5 py-1.5 text-[10.5px] font-semibold transition ${!isAll ? 'bg-lime/15 text-lime' : 'text-fog hover:text-white'}`}>Value only</button>
      </div>
      <select class="input !w-auto !py-2 text-[11.5px]" bind:value={sort} onchange={() => update({ sort })} aria-label="Sort model calls">
        <option value="probability">Sort: model probability</option>
        <option value="edge">Sort: model edge</option>
        <option value="confidence">Sort: confidence</option>
        <option value="odds">Sort: price</option>
        <option value="time">Sort: kick-off</option>
      </select>
      <a href="/api/fixtures" target="_blank" class="btn btn-ghost !py-2 text-[11px]">API <ArrowUpRight size={11} /></a>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
    {#each kpis as kpi}
      <div class="panel p-3.5">
        <div class="stat-label">{kpi.label}</div>
        <div class="display num mt-1.5 text-[18px] font-bold sm:text-[21px]" style={`color:${kpi.colour}`}>{kpi.value}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">{kpi.sub}</div>
      </div>
    {/each}
  </div>

  <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
    <button onclick={() => update({ sport: 'all' })} class={`chip shrink-0 ${data.filters.sport === 'all' ? '!border-lime/35 !bg-lime/10 !text-lime' : ''}`}>All sports <span class="num text-[9px] opacity-70">{data.summary.count}</span></button>
    {#each data.sports as s}
      <button onclick={() => update({ sport: s.id })} class={`chip shrink-0 ${data.filters.sport === s.id ? '!border-lime/35 !bg-lime/10 !text-lime' : ''}`}>
        {s.icon} {s.name} <span class="num text-[9px] opacity-70">{s.bets}</span>
      </button>
    {/each}
  </div>

  {#if data.bets.length === 0}
    <div class="panel flex flex-col items-center justify-center py-16 text-center">
      <CircleSlash size={28} class="text-fog-dim" />
      <h3 class="mt-3 text-[15px] font-semibold text-white">{isAll ? 'No fixtures in this window' : 'No value in this sport right now'}</h3>
      <p class="mt-1 max-w-md text-[12px] text-fog">{isAll ? 'Every fixture inside the published horizon is projected. Widen the window or check another sport.' : 'The market is pricing these fixtures efficiently. Check another sport or come back after the next odds refresh.'}</p>
    </div>
  {:else}
    {#if top.length}
    <div class="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {#each top as bet, i}
        <a href={`/fixtures/${bet.fixtureId}`} class="panel panel-hover relative overflow-hidden p-4">
          <div class="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lime/10 blur-2xl"></div>
          <div class="relative">
            <div class="flex items-center justify-between gap-2">
              <span class="flex min-w-0 items-center gap-1.5">
                <SportGlyph sport={bet.sport} size="xs" />
                <span class="chip min-w-0 truncate !text-[9px]">#{i + 1} · {bet.league}</span>
              </span>
              <KickoffClock kickoff={bet.kickoff} />
            </div>
            <div class="mt-3 truncate text-[10.5px] text-fog">{bet.home} vs {bet.away}</div>
            <div class="mt-0.5 display text-[16px] font-bold leading-snug text-white">{bet.selection}</div>
            <div class="mt-0.5 text-[10.5px] text-fog-dim">{bet.market} · {bet.bookmaker}</div>
            <div class="mt-3 flex items-end justify-between">
              <div>
                <div class="stat-label">Best odds</div>
                <div class="num text-[24px] font-bold text-lime">{bet.odds.toFixed(2)}</div>
              </div>
              <div class="text-right">
                <div class="stat-label">Model edge</div>
                <div class={`num text-[18px] font-bold ${bet.edge >= 0 ? 'text-mint' : 'text-rose'}`}>{signed(bet.edge * 100)}%</div>
              </div>
              <ConfidenceMeter value={bet.confidence} size="md" showLabel={false} />
            </div>
            <div class="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[10px]">
              <span class="text-fog">{bet.isValue ? `Value · stake ${fmtNgn(bet.stakeNgn)}` : 'Model call · no stake'}</span>
              <span class="flex items-center gap-1 font-semibold text-lime">Analysis <ChevronRight size={11} /></span>
            </div>
          </div>
        </a>
      {/each}
    </div>
    {/if}

    <div class="grid gap-4 xl:grid-cols-3">
      <div class="panel overflow-hidden xl:col-span-2">
        <div class="flex items-center justify-between px-4 pb-1 pt-4">
          <SectionHeader title={isAll ? 'Every fixture, one frozen call' : 'All ranked selections'} description={isAll ? 'Headline model projection, with value calls tagged' : 'Model probability versus best de-vigged price'} eyebrow="The board" />
          <span class="chip !text-[9px]">{data.shownFrom}–{data.shownTo} of {data.total}</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Fixture</th><th>Selection</th><th class="text-right">Model</th><th class="text-right">Price</th><th class="text-right">Edge</th><th class="text-right">Stake</th><th class="text-right">Slip</th><th></th></tr>
            </thead>
            <tbody>
              {#each data.bets as bet}
                <tr class="cursor-pointer" onclick={() => goto(`/fixtures/${bet.fixtureId}`)}>
                  <td>
                    <div class="flex items-center gap-2">
                      <SportGlyph sport={bet.sport} size="xs" />
                      <span class="h-4 w-1 shrink-0 rounded-full" style={`background:${bet.leagueColour}`}></span>
                      <div class="min-w-0">
                        <div class="truncate text-[11.5px] font-medium text-white">{bet.home} vs {bet.away}</div>
                        <div class="text-[9.5px] text-fog-dim">{bet.league} · {formatKickoff(bet.kickoff)}</div>
                      </div>
                    </div>
                  </td>
                  <td class="max-w-[190px]">
                    <div class="flex items-center gap-1.5">
                      <span class="truncate text-[11px] font-medium text-white/85">{bet.selection}</span>
                      {#if bet.isValue}<span class="chip shrink-0 !border-lime/30 !bg-lime/10 !px-1.5 !py-0 !text-[8px] !text-lime">Value</span>{/if}
                    </div>
                    <div class="truncate text-[9px] text-fog-dim">{bet.market}</div>
                  </td>
                  <td class="num text-right text-[11px]">{(bet.modelProbability * 100).toFixed(1)}%</td>
                  <td class="num text-right text-[11.5px] font-semibold text-lime">{bet.odds.toFixed(2)}</td>
                  <td class={`num text-right text-[11px] font-bold ${bet.edge >= 0 ? 'text-mint' : 'text-rose'}`}>{signed(bet.edge * 100)}%</td>
                  <td class="num text-right text-[10.5px] text-white/80">{fmtNgn(bet.stakeNgn)}</td>
                  <td class="text-right">
                    <span class="inline-flex justify-end">
                      <AddToBetslip
                        size="xs"
                        leg={{
                          fixtureId: bet.fixtureId,
                          fixtureLabel: `${bet.home} vs ${bet.away}`,
                          league: bet.league,
                          sport: bet.sport,
                          kickoff: bet.kickoff,
                          marketId: bet.marketId ?? bet.market,
                          marketLabel: bet.market,
                          outcomeId: bet.outcomeId,
                          label: bet.selection,
                          odds: bet.odds,
                          probability: bet.modelProbability,
                          edge: bet.edge,
                          bestBook: bet.bestBook
                        }}
                      />
                    </span>
                  </td>
                  <td class="text-right"><span class="chip !px-1.5 !py-0 !text-[8.5px] capitalize">{bet.risk}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if data.pageCount > 1}
          <div class="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-[10.5px] text-fog">
            <span>Page {data.page} of {data.pageCount}</span>
            <div class="flex items-center gap-1.5">
              <button class="btn btn-ghost !px-2.5 !py-1.5 text-[10px]" disabled={data.page <= 1} onclick={() => update({ page: String(data.page - 1) })} aria-label="Previous page">Previous</button>
              <button class="btn btn-ghost !px-2.5 !py-1.5 text-[10px]" disabled={data.page >= data.pageCount} onclick={() => update({ page: String(data.page + 1) })} aria-label="Next page">Next</button>
            </div>
          </div>
        {/if}
      </div>

      <div class="space-y-4">
        <div class="panel p-4">
          <div class="flex items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg border border-amber/25 bg-amber/10 text-amber"><Layers size={14} /></span>
            <div>
              <h3 class="text-[12.5px] font-semibold text-white">Accumulator idea</h3>
              <p class="text-[9.5px] uppercase tracking-[0.12em] text-fog-dim">Three legs · different fixtures</p>
            </div>
          </div>
          <div class="mt-3 space-y-2">
            {#each data.acca.legs as leg, i}
              <div class="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/15 p-2.5">
                <span class="num flex h-5 w-5 items-center justify-center rounded bg-white/[0.05] text-[9px] text-fog">{i + 1}</span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-[11px] font-medium text-white">{leg.selection}</div>
                  <div class="truncate text-[9px] text-fog-dim">{leg.fixture}</div>
                </div>
                <span class="num text-[11px] font-semibold text-lime">{leg.odds.toFixed(2)}</span>
              </div>
            {/each}
          </div>
          <div class="mt-3 flex items-end justify-between border-t border-white/[0.06] pt-3">
            <div><div class="stat-label">Combined odds</div><div class="num text-[20px] font-bold text-white">{data.acca.odds.toFixed(2)}</div></div>
            <div class="text-right"><div class="stat-label">Model probability</div><div class="num text-[16px] font-bold text-mint">{(data.acca.probability * 100).toFixed(1)}%</div></div>
          </div>
          <p class="mt-2 text-[9.5px] leading-relaxed text-fog-dim">Independent legs only. Correlated selections are excluded. Combine only if the product of probabilities still beats the combined price.</p>
        </div>

        <div class="panel p-4">
          <div class="flex items-center gap-2 text-[11px] font-semibold text-white"><Info size={13} class="text-sky" /> How the edge is calculated</div>
          <ol class="mt-2 space-y-2 text-[10.5px] leading-relaxed text-fog">
            <li><span class="font-semibold text-white">1.</span> Collect prices from eight bookmakers and remove the overround with proportional de-vigging.</li>
            <li><span class="font-semibold text-white">2.</span> Blend Dixon–Coles, Elo, gradient boosting and the market prior into one probability; publish that card at kickoff and never move it.</li>
            <li><span class="font-semibold text-white">3.</span> Edge = model probability × best available decimal odds − 1.</li>
            <li><span class="font-semibold text-white">4.</span> Stake only when edge ≥ 0.5%; size with quarter-Kelly and a 5% cap.</li>
          </ol>
        </div>

        {#if isAll}
        <div class="panel p-4">
          <div class="flex items-center gap-2 text-[11px] font-semibold text-white"><ShieldCheck size={13} class="text-mint" /> Every fixture is projected</div>
          <p class="mt-2 text-[10.5px] leading-relaxed text-fog">No league or tournament is sampled down. Each fixture gets its own frozen headline at kickoff, and the full schedule stays paginated rather than truncated. Value tags show where the price is also worth a stake.</p>
        </div>
        {:else}
        <div class="panel p-4">
          <div class="flex items-center gap-2 text-[11px] font-semibold text-white"><ShieldCheck size={13} class="text-mint" /> Passing is a position</div>
          <div class="mt-2 space-y-1.5">
            {#each data.noValue as f}
              <a href={`/fixtures/${f.fixtureId}`} class="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[10px] transition hover:bg-white/[0.03]">
                <CircleSlash size={10} class="shrink-0 text-fog-dim" />
                <SportGlyph sport={f.sport} size="xs" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-white/75">{f.home} vs {f.away}</div>
                  <div class="text-[9px] text-fog-dim">{f.league} · conf. {f.confidence}%</div>
                </div>
                <span class="num shrink-0 text-fog-dim">{f.pick.odds.toFixed(2)}</span>
              </a>
            {/each}
          </div>
          <p class="mt-2 text-[9.5px] text-fog-dim">These fixtures have no edge at current prices. The model recommends no bet.</p>
        </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
