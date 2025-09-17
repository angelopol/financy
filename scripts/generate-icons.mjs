import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcSvg = resolve(__dirname, '../public/icons/icon.svg');
const outDir = resolve(__dirname, '../public/icons');

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-256.png', size: 256 },
  { name: 'icon-384.png', size: 384 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 }
];

try {
  const svg = await readFile(srcSvg);
  for (const t of targets) {
    await sharp(svg)
      .resize(t.size, t.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(resolve(outDir, t.name));
    console.log('Generated', t.name);
  }
} catch (err) {
  console.error('Icon generation failed:', err);
  process.exit(1);
}
