<script lang="ts">
  import { Moon, Sun } from '@lucide/svelte';
  import { onMount } from 'svelte';

  let { compact = false }: { compact?: boolean } = $props();
  let theme = $state<'dark' | 'light'>('dark');

  function apply(next: 'dark' | 'light') {
    theme = next;
    const root = document.documentElement;
    root.dataset.theme = next;
    root.classList.toggle('dark', next === 'dark');
    root.classList.toggle('light', next === 'light');
    root.style.colorScheme = next;
    try {
      localStorage.setItem('cb_theme', next);
    } catch {
      /* storage can be blocked; the attribute still applies for this session */
    }
  }

  onMount(() => {
    const saved = document.documentElement.dataset.theme;
    theme = saved === 'light' ? 'light' : 'dark';
  });
</script>

<button
  type="button"
  onclick={() => apply(theme === 'dark' ? 'light' : 'dark')}
  class={`btn-icon shrink-0 ${compact ? '!h-9 !w-9' : ''}`}
  aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
  title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
  aria-pressed={theme === 'light'}
>
  {#if theme === 'dark'}<Sun size={15} />{:else}<Moon size={15} />{/if}
</button>
