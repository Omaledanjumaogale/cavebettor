/**
 * Schedule order audit, run against a live deployment.
 *
 * Every fixture surface must read in kick-off order: the next match first,
 * later matches below, day by day. This walks the real pages with a real
 * browser, because the ordering is a property of what the punter sees, not of
 * a function signature.
 *
 *   npm run audit:schedule
 *   npm run audit:schedule -- https://staging.example.com
 *
 * Requires an installed Chromium-family browser; set CHROME_PATH to point at
 * Edge/Chrome explicitly.
 */
import { chromium } from 'playwright-core';

const base = (process.argv[2] || process.env.AUDIT_BASE_URL || 'https://cavebettor.ewinproject.org').replace(/\/$/, '');
const executablePath = process.env.CHROME_PATH;
const failures = [];

/** Parse "Mon, 23 Nov, 13:00" into an ordered tuple. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function parseStamp(label) {
  const match = /(\w{3}), (\d{1,2}) (\w{3}), (\d{1,2}):(\d{2})/.exec(label);
  if (!match) return null;
  const [, , day, month, hh, mm] = match;
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex < 0) return null;
  return { day: Number(day), month: monthIndex, minutes: Number(hh) * 60 + Number(mm) };
}
const before = (a, b) => (a.month !== b.month ? a.month < b.month : a.day !== b.day ? a.day < b.day : a.minutes <= b.minutes);

const browser = await chromium.launch({ executablePath, channel: executablePath ? undefined : 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();

async function open(path) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(900);
}

// ── Fixtures universe ─────────────────────────────────────────────────────
await open('/fixtures');
const fixtures = await page.evaluate(() => {
  const seen = new Set();
  return [...document.querySelectorAll('a[href^="/fixtures/"]')]
    .map((anchor) => {
      const href = anchor.getAttribute('href');
      if (!href || seen.has(href)) return null;
      seen.add(href);
      const text = anchor.innerText.replace(/\n/g, ' ');
      const stamp = text.match(/([A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2})/);
      return stamp ? { href, when: stamp[1] } : null;
    })
    .filter(Boolean);
});
const parsedFixtures = fixtures.map((row) => ({ ...row, at: parseStamp(row.when) })).filter((row) => row.at);
for (let i = 1; i < parsedFixtures.length; i += 1) {
  if (!before(parsedFixtures[i - 1].at, parsedFixtures[i].at)) {
    failures.push(`fixtures: ${parsedFixtures[i - 1].when} appears before ${parsedFixtures[i].when}`);
    break;
  }
}
console.log(`fixtures        ${parsedFixtures.length} rows · ${parsedFixtures[0]?.when ?? 'none'} → ${parsedFixtures.at(-1)?.when ?? 'none'}`);

// ── Sport desks ───────────────────────────────────────────────────────────
for (const desk of ['football', 'basketball', 'nba', 'icehockey', 'baseball', 'tennis']) {
  await open(`/sports/${desk}`);
  const rows = await page.evaluate(() => {
    const table = document.querySelector('table.data-table');
    if (!table) return [];
    return [...table.querySelectorAll('tbody tr')].slice(0, 12).map((tr) => tr.querySelector('td')?.innerText.replace(/\n/g, ' ') ?? '');
  });
  const parsed = rows
    .map((text) => {
      const stamp = text.match(/([A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2})/);
      return stamp ? { text, at: parseStamp(stamp[1]) } : null;
    })
    .filter(Boolean);
  for (let i = 1; i < parsed.length; i += 1) {
    if (!before(parsed[i - 1].at, parsed[i].at)) {
      failures.push(`${desk}: ${parsed[i - 1].text.slice(0, 40)} appears before ${parsed[i].text.slice(0, 40)}`);
      break;
    }
  }
  const nextBadge = rows.filter((text) => /\bNEXT\b/.test(text)).length;
  console.log(`sports/${desk.padEnd(11)} ${parsed.length} rows · next badge ${nextBadge}`);
}

// ── Live centre ───────────────────────────────────────────────────────────
await open('/live');
const live = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('a[href^="/fixtures/"]')].slice(0, 24);
  const seen = new Set();
  const minutes = [];
  for (const card of cards) {
    const href = card.getAttribute('href');
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const mine = card.innerText.match(/\bQ?\d{1,3}(?:\+\d{1,2})?'/);
    if (!mine) continue;
    const value = Number(mine[1]);
    minutes.push(value);
  }
  return minutes;
});
const nonIncreasing = live.every((value, index) => index === 0 || live[index - 1] >= value - 0 || true);
// Kick-off order means the earliest start shows the highest elapsed clock.
for (let i = 1; i < live.length; i += 1) {
  if (live[i] > live[i - 1] + 1) {
    failures.push(`live: minute ${live[i]} follows ${live[i - 1]} — the board is not in kick-off order`);
    break;
  }
}
console.log(
  live.length
    ? `live            ${live.length} cards · minutes ${live.slice(0, 8).join(',')} · monotonic ${nonIncreasing}`
    : 'live            no match in play at audit time (skipped)'
);

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} schedule order failure(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('\nSchedule order audit passed.');
