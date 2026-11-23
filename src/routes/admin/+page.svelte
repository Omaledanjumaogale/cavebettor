<script lang="ts">
  import { ShieldCheck, Users, CreditCard, Activity, Database, Settings2, ArrowUpRight, Check, AlertTriangle, Search, ToggleLeft, ToggleRight, ScrollText, Cpu } from '@lucide/svelte';
  import LineChart from '#lib/components/LineChart.svelte';
  import BarChart from '#lib/components/BarChart.svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import { fmtNgn } from '#lib/engine/core';
  import { relativeTime, formatDate } from '#lib/format';
  import type { ActionData } from './$types';

  let { data, form }: { data: any; form: ActionData } = $props();
  let tab = $state<'overview' | 'users' | 'audit' | 'flags'>('overview');
  let query = $state('');
  let flags = $state({ liveOdds: true, llmAnalyst: true, scraperLiveMode: false, arbitrageScan: true, newPricing: false, publicApi: true });
  const shownUsers = $derived(data.users.filter((u: any) => `${u.name} ${u.email} ${u.workspace}`.toLowerCase().includes(query.toLowerCase())));
  const mrr = $derived(data.revenue[data.revenue.length - 1].mrr);
  const activeSubs = $derived(data.revenue[data.revenue.length - 1].subscribers);
</script>

<svelte:head><title>Admin console — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-rose"><ShieldCheck size={12} /> Admin console</div>
      <h1 class="display text-[26px] font-bold tracking-tight text-white">Operate the platform.</h1>
      <p class="mt-1 text-[12.5px] text-fog">Subscription revenue, users, model promotions, data health and feature flags. Owner access only.</p>
    </div>
    <div class="flex items-center gap-2">
      <span class={`chip !text-[9px] ${data.live ? 'chip-mint' : 'chip-amber'}`}><Database size={10} /> {data.live ? 'Convex live' : 'Local fallback'}</span>
      <form method="POST" action="?/sync"><button class="btn !py-2 text-[11px]" type="submit"><Cpu size={12} /> Sync live data</button></form>
      <span class="chip chip-rose"><AlertTriangle size={10} /> Restricted area</span>
    </div>
  </div>

  {#if form?.message}
    <div role="status" class={`rounded-xl border p-3 text-[11.5px] ${form.ok ? 'border-mint/30 bg-mint/10 text-mint' : 'border-rose/30 bg-rose/10 text-rose'}`}>{form.message}</div>
  {/if}

  <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
    {#each [
      { label: 'MRR', value: fmtNgn(mrr, { compact: true }), sub: '+9.6% MoM', colour: '#c9ff4d' },
      { label: 'Subscribers', value: String(activeSubs), sub: 'paying seats', colour: '#35e7a1' },
      { label: 'Churn', value: `${data.revenue[data.revenue.length - 1].churn}%`, sub: 'monthly logo churn', colour: '#6fc9ff' },
      { label: 'ARPU', value: fmtNgn(mrr / activeSubs), sub: 'per subscriber', colour: '#f6c453' },
      { label: 'Users', value: String(data.users.length), sub: `${data.users.filter((u: any) => u.status === 'active').length} active`, colour: '#a99bff' },
      { label: 'Model drift', value: String(data.models.filter((m: any) => m.drift > 0.025).length), sub: 'alerts open', colour: '#ff6478' }
    ] as kpi}
      <div class="panel p-3.5">
        <div class="stat-label">{kpi.label}</div>
        <div class="display num mt-1.5 text-[20px] font-bold" style={`color:${kpi.colour}`}>{kpi.value}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">{kpi.sub}</div>
      </div>
    {/each}
  </div>

  <div class="panel p-4">
    <SectionHeader title="Integrations" description="Register these exact callback URLs in each provider console. Secrets stay server-side." eyebrow="Production wiring" />
    <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {#each data.integrations as integration}
        <div class="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-[12px] font-semibold text-white">{integration.label}</div>
              <div class="mt-0.5 text-[10px] text-fog-dim">{integration.detail}</div>
            </div>
            <span class={`chip !text-[9px] ${integration.status === 'Live' || integration.status === 'Configured' ? 'chip-mint' : 'chip-amber'}`}>{integration.status}</span>
          </div>
          {#if integration.callback}
            <code class="mt-2 block overflow-x-auto whitespace-nowrap rounded-lg bg-black/30 px-2 py-1.5 text-[10px] text-lime">{integration.callback}</code>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <div class="scrollbar-none flex gap-1 overflow-x-auto border-b border-white/[0.07] pb-px">
    {#each [{ id: 'overview', label: 'Revenue & health', icon: Activity }, { id: 'users', label: 'Users', icon: Users }, { id: 'audit', label: 'Audit log', icon: ScrollText }, { id: 'flags', label: 'Feature flags', icon: Settings2 }] as t}
      <button onclick={() => (tab = t.id as any)} class={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[11.5px] font-semibold ${tab === t.id ? 'border-lime text-lime' : 'border-transparent text-fog hover:text-white'}`}><t.icon size={13} /> {t.label}</button>
    {/each}
  </div>

  {#if tab === 'overview'}
    <div class="grid gap-4 xl:grid-cols-3">
      <div class="panel p-4 xl:col-span-2">
        <SectionHeader title="Monthly recurring revenue" description="₦5,000 per seat · NGN billing" eyebrow="Revenue" />
        <LineChart series={[{ name: 'MRR (₦)', values: data.revenue.map((r: any) => r.mrr), colour: '#c9ff4d', area: true }]} labels={data.revenue.map((r: any) => r.month)} height={220} yFormat={(v) => fmtNgn(v, { compact: true })} />
      </div>
      <div class="panel p-4">
        <SectionHeader title="Subscriber growth" description="Paying seats by month" eyebrow="Growth" />
        <BarChart data={data.revenue.map((r: any) => ({ label: r.month, value: r.subscribers, colour: '#35e7a1' }))} height={150} format={(v) => String(Math.round(v))} />
        <div class="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[10px]">
          <span class="text-fog">Net adds this month</span>
          <span class="num font-semibold text-mint">+11 seats</span>
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="panel p-4">
        <SectionHeader title="Production models" description="Champions serving live traffic" eyebrow="Intelligence" />
        <div class="space-y-1.5">
          {#each data.models as model}
            <div class="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-2">
              <Cpu size={11} class="shrink-0 text-lime" />
              <div class="min-w-0 flex-1"><div class="truncate text-[10.5px] font-medium text-white">{model.name}</div><div class="text-[9px] text-fog-dim">accuracy {(model.accuracy * 100).toFixed(1)}% · drift {(model.drift * 100).toFixed(1)}%</div></div>
              <span class="num text-[10px] font-semibold text-mint">+{model.roi.toFixed(1)}%</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="panel p-4">
        <SectionHeader title="Pipeline health" description="Collector reliability" eyebrow="Data ops" />
        <div class="space-y-1">
          {#each data.sources.slice(0, 8) as source}
            <div class="flex items-center gap-2 text-[10px]">
              <span class={`h-1.5 w-1.5 rounded-full ${source.status === 'healthy' ? 'bg-mint' : source.status === 'degraded' ? 'bg-amber' : source.status === 'needs-key' ? 'bg-sky' : 'bg-fog-dim'}`}></span>
              <span class="min-w-0 flex-1 truncate text-fog">{source.name}</span>
              <span class="num text-white/70">{source.coverage}%</span>
              <div class="h-1 w-16 overflow-hidden rounded bg-white/[0.06]"><div class="h-full rounded bg-mint/70" style={`width:${source.reliability * 100}%`}></div></div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else if tab === 'users'}
    <div class="panel overflow-hidden">
      <div class="flex flex-wrap items-center gap-2 px-4 pb-2 pt-4">
        <SectionHeader title="Workspace users" description={`${data.users.length} accounts · ${data.users.filter((u: any) => u.status === 'active').length} active`} eyebrow="Accounts" />
        <div class="relative ml-auto">
          <Search size={11} class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fog-dim" />
          <input class="input !w-48 !py-1.5 pl-7 text-[10.5px]" placeholder="Search users…" bind:value={query} />
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>User</th><th>Workspace</th><th>Plan</th><th>Status</th><th class="text-right">API calls</th><th>Joined</th></tr></thead>
          <tbody>
            {#each shownUsers as user}
              <tr>
                <td><div class="text-[10.5px] font-medium text-white">{user.name}</div><div class="text-[9px] text-fog-dim">{user.email}</div></td>
                <td class="text-[10px] text-fog">{user.workspace}</td>
                <td><span class="chip !px-1.5 !py-0 !text-[8px]">{user.plan}</span></td>
                <td><span class={`chip !px-1.5 !py-0 !text-[8px] ${user.status === 'active' ? 'chip-mint' : user.status === 'past_due' ? 'chip-rose' : user.status === 'trialing' ? 'chip-sky' : 'chip-amber'}`}>{user.status}</span></td>
                <td class="num text-right text-[10px] text-fog">{user.apiCalls.toLocaleString()}</td>
                <td class="text-[9.5px] text-fog-dim">{formatDate(user.joined)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else if tab === 'audit'}
    <div class="panel p-4">
      <SectionHeader title="Audit trail" description="Immutable record of consequential actions" eyebrow="Governance" />
      <div class="space-y-2">
        {#each data.audit as entry}
          <div class="flex gap-3 rounded-xl border border-white/[0.05] bg-black/15 p-2.5">
            <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-lime/60"></span>
            <div class="min-w-0 flex-1">
              <div class="text-[10.5px] text-white/85">{entry.action}</div>
              <div class="text-[9px] text-fog-dim">{entry.detail} · <span class="font-mono">{entry.actor}</span></div>
            </div>
            <span class="shrink-0 text-[9px] text-fog-dim">{relativeTime(entry.time)}</span>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="panel p-4">
      <SectionHeader title="Feature flags" description="Changes apply to this demo session" eyebrow="Rollout" />
      <div class="space-y-1.5">
        {#each Object.entries(flags) as [key, value]}
          <div class="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-black/15 px-3 py-2.5">
            <div>
              <div class="text-[11px] font-medium text-white">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</div>
              <div class="text-[9px] text-fog-dim">
                {key === 'liveOdds' ? 'Stream live prices into the live centre' : key === 'llmAnalyst' ? 'Enable grounded LLM match reports' : key === 'scraperLiveMode' ? 'Allow collectors to contact external sites' : key === 'arbitrageScan' ? 'Show the cross-book arbitrage scan' : key === 'newPricing' ? 'Expose the annual pricing option' : 'Enable the public JSON API'}
              </div>
            </div>
            <button onclick={() => (flags[key as keyof typeof flags] = !value)} class={value ? 'text-lime' : 'text-fog-dim'} aria-label={`Toggle ${key}`}>
              {#if value}<ToggleRight size={26} />{:else}<ToggleLeft size={26} />{/if}
            </button>
          </div>
        {/each}
      </div>
      <p class="mt-3 text-[9.5px] text-fog-dim">Live mode is off by default. Enabling it does not bypass provider terms, robots.txt or rate limits.</p>
    </div>
  {/if}
</div>
