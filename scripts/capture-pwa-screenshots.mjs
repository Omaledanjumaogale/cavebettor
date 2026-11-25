/**
 * Manifest screenshots.
 *
 * Chromium's install sheet shows real app screenshots when the manifest
 * provides them, which is the difference between a browser prompt and a store
 * listing. These are captured from the deployed app, not mocked up.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const BASE = process.env.PWA_SCREENSHOT_BASE || 'https://cavebettor.ewinproject.org';
const OUT = 'static/screenshots';

const SHOTS = [
  { page: '/dashboard', file: 'dashboard-wide.png', width: 1280, height: 720, formFactor: 'wide', label: 'Command centre: live counts, value board and bankroll in one screen' },
  { page: '/dashboard', file: 'dashboard-narrow.png', width: 390, height: 844, formFactor: 'narrow', label: 'The same command centre on a phone' },
  { page: '/fixtures', file: 'fixtures-narrow.png', width: 390, height: 844, formFactor: 'narrow', label: 'Fixture board with kick-off windows and model probabilities' },
  { page: '/predictions', file: 'value-wide.png', width: 1280, height: 720, formFactor: 'wide', label: 'Value board ranked by model probability' }
];

const executablePath = process.env.CHROME_PATH;

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath, channel: executablePath ? undefined : 'msedge' });
  const manifest = { screenshots: [] };

  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
      colorScheme: 'dark'
    });
    const page = await context.newPage();
    await page.goto(`${BASE}${shot.page}`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${shot.file}`, fullPage: false });
    manifest.screenshots.push({
      src: `/screenshots/${shot.file}`,
      sizes: `${shot.width * 2}x${shot.height * 2}`,
      type: 'image/png',
      form_factor: shot.formFactor,
      label: shot.label
    });
    console.log(`✓ ${OUT}/${shot.file}`);
    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(manifest.screenshots, null, 2));
}

main().catch((error) => {
  console.error('screenshot capture failed:', error);
  process.exit(1);
});
