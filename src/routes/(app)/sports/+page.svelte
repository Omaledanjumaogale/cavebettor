<script lang="ts">
  import { ChevronRight, Radio, Timer } from '@lucide/svelte';

  let { data } = $props();
</script>

<svelte:head><title>Sport desks — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div>
    <div class="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog-dim">Coverage</div>
    <h1 class="display text-[22px] font-bold tracking-tight text-white sm:text-[26px]">Every sport gets its own desk.</h1>
    <p class="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-fog">
      Football, basketball, NBA, ice hockey and baseball each run a dedicated engine, settlement rule set and market vocabulary.
      Pick a desk to open its own board.
    </p>
  </div>

  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {#each data.desks as desk}
      <a
        href={`/sports/${desk.id}`}
        class="group panel panel-hover relative block overflow-hidden p-4 transition"
        style={`border-color:${desk.accent}22`}
      >
        <div class="absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-[0.09] blur-3xl" style={`background:${desk.accent}`}></div>
        <div class="relative">
          <div class="flex items-center gap-2.5">
            <span class="text-[22px] leading-none">{desk.icon}</span>
            <span class="display text-[16px] font-semibold text-white">{desk.name}</span>
            <ChevronRight size={15} class="ml-auto text-fog-dim transition group-hover:translate-x-0.5 group-hover:text-white" />
          </div>
          <p class="mt-1.5 text-[11px] leading-relaxed text-fog">{desk.tagline}</p>
          <div class="mt-3 grid grid-cols-3 gap-2">
            <div class="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-center">
              <div class="num text-[13px] font-bold text-white">{desk.fixtures}</div>
              <div class="text-[8.5px] uppercase tracking-[0.12em] text-fog-dim">Games</div>
            </div>
            <div class="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-center">
              <div class="num text-[13px] font-bold text-mint">{desk.live}</div>
              <div class="text-[8.5px] uppercase tracking-[0.12em] text-fog-dim">Live</div>
            </div>
            <div class="rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-center">
              <div class="num text-[13px] font-bold" style={`color:${desk.accent}`}>{desk.leagues.length}</div>
              <div class="text-[8.5px] uppercase tracking-[0.12em] text-fog-dim">Comps</div>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-1.5 border-t border-white/[0.06] pt-2.5 text-[9.5px] text-fog-dim">
            <Timer size={10} />
            <span class="num truncate">{desk.engine.version}</span>
            <span class="truncate">· {desk.providerHost}</span>
            {#if desk.providerBacked}
              <span class="ml-auto flex shrink-0 items-center gap-1 text-mint"><Radio size={9} /> live feed</span>
            {/if}
          </div>
        </div>
      </a>
    {/each}
  </div>
</div>
