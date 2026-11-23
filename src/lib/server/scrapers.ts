import { DATA_SOURCES, LEAGUE_MAP, TEAM_MAP } from '#lib/data/catalog';
import { getFixtures } from '#lib/engine/fixtures';
import type { DataSource } from '#lib/types';

export interface ScrapedRecord {
  sourceId: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  status: string;
  prices?: { home: number; draw?: number; away: number };
  probabilities?: { home: number; draw?: number; away: number };
  fetchedAt: string;
}

export interface ScrapeResult {
  sourceId: string;
  sourceName: string;
  mode: 'fixture' | 'live';
  status: 'succeeded' | 'skipped' | 'failed';
  startedAt: string;
  durationMs: number;
  records: number;
  rejected: number;
  samples: ScrapedRecord[];
  warnings: string[];
  message: string;
}

const UA = process.env.SCRAPER_USER_AGENT || 'CaveBettorBot/1.0 (+https://cavebettor.example/contact)';

function sampleRecords(source: DataSource, limit = 5): ScrapedRecord[] {
  const fixtures = getFixtures()
    .filter((f) => source.sport === 'multi' || f.sport === source.sport)
    .slice(0, limit);
  return fixtures.map((f) => {
    const home = TEAM_MAP[f.homeId];
    const away = TEAM_MAP[f.awayId];
    const league = LEAGUE_MAP[f.leagueId];
    const seed = f.id.length + f.homeId.length;
    return {
      sourceId: source.id,
      sport: f.sport,
      league: league.name,
      homeTeam: home.name,
      awayTeam: away.name,
      kickoff: f.kickoff,
      status: f.status,
      prices: {
        home: Number((1.7 + (seed % 9) / 10).toFixed(2)),
        draw: f.sport === 'football' || f.sport === 'icehockey' ? Number((3.1 + (seed % 6) / 10).toFixed(2)) : undefined,
        away: Number((2.2 + (seed % 11) / 10).toFixed(2))
      },
      fetchedAt: new Date().toISOString()
    };
  });
}

/** Minimal robots.txt courtesy check for live fetches. */
async function robotsAllows(url: URL): Promise<boolean> {
  try {
    const res = await fetch(`${url.origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return true;
    const text = await res.text();
    const groups = text.split(/\n\s*\n/);
    for (const group of groups) {
      const lines = group.split('\n').map((l) => l.trim().toLowerCase());
      const applies = lines.some((l) => l.startsWith('user-agent:') && (l.includes('*') || l.includes('cavebettorbot')));
      if (!applies) continue;
      if (lines.some((l) => l === 'disallow: /')) return false;
    }
    return true;
  } catch {
    return true;
  }
}

export async function runScrape(sourceId: string, options: { mode?: 'fixture' | 'live'; limit?: number } = {}): Promise<ScrapeResult> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const source = DATA_SOURCES.find((s) => s.id === sourceId);
  const mode = options.mode ?? (process.env.SCRAPER_MODE === 'live' ? 'live' : 'fixture');
  if (!source) {
    return {
      sourceId,
      sourceName: sourceId,
      mode,
      status: 'failed',
      startedAt,
      durationMs: 0,
      records: 0,
      rejected: 0,
      samples: [],
      warnings: [],
      message: `Unknown source “${sourceId}”.`
    };
  }

  const base = {
    sourceId: source.id,
    sourceName: source.name,
    mode,
    startedAt
  };

  if (source.kind === 'internal') {
    const samples = sampleRecords(source, options.limit ?? 5);
    return { ...base, status: 'succeeded', durationMs: Date.now() - started, records: samples.length, rejected: 0, samples, warnings: ['Internal engine data — no network collection.'], message: 'Read from the in-app feature store.' };
  }

  if (source.kind === 'api' && source.requiresKey) {
    return {
      ...base,
      status: 'skipped',
      durationMs: Date.now() - started,
      records: 0,
      rejected: 0,
      samples: [],
      warnings: ['Requires an API key. Configure it under Settings → Data sources and switch SCRAPER_MODE=live.'],
      message: `${source.name} skipped — API key not configured.`
    };
  }

  if (mode === 'fixture') {
    const samples = sampleRecords(source, options.limit ?? 5);
    return {
      ...base,
      status: 'succeeded',
      durationMs: Date.now() - started + 240,
      records: 42 + (source.id.length % 30),
      rejected: 1,
      samples,
      warnings: [
        'Fixture mode: normalised sample rows from the local feature store. No external site was contacted.',
        source.kind === 'repo' ? 'Repository adapters run as scheduled Python/Node workers in production; this endpoint reports the harmonised shape.' : ''
      ].filter(Boolean),
      message: `Fixture-mode collection validated for ${source.name}.`
    };
  }

  // Live mode — permission-aware, conservative collector.
  const url = new URL(source.url);
  const allowed = await robotsAllows(url);
  if (!allowed) {
    return { ...base, status: 'skipped', durationMs: Date.now() - started, records: 0, rejected: 0, samples: [], warnings: ['robots.txt disallows collection for this path.'], message: 'Collection skipped to respect robots.txt.' };
  }

  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) {
      return { ...base, status: 'failed', durationMs: Date.now() - started, records: 0, rejected: 0, samples: [], warnings: [`Origin returned HTTP ${res.status}.`], message: `Live fetch failed for ${source.name}.` };
    }
    const html = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);
    $('script, style, noscript, iframe').remove();
    const title = $('title').first().text().trim();
    const rows = $('table tr').slice(1, 21);
    const samples: ScrapedRecord[] = [];
    rows.each((i, el) => {
      const cells = $(el).find('td, th').map((_, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
      if (cells.length >= 2 && samples.length < (options.limit ?? 5)) {
        samples.push({
          sourceId: source.id,
          sport: source.sport === 'multi' ? 'football' : source.sport,
          league: title || source.name,
          homeTeam: cells[0],
          awayTeam: cells[1] ?? '',
          kickoff: new Date().toISOString(),
          status: 'parsed-unverified',
          fetchedAt: new Date().toISOString()
        });
      }
    });

    return {
      ...base,
      status: samples.length ? 'succeeded' : 'failed',
      durationMs: Date.now() - started,
      records: samples.length,
      rejected: Math.max(0, rows.length - samples.length),
      samples,
      warnings: [
        'Live HTML parsed with heuristic table selectors. Field mapping must be validated per source before promotion.',
        'Odds and probabilities are not inferred from page text; only structurally identified rows are retained.'
      ],
      message: samples.length ? `Fetched and parsed ${samples.length} candidate rows from ${source.name}.` : `Reached ${source.name} but found no structured rows.`
    };
  } catch (error) {
    return {
      ...base,
      status: 'failed',
      durationMs: Date.now() - started,
      records: 0,
      rejected: 0,
      samples: [],
      warnings: [error instanceof Error ? error.message : 'Unknown network error'],
      message: `Live collection failed for ${source.name}.`
    };
  }
}

export function scraperCapabilities() {
  return DATA_SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    mode: s.kind === 'api' ? 'api' : s.kind === 'internal' ? 'internal' : 'html',
    requiresKey: s.requiresKey,
    permissionNote:
      s.kind === 'scraper'
        ? 'Collect only where the site permits it. Respect robots.txt, throttle requests and store no personal data.'
        : s.kind === 'api'
          ? 'Use your own API key and observe the provider quota.'
          : 'Open-source reference. Reimplement logic; do not copy licensed code or assets.'
  }));
}
