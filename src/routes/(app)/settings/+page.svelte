<script lang="ts">
  import { onMount } from 'svelte';
  import { Settings, User, CreditCard, KeyRound, Database, Bell, ShieldCheck, Check, Save, ArrowUpRight, Eye, EyeOff, Sparkles, Lock, AlertTriangle, CircleHelp } from '@lucide/svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import InstallApp from '#lib/components/InstallApp.svelte';
  import { DEMO_USER, SUBSCRIPTION_PLANS, DATA_SOURCES } from '#lib/data/catalog';
  import { fmtNgn } from '#lib/engine/core';
  import { formatDate } from '#lib/format';

  let { data } = $props();
  let tab = $state<'profile' | 'billing' | 'connections' | 'sources' | 'preferences' | 'security'>('profile');
  let saved = $state('');
  let showKeys = $state(false);
  let keys = $state<Record<string, string>>({});
  let profile = $state({ name: DEMO_USER.name, email: DEMO_USER.email, workspace: DEMO_USER.workspace, timezone: DEMO_USER.timezone });
  let prefs = $state({ currency: 'NGN', oddsFormat: 'decimal', staking: 'quarter', minEdge: 2.5, maxStake: 5, notifyValue: true, notifyResults: true, notifyDrift: true, dailyBrief: true });
  let loading = $state(false);
  let billingMessage = $state('');

  const keyRows = $derived([
    { id: 'apiFootball', label: 'API-Football', env: 'API_FOOTBALL_KEY', configured: data.keys.apiFootball, hint: 'Fixtures, lineups, injuries and odds' },
    { id: 'oddsApi', label: 'The Odds API', env: 'THE_ODDS_API_KEY', configured: data.keys.oddsApi, hint: 'Bookmaker prices and movement' },
    { id: 'sportsdb', label: 'TheSportsDB', env: 'SPORTSDB_KEY', configured: data.keys.sportsdb, hint: 'Badges, venues and schedules' },
    { id: 'balldontlie', label: 'BallDontLie', env: 'BALLDONTLIE_KEY', configured: data.keys.balldontlie, hint: 'NBA box scores and availability' },
    { id: 'llm', label: 'LLM analyst', env: 'OPENAI_API_KEY', configured: data.keys.llm, hint: 'Grounded narrative match reports' },
    { id: 'paystack', label: 'Paystack', env: 'PAYSTACK_SECRET_KEY', configured: data.keys.paystack, hint: 'NGN subscription checkout' }
  ]);

  onMount(() => {
    try {
      const raw = localStorage.getItem('cavebettor.prefs');
      if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
      const p = localStorage.getItem('cavebettor.profile');
      if (p) profile = { ...profile, ...JSON.parse(p) };
      const k = localStorage.getItem('cavebettor.demoKeys');
      if (k) keys = JSON.parse(k);
    } catch {
      /* ignore */
    }
  });

  function flash(label: string) {
    saved = label;
    setTimeout(() => (saved = ''), 2200);
  }

  function savePrefs() {
    try {
      localStorage.setItem('cavebettor.prefs', JSON.stringify(prefs));
      localStorage.setItem('cavebettor.profile', JSON.stringify(profile));
      flash('Preferences saved in this browser');
    } catch {
      flash('Could not access local storage');
    }
  }

  function saveKeys() {
    try {
      localStorage.setItem('cavebettor.demoKeys', JSON.stringify(keys));
      flash('Demo vault saved locally — live calls use server environment variables');
    } catch {
      flash('Could not access local storage');
    }
  }

  async function checkout() {
    loading = true;
    billingMessage = '';
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: profile.email, plan: 'pro' })
      });
      const body = await res.json();
      billingMessage = body.message ?? (res.ok ? 'Checkout ready.' : 'Checkout unavailable.');
      if (body.authorizationUrl) window.location.href = body.authorizationUrl;
    } catch {
      billingMessage = 'Could not reach the billing endpoint.';
    } finally {
      loading = false;
    }
  }

  const plan = $derived(SUBSCRIPTION_PLANS[1]);
</script>

<svelte:head><title>Settings — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog-dim"><Settings size={12} class="text-lime" /> Settings</div>
      <h1 class="display text-[26px] font-bold tracking-tight text-white">Workspace controls.</h1>
      <p class="mt-1 text-[12.5px] text-fog">Profile, billing, connections, data sources, preferences and security.</p>
    </div>
    {#if saved}<span class="chip chip-mint"><Check size={10} /> {saved}</span>{/if}
  </div>

  <div class="grid gap-4 lg:grid-cols-[220px_1fr]">
    <nav class="panel h-fit p-2">
      {#each [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'billing', label: 'Subscription', icon: CreditCard },
        { id: 'connections', label: 'Connections & keys', icon: KeyRound },
        { id: 'sources', label: 'Data sources', icon: Database },
        { id: 'preferences', label: 'Preferences', icon: Bell },
        { id: 'security', label: 'Security', icon: ShieldCheck }
      ] as item}
        <button onclick={() => (tab = item.id as any)} class={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11.5px] transition ${tab === item.id ? 'bg-lime/[0.09] font-semibold text-lime' : 'text-white/65 hover:bg-white/[0.04] hover:text-white'}`}>
          <item.icon size={13} class={tab === item.id ? 'text-lime' : 'text-fog-dim'} /> {item.label}
        </button>
      {/each}
    </nav>

    <div class="min-w-0 space-y-4">
      {#if tab === 'profile'}
        <div class="panel p-4">
          <SectionHeader title="Your profile" description="Visible to members of this workspace" eyebrow="Account" />
          <div class="flex items-center gap-4">
            <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-mint to-sky text-[18px] font-bold text-pitch-950">OD</span>
            <div>
              <div class="text-[14px] font-semibold text-white">{profile.name}</div>
              <div class="text-[11px] text-fog">{profile.email}</div>
              <div class="mt-1 flex gap-1.5"><span class="chip chip-lime !text-[8.5px]">Owner</span><span class="chip chip-mint !text-[8.5px]">Pro</span></div>
            </div>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label class="label" for="name">Full name</label><input id="name" class="input" bind:value={profile.name} /></div>
            <div><label class="label" for="email">Email</label><input id="email" class="input" type="email" bind:value={profile.email} /></div>
            <div><label class="label" for="workspace">Workspace</label><input id="workspace" class="input" bind:value={profile.workspace} /></div>
            <div><label class="label" for="tz">Timezone</label><select id="tz" class="input" bind:value={profile.timezone}><option>Africa/Lagos</option><option>Europe/London</option><option>America/New_York</option><option>Asia/Dubai</option></select></div>
          </div>
          <div class="mt-3 flex justify-end"><button onclick={savePrefs} class="btn btn-primary !py-2 text-[11px]"><Save size={12} /> Save profile</button></div>
        </div>

        <div class="panel p-4">
          <SectionHeader title="Workspace members" description="Role-based access for your desk" eyebrow="Team" />
          <div class="space-y-1.5">
            {#each [
              { name: 'Omale Danjuma', role: 'Owner', email: 'omale@cavebettor.ng', initials: 'OD' },
              { name: 'Amara Eze', role: 'Analyst', email: 'amara@cavebettor.ng', initials: 'AE' },
              { name: 'Tunde Balogun', role: 'Viewer', email: 'tunde@cavebettor.ng', initials: 'TB' }
            ] as member}
              <div class="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-2">
                <span class="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[9px] font-semibold text-white">{member.initials}</span>
                <div class="min-w-0 flex-1"><div class="text-[11px] font-medium text-white">{member.name}</div><div class="text-[9px] text-fog-dim">{member.email}</div></div>
                <span class="chip !px-1.5 !py-0 !text-[8px]">{member.role}</span>
              </div>
            {/each}
          </div>
          <p class="mt-2 text-[9.5px] text-fog-dim">The Pro plan includes up to 5 seats at ₦5,000 per seat per month.</p>
        </div>
      {:else if tab === 'billing'}
        <div class="panel relative overflow-hidden p-4">
          <div class="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime/10 blur-2xl"></div>
          <div class="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-lime">Current plan</div>
              <h2 class="display mt-1 text-[22px] font-bold text-white">{plan.name}</h2>
              <p class="text-[11.5px] text-fog">{plan.tagline}</p>
              <div class="mt-2 flex items-baseline gap-1.5"><span class="display num text-[28px] font-bold text-white">₦5,000</span><span class="text-[11px] text-fog">/ month</span></div>
              <div class="mt-1 text-[10px] text-fog-dim">Renews {formatDate(DEMO_USER.renewsAt)} · billed in Nigerian Naira</div>
            </div>
            <div class="text-right">
              <span class="chip chip-mint">Active</span>
              <div class="mt-2 text-[10px] text-fog-dim">Seats 1 of 5</div>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button onclick={checkout} class="btn btn-primary !py-2 text-[11px]" disabled={loading}>{loading ? 'Opening checkout…' : 'Manage payment method'}</button>
            <a href="/pricing" class="btn btn-ghost !py-2 text-[11px]">Compare plans</a>
          </div>
          {#if billingMessage}<div class="mt-3 rounded-lg border border-amber/20 bg-amber/[0.06] px-3 py-2 text-[10.5px] text-amber">{billingMessage}</div>{/if}
        </div>

        <div class="panel p-4">
          <SectionHeader title="What your subscription unlocks" description="Every feature in the workspace" eyebrow="Included" />
          <div class="grid gap-2 sm:grid-cols-2">
            {#each plan.features as feature}
              <div class="flex items-start gap-2 text-[10.5px] text-fog"><Check size={11} class="mt-0.5 shrink-0 text-mint" /> {feature}</div>
            {/each}
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-[10px] sm:grid-cols-4">
            {#each Object.entries(plan.limits) as [key, value]}
              <div class="rounded-lg bg-white/[0.03] p-2"><div class="text-fog-dim">{key}</div><div class="num mt-0.5 font-semibold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div></div>
            {/each}
          </div>
        </div>

        <div class="panel p-4">
          <SectionHeader title="Billing history" description="Invoices in NGN" eyebrow="Invoices" />
          <div class="space-y-1.5">
            {#each [0, 1, 2, 3].map((i) => ({ date: new Date(Date.now() - i * 30 * 864e5).toISOString(), amount: 5000, status: 'Paid' })) as invoice}
              <div class="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/15 px-3 py-2 text-[10.5px]">
                <span class="text-fog">{formatDate(invoice.date)}</span>
                <span class="num font-semibold text-white">{fmtNgn(invoice.amount)}</span>
                <span class="chip chip-mint !px-1.5 !py-0 !text-[8px]">{invoice.status}</span>
              </div>
            {/each}
          </div>
        </div>
      {:else if tab === 'connections'}
        <div class="panel p-4">
          <SectionHeader title="API connections" description="Server-side environment variables are the source of truth. This demo vault never calls providers." eyebrow="Integrations" />
          <div class="mb-3 flex items-center justify-between">
            <span class="text-[10px] text-fog-dim">{keyRows.filter((k) => k.configured).length} of {keyRows.length} configured</span>
            <button onclick={() => (showKeys = !showKeys)} class="btn btn-ghost !px-2.5 !py-1.5 text-[9.5px]">{#if showKeys}<EyeOff size={11} /> Hide values{:else}<Eye size={11} /> Show demo values{/if}</button>
          </div>
          <div class="space-y-2">
            {#each keyRows as row}
              <div class="rounded-xl border border-white/[0.06] bg-black/15 p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div class="text-[11px] font-semibold text-white">{row.label}</div>
                    <div class="text-[9px] text-fog-dim">{row.hint} · <span class="font-mono">{row.env}</span></div>
                  </div>
                  <span class={`chip !px-1.5 !py-0 !text-[8px] ${row.configured ? 'chip-mint' : 'chip-amber'}`}>{row.configured ? 'configured' : 'not set'}</span>
                </div>
                <input class="input mt-2 !py-1.5 font-mono text-[10px]" type={showKeys ? 'text' : 'password'} placeholder={row.configured ? '•••••••••••• (server env)' : `Paste ${row.env} for local demo`} bind:value={keys[row.id]} />
              </div>
            {/each}
          </div>
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p class="max-w-md text-[9px] leading-relaxed text-fog-dim"><Lock size={9} class="mr-1 inline" /> Production keys are stored as Cloudflare/Convex environment secrets. The browser demo vault is for testing only and is never sent to a provider.</p>
            <button onclick={saveKeys} class="btn btn-primary !py-2 text-[11px]"><Save size={12} /> Save demo vault</button>
          </div>
        </div>

        <div class="space-y-3">
          <InstallApp variant="card" />
          <div class="panel p-4">
            <SectionHeader title="E-WIN ecosystem" description="One identity across every E-WIN application" eyebrow="Ecosystem" />
            <div class="space-y-2 text-[10.5px] text-fog">
              <div class="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
                <span>Single sign-on</span>
                <span class={`chip !text-[8.5px] ${data.ecosystem?.sso ? 'chip-mint' : 'chip-amber'}`}>{data.ecosystem?.sso ? 'Connected' : 'Not configured'}</span>
              </div>
              <div class="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
                <span>App descriptor</span>
                <a class="font-mono text-[9.5px] text-lime hover:underline" href="/.well-known/ewin-app.json">/.well-known/ewin-app.json</a>
              </div>
              <a class="btn btn-ghost w-full !py-2 text-[11px]" href={data.ecosystem?.hubUrl ?? 'https://ewinproject.org'} target="_blank" rel="noopener">
                Open the E-WIN Project hub <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        </div>

        <div class="panel p-4">
          <SectionHeader title="LLM analyst" description="Grounded narrative generation" eyebrow="AI" />
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet/15 bg-violet/[0.05] p-3">
            <div class="flex items-center gap-2.5">
              <span class="flex h-8 w-8 items-center justify-center rounded-lg border border-violet/25 bg-violet/10 text-violet"><Sparkles size={14} /></span>
              <div><div class="text-[11px] font-semibold text-white">Match analyst</div><div class="text-[9px] text-fog-dim">Uses verified model numbers only · falls back to deterministic templates</div></div>
            </div>
            <span class={`chip !text-[8.5px] ${data.keys.llm ? 'chip-mint' : 'chip-sky'}`}>{data.keys.llm ? 'LLM active' : 'Grounded fallback'}</span>
          </div>
        </div>
      {:else if tab === 'sources'}
        <div class="panel p-4">
          <SectionHeader title="Data source permissions" description="Which connectors are enabled in this workspace" eyebrow="Pipeline" />
          <div class="space-y-1.5">
            {#each DATA_SOURCES.filter((s) => s.kind !== 'internal').slice(0, 16) as source}
              <div class="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-2">
                <span class={`h-1.5 w-1.5 shrink-0 rounded-full ${source.status === 'healthy' ? 'bg-mint' : source.status === 'degraded' ? 'bg-amber' : source.status === 'needs-key' ? 'bg-sky' : 'bg-fog-dim'}`}></span>
                <div class="min-w-0 flex-1"><div class="truncate text-[10.5px] font-medium text-white">{source.name}</div><div class="text-[9px] text-fog-dim">{source.kind} · {source.sport}</div></div>
                <span class="num text-[9.5px] text-fog">{source.coverage}%</span>
                <span class={`chip !px-1.5 !py-0 !text-[8px] ${source.status === 'healthy' ? 'chip-mint' : source.status === 'needs-key' ? 'chip-sky' : 'chip-amber'}`}>{source.status}</span>
              </div>
            {/each}
          </div>
          <a href="/scrapers" class="mt-3 flex items-center gap-1 text-[10.5px] font-semibold text-lime hover:underline">Open the data pipeline <ArrowUpRight size={10} /></a>
        </div>
      {:else if tab === 'preferences'}
        <div class="panel p-4">
          <SectionHeader title="Display & staking" description="Applies across the workspace" eyebrow="Preferences" />
          <div class="grid gap-3 sm:grid-cols-2">
            <div><label class="label" for="currency">Primary currency</label><select id="currency" class="input" bind:value={prefs.currency}><option value="NGN">Nigerian Naira (₦)</option><option value="USD">US Dollar ($)</option><option value="GBP">Pound Sterling (£)</option></select></div>
            <div><label class="label" for="odds">Odds format</label><select id="odds" class="input" bind:value={prefs.oddsFormat}><option value="decimal">Decimal</option><option value="american">American</option><option value="fractional">Fractional</option></select></div>
            <div><label class="label" for="staking">Staking method</label><select id="staking" class="input" bind:value={prefs.staking}><option value="quarter">Quarter Kelly (recommended)</option><option value="half">Half Kelly</option><option value="flat">Flat 1%</option></select></div>
            <div><label class="label" for="edge">Minimum edge — {prefs.minEdge}%</label><input id="edge" type="range" min="0" max="10" step="0.5" bind:value={prefs.minEdge} class="w-full accent-[#c9ff4d]" /></div>
            <div><label class="label" for="maxstake">Max stake — {prefs.maxStake}% of bankroll</label><input id="maxstake" type="range" min="1" max="10" step="0.5" bind:value={prefs.maxStake} class="w-full accent-[#c9ff4d]" /></div>
          </div>
        </div>
        <div class="panel p-4">
          <SectionHeader title="Notifications" description="Email and in-app alerts" eyebrow="Alerts" />
          <div class="space-y-1">
            {#each [
              { key: 'notifyValue', label: 'New positive-EV selection', hint: 'Alert when an edge above your threshold appears' },
              { key: 'notifyResults', label: 'Settled selection results', hint: 'Grading and P/L updates' },
              { key: 'notifyDrift', label: 'Model drift & rollback', hint: 'When a champion is replaced' },
              { key: 'dailyBrief', label: 'Daily analyst brief', hint: 'One email at 08:00 WAT' }
            ] as row}
              <label class="flex cursor-pointer items-center justify-between gap-3 border-b border-white/[0.05] py-2.5">
                <div><div class="text-[11px] text-white/85">{row.label}</div><div class="text-[9px] text-fog-dim">{row.hint}</div></div>
                <input type="checkbox" bind:checked={prefs[row.key as 'notifyValue' | 'notifyResults' | 'notifyDrift' | 'dailyBrief']} class="h-4 w-4 accent-[#c9ff4d]" />
              </label>
            {/each}
          </div>
          <div class="mt-3 flex justify-end"><button onclick={savePrefs} class="btn btn-primary !py-2 text-[11px]"><Save size={12} /> Save preferences</button></div>
        </div>
      {:else}
        <div class="panel p-4">
          <SectionHeader title="Security & access" description="Protect the workspace" eyebrow="Security" />
          <div class="space-y-2">
            {#each [
              { title: 'Two-factor authentication', detail: 'TOTP via authenticator app', action: 'Enable' },
              { title: 'Active sessions', detail: '2 devices · Lagos and London', action: 'Review' },
              { title: 'API tokens', detail: '1 token · created 42 days ago', action: 'Rotate' },
              { title: 'Audit log', detail: 'Every model, key and billing change', action: 'View' }
            ] as row}
              <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/15 p-3">
                <div><div class="text-[11px] font-semibold text-white">{row.title}</div><div class="text-[9px] text-fog-dim">{row.detail}</div></div>
                <button class="btn btn-ghost !px-2.5 !py-1.5 text-[9.5px]">{row.action}</button>
              </div>
            {/each}
          </div>
        </div>
        <div class="panel border-rose/20 p-4">
          <SectionHeader title="Responsible play" description="Hard limits on the paper desk" eyebrow="Guardrails" />
          <div class="grid gap-3 sm:grid-cols-2">
            <div><label class="label" for="daily">Daily loss limit (₦)</label><input id="daily" class="input" type="number" value="50000" /></div>
            <div><label class="label" for="weekly">Weekly loss limit (₦)</label><input id="weekly" class="input" type="number" value="200000" /></div>
          </div>
          <div class="mt-3 flex items-start gap-2 rounded-lg border border-amber/20 bg-amber/[0.06] p-2.5 text-[9.5px] leading-relaxed text-amber">
            <AlertTriangle size={12} class="mt-0.5 shrink-0" />
            <span>If gambling stops being fun, stop. CaveBettor is research software for adults 18+. It does not accept deposits and cannot place bets. Seek local support if you need help.</span>
          </div>
          <div class="mt-3 flex justify-between">
            <a href="/workspace" class="btn btn-ghost !py-2 text-[10.5px]"><CircleHelp size={11} /> Methodology</a>
            <button class="btn !bg-rose/15 !text-rose !py-2 text-[10.5px]" onclick={() => flash('Account deletion requires email confirmation — demo only')}>Delete workspace</button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
