#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const urls = JSON.parse(
  fs.readFileSync(path.join(ROOT, "src/_data/urls.json"), "utf8")
);
const site = path.join(ROOT, "_site");

let ok = 0;
const missing = [];
for (const u of urls) {
  const rel = u.replace(/^\//, "");
  const p = path.join(site, rel);
  if (fs.existsSync(p)) ok++;
  else missing.push(u);
}

console.log(`URL QA: ${ok}/${urls.length} present in _site`);
if (missing.length) {
  console.log("Missing:");
  missing.forEach((m) => console.log(" ", m));
  process.exit(1);
}

// Spot-check a few pages contain expected strings
const checks = [
  ["index.html", "Gene Canning"],
  ["index.html", "Pathway of Fame"],
  ["contact-gene.html", "data-netlify"],
  ["biography.html", "Person"],
  [
    "original-paintings/african-wildlife/treetop-leopard-48-x-86-oil.html",
    "Treetop Leopard",
  ],
  [
    "on-the-trail-of-tom-thomson/fall-season-paintings/index.html",
    "data-gc-gallery",
  ],
];
for (const [file, needle] of checks) {
  const html = fs.readFileSync(path.join(site, file), "utf8");
  if (!html.includes(needle)) {
    // Recognition is in list items not the word Recognition
    if (needle === "Recognition" && html.includes("Pathway of Fame")) {
      continue;
    }
    console.error(`Spot-check failed: ${file} missing “${needle}”`);
    process.exit(1);
  }
}
console.log("Spot-checks passed.");
