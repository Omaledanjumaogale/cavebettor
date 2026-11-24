#!/usr/bin/env node
/**
 * Asset pipeline for CaveBettor.
 *
 * 1. Converts every generated PNG source in design-assets/generated-source into
 *    an optimised WebP deliverable in static/images/generated.
 * 2. Produces responsive derivatives (640w, 1024w) in static/images/responsive.
 * 3. Rasterises the branded navigation-banner SVGs into static/banners/webp.
 * 4. Records dimensions, byte sizes and checksums in design-assets/asset-manifest.json.
 *
 * Run with: node scripts/build-assets.mjs
 */
import { mkdir, readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const sourceDir = path.join(root, 'design-assets/generated-source');
const generatedDir = path.join(root, 'static/images/generated');
const responsiveDir = path.join(root, 'static/images/responsive');
const bannerSvgDir = path.join(root, 'static/banners/svg');
const bannerWebpDir = path.join(root, 'static/banners/webp');
const manifestPath = path.join(root, 'design-assets/asset-build-manifest.json');

const QUALITY = 82;
const RESPONSIVE_WIDTHS = [640, 1024];

async function sha256(file) {
  return crypto.createHash('sha256').update(await readFile(file)).digest('hex');
}

async function buildImage(name) {
  const source = path.join(sourceDir, `${name}.png`);
  if (!existsSync(source)) return null;

  const master = path.join(generatedDir, `${name}.webp`);
  const meta = await sharp(source).metadata();
  const pipeline = sharp(source).resize({ width: 1536, withoutEnlargement: true });

  await pipeline.clone().webp({ quality: QUALITY, effort: 5 }).toFile(master);

  const derivatives = [];
  for (const width of RESPONSIVE_WIDTHS) {
    if (meta.width && meta.width < width) continue;
    const target = path.join(responsiveDir, `${name}-${width}.webp`);
    await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY, effort: 5 }).toFile(target);
    derivatives.push({
      path: path.relative(root, target).replace(/\\/g, '/'),
      width,
      bytes: (await stat(target)).size
    });
  }

  const out = await sharp(master).metadata();
  return {
    path: path.relative(root, master).replace(/\\/g, '/'),
    width: out.width,
    height: out.height,
    bytes: (await stat(master)).size,
    sha256: await sha256(master),
    derivatives
  };
}

async function buildBanners() {
  if (!existsSync(bannerSvgDir)) return [];
  const files = await readdir(bannerSvgDir);
  const banners = [];
  for (const file of files.filter((f) => f.endsWith('.svg'))) {
    const name = file.replace(/\.svg$/, '');
    const svg = path.join(bannerSvgDir, file);
    const target = path.join(bannerWebpDir, `${name}.webp`);
    await sharp(svg, { density: 200 }).resize({ width: 1600 }).webp({ quality: 84 }).toFile(target);
    banners.push({
      id: name,
      svg: path.relative(root, svg).replace(/\\/g, '/'),
      webp: path.relative(root, target).replace(/\\/g, '/'),
      bytes: (await stat(target)).size,
      sha256: await sha256(target)
    });
  }
  return banners;
}

async function main() {
  for (const dir of [generatedDir, responsiveDir, bannerWebpDir]) await mkdir(dir, { recursive: true });

  const specs = JSON.parse(await readFile(path.join(root, 'src/lib/data/landing-media.json'), 'utf8'));
  const outputs = [];
  for (const asset of specs.assets) {
    const built = await buildImage(asset.file);
    if (built) {
      outputs.push({ id: asset.id, placement: asset.placement, group: asset.group, ...built });
      console.log(`✓ ${built.path} (${built.width}×${built.height}, ${(built.bytes / 1024).toFixed(0)} kB)`);
    } else {
      console.log(`· skipped ${asset.file} (no source in design-assets/generated-source)`);
    }
  }

  const banners = await buildBanners();
  for (const banner of banners) console.log(`✓ ${banner.webp}`);

  const manifest = {
    builtAt: new Date().toISOString(),
    quality: QUALITY,
    responsiveWidths: RESPONSIVE_WIDTHS,
    images: outputs,
    banners
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n${outputs.length} images, ${banners.length} banners → ${path.relative(root, manifestPath)}`);
}

main();
