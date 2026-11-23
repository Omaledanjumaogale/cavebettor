<script lang="ts">
  let { form, size = 'sm' }: { form: ('W' | 'D' | 'L')[]; size?: 'xs' | 'sm' } = $props();
  const cls = (r: string) =>
    r === 'W'
      ? 'bg-mint/15 text-mint border-mint/30'
      : r === 'D'
        ? 'bg-white/[0.06] text-white/60 border-white/10'
        : 'bg-rose/10 text-rose border-rose/25';
</script>

<div class="flex items-center gap-1">
  {#each form as r}
    <span
      class={`inline-flex items-center justify-center rounded ${size === 'xs' ? 'h-4 w-4 text-[8px]' : 'h-5 w-5 text-[9px]'} border font-bold ${cls(r)}`}
      title={r === 'W' ? 'Win' : r === 'D' ? 'Draw' : 'Loss'}>{r}</span
    >
  {/each}
</div>
