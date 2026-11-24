<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<!--
  Root layout is intentionally minimal: it must not read cookies, call Convex or
  touch platform.env, so that every route group below it can be prerendered as a
  static HTML shell and served straight from Cloudflare without invoking a Worker.
-->
{@render children()}
