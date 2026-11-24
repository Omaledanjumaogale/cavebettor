#!/usr/bin/env node
/**
 * Generate the CaveBettor landing-page visual assets.
 *
 * The generator talks to the configured OpenAI-compatible image endpoint
 * (Agnes AI by default) and stores the raw PNG sources under
 * design-assets/generated-source/. scripts/build-assets.mjs then turns those
 * sources into optimised WebP deliverables plus responsive derivatives.
 *
 * Usage:
 *   node scripts/generate-assets.mjs            # generate missing sources only
 *   node scripts/generate-assets.mjs --force    # regenerate everything
 *
 * Secrets are read from the environment or .env.local and never committed.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const specsPath = path.join(root, 'src/lib/data/landing-media.json');
const sourceDir = path.join(root, 'design-assets/generated-source');
const manifestPath = path.join(root, 'design-assets/asset-manifest.json');

const force = process.argv.includes('--force');
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

async function loadEnv() {
  try {
    const raw = await readFile(path.join(root, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      const [, key, value] = match;
      if (!process.env[key]) process.env[key] = value.replace(/^["']|["']$/g, '');
    }
  } catch {
    /* .env.local is optional */
  }
}

const SUBJECT_PROMPTS = {
  'hero-command-centre':
    'Premium wide cinematic shot of a modern sports-intelligence command centre at night: a long desk with three large curved monitors glowing with abstract green probability panels, empty ergonomic chair, faint volumetric light, deep pitch-black room, lime and mint accents, no readable text, editorial technology photography',
  'promo-slide-01':
    'Two analysts in a dark modern sports-intelligence studio at night, standing before a wide glowing wall of abstract data visualisations and candlestick-style probability curves, calm confident posture, lime green rim light, cinematic depth of field',
  'promo-slide-02':
    'A floodlit football stadium at night seen from the tunnel, mist drifting across a vivid green pitch, empty tiers fading into darkness, dramatic volumetric light beams, hopeful cinematic atmosphere',
  'promo-slide-03':
    'A dark slate desk with a basketball and a baseball resting in sharp focus beside a tablet displaying abstract line charts, cool side lighting with mint green highlights, editorial product photography',
  'story-customer':
    'A young Nigerian sports analyst sitting by a window in a modest apartment in Lagos at dusk, phone in hand, thoughtful concentration, football scarf on the sofa, warm realistic interior light',
  'story-challenge':
    'A person overwhelmed at a cluttered desk covered in conflicting paper betting slips and mismatched screens flashing different odds, dim chaotic lighting, sense of information overload',
  'story-discovery':
    'A single clean glowing probability chart on a wide monitor in an otherwise dark calm room, one sharp line separating value from noise, minimal composition, confident clarity',
  'story-guide':
    'An elegant command-centre workstation at night showing abstract green interface panels, a wide desk, soft volumetric glow, inviting professional atmosphere',
  'story-experience':
    'Hands building a multi-leg slip on a tablet that shows abstract stacked price rows and combined odds bars, warm desk light, close up on fingers and screen',
  'story-outcome':
    'A satisfied analyst in a home office reviewing an upward-trending abstract bankroll curve on a laptop, relaxed confident posture, soft morning light through blinds',
  'feature-learning':
    'An open notebook filled with hand-written model notes and small calibration charts lying beside a laptop showing abstract learning curves, warm lamp light, premium editorial still life',
  'feature-workflow':
    'A calm evening workflow desk with three monitors streaming abstract data pipelines, cables and notebooks neatly arranged, mint green highlights, cinematic wide shot',
  'feature-community':
    'A diverse group of four analysts collaborating around shared screens in a modern Lagos studio at night, collaborative energy, lime accents, documentary photography',
  'dashboard-ecosystem':
    'Abstract visualisation of a connected network of glowing sport nodes and links, lime and mint gradients on a near-black background, depth and depth-of-field, premium abstract 3D render'
};

async function main() {
  await loadEnv();

  const apiKey = process.env.AGENES_AI_KEY ?? process.env.AGNES_AI_KEY ?? process.env.OPENAI_API_KEY;
  const base = (process.env.AGNES_API_BASE_URL ?? process.env.AGNES_API_BASE ?? 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');
  const model = process.env.AGNES_IMAGE_MODEL ?? 'agnes-image-2.5-flash';

  if (!apiKey) {
    console.error('No image-generation key found (AGNES_AI_KEY / AGNES_IMAGE_MODEL).');
    process.exitCode = 1;
    return;
  }

  const { assets, styleGuide } = JSON.parse(await readFile(specsPath, 'utf8'));
  await mkdir(sourceDir, { recursive: true });

  const results = [];
  for (const asset of assets) {
    if (only && asset.id !== only) continue;
    const target = path.join(sourceDir, `${asset.file}.png`);
    let exists = true;
    try {
      await access(target, constants.F_OK);
    } catch {
      exists = false;
    }
    if (exists && !force) {
      console.log(`· existing  ${asset.file}.png`);
      results.push({ ...asset, source: path.relative(root, target), regenerated: false });
      continue;
    }

    const subject = SUBJECT_PROMPTS[asset.id] ?? 'Premium cinematic sports analytics scene, dark mint and lime palette.';
    const prompt = `${subject}. ${styleGuide}`;
    process.stdout.write(`→ generating ${asset.file} … `);
    try {
      const res = await fetch(`${base}/images/generations`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt, size: '1536x1024', n: 1 })
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const body = await res.json();
      const url = body?.data?.[0]?.url;
      if (!url) throw new Error(`no image url in response: ${JSON.stringify(body).slice(0, 200)}`);
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error(`download failed ${imgRes.status}`);
      const bytes = Buffer.from(await imgRes.arrayBuffer());
      await writeFile(target, bytes);
      console.log(`ok (${(bytes.length / 1024).toFixed(0)} kB)`);
      results.push({ ...asset, source: path.relative(root, target), regenerated: true });
    } catch (error) {
      console.log(`FAILED: ${error.message}`);
      results.push({ ...asset, source: path.relative(root, target), regenerated: false, error: String(error.message) });
    }
  }

  const failed = results.filter((r) => r.error);
  await writeFile(
    manifestPath,
    JSON.stringify({ generatedBy: model, generatedAt: new Date().toISOString(), assets: results }, null, 2)
  );
  console.log(`\n${results.length - failed.length}/${results.length} sources ready → ${path.relative(root, manifestPath)}`);
  if (failed.length) process.exitCode = 1;
}

main();
