<script lang="ts">
  import Sparkline from './Sparkline.svelte';
  import type { Snippet } from 'svelte';

  let {
    label,
    value,
    sub = '',
    delta,
    deltaLabel = 'vs last period',
    spark,
    colour = '#c9ff4d',
    icon,
    href = ''
  }: {
    label: string;
    value: string;
    sub?: string;
    delta?: number;
    deltaLabel?: string;
    spark?: number[];
    colour?: string;
    icon?: Snippet;
    href?: string;
  } = $props();
  const positive = $derived((delta ?? 0) >= 0);
</script>

<svelte:element this={href ? 'a' : 'div'} {href} class="panel panel-hover relative block overflow-hidden p-3.5 sm:p-4">
  <div class="absolute right-0 top-0 h-24 w-24 rounded-full opacity-[0.07] blur-2xl" style={`background:${colour}`}></div>
  <div class="relative flex items-start justify-between gap-2">
    <div class="flex min-w-0 items-center gap-2">
      {#if icon}<span class="shrink-0 text-fog" style={`color:${colour}`}>{@render icon()}</span>{/if}
      <span class="stat-label truncate">{label}</span>
    </div>
    {#if spark}
      <span class="hidden shrink-0 sm:block"><Sparkline values={spark} width={72} height={24} {colour} strokeWidth={1.7} /></span>
    {/if}
  </div>
  <div class="relative mt-3 flex items-end justify-between gap-2">
    <div class="min-w-0">
      <div class="display num truncate text-[20px] font-bold leading-none text-white sm:text-[23px]">{value}</div>
      {#if sub}<div class="mt-1.5 truncate text-[10.5px] text-fog sm:text-[11px]">{sub}</div>{/if}
    </div>
    {#if spark}
      <span class="block shrink-0 sm:hidden"><Sparkline values={spark} width={52} height={20} {colour} strokeWidth={1.6} /></span>
    {/if}
  </div>
  {#if delta !== undefined}
    <div class="relative mt-2.5 flex items-center gap-1.5 text-[10.5px]">
      <span class={`num font-semibold ${positive ? 'text-mint' : 'text-rose'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%</span>
      <span class="text-fog-dim">{deltaLabel}</span>
    </div>
  {/if}
</svelte:element>
