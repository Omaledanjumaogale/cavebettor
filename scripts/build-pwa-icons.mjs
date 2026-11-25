/**
 * PWA icon pipeline.
 *
 * Rasterises the brand mark into the exact PNG sizes the install prompts ask
 * for. Android needs 192 and 512 (plus maskable variants with the safe zone
 * respected); iOS ignores SVG touch icons entirely, so a 180px PNG is
 * mandatory there. Everything is generated from one source of truth
 * (`static/favicon.svg`) so the installed app can never drift from the site.
 */
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const SOURCE = 'static/favicon.svg';
const OUT = 'static/icons';

/** Icons the platforms actually request. */
const TARGETS = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-256.png', size: 256 },
  { name: 'icon-384.png', size: 384 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-16.png', size: 16 }
];

/** Maskable icons need ~20% padding so Android's mask never crops the mark. */
const MASKABLE = [
  { name: 'maskable-192.png', size: 192 },
  { name: 'maskable-512.png', size: 512 }
];

const BACKGROUND = '#070d0b';

async function main() {
  await mkdir(OUT, { recursive: true });
  const svg = await readFile(SOURCE);

  for (const target of TARGETS) {
    await sharp(svg, { density: 512 })
      .resize(target.size, target.size, { fit: 'contain', background: { r: 7, g: 13, b: 11, alpha: 1 } })
      .png({ compressionLevel: 9 })
      .toFile(`${OUT}/${target.name}`);
    console.log(`✓ ${OUT}/${target.name} (${target.size}×${target.size})`);
  }

  for (const target of MASKABLE) {
    const inner = Math.round(target.size * 0.72);
    const pad = Math.round((target.size - inner) / 2);
    const mark = await sharp(svg, { density: 512 }).resize(inner, inner, { fit: 'contain' }).png().toBuffer();
    await sharp({
      create: {
        width: target.size,
        height: target.size,
        channels: 4,
        background: BACKGROUND
      }
    })
      .composite([{ input: mark, top: pad, left: pad }])
      .png({ compressionLevel: 9 })
      .toFile(`${OUT}/${target.name}`);
    console.log(`✓ ${OUT}/${target.name} (maskable, ${target.size}×${target.size})`);
  }
}

main().catch((error) => {
  console.error('PWA icon build failed:', error);
  process.exit(1);
});
