#!/usr/bin/env node
/**
 * Sample five colours per artwork into src/_data/palettes.json.
 * Caches by image mtime in .cache/palettes-cache.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { palette } from "./palette.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MIRROR = "/Users/matuskliment/www.genecanning.com";
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
  if (prev && prev._mtime === mtime && Array.isArray(prev.colours)) {
    flat[art.slug] = prev.colours;
    reused++;
    continue;
  }
  try {
    const colours = await palette(src);
    cache[art.slug] = { colours, _mtime: mtime };
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
