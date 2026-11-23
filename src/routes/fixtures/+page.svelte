<script lang="ts">
  import { goto } from '$app/navigation';
  import { CalendarDays, Search, LayoutGrid, List, SlidersHorizontal, ChevronRight, Radio, Sparkles, CircleX } from '@lucide/svelte';
  import FixtureCard from '#lib/components/FixtureCard.svelte';
  import MatchRow from '#lib/components/MatchRow.svelte';
  import { LEAGUE_MAP } from '#lib/data/catalog';
  import { formatDate } from '#lib/format';

  let { data } = $props();
  let search = $state(data.filters.q);

  const statuses = [
    { id: 'all', label: 'All fixtures' },
    { id: 'live', label: 'Live' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'value', label: 'With value' },
    { id: 'finished', label: 'Finished' }
  ];

  function update(patch: Record<string, string>) {
    const params = new URLSearchParams({
      sport: data.filters.sport,
      league: data.filters.league,
      status: data.filters.status,
      q: data.filters.q,
      view: data.filters.view,
      ...patch
    });
    for (const [k, v] of [...params.entries()]) {
      if (!v || v === 'all') params.delete(k);
    }
    goto(`/fixtures${params.size ? `?${params}` : ''}`, { keepFocus: true, noScroll: true });
  }

  function onSearch(e: Event) {
    update({ q: (e.target as HTMLInputElement).value });
  }

  const groups = $derived.by(() => {
    const map = new Map<string, typeof data.fixtures>();
    for (const item of data.fixtures) {
      const date = item.fixture.status === 'finished' ? 'Full time' : formatDate(item.fixture.kickoff, { weekday: 'long', day: 'numeric', month: 'long', year: undefined });
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(item);
    }
    return [...map.entries()];
  });

  const sportLeagues = $derived(data.leagues.filter((l: any) => data.filters.sport === 'all' || l.sport === data.filters.sport));
</script>

<svelte:head><title>Fixtures & predictions — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog-dim">
        <CalendarDays size={12} class="text-lime" /> Fixture universe
      </div>
      <h1 class="display text-[26px] font-bold tracking-tight text-white">Every match. Every market.</h1>
      <p class="mt-1 text-[12.5px] text-fog">
        {data.fixtures.length} fixtures shown of {data.total} across five sports. Probabilities are ensemble estimates — tap a match for the full read.
      </p>
    </div>
    <div class="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.025] p-1">
      <button onclick={() => update({ view: 'grid' })} class={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${data.filters.view === 'grid' ? 'bg-white/10 text-white' : 'text-fog-dim hover:text-white'}`}>
        <LayoutGrid size={13} /> Cards
      </button>
      <button onclick={() => update({ view: 'table' })} class={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${data.filters.view === 'table' ? 'bg-white/10 text-white' : 'text-fog-dim hover:text-white'}`}>
        <List size={13} /> Table
      </button>
    </div>
  </div>

  <!-- Sports -->
  <div class="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
    <button onclick={() => update({ sport: 'all', league: 'all' })} class={`chip shrink-0 ${data.filters.sport === 'all' ? '!border-lime/35 !bg-lime/10 !text-lime' : 'hover:!bg-white/[0.07]'}`}>All sports</button>
    {#each data.sports as sport}
      <button onclick={() => update({ sport: sport.id, league: 'all' })} class={`chip shrink-0 ${data.filters.sport === sport.id ? '!border-lime/35 !bg-lime/10 !text-lime' : 'hover:!bg-white/[0.07]'}`}>
        <span>{sport.icon}</span>{sport.name}
      </button>
    {/each}
  </div>

  <!-- Filter bar -->
  <div class="panel flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
    <div class="flex items-center gap-1 overflow-x-auto scrollbar-none">
      {#each statuses as s}
        <button
          onclick={() => update({ status: s.id })}
          class={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${data.filters.status === s.id ? 'bg-lime text-pitch-950' : 'text-fog hover:bg-white/[0.05] hover:text-white'}`}
        >
          {s.label}
        </button>
      {/each}
    </div>
    <div class="hidden h-5 w-px bg-white/10 lg:block"></div>
    <select
      value={data.filters.league}
      onchange={(e) => update({ league: (e.target as HTMLSelectElement).value })}
      class="input !w-auto min-w-[170px] !py-2 text-[11.5px]"
      aria-label="Filter by league"
    >
      <option value="all">All competitions</option>
      {#each sportLeagues as league}
        <option value={league.id}>{league.shortName} — {league.country}</option>
      {/each}
    </select>
    <form class="relative ml-auto w-full lg:w-64" onsubmit={(e) => { e.preventDefault(); update({ q: search }); }}>
      <Search size={13} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" />
      <input class="input !py-2 pl-9 text-[11.5px]" placeholder="Team or club…" bind:value={search} />
    </form>
    {#if data.filters.q || data.filters.league !== 'all' || data.filters.status !== 'all' || data.filters.sport !== 'all'}
      <button onclick={() => goto('/fixtures', { noScroll: true })} class="btn btn-ghost !px-2.5 !py-1.5 text-[10.5px]"><CircleX size={12} /> Clear</button>
    {/if}
  </div>

  {#if data.fixtures.length === 0}
    <div class="panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <SlidersHorizontal size={28} class="text-fog-dim" />
      <h3 class="mt-3 text-[15px] font-semibold text-white">No fixtures match those filters</h3>
      <p class="mt-1 max-w-sm text-[12px] text-fog">Try a different sport or competition. The engine covers football, basketball, tennis, ice hockey and baseball.</p>
      <button onclick={() => goto('/fixtures', { noScroll: true })} class="btn btn-primary mt-4 !py-2 text-[11.5px]">Reset filters</button>
    </div>
  {:else if data.filters.view === 'grid'}
    <div class="space-y-5">
      {#each groups as [date, items]}
        <div>
          <div class="mb-2 flex items-center gap-2">
            <h3 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">{date}</h3>
            <span class="h-px flex-1 bg-white/[0.06]"></span>
            <span class="num text-[10px] text-fog-dim">{items.length} fixtures</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {#each items as item}
              <FixtureCard fixture={item.fixture} prediction={item.prediction} />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="panel overflow-hidden">
      <div class="hidden gap-3 border-b border-white/[0.06] px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim sm:grid sm:grid-cols-[84px_1fr_190px_auto]">
        <span>Time</span><span>Match</span><span>Model split</span><span class="text-right">Best price</span>
      </div>
      {#each groups as [date, items]}
        <div class="border-b border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim">{date}</div>
        {#each items as item}
          <MatchRow fixture={item.fixture} prediction={item.prediction} />
        {/each}
      {/each}
    </div>
  {/if}
</div>
