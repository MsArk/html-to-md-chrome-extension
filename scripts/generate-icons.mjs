#!/usr/bin/env node
/**
 * Genera iconos PNG placeholder para la extensión (SVG → PNG con sharp, sin Cairo).
 * Ejecutar: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sizes = [16, 48, 128];
const dir = path.resolve('public/icons');
fs.mkdirSync(dir, { recursive: true });

function svgForSize(size) {
  const r = size * 0.18;
  const fontSize = Math.round(size * 0.55);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#6c8bff"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    fill="#ffffff" font-family="system-ui, Segoe UI, sans-serif" font-weight="700" font-size="${fontSize}">M</text>
</svg>`;
}

for (const size of sizes) {
  const out = path.join(dir, `icon${size}.png`);
  await sharp(Buffer.from(svgForSize(size))).png().toFile(out);
  console.log(`✓ icon${size}.png`);
}
