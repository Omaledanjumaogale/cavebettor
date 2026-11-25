<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { pwa } from '#lib/pwa.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  // The service worker is registered from the root layout, so every route —
  // prerendered public pages included — is covered by the same offline shell.
  onMount(() => pwa.init());
</script>

<!--
  Root layout is intentionally minimal: it must not read cookies, call Convex or
  touch platform.env, so that every route group below it can be prerendered as a
  static HTML shell and served straight from Cloudflare without invoking a Worker.
  The PWA registration above is client-only and adds no server work.
-->
{@render children()}
