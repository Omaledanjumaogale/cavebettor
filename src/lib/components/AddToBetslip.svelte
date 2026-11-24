<script lang="ts">
  import { Check, Plus } from '@lucide/svelte';
  import { betslip, type SlipLeg } from '#lib/betslip.svelte';

  let {
    leg,
    size = 'sm',
    label = false
  }: {
    leg: Omit<SlipLeg, 'id'> & { id?: string };
    size?: 'xs' | 'sm';
    label?: boolean;
  } = $props();

  const id = $derived(leg.id ?? `${leg.fixtureId}:${leg.marketId}:${leg.outcomeId ?? leg.label}`);
  const inSlip = $derived(betslip.legs.some((entry) => entry.id === id));

  function toggle(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    betslip.add({ ...leg, id } as SlipLeg);
  }
</script>

<button
  type="button"
  onclick={toggle}
  class={`inline-flex shrink-0 items-center justify-center gap-1 rounded-md border transition-colors ${
    inSlip
      ? 'border-mint/40 bg-mint/15 text-mint'
      : 'border-white/12 bg-white/[0.04] text-fog hover:border-lime/40 hover:bg-lime/10 hover:text-lime'
  } ${size === 'xs' ? 'h-5 w-5' : 'h-6 w-6'} ${label ? '!w-auto px-2 !text-[10px] font-semibold' : ''}`}
  aria-label={inSlip ? `Remove ${leg.label} from the betslip` : `Add ${leg.label} to the betslip`}
  aria-pressed={inSlip}
  title={inSlip ? 'In the betslip — click to remove' : 'Add to betslip'}
>
  {#if inSlip}<Check size={size === 'xs' ? 11 : 12} />{:else}<Plus size={size === 'xs' ? 11 : 12} />{/if}
  {#if label}{inSlip ? 'Added' : 'Add'}{/if}
</button>
