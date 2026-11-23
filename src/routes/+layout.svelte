<script lang="ts">
  import '../app.css';
  import AppShell from '#lib/components/AppShell.svelte';
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  let { children, data }: { children: Snippet; data: any } = $props();
  const bare = $derived(page.url.pathname.startsWith('/auth'));
</script>

{#if bare}
  {@render children()}
{:else}
  <AppShell liveCount={data.counts.live} valueCount={data.counts.value} fixturesCount={data.counts.fixtures} user={data.user}>
    {@render children()}
  </AppShell>
{/if}
