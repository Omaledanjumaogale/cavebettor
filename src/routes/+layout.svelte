<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { pwa } from '#lib/pwa.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    pwa.init();

    // A new worker taking over mid-session would otherwise leave the page on
    // the previous build's client bundle.
    navigator.serviceWorker?.addEventListener?.('controllerchange', () => {
      if (!sessionStorage.getItem('cb_sw_reloaded')) {
        sessionStorage.setItem('cb_sw_reloaded', '1');
        location.reload();
      }
    });

    // Offline-safe navigation. SvelteKit routes on the client, so a tap on a
    // link while the radio is off would otherwise end on its error page
    // instead of the offline notice.
    const onClick = (event: MouseEvent) => {
      if (navigator.onLine || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === '/offline') return;
      event.preventDefault();
      goto('/offline');
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  });
</script>

<!--
  Root layout is intentionally minimal: it must not read cookies, call Convex or
  touch platform.env, so that every route group below it can be prerendered as a
  static HTML shell and served straight from Cloudflare without invoking a Worker.
  The PWA registration above is client-only and adds no server work.
-->
{@render children()}
