<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { Sparkles, ShieldCheck, Filter, Search, CalendarDays, ChevronRight, Radio, TrendingUp, Info } from '@lucide/svelte';
  import { formatKickoff, formatDate } from '#lib/format';

  let { data } = $props();

  let sport = $state(untrack(() => data.filters.sport));
  let league = $state(untrack(() => data.filters.league));
  let market = $state(untrack(() => data.filters.market));
  let tier = $state(untrack(() => data.filters.tier));
  let min = $state(untrack(() => data.filters.minProbability));
  let q = $state(untrack(() => data.filters.query));
  let date = $state(untrack(() => data.date));

  function apply() {
    const params = new URLSearchParams({
      date,
      sport,
      league,
      market,
      tier,
      min: String(min),
      q
    });
    goto(`?${params.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
  }

  const tierChip = (value: string) =>
    value === 'banker' ? 'chip chip-lime' : value === 'strong' ? 'chip chip-mint' : 'chip chip-sky';
</script>

<svelte:head><title>Shortlist board — CaveBettor owner console</title></svelte:head>

<div class="space-y-5">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="flex items-center gap-2">
        <span class="chip chip-lime"><Sparkles size={10} /> Owner console</span>
        <span class="text-[10px] text-fog-dim">Auto-generated · owner only</span>
      </div>
      <h1 class="display mt-2 text-[24px] font-bold leading-tight text-white sm:text-[30px]">Shortlist board</h1>
      <p class="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-fog">
        Only the fixtures the model is willing to stand behind, with the single market call that clears every gate.
        Anything uncertain is left off the board entirely.
      </p>
    </div>
    <div class="flex flex-col items-end gap-1 text-[10px] text-fog-dim">
      <span class="inline-flex items-center gap-1"><ShieldCheck size={11} class="text-mint" /> gates: probability · price · family · league accuracy</span>
      {#if data.board.learning}
        <span class="inline-flex items-center gap-1">
          <TrendingUp size={11} class="text-lime" />
          learning loop: {data.board.learning.settled} settled · {(data.board.learning.accuracy * 100).toFixed(1)}% hit rate
        </span>
      {/if}
    </div>
  </div>

  <div class="panel p-3.5">
    <div class="flex flex-wrap items-center gap-2">
      <span class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-fog-dim">
        <Filter size={11} /> Filters
      </span>
      <select class="input !w-auto !py-1.5 text-[11px]" bind:value={sport} onchange={apply}>
        <option value="all">All sports</option>
        {#each data.sports as s}<option value={s.id}>{s.name}</option>{/each}
      </select>
      <select class="input !w-auto !py-1.5 text-[11px]" bind:value={league} onchange={apply}>
        <option value="all">All competitions</option>
        {#each data.leagues as l}<option value={l.id}>{l.name} · {l.country}</option>{/each}
      </select>
      <select class="input !w-auto !py-1.5 text-[11px]" bind:value={market} onchange={apply}>
        <option value="all">All market families</option>
        <option value="match">Match result</option>
        <option value="dc">Double chance</option>
        <option value="dnb">Draw no bet</option>
        <option value="handicap">Handicap / spread</option>
        <option value="totals">Totals</option>
        <option value="team-total">Team totals</option>
        <option value="btts">Both teams to score</option>
      </select>
      <select class="input !w-auto !py-1.5 text-[11px]" bind:value={tier} onchange={apply}>
        <option value="all">Every tier</option>
        <option value="banker">Banker · 80%+</option>
        <option value="strong">Strong · 72%+</option>
        <option value="steady">Steady · 68%+</option>
      </select>
      <label class="inline-flex items-center gap-1.5 text-[10.5px] text-fog">
        Min
        <input class="input !w-16 !py-1.5 text-[11px]" type="number" min="0" max="95" step="1" bind:value={min} onchange={apply} />
        %
      </label>
      <label class="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
        <Search size={12} class="shrink-0 text-fog-dim" />
        <input
          class="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-fog-dim"
          placeholder="Team, competition or selection"
          bind:value={q}
          oninput={apply}
        />
      </label>
      <select class="input !w-auto !py-1.5 text-[11px]" bind:value={date} onchange={apply}>
        {#each data.archive as day}
          <option value={day}>{day === data.today ? `Today · ${day}` : day}</option>
        {/each}
      </select>
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-fog-dim">
      <span>{data.board.picks.length} of {data.total} published selections</span>
      <span>·</span>
      <span>{data.board.scanned} fixtures scanned</span>
      <span>·</span>
      <span>generated {new Date(data.board.generatedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</span>
      {#each data.board.rejected.slice(0, 4) as reason}
        <span class="chip !py-0.5 !text-[8.5px]">{reason.count} × {reason.reason}</span>
      {/each}
    </div>
  </div>

  {#if !data.board.picks.length}
    <div class="panel p-8 text-center">
      <Info size={18} class="mx-auto text-fog-dim" />
      <p class="mt-2 text-[12px] text-fog">Nothing clears every gate for this date and filter set.</p>
      <p class="mt-1 text-[10.5px] text-fog-dim">The board publishes nothing rather than publish doubt.</p>
    </div>
  {:else}
    <div class="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      {#each data.board.picks as pick (pick.fixtureId)}
        <a href={`/fixtures/${pick.fixtureId}`} class="panel panel-hover block p-3.5">
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-fog">{pick.league}</span>
            <span class={tierChip(pick.tier)}>{(pick.modelProbability * 100).toFixed(1)}%</span>
          </div>
          <div class="mt-0.5 flex items-center gap-1 text-[9.5px] text-fog-dim">
            <span class="truncate">{pick.country}</span>
            <span>·</span>
            <span>{formatDate(pick.kickoff, { weekday: 'short', day: '2-digit', month: 'short' })}</span>
            <span>{formatKickoff(pick.kickoff)}</span>
            {#if pick.status === 'live' || pick.status === 'halftime'}
              <span class="inline-flex items-center gap-0.5 text-mint"><Radio size={9} /> live</span>
            {/if}
          </div>

          <div class="mt-2 text-[12px] font-semibold text-white">
            {pick.home} <span class="text-fog-dim">vs</span> {pick.away}
          </div>
          {#if pick.score}
            <div class="num mt-0.5 text-[11px] text-fog">{pick.score.home}–{pick.score.away}</div>
          {/if}
          {#if pick.periods?.length}
            <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-fog-dim">
              {#each pick.periods as period}
                <span class="inline-flex items-center gap-1">
                  <span class="uppercase tracking-[0.05em]">{period.label}</span>
                  <span class="num font-semibold text-fog">{period.home}–{period.away}</span>
                </span>
              {/each}
            </div>
          {/if}

          <div class="mt-2.5 rounded-lg border border-lime/20 bg-lime/[0.05] px-2.5 py-2">
            <div class="text-[9px] uppercase tracking-[0.1em] text-fog-dim">{pick.market}</div>
            <div class="text-[12px] font-semibold text-white">{pick.selection}</div>
            <div class="mt-1 flex items-center gap-2 text-[10px]">
              <span class="num font-semibold text-lime">{pick.odds.toFixed(2)}</span>
              <span class="text-fog-dim">·</span>
              <span class="num text-mint">{pick.edge >= 0 ? '+' : ''}{(pick.edge * 100).toFixed(1)}% edge</span>
              <span class="ml-auto text-fog-dim">₦{pick.stakeNgn.toLocaleString()}</span>
            </div>
          </div>
          <div class="mt-2 flex items-center justify-between gap-2 text-[9.5px] text-fog-dim">
            <span class="inline-flex items-center gap-1"><CalendarDays size={9} /> {pick.reason}</span>
            <ChevronRight size={12} class="shrink-0" />
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
