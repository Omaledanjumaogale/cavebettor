<script lang="ts">
  import AppShell from '#lib/components/AppShell.svelte';
  import type { Snippet } from 'svelte';

  let { children, data }: { children: Snippet; data: any } = $props();
</script>

<!--
  The authenticated workspace shell. The global stylesheet is imported once by
  the root layout so both the static public pages and the workspace share the
  same design system.
-->
<AppShell liveCount={data.counts.live} valueCount={data.counts.value} fixturesCount={data.counts.fixtures} user={data.user}>
  {@render children()}
</AppShell>
