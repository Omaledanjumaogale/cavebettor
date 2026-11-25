<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { CalendarDays, Search, LayoutGrid, List, SlidersHorizontal, ChevronRight, Radio, Sparkles, CircleX } from '@lucide/svelte';
  import FixtureCard from '#lib/components/FixtureCard.svelte';
  import MatchRow from '#lib/components/MatchRow.svelte';
  import { formatDate } from '#lib/format';

  let { data } = $props();
  let search = $state(untrack(() => data.filters.q));

  const statuses = [
    { id: 'all', label: 'Upcoming & live' },
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
      day: data.filters.day,
      within: data.filters.within,
      ...patch
    });
    for (const [k, v] of [...params.entries()]) {
      if (!v || v === 'all') params.delete(k);
    }
    goto(`/fixtures${params.size ? `?${params}` : ''}`, { keepFocus: true, noScroll: true });
  }

  const freshness = $derived.by(() => {
    const age = data.feed.ageMs;
    if (age === null) return 'awaiting first collection';
    const mins = Math.round(age / 60_000);
    if (mins < 1) return 'updated just now';
    if (mins < 60) return `updated ${mins}m ago`;
    const hours = Math.round(mins / 60);
    return `updated ${hours}h ago`;
  });

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

  const dayLabel = (iso: string) => {
    if (iso === data.today) return 'Today';
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    if (iso === tomorrow) return 'Tomorrow';
    return formatDate(`${iso}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' });
  };
</script>

<svelte:head><title>Fixtures & predictions — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog-dim">
        <CalendarDays size={12} class="text-lime" /> Fixture universe
      </div>
      <h1 class="display text-[22px] font-bold tracking-tight text-white sm:text-[26px]">Every match. Every market.</h1>
      <p class="mt-1 text-[12.5px] text-fog">
        {data.filteredTotal} fixtures match, of {data.total} in the universe · {data.stats.live} live · {data.stats.upcoming} upcoming · {data.stats.finished} finished
      </p>
      {#if data.filters.status === 'finished'}
        <p class="mt-1 text-[10.5px] text-fog-dim">
          Results stay here for {data.finishedWindowHours} hours after full time. After that the match leaves the board —
          its settled markets are archived and keep training the models.
        </p>
      {/if}
      <p class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-fog-dim">
        <span class={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${data.feed.source === 'provider' ? 'border-mint/30 bg-mint/10 text-mint' : 'border-amber/30 bg-amber/10 text-amber'}`}>
          <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
          {data.feed.source === 'provider' ? 'Live provider feed' : 'Engine fallback'}
        </span>
        <span>{data.stats.leagues} competitions</span>
        <span class="h-1 w-1 rounded-full bg-fog-dim"></span>
        <span>{freshness}</span>
      </p>
    </div>
    <div class="flex w-full items-center gap-1 rounded-xl border border-white/10 bg-white/[0.025] p-1 sm:w-auto">
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
    <!-- Status: wraps instead of scrolling, so "Finished" is never hidden -->
    <div class="flex min-w-0 flex-wrap items-center gap-1 lg:shrink-0 lg:flex-nowrap">
      {#each statuses as s}
        <button
          onclick={() => update({ status: s.id })}
          class={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
            data.filters.status === s.id ? 'bg-lime text-pitch-950' : 'text-fog hover:bg-white/[0.05] hover:text-white'
          }`}
        >
          {s.label}
        </button>
      {/each}
    </div>
    <div class="hidden h-5 w-px shrink-0 bg-white/10 lg:block"></div>
    <!-- Kick-off window as a dropdown: it used to sit on top of the status row -->
    <label class="flex shrink-0 items-center gap-1.5 text-[10.5px] text-fog-dim">
      <span>Kick-off</span>
      <select
        value={data.filters.within}
        onchange={(e) => update({ within: (e.target as HTMLSelectElement).value })}
        class="input !w-auto !py-2 text-[11px]"
        aria-label="Filter by kick-off window"
      >
        <option value="all">Anytime</option>
        <option value="1h">Next 1 hour</option>
        <option value="3h">Next 3 hours</option>
        <option value="6h">Next 6 hours</option>
        <option value="12h">Next 12 hours</option>
        <option value="24h">Next 24 hours</option>
      </select>
    </label>
    <select
      value={data.filters.league}
      onchange={(e) => update({ league: (e.target as HTMLSelectElement).value })}
      class="input min-w-0 !py-2 text-[11.5px] lg:!w-auto lg:min-w-[170px]"
      aria-label="Filter by league"
    >
      <option value="all">All competitions ({data.stats.leagues})</option>
      {#each sportLeagues as league}
        <option value={league.id}>{league.name} — {league.country} ({league.count})</option>
      {/each}
    </select>
    <form class="relative w-full min-w-0 lg:ml-auto lg:w-56" onsubmit={(e) => { e.preventDefault(); update({ q: search }); }}>
      <Search size={13} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" />
      <input class="input !py-2 pl-9 text-[11.5px]" placeholder="Team or club…" bind:value={search} />
    </form>
    {#if data.filters.q || data.filters.league !== 'all' || data.filters.status !== 'all' || data.filters.sport !== 'all' || data.filters.within !== 'all'}
      <button onclick={() => goto('/fixtures', { noScroll: true })} class="btn btn-ghost shrink-0 !px-2.5 !py-1.5 text-[10.5px]"><CircleX size={12} /> Clear</button>
    {/if}
  </div>

  <div class="scrollbar-none flex items-center gap-1.5 overflow-x-auto pb-0.5">
    <button onclick={() => update({ day: 'all' })} class={`chip shrink-0 ${data.filters.day === 'all' ? '!border-lime/35 !bg-lime/10 !text-lime' : 'hover:!bg-white/[0.07]'}`}>Every day</button>
    {#each data.days as d}
      <button onclick={() => update({ day: d })} class={`chip shrink-0 ${data.filters.day === d ? '!border-lime/35 !bg-lime/10 !text-lime' : 'hover:!bg-white/[0.07]'}`}>{dayLabel(d)}</button>
    {/each}
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

  {#if data.pageCount > 1}
    <div class="flex items-center justify-center gap-2 pb-4">
      <button
        class="btn btn-ghost !py-1.5 text-[11px]"
        disabled={data.page <= 1}
        onclick={() => update({ page: String(data.page - 1) })}
      >Previous</button>
      <span class="num text-[11px] text-fog">Page {data.page} of {data.pageCount}</span>
      <button
        class="btn btn-ghost !py-1.5 text-[11px]"
        disabled={data.page >= data.pageCount}
        onclick={() => update({ page: String(data.page + 1) })}
      >Next</button>
    </div>
  {/if}
</div>
