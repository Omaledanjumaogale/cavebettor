<script lang="ts">
  let {
    data,
    height = 180,
    horizontal = false,
    format = (v: number) => String(Math.round(v)),
    colour = '#c9ff4d',
    showValues = true,
    max: forcedMax
  }: {
    data: { label: string; value: number; colour?: string; sub?: string }[];
    height?: number;
    horizontal?: boolean;
    format?: (v: number) => string;
    colour?: string;
    showValues?: boolean;
    max?: number;
  } = $props();
  const max = $derived(forcedMax ?? Math.max(...data.map((d) => Math.abs(d.value)), 0.0001));
</script>

{#if horizontal}
  <div class="flex flex-col gap-2.5">
    {#each data as d}
      <div class="group">
        <div class="mb-1 flex items-baseline justify-between gap-3">
          <span class="truncate text-[12px] text-white/80">{d.label}</span>
          <span class="num text-[11.5px] font-semibold" style={`color:${d.colour ?? colour}`}>{format(d.value)}</span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-white/[0.055]">
          <div
            class="h-full rounded-full transition-all duration-500"
            style={`width:${Math.max(2, (Math.abs(d.value) / max) * 100)}%;background:${d.colour ?? colour};opacity:${d.sub ? 0.9 : 1}`}
          ></div>
        </div>
        {#if d.sub}<div class="mt-1 text-[10.5px] text-fog-dim">{d.sub}</div>{/if}
      </div>
    {/each}
  </div>
{:else}
  <div class="relative w-full" style={`height:${height}px`}>
    <div class="flex h-full items-end gap-1.5">
      {#each data as d}
        <div class="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          {#if showValues}
            <span class="num text-[10px] font-semibold text-white/70 opacity-0 transition group-hover:opacity-100">{format(d.value)}</span>
          {/if}
          <div
            class="w-full rounded-t-md transition-all duration-500 group-hover:brightness-125"
            style={`height:${Math.max(2, (Math.abs(d.value) / max) * 100)}%;background:${d.colour ?? `linear-gradient(180deg, ${colour}, ${colour}55)`}; min-width:4px`}
            title={`${d.label}: ${format(d.value)}`}
          ></div>
          <span class="w-full truncate text-center text-[9.5px] text-fog-dim">{d.label}</span>
        </div>
      {/each}
    </div>
  </div>
{/if}
