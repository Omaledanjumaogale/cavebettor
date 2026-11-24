<script lang="ts">
  import { Check, Copy } from '@lucide/svelte';
  import type { Team } from '#lib/types';

  let {
    team,
    size = 'sm',
    showCopy = true,
    class: extra = ''
  }: { team: Team; size?: 'sm' | 'md' | 'lg'; showCopy?: boolean; class?: string } = $props();

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(team.name);
      copied = true;
      clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 1600);
    } catch {
      copied = false;
    }
  }

  const scale = $derived(size === 'lg' ? 'text-[15px]' : size === 'md' ? 'text-[13px]' : 'text-[12.5px]');
</script>

<span class={`inline-flex min-w-0 max-w-full items-center gap-1 ${extra}`}>
  <a
    href={`/teams/${encodeURIComponent(team.id)}`}
    class={`truncate font-semibold text-white transition hover:text-lime hover:underline ${scale}`}
    title={`Open ${team.name} stats`}
    onclick={(event) => event.stopPropagation()}
  >
    {team.name}
  </a>
  {#if showCopy}
    <button
      type="button"
      class="shrink-0 rounded p-0.5 text-fog-dim transition hover:text-lime"
      aria-label={`Copy ${team.name}`}
      title={copied ? 'Copied' : 'Copy team name'}
      onclick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        copy();
      }}
    >
      {#if copied}<Check size={11} class="text-mint" />{:else}<Copy size={11} />{/if}
    </button>
  {/if}
</span>
