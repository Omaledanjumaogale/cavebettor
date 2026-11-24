<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import {
    LayoutDashboard, CalendarDays, Radio, Sparkles, Coins, BrainCircuit, Database,
    ChartNoAxesCombined, WalletCards, NotebookPen, Settings, CreditCard, ShieldCheck,
    Search, Bell, Menu, X, ChevronDown, ArrowUpRight, CircleHelp, LogOut, Plus, Command,
    Activity, Volleyball, Snowflake, CircleDot, Ticket
  } from '@lucide/svelte';
  import BrandMark from './BrandMark.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import { DEMO_USER, SUBSCRIPTION_PLANS } from '#lib/data/catalog';

  let {
    children,
    liveCount = 0,
    valueCount = 0,
    fixturesCount = 0,
    user = null
  }: { children: Snippet; liveCount?: number; valueCount?: number; fixturesCount?: number; user?: typeof DEMO_USER | null } = $props();

  let searchOpen = $state(false);
  let drawer = $state(false);
  let userMenu = $state(false);

  const nav = $derived([
    {
      label: 'Intelligence',
      items: [
        { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, badge: '' },
        { href: '/fixtures', label: 'Fixtures', icon: CalendarDays, badge: String(fixturesCount) },
        { href: '/live', label: 'Live now', icon: Radio, badge: liveCount ? String(liveCount) : '', live: true },
        { href: '/predictions', label: 'Value board', icon: Sparkles, badge: valueCount ? String(valueCount) : '' },
        { href: '/odds', label: 'Odds & markets', icon: Coins, badge: '' }
      ]
    },
    {
      label: 'Sport desks',
      items: [
        { href: '/sports', label: 'All desks', icon: LayoutDashboard, badge: '' },
        { href: '/sports/football', label: 'Football desk', icon: Activity, badge: '' },
        { href: '/sports/basketball', label: 'Basketball desk', icon: Volleyball, badge: '' },
        { href: '/sports/nba', label: 'NBA desk', icon: Volleyball, badge: '' },
        { href: '/sports/icehockey', label: 'Ice hockey desk', icon: Snowflake, badge: '' },
        { href: '/sports/baseball', label: 'Baseball desk', icon: CircleDot, badge: '' }
      ]
    },
    {
      label: 'Models & data',
      items: [
        { href: '/models', label: 'Model lab', icon: BrainCircuit, badge: '' },
        { href: '/scrapers', label: 'Data pipeline', icon: Database, badge: '' }
      ]
    },
    {
      label: 'Workspace',
      items: [
        { href: '/paper', label: 'Paper desk', icon: WalletCards, badge: '' },
        { href: '/betslip', label: 'Betslip builder', icon: Ticket, badge: '' },
        { href: '/analytics', label: 'Performance', icon: ChartNoAxesCombined, badge: '' },
        { href: '/workspace', label: 'Research notes', icon: NotebookPen, badge: '' }
      ]
    },
    {
      label: 'Account',
      items: [
        { href: '/settings', label: 'Settings', icon: Settings, badge: '' },
        { href: '/pricing', label: 'Subscription', icon: CreditCard, badge: '' },
        { href: '/admin', label: 'Admin', icon: ShieldCheck, badge: '' }
      ]
    }
  ]);

  const active = (href: string) => {
    const path = page.url.pathname;
    if (href === '/dashboard') return path === '/dashboard';
    // "/sports" is a hub page — only highlight it on the hub itself.
    if (href === '/sports') return path === '/sports';
    return path.startsWith(href);
  };
  const currentLabel = $derived(
    nav.flatMap((g) => g.items).find((i) => active(i.href))?.label ?? 'Overview'
  );
  const viewer = $derived(user ?? DEMO_USER);
  const plan = $derived(viewer.plan);

  const mobileItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/fixtures', label: 'Fixtures', icon: CalendarDays },
    { href: '/live', label: 'Live', icon: Radio },
    { href: '/predictions', label: 'Value', icon: Sparkles },
    { href: '/analytics', label: 'Stats', icon: ChartNoAxesCombined }
  ];
</script>

<div class="min-h-screen">
  <!-- Desktop sidebar -->
  <aside class="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/[0.07] bg-pitch-950/80 backdrop-blur-xl lg:flex">
    <div class="flex h-16 shrink-0 items-center px-5">
      <a href="/dashboard" aria-label="CaveBettor command centre"><BrandMark size={34} withWordmark /></a>
    </div>

    <div class="mx-3 mb-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5">
      <button class="flex w-full items-center justify-between gap-2 text-left" onclick={() => (userMenu = !userMenu)}>
        <div class="min-w-0">
          <div class="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-fog-dim">Workspace</div>
          <div class="mt-0.5 truncate text-[12px] font-semibold text-white">{viewer.workspace}</div>
        </div>
        <ChevronDown size={14} class="shrink-0 text-fog-dim" />
      </button>
      {#if userMenu}
        <div class="mt-2 space-y-1 border-t border-white/10 pt-2">
          <div class="rounded-lg px-2 py-1.5 text-[11px] text-fog">Lagos Value Desk <span class="chip chip-lime ml-1 !px-1.5 !py-0">active</span></div>
          <button class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-fog hover:bg-white/5"><Plus size={12} /> Create workspace</button>
        </div>
      {/if}
    </div>

    <nav class="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none">
      {#each nav as group}
        <div class="mb-4">
          <div class="mb-1.5 px-2 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-fog-dim/80">{group.label}</div>
          {#each group.items as item}
            <a
              href={item.href}
              class={`group mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition ${active(item.href) ? 'bg-lime/[0.09] font-semibold text-lime ring-1 ring-inset ring-lime/15' : 'text-white/64 hover:bg-white/[0.04] hover:text-white/90'}`}
            >
              <item.icon size={15} strokeWidth={active(item.href) ? 2.2 : 1.8} class={active(item.href) ? 'text-lime' : 'text-fog-dim group-hover:text-white/80'} />
              <span class="flex-1 truncate">{item.label}</span>
              {#if item.live && liveCount > 0}
                <span class="flex items-center gap-1 rounded-full bg-mint/12 px-1.5 py-0.5 text-[9px] font-bold text-mint">
                  <span class="live-dot h-1 w-1 rounded-full bg-mint"></span>{item.badge}
                </span>
              {:else if item.badge}
                <span class="num rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[9.5px] font-semibold text-fog">{item.badge}</span>
              {/if}
            </a>
          {/each}
        </div>
      {/each}
    </nav>

    <div class="mx-3 mb-3 shrink-0 rounded-xl border border-lime/15 bg-gradient-to-br from-lime/[0.09] to-transparent p-3">
      <div class="flex items-center justify-between">
        <span class="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-lime/80">Current plan</span>
        <span class="chip chip-lime !px-1.5 !py-0 !text-[9px]">Active</span>
      </div>
      <div class="mt-1.5 text-[12.5px] font-semibold text-white">{plan.name}</div>
      <div class="num mt-0.5 text-[11px] text-fog">₦{plan.priceNgn.toLocaleString('en-NG')} / month · renews in 18 days</div>
      <a href="/pricing" class="mt-2.5 flex items-center gap-1 text-[10.5px] font-semibold text-lime hover:underline">Manage plan <ArrowUpRight size={11} /></a>
    </div>

    <div class="flex shrink-0 items-center gap-2.5 border-t border-white/[0.07] px-4 py-3">
      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-mint to-sky text-[11px] font-bold text-pitch-950">{viewer.avatar}</span>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[11.5px] font-semibold text-white">{viewer.name}</div>
        <div class="truncate text-[9.5px] text-fog-dim">{viewer.email}</div>
      </div>
      <a href="/settings" class="btn-icon !h-7 !w-7" aria-label="Account settings"><Settings size={13} /></a>
      <a href="/auth/logout" class="btn-icon !h-7 !w-7" aria-label="Sign out" title="Sign out"><LogOut size={13} /></a>
    </div>
  </aside>

  <!-- Mobile drawer -->
  {#if drawer}
    <div class="fixed inset-0 z-[80] lg:hidden">
      <button class="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Close menu" onclick={() => (drawer = false)}></button>
      <div class="animate-in absolute inset-y-0 left-0 flex w-[286px] flex-col border-r border-white/10 bg-pitch-950">
        <div class="flex h-16 items-center justify-between px-4">
          <BrandMark size={30} withWordmark />
          <button class="btn-icon" onclick={() => (drawer = false)} aria-label="Close menu"><X size={16} /></button>
        </div>
        <nav class="flex-1 overflow-y-auto px-3 pb-6">
          {#each nav as group}
            <div class="mb-4">
              <div class="mb-1 px-2 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-fog-dim">{group.label}</div>
              {#each group.items as item}
                <a href={item.href} onclick={() => (drawer = false)} class={`mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] ${active(item.href) ? 'bg-lime/10 font-semibold text-lime' : 'text-white/70'}`}>
                  <item.icon size={16} class={active(item.href) ? 'text-lime' : 'text-fog-dim'} />
                  {item.label}
                  {#if item.badge}<span class="num ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[9.5px] text-fog">{item.badge}</span>{/if}
                </a>
              {/each}
            </div>
          {/each}
        </nav>
        <div class="border-t border-white/10 p-4 text-[11px] text-fog">
          Signed in as <span class="text-white">{viewer.name}</span>
          <div class="mt-1 text-[10px] text-fog-dim">{plan.name} · ₦{plan.priceNgn.toLocaleString('en-NG')}/mo</div>
          <a href="/auth/logout" class="mt-2 inline-flex items-center gap-1 text-[10.5px] text-rose hover:underline"><LogOut size={11} /> Sign out</a>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main -->
  <div class="lg:pl-[248px]">
    <header class="sticky top-0 z-30 border-b border-white/[0.07] bg-void/75 backdrop-blur-xl">
      <div class="flex h-14 items-center gap-2.5 px-3.5 sm:h-16 sm:gap-3 sm:px-6">
        <button class="btn-icon lg:hidden" onclick={() => (drawer = true)} aria-label="Open menu"><Menu size={16} /></button>
        <div class="hidden min-w-0 items-center gap-2 text-[11px] sm:flex">
          <span class="text-fog-dim">Workspace</span>
          <span class="text-fog-dim">/</span>
          <span class="font-semibold text-white">{currentLabel}</span>
        </div>

        <!-- Compact search trigger on phones, full field from sm upwards. -->
        <button
          onclick={() => (searchOpen = true)}
          class="btn-icon ml-auto shrink-0 sm:hidden"
          aria-label="Search"
        >
          <Search size={15} />
        </button>

        <button
          onclick={() => (searchOpen = true)}
          class="ml-auto hidden h-9 w-full max-w-[300px] items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 text-left text-[11.5px] text-fog-dim transition hover:border-white/20 hover:bg-white/[0.05] sm:flex"
        >
          <Search size={13} />
          <span class="flex-1 truncate">Search teams, fixtures, models…</span>
          <kbd class="hidden items-center gap-0.5 rounded border border-white/10 px-1.5 py-0.5 text-[9px] md:flex"><Command size={8} /> K</kbd>
        </button>

        <a href="/live" class="hidden shrink-0 items-center gap-1.5 rounded-full border border-mint/25 bg-mint/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-mint sm:flex">
          <span class="live-dot h-1.5 w-1.5 rounded-full bg-mint"></span>{liveCount} live
        </a>

        <div class="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-white/70 md:flex">
          <span class="text-lime">₦</span> NGN
        </div>

        <button class="btn-icon relative shrink-0" aria-label="Notifications">
          <Bell size={15} />
          <span class="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-lime"></span>
        </button>
        <div class="hidden items-center gap-2 sm:flex">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-mint to-sky text-[10px] font-bold text-pitch-950">{viewer.avatar}</span>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[1560px] px-3.5 pb-24 pt-4 sm:px-6 sm:pt-5 lg:pb-10">
      {@render children()}
    </main>

    <footer class="mx-auto hidden w-full max-w-[1560px] items-center justify-between gap-4 border-t border-white/[0.05] px-6 py-5 text-[10px] text-fog-dim lg:flex">
      <span>© 2026 CaveBettor. Intelligence, not a sportsbook. 18+ only. Gamble responsibly.</span>
      <div class="flex items-center gap-4">
        <a href="/pricing" class="hover:text-white">₦5,000/month</a>
        <a href="/workspace" class="hover:text-white">Methodology</a>
        <span class="flex items-center gap-1 text-fog"><CircleHelp size={11} /> Support</span>
      </div>
    </footer>
  </div>

  <!-- Mobile bottom nav -->
  <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-pitch-950/95 backdrop-blur-xl lg:hidden">
    <div class="flex items-stretch justify-around px-1 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5">
      {#each mobileItems as item}
        <a href={item.href} class={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 text-[9px] font-medium ${active(item.href) ? 'text-lime' : 'text-fog-dim'}`}>
          <item.icon size={17} strokeWidth={active(item.href) ? 2.3 : 1.8} />
          {item.label}
        </a>
      {/each}
      <button onclick={() => (drawer = true)} class="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 text-[9px] font-medium text-fog-dim">
        <Menu size={17} />
        More
      </button>
    </div>
  </nav>

  <CommandPalette bind:open={searchOpen} />
</div>
