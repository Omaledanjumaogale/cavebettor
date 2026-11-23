<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Search, CornerDownLeft, LoaderCircle } from '@lucide/svelte';

  let { open = $bindable(false) }: { open: boolean } = $props();
  let query = $state('');
  let results = $state<{ type: string; id: string; title: string; subtitle: string; href: string }[]>([]);
  let loading = $state(false);
  let active = $state(0);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inputEl = $state<HTMLInputElement | null>(null);

  const quick = [
    { type: 'Page', id: 'q1', title: 'Today’s overview', subtitle: 'Command centre', href: '/' },
    { type: 'Page', id: 'q2', title: 'Fixtures & predictions', subtitle: 'All sports', href: '/fixtures' },
    { type: 'Page', id: 'q3', title: 'Value board', subtitle: 'Every positive-EV pick', href: '/predictions' },
    { type: 'Page', id: 'q4', title: 'Model laboratory', subtitle: 'Training, calibration, drift', href: '/models' },
    { type: 'Page', id: 'q5', title: 'Data pipeline', subtitle: 'Scrapers and API sources', href: '/scrapers' }
  ];

  $effect(() => {
    if (open) setTimeout(() => inputEl?.focus(), 50);
    else {
      query = '';
      results = [];
      active = 0;
    }
  });

  function search(q: string) {
    if (timer) clearTimeout(timer);
    if (!q.trim()) {
      results = [];
      return;
    }
    loading = true;
    timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        results = await res.json();
        active = 0;
      } catch {
        results = [];
      } finally {
        loading = false;
      }
    }, 160);
  }

  function onInput(e: Event) {
    query = (e.target as HTMLInputElement).value;
    search(query);
  }

  function go(href: string) {
    open = false;
    goto(href);
  }

  function onKey(e: KeyboardEvent) {
    const list = query.trim() ? results : quick;
    if (e.key === 'Escape') open = false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(list.length - 1, active + 1);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(0, active - 1);
    }
    if (e.key === 'Enter' && list[active]) go(list[active].href);
  }

  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open = !open;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const list = $derived(query.trim() ? results : quick);
</script>

{#if open}
  <div class="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search CaveBettor">
    <button class="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close search" onclick={() => (open = false)}></button>
    <div class="animate-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/12 bg-pitch-950/95 shadow-2xl backdrop-blur-xl">
      <div class="flex items-center gap-3 border-b border-white/10 px-4">
        <Search size={16} class="shrink-0 text-fog-dim" />
        <input
          bind:this={inputEl}
          value={query}
          oninput={onInput}
          onkeydown={onKey}
          class="w-full bg-transparent py-4 text-[14px] text-white placeholder:text-fog-dim focus:outline-none"
          placeholder="Search fixtures, teams, leagues, models, sources…"
          autocomplete="off"
          spellcheck="false"
        />
        {#if loading}<LoaderCircle size={15} class="animate-spin text-lime" />{/if}
        <kbd class="hidden rounded border border-white/12 px-1.5 py-0.5 text-[9px] text-fog-dim sm:block">ESC</kbd>
      </div>
      <div class="max-h-[56vh] overflow-y-auto p-2">
        {#if !query.trim()}
          <div class="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-fog-dim">Quick navigation</div>
        {/if}
        {#each list as item, i}
          <button
            onclick={() => go(item.href)}
            onmouseenter={() => (active = i)}
            class={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active === i ? 'bg-lime/10 ring-1 ring-lime/25' : 'hover:bg-white/[0.04]'}`}
          >
            <span class={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[9px] font-bold uppercase ${active === i ? 'border-lime/35 bg-lime/10 text-lime' : 'border-white/10 bg-white/[0.03] text-fog'}`}>
              {item.type.slice(0, 2)}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[12.5px] font-medium text-white">{item.title}</span>
              <span class="block truncate text-[10.5px] text-fog-dim">{item.subtitle}</span>
            </span>
            {#if active === i}<CornerDownLeft size={13} class="text-lime" />{/if}
          </button>
        {:else}
          <div class="px-3 py-8 text-center text-[12px] text-fog-dim">No matches for “{query}”. Try a team, league or model name.</div>
        {/each}
      </div>
      <div class="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[9.5px] text-fog-dim">
        <span>↑ ↓ to navigate · ↵ to open</span>
        <span>{list.length} results</span>
      </div>
    </div>
  </div>
{/if}
