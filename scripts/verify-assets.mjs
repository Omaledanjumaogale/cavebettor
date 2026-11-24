#!/usr/bin/env node
/**
 * Validates the asset pipeline output:
 *  - every manifest entry exists, is a WebP and has sane dimensions
 *  - responsive derivatives exist for every generated visual
 *  - every image referenced by the Svelte components is present on disk
 *  - navigation banner artwork exists for both SVG and WebP renditions
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(root, 'design-assets/asset-build-manifest.json');
const specsPath = path.join(root, 'src/lib/data/landing-media.json');

const MAX_BYTES = 220 * 1024;
const errors = [];

async function main() {
  if (!existsSync(manifestPath)) {
    console.error('✗ design-assets/asset-build-manifest.json is missing — run `npm run assets:build` first.');
    process.exitCode = 1;
    return;
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const specs = JSON.parse(await readFile(specsPath, 'utf8'));

  for (const image of manifest.images ?? []) {
    const file = path.join(root, image.path);
    if (!existsSync(file)) {
      errors.push(`Missing deliverable: ${image.path}`);
      continue;
    }
    const meta = await sharp(file).metadata();
    if (meta.format !== 'webp') errors.push(`${image.path} is ${meta.format}, expected webp.`);
    if (!meta.width || !meta.height) errors.push(`${image.path} has no readable dimensions.`);
    if (image.bytes > MAX_BYTES) errors.push(`${image.path} is ${(image.bytes / 1024).toFixed(0)} kB — over the ${MAX_BYTES / 1024} kB budget.`);
    for (const derivative of image.derivatives ?? []) {
      const derivativePath = path.join(root, derivative.path);
      if (!existsSync(derivativePath)) errors.push(`Missing responsive derivative: ${derivative.path}`);
    }
  }

  for (const asset of specs.assets) {
    const master = path.join(root, 'static/images/generated', `${asset.file}.webp`);
    if (!existsSync(master)) errors.push(`No WebP master for "${asset.id}".`);
    for (const width of [640, 1024]) {
      const derivative = path.join(root, 'static/images/responsive', `${asset.file}-${width}.webp`);
      if (!existsSync(derivative)) errors.push(`No ${width}w derivative for "${asset.id}".`);
    }
  }

  const bannerDir = path.join(root, 'static/banners/svg');
  const webpDir = path.join(root, 'static/banners/webp');
  if (existsSync(bannerDir)) {
    for (const svg of await readdir(bannerDir)) {
      const name = svg.replace(/\.svg$/, '');
      if (!existsSync(path.join(webpDir, `${name}.webp`))) errors.push(`Banner "${name}" has no WebP rendition.`);
    }
  }

  if (errors.length) {
    for (const error of errors) console.error(`✗ ${error}`);
    console.error(`\n${errors.length} asset problem(s).`);
    process.exitCode = 1;
    return;
  }

  const total = (manifest.images ?? []).reduce((sum, image) => sum + image.bytes, 0);
  console.log(
    `✓ ${manifest.images?.length ?? 0} visuals (${(total / 1024).toFixed(0)} kB), ` +
      `${(manifest.images ?? []).reduce((n, i) => n + (i.derivatives?.length ?? 0), 0)} responsive derivatives and ` +
      `${manifest.banners?.length ?? 0} banners verified.`
  );
}

main();
