#!/usr/bin/env node
/**
 * "Colours in this painting" — build-time palette extraction.
 *
 * Samples each painting image and returns the distinct colours in it,
 * most prominent first, as hex. Run once per build (or when images change)
 * and store the result with each artwork record (field: `palette`).
 *
 *   npm i -D sharp
 *   node tools/palette.mjs src/img/originals/*.jpg > src/_data/palettes.json
 *
 * Or import it from an Eleventy data file:
 *   import { palette } from './tools/palette.mjs';
 *   const colours = await palette('src/img/originals/treetop-leopard.jpg');
 *
 * Method: downsample, k-means in Lab space (seeded, so results are stable),
 * then keep each distinct colour that covers a real part of the picture.
 * The swatch is a pixel from the painting, not a blend of neighbouring colours.
 * Pure white/black specks under 3% of the picture are ignored.
 */

import sharp from 'sharp';
import { basename } from 'node:path';

const K = 16;
const KEEP = 12;
const MIN_SHARE = 0.012;
const SAME_COLOUR = 9 ** 2;

function srgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function toLab([r, g, b]) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function seeded(seed) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export async function palette(file, keep = KEEP) {
  const { data, info } = await sharp(file).resize(160, 160, { fit: 'inside' }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i < data.length; i += info.channels) px.push([data[i], data[i + 1], data[i + 2]]);
  const lab = px.map(toLab);

  // k-means++ init, seeded
  const rand = seeded(1234);
  const cents = [lab[Math.floor(rand() * lab.length)]];
  while (cents.length < K) {
    const d = lab.map((p) => Math.min(...cents.map((c) => dist2(p, c))));
    const sum = d.reduce((a, b) => a + b, 0);
    let r = rand() * sum, i = 0;
    while (r > d[i] && i < d.length - 1) { r -= d[i]; i++; }
    cents.push(lab[i]);
  }
  let assign = new Array(lab.length).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    assign = lab.map((p) => { let best = 0, bd = Infinity; cents.forEach((c, j) => { const d = dist2(p, c); if (d < bd) { bd = d; best = j; } }); return best; });
    for (let j = 0; j < K; j++) {
      const members = lab.filter((_, i) => assign[i] === j);
      if (members.length) cents[j] = [0, 1, 2].map((k) => members.reduce((s, m) => s + m[k], 0) / members.length);
    }
  }
  // A real pixel from each cluster, the one nearest the cluster's own average.
  const clusters = cents.map((c, j) => {
    const idx = assign.map((a, i) => (a === j ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return null;
    let best = idx[0];
    let bestD = Infinity;
    for (const i of idx) {
      const d = dist2(lab[i], c);
      if (d < bestD) { bestD = d; best = i; }
    }
    return { lab: lab[best], rgb: px[best], share: idx.length / px.length };
  }).filter((c) => c && c.share >= MIN_SHARE);

  clusters.sort((a, b) => b.share - a.share);
  const out = [];
  for (const c of clusters) {
    const nearWhiteOrBlack = c.lab[0] > 97 || c.lab[0] < 4;
    if (nearWhiteOrBlack && c.share < 0.03) continue;
    if (out.some((o) => dist2(o.lab, c.lab) < SAME_COLOUR)) continue;
    out.push(c);
    if (out.length === keep) break;
  }
  return out.map((c) => hex(c.rgb));
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('Usage: node tools/palette.mjs <images…>'); process.exit(1); }
  const result = {};
  for (const f of files) result[basename(f).replace(/\.[^.]+$/, '')] = await palette(f);
  console.log(JSON.stringify(result, null, 2));
}
