#!/usr/bin/env node
/**
 * Sample the distinct colours in each artwork into src/_data/palettes.json.
 * Caches by image mtime in .cache/palettes-cache.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { palette } from "./palette.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MIRROR = "/Users/matuskliment/www.genecanning.com";
const ALGO = 2;
const OUT = path.join(ROOT, "src/_data/palettes.json");
const CACHE = path.join(ROOT, ".cache/palettes-cache.json");

const artworks = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/_data/artworks.json"), "utf8")
);

function resolveSource(filename) {
  if (!filename) return null;
  for (const c of [
    path.join(ROOT, "img-source", filename),
    path.join(MIRROR, "_Media", filename),
  ]) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

fs.mkdirSync(path.dirname(CACHE), { recursive: true });

let cache = {};
if (fs.existsSync(CACHE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    cache = {};
  }
}

let existingFlat = {};
if (fs.existsSync(OUT)) {
  try {
    existingFlat = JSON.parse(fs.readFileSync(OUT, "utf8"));
  } catch {
    existingFlat = {};
  }
}

// Netlify builds already ship palettes.json — resampling every painting burns the clock.
if (process.env.NETLIFY && Object.keys(existingFlat).length > 50) {
  console.log(
    `palettes: using committed palettes.json (${Object.keys(existingFlat).length} entries)`
  );
  process.exit(0);
}

const flat = { ...existingFlat };
let computed = 0;
let reused = 0;

for (const art of artworks) {
  if (art.kind === "photo") continue;
  const src = resolveSource(art.image);
  if (!src) {
    if (cache[art.slug]?.colours) flat[art.slug] = cache[art.slug].colours;
    continue;
  }
  const mtime = fs.statSync(src).mtimeMs;
  const prev = cache[art.slug];
  if (prev && prev._algo === ALGO && prev._mtime === mtime && Array.isArray(prev.colours)) {
    flat[art.slug] = prev.colours;
    reused++;
    continue;
  }
  try {
    const colours = await palette(src);
    cache[art.slug] = { colours, _mtime: mtime, _algo: ALGO };
    flat[art.slug] = colours;
    computed++;
    if (computed % 25 === 0) console.log(`palettes: ${computed} sampled…`);
  } catch (err) {
    console.warn(`palette failed for ${art.slug}:`, err.message);
  }
}

fs.writeFileSync(CACHE, JSON.stringify(cache));
fs.writeFileSync(OUT, JSON.stringify(flat, null, 2));
console.log(
  `palettes: ${Object.keys(flat).length} total (${computed} new, ${reused} cached)`
);
