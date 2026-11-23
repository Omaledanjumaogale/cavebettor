<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    title,
    description = '',
    action,
    eyebrow = ''
  }: { title: string; description?: string; action?: Snippet; eyebrow?: string } = $props();
</script>

<div class="mb-3 flex flex-wrap items-end justify-between gap-2">
  <div class="min-w-0">
    {#if eyebrow}<div class="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-lime/75">{eyebrow}</div>{/if}
    <h2 class="display text-[17px] font-semibold tracking-tight text-white">{title}</h2>
    {#if description}<p class="mt-0.5 text-[11.5px] leading-relaxed text-fog">{description}</p>{/if}
  </div>
  {#if action}{@render action()}{/if}
</div>
