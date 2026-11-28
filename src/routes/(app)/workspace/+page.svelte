<script lang="ts">
  import { onMount } from 'svelte';
  import { NotebookPen, GitBranch, Globe, ArrowUpRight, Layers, BrainCircuit, ShieldCheck, Plus, Trash2, Save, Check, Database, Cpu, Cloud, KeyRound, Scale } from '@lucide/svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import { relativeTime } from '#lib/format';

  let { data } = $props();
  let tab = $state<'matrix' | 'method' | 'notes' | 'architecture'>('matrix');
  let filter = $state<'all' | 'repo' | 'site'>('all');
  let notes = $state<{ id: string; title: string; body: string; createdAt: string; tag: string }[]>([]);
  let draftTitle = $state('');
  let draftBody = $state('');
  let draftTag = $state('Decision');
  let saved = $state(false);

  const shown = $derived(data.harmonisation.filter((h: any) => filter === 'all' || h.kind === filter));

  onMount(() => {
    try {
      const raw = localStorage.getItem('cavebettor.notes');
      if (raw) notes = JSON.parse(raw);
    } catch {
      notes = [];
    }
    if (notes.length === 0) {
      notes = [
        {
          id: 'seed-1',
          title: 'Adopt Dixon–Coles as the football baseline',
          body: 'Low-score correction materially improves draw and correct-score calibration. Weighted 34% of the football ensemble, behind the market prior only when prices are sharp.',
          createdAt: new Date(Date.now() - 12 * 864e5).toISOString(),
          tag: 'Model'
        },
        {
          id: 'seed-2',
          title: 'Naira-first, never a sportsbook',
          body: 'CaveBettor publishes probabilities and paper-settled selections. No deposits, no wallet, no bet placement. The commercial product is research software at ₦5,000 per month.',
          createdAt: new Date(Date.now() - 9 * 864e5).toISOString(),
          tag: 'Product'
        },
        {
          id: 'seed-3',
          title: 'Fixture-mode collectors by default',
          body: 'Live scraping is opt-in and permission-aware. The default runtime validates normalisation using the local feature store, so the product is fully demonstrable without hitting third-party sites.',
          createdAt: new Date(Date.now() - 5 * 864e5).toISOString(),
          tag: 'Data'
        }
      ];
      persist();
    }
  });

  function persist() {
    try {
      localStorage.setItem('cavebettor.notes', JSON.stringify(notes));
    } catch {
      /* storage unavailable */
    }
  }

  function addNote() {
    if (!draftTitle.trim()) return;
    notes = [{ id: crypto.randomUUID(), title: draftTitle.trim(), body: draftBody.trim(), tag: draftTag, createdAt: new Date().toISOString() }, ...notes];
    draftTitle = '';
    draftBody = '';
    persist();
    saved = true;
    setTimeout(() => (saved = false), 1800);
  }

  function remove(id: string) {
    notes = notes.filter((n) => n.id !== id);
    persist();
  }

  const tagStyle = (tag: string) =>
    tag === 'Model' ? 'chip chip-lime' : tag === 'Data' ? 'chip chip-sky' : tag === 'Product' ? 'chip chip-amber' : 'chip';
</script>

<svelte:head><title>Research notes & methodology — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-violet"><NotebookPen size={12} /> Research workspace</div>
      <h1 class="display text-[26px] font-bold tracking-tight text-white">Built from evidence.</h1>
      <p class="mt-1 max-w-2xl text-[12.5px] text-fog">
        {data.stats.repos} repositories and {data.stats.sites} public analytics sites harmonised into {data.stats.features} capabilities across {data.stats.modules} product modules. No proprietary code or paid assets were copied.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <span class="chip chip-mint"><ShieldCheck size={10} /> research-only sources</span>
      <a href="/pricing" class="btn btn-ghost !py-2 text-[11px]">Commercial model <ArrowUpRight size={11} /></a>
    </div>
  </div>

  <div class="scrollbar-none flex gap-1 overflow-x-auto border-b border-white/[0.07] pb-px">
    {#each [{ id: 'matrix', label: 'Harmonisation matrix', icon: Layers }, { id: 'method', label: 'Methodology', icon: Scale }, { id: 'architecture', label: 'Architecture', icon: Cloud }, { id: 'notes', label: 'Decision log', icon: NotebookPen }] as t}
      <button onclick={() => (tab = t.id as any)} class={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[11.5px] font-semibold ${tab === t.id ? 'border-lime text-lime' : 'border-transparent text-fog hover:text-white'}`}>
        <t.icon size={13} /> {t.label}
      </button>
    {/each}
  </div>

  {#if tab === 'matrix'}
    <div class="flex flex-wrap items-center gap-1.5">
      {#each [{ id: 'all', label: 'All sources' }, { id: 'repo', label: 'Repositories' }, { id: 'site', label: 'Analytics sites' }] as f}
        <button onclick={() => (filter = f.id as any)} class={`chip ${filter === f.id ? '!border-lime/35 !bg-lime/10 !text-lime' : ''}`}>{f.label}</button>
      {/each}
      <span class="ml-auto text-[10px] text-fog-dim">Each row is a feature decision, not a code import</span>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      {#each shown as source}
        <div class="panel p-3.5">
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-fog">
                {#if source.kind === 'repo'}<GitBranch size={13} />{:else}<Globe size={13} />{/if}
              </span>
              <a href={source.url} target="_blank" rel="noreferrer" class="truncate text-[11.5px] font-semibold text-white hover:text-lime">{source.name}</a>
            </div>
            <span class={`chip !px-1.5 !py-0 !text-[8px] ${source.status === 'adopted' ? 'chip-mint' : source.status === 'adapted' ? 'chip-sky' : ''}`}>{source.status}</span>
          </div>
          <ul class="mt-2 space-y-1">
            {#each source.contributions as c}
              <li class="flex gap-1.5 text-[9.5px] leading-relaxed text-fog"><span class="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-lime/50"></span>{c}</li>
            {/each}
          </ul>
          <div class="mt-2 flex flex-wrap gap-1 border-t border-white/[0.05] pt-2">
            {#each source.cavebettorModules as m}<span class="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8.5px] text-white/60">{m}</span>{/each}
          </div>
        </div>
      {/each}
    </div>

    <div class="panel p-4">
      <SectionHeader title="Sport and market harmonisation" description="One probability contract, five sport-specific generators" eyebrow="Coverage" />
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Sport</th><th>Markets</th><th>Primary model</th></tr></thead>
          <tbody>
            {#each data.markets as row}
              <tr><td class="text-[11px] font-semibold text-white">{row.sport}</td><td class="text-[10px] text-fog">{row.markets.join(' · ')}</td><td class="text-[10px] text-white/70">{row.primary}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else if tab === 'method'}
    <div class="grid gap-4 lg:grid-cols-3">
      <div class="panel p-4 lg:col-span-2">
        <SectionHeader title="How CaveBettor forms a probability" description="A transparent, reproducible chain" eyebrow="Methodology" />
        <div class="space-y-3">
          {#each [
            { title: '1 · Price discovery', body: 'Collect prices from eight bookmakers. Convert decimal odds to implied probability and remove the overround with proportional de-vigging. The consensus becomes the market prior.' },
            { title: '2 · Sport-specific distribution', body: 'Football and hockey use a Dixon–Coles corrected bivariate Poisson with time-decayed attack and defence strengths. Basketball uses a normal margin/total model. Baseball uses a pitcher-led run distribution. Tennis uses Elo with surface and fatigue adjustments.' },
            { title: '3 · Machine-learning adjustment', body: 'A gradient-boosted ensemble consumes 142 features: rolling xG, Elo, rest, travel, availability, pace, park factors, weather and market movement. Sequence models run in shadow mode.' },
            { title: '4 · Ensemble and calibration', body: 'Components are weighted by sport and validated for calibration. Probabilities are never allowed to drift arbitrarily far from the market prior; large disagreements require supporting features.' },
            { title: '5 · Edge and staking', body: 'Edge = model probability × best price − 1. Only positive edges above 0.5% survive. Stakes use quarter-Kelly with a 5% bankroll cap. Correlated legs are excluded from accumulators.' },
            { title: '6 · Measurement', body: 'Every recommendation is recorded at the best available price and scored against the closing line and the result. Calibration, CLV, ROI, yield and drawdown are published — including the losses.' }
          ] as step}
            <div class="rounded-xl border border-white/[0.06] bg-black/15 p-3">
              <div class="text-[11px] font-semibold text-white">{step.title}</div>
              <p class="mt-1 text-[10.5px] leading-relaxed text-fog">{step.body}</p>
            </div>
          {/each}
        </div>
      </div>
      <div class="space-y-4">
        <div class="panel p-4">
          <SectionHeader title="What this is not" description="Boundaries are a feature" eyebrow="Product" />
          <ul class="space-y-2 text-[10.5px] leading-relaxed text-fog">
            <li class="flex gap-2"><span class="text-rose">✕</span> Not a sportsbook. No deposits, wallets, bet slips or settlements with real money.</li>
            <li class="flex gap-2"><span class="text-rose">✕</span> Not a guarantee. Probabilities are estimates; variance is real.</li>
            <li class="flex gap-2"><span class="text-rose">✕</span> Not a copy of any repository. Only patterns and public ideas were reimplemented.</li>
            <li class="flex gap-2"><span class="text-rose">✕</span> Not financial advice. 18+ only. Gamble responsibly.</li>
          </ul>
        </div>
        <div class="panel p-4">
          <SectionHeader title="Data ethics" description="Collection rules" eyebrow="Governance" />
          <ul class="space-y-2 text-[10.5px] leading-relaxed text-fog">
            <li class="flex gap-2"><span class="text-mint">✓</span> Respect robots.txt and rate limits.</li>
            <li class="flex gap-2"><span class="text-mint">✓</span> Use licensed APIs where available.</li>
            <li class="flex gap-2"><span class="text-mint">✓</span> Store no personal data from scraped pages.</li>
            <li class="flex gap-2"><span class="text-mint">✓</span> Keep an immutable snapshot for every training run.</li>
            <li class="flex gap-2"><span class="text-mint">✓</span> Publish limitations alongside results.</li>
          </ul>
        </div>
      </div>
    </div>
  {:else if tab === 'architecture'}
    <div class="panel p-4">
      <SectionHeader title="Enterprise architecture" description="SvelteKit on Cloudflare Pages, Convex for reactive state, a deterministic intelligence core" eyebrow="System design" />
      <div class="space-y-2">
        {#each data.architecture as layer, i}
          <div class="flex gap-3 rounded-xl border border-white/[0.06] bg-black/15 p-3">
            <span class="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-lime/20 bg-lime/[0.07] text-[9px] font-bold text-lime">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <div class="text-[11.5px] font-semibold text-white">{layer.name}</div>
              <p class="mt-0.5 text-[10.5px] leading-relaxed text-fog">{layer.detail}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
    <div class="grid gap-4 md:grid-cols-3">
      {#each [
        { icon: Database, title: 'Convex schema', body: 'users, subscriptions, leagues, teams, fixtures, markets, odds, predictions, modelVersions, trainingRuns, dataSources, scrapeJobs, watchlists, paperBets, analysisReports, apiKeys and auditLogs — all indexed for the queries the UI actually runs.' },
        { icon: Cpu, title: 'Intelligence core', body: 'Pure deterministic functions. The same fixture produces the same probability in the browser, in the API and in Convex actions. No hidden randomness, no look-ahead.' },
        { icon: KeyRound, title: 'Integrations', name: 'Providers', body: 'API-Football, The Odds API, TheSportsDB, BallDontLie and an LLM analyst activate when keys are present. Collection defaults to fixture mode and never silently calls a paid endpoint.' }
      ] as card}
        <div class="panel p-4">
          <card.icon size={16} class="text-lime" />
          <h3 class="mt-2 text-[12px] font-semibold text-white">{card.title}</h3>
          <p class="mt-1 text-[10px] leading-relaxed text-fog">{card.body}</p>
        </div>
      {/each}
    </div>
    <div class="panel p-4">
      <SectionHeader title="Deployment topology" description="Edge-first, credential-gated" eyebrow="Operations" />
      <div class="grid gap-2 text-[10px] sm:grid-cols-3">
        {#each [
          ['Cloudflare Pages', 'SvelteKit SSR + static assets, _worker.js for API routes, edge caching.'],
          ['Convex', 'Reactive queries, mutations, scheduled functions and file storage.'],
          ['Workers / cron', 'Scrapers, normalisation jobs, training triggers and drift audits.'],
          ['Paystack', 'NGN subscription checkout and webhook reconciliation.'],
          ['LLM provider', 'Grounded match analysis. Falls back to deterministic templates.'],
          ['Observability', 'Structured logs, run history, data-quality gates and error budgets.']
        ] as row}
          <div class="rounded-lg border border-white/[0.05] bg-black/15 p-2.5"><div class="font-semibold text-white">{row[0]}</div><div class="mt-0.5 leading-relaxed text-fog">{row[1]}</div></div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="grid gap-4 lg:grid-cols-3">
      <div class="panel p-4">
        <SectionHeader title="Add a decision note" description="Saved locally in this browser" eyebrow="Log" />
        <div class="space-y-2.5">
          <div><label class="label" for="note-title">Title</label><input id="note-title" class="input" bind:value={draftTitle} placeholder="e.g. Weight market prior higher in NBA" /></div>
          <div><label class="label" for="note-body">Reasoning</label><textarea id="note-body" class="input min-h-[90px]" bind:value={draftBody} placeholder="What did you decide, and what evidence supports it?"></textarea></div>
          <div>
            <label class="label" for="note-tag">Tag</label>
            <select id="note-tag" class="input" bind:value={draftTag}><option>Decision</option><option>Model</option><option>Data</option><option>Product</option></select>
          </div>
          <button onclick={addNote} class="btn btn-primary w-full !py-2 text-[11.5px]" disabled={!draftTitle.trim()}>{#if saved}<Check size={12} /> Saved{:else}<Plus size={12} /> Add note{/if}</button>
        </div>
      </div>
      <div class="lg:col-span-2">
        <SectionHeader title="Decision log" description={`${notes.length} notes · newest first`} eyebrow="Institutional memory" />
        <div class="space-y-2">
          {#each notes as note}
            <div class="panel p-3.5">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[11.5px] font-semibold text-white">{note.title}</span>
                    <span class={`${tagStyle(note.tag)} !px-1.5 !py-0 !text-[8px]`}>{note.tag}</span>
                  </div>
                  <div class="mt-0.5 text-[9px] text-fog-dim">{relativeTime(note.createdAt)}</div>
                </div>
                <button onclick={() => remove(note.id)} class="btn-icon !h-6 !w-6 shrink-0" aria-label="Delete note"><Trash2 size={11} /></button>
              </div>
              {#if note.body}<p class="mt-2 text-[10.5px] leading-relaxed text-fog">{note.body}</p>{/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
