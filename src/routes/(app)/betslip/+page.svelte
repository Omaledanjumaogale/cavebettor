<script lang="ts">
  import { Plus, Minus, Trash2, Download, Share2, Copy, Check, Search, Ticket, Wallet, Info } from '@lucide/svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import { formatKickoff } from '#lib/format';
  import { fmtNgn, pct } from '#lib/engine/core';

  let { data } = $props();

  type Selection = (typeof data.selections)[number];

  const STORAGE_KEY = 'cavebettor.betslip.v1';

  let query = $state('');
  let sportFilter = $state('all');
  let minEdge = $state(0.5);
  let slip = $state<Selection[]>([]);
  let stake = $state(10_000);
  let notice = $state('');
  let copied = $state(false);

  const filtered = $derived(
    data.selections.filter((selection) => {
      if (sportFilter !== 'all' && selection.sport !== sportFilter) return false;
      if (selection.edge * 100 < minEdge) return false;
      if (!query.trim()) return true;
      const haystack = `${selection.fixtureLabel} ${selection.league} ${selection.marketLabel} ${selection.label}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
  );

  const sports = $derived(
    Object.entries(
      data.selections.reduce<Record<string, number>>((acc, selection) => {
        acc[selection.sportLabel] = (acc[selection.sportLabel] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([label, count]) => ({ label, count }))
  );

  const combinedOdds = $derived(slip.reduce((acc, leg) => acc * leg.odds, 1));
  const combinedProbability = $derived(slip.reduce((acc, leg) => acc * leg.probability, 1));
  const averageEdge = $derived(slip.length ? slip.reduce((acc, leg) => acc + leg.edge, 0) / slip.length : 0);
  const kellyFraction = $derived(
    slip.length ? Math.max(0, (combinedProbability * (combinedOdds - 1) - (1 - combinedProbability)) / (combinedOdds - 1)) : 0
  );
  const suggestedStake = $derived(Math.round((data.bankrollNgn * Math.min(kellyFraction, 0.02)) / 500) * 500);
  const potentialReturn = $derived(stake * combinedOdds);
  const potentialProfit = $derived(potentialReturn - stake);

  const inSlip = (selection: Selection) => slip.some((leg) => leg.id === selection.id);

  function add(selection: Selection) {
    if (inSlip(selection)) {
      slip = slip.filter((leg) => leg.id !== selection.id);
      return;
    }
    slip = [...slip, selection];
  }

  function clear() {
    slip = [];
  }

  function encode(legs: Selection[]) {
    const payload = legs.map((leg) => [leg.fixtureId, leg.marketId, leg.outcomeId, leg.odds]);
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(value: string): Selection[] {
    try {
      const padded = value.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes)) as [string, string, string, number][];
      return payload
        .map(([fixtureId, marketId, outcomeId]) =>
          data.selections.find((s) => s.fixtureId === fixtureId && s.marketId === marketId && s.outcomeId === outcomeId)
        )
        .filter((s): s is Selection => Boolean(s));
    } catch {
      return [];
    }
  }

  function shareLink() {
    if (!slip.length) return '';
    const url = `${location.origin}/betslip?slip=${encode(slip)}`;
    return url;
  }

  async function copyShareLink() {
    const url = shareLink();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      notice = 'Share link copied to your clipboard.';
      setTimeout(() => (copied = false), 2500);
    } catch {
      notice = url;
    }
  }

  async function share() {
    const url = shareLink();
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'CaveBettor betslip', text: `${slip.length} legs at ${combinedOdds.toFixed(2)} combined odds`, url });
        return;
      } catch {
        /* the visitor dismissed the share sheet — fall back to the clipboard */
      }
    }
    await copyShareLink();
  }

  function downloadJson() {
    const payload = slip.map((leg) => ({
      fixture: leg.fixtureLabel,
      league: leg.league,
      sport: leg.sportLabel,
      market: leg.marketLabel,
      selection: leg.label,
      odds: leg.odds,
      modelProbability: leg.probability,
      edge: leg.edge,
      book: leg.bestBook
    }));
    const blob = new Blob(
      [JSON.stringify({ generatedAt: new Date().toISOString(), stakeNgn: stake, combinedOdds, legs: payload }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cavebettor-betslip-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notice = 'Betslip JSON downloaded.';
  }

  function downloadPng() {
    if (!slip.length) return;
    const width = 1120;
    const rowHeight = 76;
    const height = 320 + slip.length * rowHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#07100c';
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createLinearGradient(0, 0, width, height);
    glow.addColorStop(0, 'rgba(201,255,77,0.16)');
    glow.addColorStop(1, 'rgba(53,231,161,0.02)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(201,255,77,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    ctx.fillStyle = '#c9ff4d';
    ctx.font = '600 26px Inter Variable, Inter, sans-serif';
    ctx.fillText('CaveBettor betslip', 60, 92);
    ctx.fillStyle = '#93a9a0';
    ctx.font = '400 17px Inter Variable, Inter, sans-serif';
    ctx.fillText(`${slip.length} leg${slip.length === 1 ? '' : 's'} · ${new Date().toLocaleDateString('en-NG')} · research only, no real stakes`, 60, 124);

    ctx.strokeStyle = 'rgba(147,169,160,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 152);
    ctx.lineTo(width - 60, 152);
    ctx.stroke();

    slip.forEach((leg, index) => {
      const y = 200 + index * rowHeight;
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 21px Inter Variable, Inter, sans-serif';
      ctx.fillText(leg.fixtureLabel, 60, y);
      ctx.fillStyle = '#93a9a0';
      ctx.font = '400 17px Inter Variable, Inter, sans-serif';
      ctx.fillText(`${leg.sportLabel} · ${leg.league} · ${leg.marketLabel}: ${leg.label}`, 60, y + 28);
      ctx.fillStyle = '#c9ff4d';
      ctx.font = '700 21px Inter Variable, Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${leg.odds.toFixed(2)}`, width - 60, y);
      ctx.fillStyle = '#35e7a1';
      ctx.font = '400 16px Inter Variable, Inter, sans-serif';
      ctx.fillText(`model ${(leg.probability * 100).toFixed(1)}% · edge ${(leg.edge * 100).toFixed(1)}%`, width - 60, y + 28);
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(147,169,160,0.12)';
      ctx.beginPath();
      ctx.moveTo(60, y + 50);
      ctx.lineTo(width - 60, y + 50);
      ctx.stroke();
    });

    const footerY = 240 + slip.length * rowHeight;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px Inter Variable, Inter, sans-serif';
    ctx.fillText(`Combined odds ${combinedOdds.toFixed(2)}`, 60, footerY);
    ctx.fillText(`Stake ${fmtNgn(stake)}`, 60, footerY + 34);
    ctx.fillStyle = '#c9ff4d';
    ctx.fillText(`Potential return ${fmtNgn(potentialReturn)}`, 420, footerY + 34);
    ctx.fillStyle = '#647c72';
    ctx.font = '400 15px Inter Variable, Inter, sans-serif';
    ctx.fillText('CaveBettor is a research workspace. It never accepts deposits and never places bets.', 60, footerY + 72);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cavebettor-betslip-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
      notice = 'Betslip image downloaded.';
    }, 'image/png');
  }

  $effect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(location.search);
    const shared = params.get('slip');
    if (shared) {
      const legs = decode(shared);
      if (legs.length) slip = legs;
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const ids = JSON.parse(stored) as string[];
        slip = data.selections.filter((selection) => ids.includes(selection.id));
      } catch {
        /* ignore a corrupted slip */
      }
    }
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slip.map((leg) => leg.id)));
  });
</script>

<svelte:head><title>Betslip builder — CaveBettor</title></svelte:head>

<div class="space-y-5">
  <SectionHeader
    title="Betslip builder"
    description="Pick priced markets across fixtures, let the accumulator price itself from model probabilities, then download or share the slip."
    eyebrow="Workspace"
  />

  <div class="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
    <!-- Selection board -->
    <div class="space-y-3">
      <div class="panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div class="relative w-full min-w-0 flex-1">
          <Search size={14} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" />
          <input
            class="w-full rounded-lg border border-white/10 bg-black/20 py-2 pl-9 pr-3 text-[12px] text-white placeholder:text-fog-dim focus:border-lime/40 focus:outline-none"
            placeholder="Search a fixture, league or market…"
            bind:value={query}
          />
        </div>
        <select
          class="w-full min-w-0 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white focus:border-lime/40 focus:outline-none sm:w-auto"
          bind:value={sportFilter}
        >
          <option value="all">All sports</option>
          {#each sports as sport}
            <option value={sport.label}>{sport.label} ({sport.count})</option>
          {/each}
        </select>
        <label class="flex w-full items-center gap-2 text-[11px] text-fog sm:w-auto">
          Min edge
          <input type="range" min="0.5" max="8" step="0.5" bind:value={minEdge} class="min-w-0 flex-1 accent-lime sm:w-24 sm:flex-none" />
          <span class="num w-10 shrink-0 text-right text-white">{Number(minEdge).toFixed(1)}%</span>
        </label>
      </div>

      <div class="panel divide-y divide-white/[0.06] overflow-hidden">
        {#each filtered.slice(0, 60) as selection (selection.id)}
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="truncate text-[12.5px] font-semibold text-white">{selection.fixtureLabel}</span>
                <span class="chip !px-1.5 !py-0.5 !text-[9px]">{selection.league}</span>
                <span class="text-[10px] text-fog-dim">{formatKickoff(selection.kickoff)}</span>
              </div>
              <div class="mt-1 truncate text-[11px] text-fog">
                {selection.marketLabel}: <span class="text-white/85">{selection.label}</span>
                <span class="text-fog-dim">· {selection.bestBook} · model {(selection.probability * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div class="text-right">
              <div class="num text-[13px] font-bold text-lime">{selection.odds.toFixed(2)}</div>
              <div class="num text-[10px] text-mint">+{(selection.edge * 100).toFixed(1)}% edge</div>
            </div>
            <button
              type="button"
              class="btn !px-2.5 !py-1.5 {inSlip(selection) ? 'btn-primary' : 'btn-ghost'}"
              aria-label={inSlip(selection) ? `Remove ${selection.label} from the slip` : `Add ${selection.label} to the slip`}
              onclick={() => add(selection)}
            >
              {#if inSlip(selection)}<Check size={14} />{:else}<Plus size={14} />{/if}
            </button>
          </div>
        {:else}
          <div class="px-4 py-10 text-center text-[12px] text-fog">
            No priced market matches that filter. Widen the edge threshold or clear the search.
          </div>
        {/each}
      </div>
      {#if filtered.length > 60}
        <p class="text-center text-[10.5px] text-fog-dim">Showing the 60 strongest of {filtered.length} priced selections.</p>
      {/if}
    </div>

    <!-- Slip -->
    <aside class="panel h-fit p-4 lg:sticky lg:top-20">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Ticket size={15} class="text-lime" />
          <h2 class="text-[13px] font-semibold text-white">Your slip</h2>
          <span class="chip !px-1.5 !py-0.5 !text-[9px]">{slip.length} legs</span>
        </div>
        {#if slip.length}
          <button type="button" class="text-[11px] text-fog-dim hover:text-rose" onclick={clear}>
            <Trash2 size={12} class="inline" /> Clear
          </button>
        {/if}
      </div>

      {#if slip.length === 0}
        <p class="mt-4 rounded-xl border border-dashed border-white/12 px-3 py-6 text-center text-[11.5px] text-fog-dim">
          Add legs from the board. The combined price is calculated from the model probabilities, not from a marketing
          formula.
        </p>
      {:else}
        <ul class="mt-3 space-y-2">
          {#each slip as leg (leg.id)}
            <li class="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="truncate text-[11.5px] font-semibold text-white">{leg.fixtureLabel}</div>
                  <div class="mt-0.5 truncate text-[10.5px] text-fog">{leg.marketLabel}: {leg.label}</div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="num text-[12.5px] font-bold text-lime">{leg.odds.toFixed(2)}</span>
                  <button type="button" aria-label="Remove leg" class="text-fog-dim hover:text-rose" onclick={() => add(leg)}>
                    <Minus size={13} />
                  </button>
                </div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}

      <dl class="mt-4 space-y-2 border-t border-white/[0.07] pt-4 text-[11.5px]">
        <div class="flex items-center justify-between">
          <dt class="text-fog">Combined odds</dt>
          <dd class="num font-semibold text-white">{combinedOdds.toFixed(2)}</dd>
        </div>
        <div class="flex items-center justify-between">
          <dt class="text-fog">Model probability</dt>
          <dd class="num font-semibold text-white">{pct(combinedProbability)}</dd>
        </div>
        <div class="flex items-center justify-between">
          <dt class="text-fog">Average edge</dt>
          <dd class="num font-semibold text-mint">{pct(averageEdge)}</dd>
        </div>
        <div class="flex items-center justify-between">
          <dt class="flex items-center gap-1 text-fog">
            Suggested stake
            <Info size={11} class="text-fog-dim" />
          </dt>
          <dd class="num font-semibold text-lime">{fmtNgn(suggestedStake)}</dd>
        </div>
      </dl>

      <label class="mt-3 block text-[11px] text-fog">
        Stake (₦)
        <input
          type="number"
          min="0"
          step="500"
          bind:value={stake}
          class="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white focus:border-lime/40 focus:outline-none"
        />
      </label>

      <div class="mt-3 rounded-xl border border-lime/25 bg-lime/[0.07] px-3 py-2.5">
        <div class="flex items-center justify-between text-[11.5px]">
          <span class="text-fog">Potential return</span>
          <span class="num font-bold text-lime">{fmtNgn(potentialReturn)}</span>
        </div>
        <div class="mt-1 flex items-center justify-between text-[11px]">
          <span class="text-fog-dim">Potential profit</span>
          <span class="num text-mint">{fmtNgn(potentialProfit)}</span>
        </div>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" class="btn btn-ghost !py-2 text-[11px]" onclick={downloadPng} disabled={!slip.length}>
          <Download size={13} /> Image
        </button>
        <button type="button" class="btn btn-ghost !py-2 text-[11px]" onclick={downloadJson} disabled={!slip.length}>
          <Download size={13} /> JSON
        </button>
        <button type="button" class="btn btn-ghost !py-2 text-[11px]" onclick={share} disabled={!slip.length}>
          <Share2 size={13} /> {copied ? 'Copied' : 'Share'}
        </button>
        <button type="button" class="btn btn-ghost !py-2 text-[11px]" onclick={copyShareLink} disabled={!slip.length}>
          <Copy size={13} /> Link
        </button>
      </div>

      <p class="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-fog-dim">
        <Wallet size={11} class="mt-0.5 shrink-0" />
        CaveBettor builds research slips. It never accepts deposits, never holds a wallet and never places a bet.
      </p>

      {#if notice}
        <p class="mt-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[10.5px] text-fog" role="status">{notice}</p>
      {/if}
    </aside>
  </div>
</div>
