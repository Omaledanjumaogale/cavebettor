#!/usr/bin/env node
/**
 * Guards the one-visual-per-placement rule.
 *
 * - SHA-256 exact duplicate detection across every generated visual.
 * - dHash perceptual hashing so visually near-identical artwork is flagged.
 * - Manifest placement uniqueness (no visual may serve two sections).
 * - Navigation banner identity checks (id, inscription, artwork, route).
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const imageDir = path.join(root, 'static/images/generated');
const bannerSvgDir = path.join(root, 'static/banners/svg');
const specsPath = path.join(root, 'src/lib/data/landing-media.json');
const bannerConfigPath = path.join(root, 'src/lib/config/navigation-banners.ts');

const errors = [];
const warnings = [];

async function sha256(file) {
  return crypto.createHash('sha256').update(await readFile(file)).digest('hex');
}

/** 8×8 difference hash — enough to flag "same image, different file". */
async function dhash(file) {
  const { data } = await sharp(file).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const bits = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits.push(data[y * 9 + x] > data[y * 9 + x + 1] ? 1 : 0);
    }
  }
  return bits.join('');
}

function hamming(a, b) {
  let distance = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) distance++;
  return distance;
}

const normalise = (value) =>
  value
    .normalize('NFKD')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

async function main() {
  const specs = JSON.parse(await readFile(specsPath, 'utf8'));

  // 1. Placement uniqueness from the manifest.
  const placements = new Map();
  for (const asset of specs.assets) {
    if (placements.has(asset.placement)) {
      errors.push(`Placement "${asset.placement}" is claimed by both ${placements.get(asset.placement)} and ${asset.id}.`);
    }
    placements.set(asset.placement, asset.id);
  }

  const ids = new Set();
  for (const asset of specs.assets) {
    if (ids.has(asset.id)) errors.push(`Duplicate asset id "${asset.id}".`);
    ids.add(asset.id);
    const file = path.join(imageDir, `${asset.file}.webp`);
    if (!existsSync(file)) errors.push(`Missing deliverable for "${asset.id}": ${path.relative(root, file)}`);
  }

  // 2. Exact + perceptual duplicates across generated visuals.
  const files = existsSync(imageDir) ? (await readdir(imageDir)).filter((f) => f.endsWith('.webp')) : [];
  const hashes = [];
  for (const file of files) {
    const full = path.join(imageDir, file);
    hashes.push({ file, sha: await sha256(full), dhash: await dhash(full) });
  }
  for (let i = 0; i < hashes.length; i++) {
    for (let j = i + 1; j < hashes.length; j++) {
      const a = hashes[i];
      const b = hashes[j];
      if (a.sha === b.sha) {
        errors.push(`Exact duplicate artwork: ${a.file} and ${b.file}.`);
        continue;
      }
      const distance = hamming(a.dhash, b.dhash);
      if (distance <= 4) {
        warnings.push(`Near-identical artwork (dHash distance ${distance}): ${a.file} and ${b.file} — review manually.`);
      }
    }
  }

  // 3. Banner identity rules.
  const bannerConfig = await readFile(bannerConfigPath, 'utf8');
  const bannerIds = [...bannerConfig.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
  const inscriptions = [...bannerConfig.matchAll(/inscription:\s*'([^']+)'/g)].map((m) => normalise(m[1]));
  const artworks = [...bannerConfig.matchAll(/artwork:\s*'([^']+)'/g)].map((m) => m[1]);
  const routes = [...bannerConfig.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);

  for (const [label, values] of [
    ['banner id', bannerIds],
    ['banner inscription', inscriptions],
    ['banner artwork', artworks],
    ['banner route', routes]
  ]) {
    const seen = new Set();
    for (const value of values) {
      if (seen.has(value)) errors.push(`Repeated ${label}: "${value}".`);
      seen.add(value);
    }
  }

  if (existsSync(bannerSvgDir)) {
    for (const artwork of artworks) {
      const file = path.join(root, 'static', artwork.replace(/^\//, ''));
      if (!existsSync(file)) errors.push(`Banner artwork missing on disk: ${artwork}`);
    }
    const svgFiles = (await readdir(bannerSvgDir)).filter((f) => f.endsWith('.svg'));
    const svgHashes = new Map();
    for (const svg of svgFiles) {
      const sha = await sha256(path.join(bannerSvgDir, svg));
      if (svgHashes.has(sha)) errors.push(`Duplicate banner artwork file: ${svg} and ${svgHashes.get(sha)}.`);
      svgHashes.set(sha, svg);
    }
    if (svgFiles.length !== artworks.length) {
      errors.push(`Banner artwork count mismatch: ${artworks.length} configured vs ${svgFiles.length} SVG files.`);
    }
  }

  for (const warning of warnings) console.warn(`! ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`✗ ${error}`);
    console.error(`\n${errors.length} uniqueness violation(s).`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${specs.assets.length} placements, ${files.length} generated visuals and ${bannerIds.length} banners are unique.`);
}

main();
