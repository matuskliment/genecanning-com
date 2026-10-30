#!/usr/bin/env node
/**
 * One-off extraction from the Sandvox wget mirror into Eleventy data files.
 * Source: /Users/matuskliment/www.genecanning.com
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIRROR = "/Users/matuskliment/www.genecanning.com";
const MEDIA = path.join(MIRROR, "_Media");
const OUT_DATA = path.join(ROOT, "src", "_data");
const OUT_CONTENT = path.join(ROOT, "src", "content");

fs.mkdirSync(OUT_DATA, { recursive: true });
fs.mkdirSync(OUT_CONTENT, { recursive: true });

const SECTION_DEFAULTS = {
  "fall-season-paintings": { widthIn: 10, heightIn: 8, price: 650, medium: "Field painting" },
  "spring-season-paintings": { widthIn: 10, heightIn: 8, price: 650, medium: "Field painting" },
  "summer-season-paintings": { widthIn: 10, heightIn: 8, price: 650, medium: "Field painting" },
  "winter-season-paintings": { widthIn: 10, heightIn: 8, price: 650, medium: "Field painting" },
};

const warnings = [];
const wordAudit = [];

function walkHtml(dir, list = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".") || ent.name === "sandvox_SmoothDark") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "_Media" || ent.name === "_Resources") continue;
      walkHtml(p, list);
    } else if (ent.name.endsWith(".html")) {
      list.push(p);
    }
  }
  return list;
}

function relUrl(absPath) {
  let r = "/" + path.relative(MIRROR, absPath).split(path.sep).join("/");
  return r;
}

function cleanText(s) {
  return (s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s) {
  return cleanText(
    s
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
  );
}

function normalizeQuotes(s) {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/″/g, '"')
    .replace(/′/g, "'");
}

function parseFraction(tok) {
  // 13 3/4 or 19 1/2 or 8
  tok = tok.trim();
  const m = tok.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  const m2 = tok.match(/^(\d+)\/(\d+)$/);
  if (m2) return Number(m2[1]) / Number(m2[2]);
  const n = Number(tok);
  return Number.isFinite(n) ? n : null;
}

function parseCaption(captionOriginal, seriesKey) {
  const original = decodeEntities(captionOriginal);
  let text = normalizeQuotes(original);
  const result = {
    title: "",
    medium: "",
    widthIn: null,
    heightIn: null,
    status: "available",
    price: null,
    edition: "",
    captionOriginal: original,
    parseOk: true,
  };

  const lower = text.toLowerCase();
  if (/\bsold\b/i.test(text)) result.status = "sold";
  else if (/private collection/i.test(text)) result.status = "private";
  else if (/collection of the artist|artist'?s? collection/i.test(text))
    result.status = "artist";

  // Edition
  const ed = text.match(/Edition of\s+[\d,]+|Open [Ee]dition/i);
  if (ed) result.edition = ed[0];

  // Price $1,500 or $650
  const priceM = text.match(/\$\s*([\d,]+)/);
  if (priceM) result.price = Number(priceM[1].replace(/,/g, ""));

  // Dimensions: 48" x 86" or 13 3/4" x 13 3/4" or 16" 20" (missing x)
  const dimRe =
    /(\d+(?:\s+\d+\/\d+)?)\s*"?\s*[x×]\s*(\d+(?:\s+\d+\/\d+)?)\s*"?/i;
  const dimRe2 =
    /(\d+(?:\s+\d+\/\d+)?)\s*"\s+(\d+(?:\s+\d+\/\d+)?)\s*"/; // missing x
  let dm = text.match(dimRe) || text.match(dimRe2);
  if (dm) {
    // Sandvox captions are often height x width in display, but handoff says widthIn/heightIn
    // Live site shows e.g. "48" x 86"" for Treetop Leopard which is H x W for a landscape-wide piece? 
    // Actually Treetop is 48 high x 86 wide per handoff example widthIn 86 heightIn 48.
    // Captions show "48\" x 86\"" — first number then second. Handoff: widthIn 86, heightIn 48.
    // So caption order is height × width (portrait-first reading of "48 x 86").
    const a = parseFraction(dm[1]);
    const b = parseFraction(dm[2]);
    result.heightIn = a;
    result.widthIn = b;
  }

  // Medium clues
  const mediumPatterns = [
    /Mixed Media on [A-Za-z ]+/i,
    /Oil on [A-Za-z ]+/i,
    /Acrylic on [A-Za-z ]+/i,
    /Graphite on [A-Za-z ,]+/i,
    /on (?:Canvas Board|Wood Panel|Masonite|Linen|Birch Panel|Canvas|Panel)/i,
    /Field painting/i,
  ];
  for (const p of mediumPatterns) {
    const m = text.match(p);
    if (m) {
      result.medium = cleanText(m[0].replace(/^on /i, (x) =>
        x.toLowerCase() === "on " ? "On " : x
      ));
      // Normalize "on Canvas Board" → keep as found
      if (/^on /i.test(m[0])) result.medium = cleanText(m[0].replace(/^on/i, "On"));
      break;
    }
  }

  // Title: strip trailing status/price/edition/size/medium
  let title = text;
  title = title.replace(/\bSOLD\b/gi, "");
  title = title.replace(/Private Collection/gi, "");
  title = title.replace(/Collection of the Artist/gi, "");
  title = title.replace(/\$\s*[\d,]+(?:\s*unframed)?/gi, "");
  title = title.replace(/Edition of\s+[\d,]+|Open [Ee]dition/gi, "");
  if (dm) title = title.replace(dm[0], "");
  if (result.medium) title = title.replace(new RegExp(result.medium.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "");
  title = title.replace(/^[.\s,;:-]+|[.\s,;:-]+$/g, "");
  title = cleanText(title.replace(/\s+/g, " "));
  // Prints often "Washday. Edition..." — period left
  title = title.replace(/\.\s*$/, "");
  result.title = title || original.split(/\d/)[0].trim() || original;

  // Apply section defaults when missing
  const def = SECTION_DEFAULTS[seriesKey];
  if (def) {
    if (result.widthIn == null) result.widthIn = def.widthIn;
    if (result.heightIn == null) result.heightIn = def.heightIn;
    if (result.price == null && result.status === "available") result.price = def.price;
    if (!result.medium && def.medium) result.medium = def.medium;
  }

  if (!result.title || (result.widthIn == null && !def)) {
    result.parseOk = false;
  }
  // Soft warning if no medium and not photo
  if (!result.medium && !seriesKey.includes("photos")) {
    result.parseOk = result.parseOk && false;
  }

  return result;
}

/** oil / acrylic / graphite from medium text; empty when caption does not say */
function mediumKeyFrom(medium) {
  if (!medium) return "";
  const m = String(medium).toLowerCase();
  if (/\boil\b/.test(m)) return "oil";
  if (/\bacrylic\b/.test(m)) return "acrylic";
  if (/\bgraphite\b/.test(m)) return "graphite";
  return "";
}

function findBestImage(thumbSrc, detailHtml) {
  // Collect candidate basenames from detail page full-size link and media refs
  const names = new Set();
  if (thumbSrc) {
    const base = path.basename(thumbSrc.split("?")[0]);
    names.add(base);
    // strip size suffixes
    const stem = base
      .replace(/_128_hr/i, "")
      .replace(/_med_hr/i, "")
      .replace(/_360(?:-\d+)?/i, "")
      .replace(/_69_hr/i, "")
      .replace(/-\d+(?=\.(jpe?g|png|gif)$)/i, "");
    names.add(stem);
    // try removing trailing -N before extension
    names.add(base.replace(/_\d+_hr/i, ""));
  }
  if (detailHtml) {
    const $ = cheerio.load(detailHtml);
    $("a.imageLink").each((_, el) => {
      const href = $(el).attr("href") || "";
      const m = href.match(/_Media\/([^?#]+)/);
      if (m) names.add(path.basename(m[1]));
    });
    $("img").each((_, el) => {
      const src = $(el).attr("src") || "";
      const m = src.match(/_Media\/([^?#]+)/);
      if (m) names.add(path.basename(m[1]));
    });
  }

  const mediaFiles = fs.readdirSync(MEDIA);
  let best = null;
  let bestSize = -1;

  for (const name of names) {
    const stem = name.replace(/\.(jpe?g|png|gif|webp|tif|tiff|cr2)$/i, "");
    for (const f of mediaFiles) {
      const fl = f.toLowerCase();
      const st = stem.toLowerCase();
      const stemClean = st
        .replace(/_128_hr.*/, "")
        .replace(/_med_hr.*/, "")
        .replace(/_360.*/, "")
        .replace(/_\d+_hr.*/, "");
      if (
        fl !== name.toLowerCase() &&
        !fl.includes(st.slice(0, Math.min(20, st.length))) &&
        !fl.startsWith(stemClean) &&
        !fl.includes(stemClean)
      ) {
        continue;
      }
      if (/_128_hr|_69_hr|_360/.test(f)) continue;
      // Prefer web-friendly formats
      if (!/\.(jpe?g|png|webp|gif)$/i.test(f)) continue;
      const full = path.join(MEDIA, f);
      try {
        const sz = fs.statSync(full).size;
        const score =
          sz +
          (f.includes("_med_hr") ? -1000 : 0) +
          (/\.jpe?g$/i.test(f) ? 5000 : 0);
        if (score > bestSize) {
          bestSize = score;
          best = f;
        }
      } catch {
        /* skip */
      }
    }
  }

  // Exact basename match fallback
  if (!best) {
    for (const name of names) {
      if (mediaFiles.includes(name)) {
        best = name;
        break;
      }
    }
  }
  return best;
}

function extractMainHtml($) {
  const main = $("#main-content").clone();
  main.find(".collection-navigation, .hidden, script, style").remove();
  return main;
}

function wordsFromHtml(html) {
  const $ = cheerio.load(`<div>${html}</div>`);
  return cleanText($.text()).split(/\s+/).filter(Boolean);
}

function narrativeToMarkdown($, pagePath) {
  const main = extractMainHtml($);
  // Remove photo navigation but keep article
  const title =
    cleanText(main.find("h2.title .in").first().text()) ||
    cleanText(main.find("h2.title").first().text());
  main.find("h2.title").remove();

  const parts = [];
  const seen = new Set();
  const paraRoot = main.find(".RichTextElement").first().length
    ? main.find(".RichTextElement").first()
    : main.find(".article-content").first().length
      ? main.find(".article-content").first()
      : main;
  // Sandvox pages mix .Body with Word-pasted .MsoNormal (biography is almost all MsoNormal)
  paraRoot.find("p.Body, p.MsoNormal, p.paragraph_style_1, p").each((_, p) => {
    const t = cleanText($(p).text());
    if (!t || t === "[Back To Top]" || seen.has(t)) return;
    // Skip empty / whitespace-only / lone nbsp leftovers
    if (t.length < 2) return;
    seen.add(t);
    parts.push(t);
  });

  // Images in narrative — keep as markdown image refs to media filenames
  const images = [];
  main.find("img").each((_, img) => {
    const src = $(img).attr("src") || "";
    const alt = $(img).attr("alt") || "";
    const m = src.match(/_Media\/([^?#]+)/);
    if (m) images.push({ file: path.basename(m[1]), alt });
  });

  // YouTube
  const videos = [];
  main.find("iframe").each((_, iframe) => {
    let src = $(iframe).attr("src") || "";
    src = src.replace(/^http:\/\//, "https://");
    if (src.includes("youtube") || src.includes("youtu.be")) videos.push(src);
  });

  return { title, paragraphs: parts, images, videos, wordCount: parts.join(" ").split(/\s+/).filter(Boolean).length };
}

function seriesKeyFromPath(oldPath) {
  // /original-paintings/african-wildlife/foo.html → african-wildlife
  const parts = oldPath.split("/").filter(Boolean);
  if (parts[0] === "original-paintings" && parts.length >= 2) return parts[1].replace(/\.html$/, "");
  if (parts[0] === "prints") return "prints";
  if (parts[0] === "on-the-trail-of-tom-thomson") {
    if (parts.length >= 2) return parts[1].replace(/\.html$/, "");
    return "thomson";
  }
  return parts[0] || "root";
}

function isGalleryIndex(oldPath, $) {
  return $(".photogrid-index, .gridItem").length > 0 && /index\.html$/.test(oldPath);
}

function isArtworkDetail(oldPath, $) {
  return (
    $(".has-photo-navigation, body.has-photo-navigation").length > 0 ||
    ($(".ImageElement").length > 0 &&
      /\/(original-paintings|prints|on-the-trail-of-tom-thomson)\//.test(oldPath) &&
      !/index\.html$/.test(oldPath) &&
      !/project-overview|videos-from-the-trail/.test(oldPath))
  );
}

// ——— main ———
const htmlFiles = walkHtml(MIRROR);
const artworks = [];
const galleries = [];
const photos = [];
const pages = {};
const urlList = [];

for (const file of htmlFiles) {
  const oldPath = relUrl(file);
  urlList.push(oldPath);
  const html = fs.readFileSync(file, "utf8");
  const $ = cheerio.load(html);
  const series = seriesKeyFromPath(oldPath);

  if (isGalleryIndex(oldPath, $)) {
    const title =
      cleanText($("h2.title .in").first().text()) ||
      cleanText($("h2.title").first().text()) ||
      path.basename(path.dirname(file));
    const intro = [];
    $("#main-content p.Body").each((_, p) => {
      const t = cleanText($(p).text());
      if (t) intro.push(t);
    });

    const items = [];
    $(".gridItem").each((_, el) => {
      const $el = $(el);
      const link = $el.find("a.imageLink").first();
      const href = link.attr("href") || $el.find("h3 a").attr("href") || "";
      const caption =
        decodeEntities(link.attr("title") || "") ||
        cleanText($el.find("h3").text());
      const thumb = link.find("img").attr("src") || "";
      const thumbFile = (thumb.match(/_Media\/([^?#]+)/) || [])[1] || "";

      // Resolve detail path
      const dir = path.dirname(file);
      const detailAbs = path.resolve(dir, href);
      const detailPath = relUrl(detailAbs);
      const slug = path.basename(href, ".html");

      let detailHtml = "";
      if (fs.existsSync(detailAbs)) {
        detailHtml = fs.readFileSync(detailAbs, "utf8");
      }
      const image = findBestImage(thumbFile, detailHtml);
      const kind =
        series === "photos-from-the-trail"
          ? "photo"
          : series === "prints"
            ? "print"
            : "painting";
      const parsed =
        kind === "photo"
          ? {
              title: decodeEntities(caption) || cleanText(caption),
              medium: "",
              widthIn: null,
              heightIn: null,
              status: "",
              price: null,
              edition: "",
              captionOriginal: decodeEntities(caption),
              parseOk: true,
            }
          : parseCaption(caption, series);
      if (!parsed.parseOk && kind !== "photo") {
        warnings.push({
          type: "caption-parse",
          path: detailPath,
          caption,
          parsed: {
            title: parsed.title,
            medium: parsed.medium,
            size: `${parsed.heightIn}x${parsed.widthIn}`,
          },
        });
      }

      const record = {
        slug,
        oldPath: detailPath.endsWith(".html") ? detailPath : detailPath,
        series,
        galleryPath: oldPath,
        title: parsed.title,
        medium: parsed.medium,
        mediumKey: kind === "photo" ? "" : mediumKeyFrom(parsed.medium),
        widthIn: parsed.widthIn,
        heightIn: parsed.heightIn,
        status: parsed.status,
        price: parsed.price,
        edition: parsed.edition,
        image: image || thumbFile,
        thumb: thumbFile,
        captionOriginal: parsed.captionOriginal,
        parseOk: parsed.parseOk,
        kind,
      };

      if (record.kind === "photo") photos.push(record);
      else artworks.push(record);
      items.push({ slug, oldPath: record.oldPath, title: record.title });
    });

    galleries.push({
      path: oldPath,
      series,
      title,
      intro,
      items,
    });
    continue;
  }

  // Narrative / other pages
  if (
    oldPath === "/index.html" ||
    oldPath === "/biography.html" ||
    oldPath === "/contact-gene.html" ||
    oldPath === "/pbs-tvs-journeys-of-an.html" ||
    oldPath === "/on-the-trail-of-tom-thomson/index.html" ||
    oldPath === "/on-the-trail-of-tom-thomson/project-overview.html" ||
    oldPath === "/on-the-trail-of-tom-thomson/videos-from-the-trail/index.html" ||
    oldPath === "/original-paintings/index.html" ||
    oldPath === "/prints/index.html" ||
    /\/index\.html$/.test(oldPath)
  ) {
    // Skip gallery indexes already handled; remaining indexes without grid
    if ($(".gridItem").length) continue;
    const nar = narrativeToMarkdown($, oldPath);
    pages[oldPath] = nar;
    wordAudit.push({ path: oldPath, words: nar.wordCount });
  }
}

// Also extract narrative for artwork-less pages that are text-only already covered.
// Extract biography, home, etc. explicitly if missed
for (const key of [
  "/index.html",
  "/biography.html",
  "/pbs-tvs-journeys-of-an.html",
  "/contact-gene.html",
  "/on-the-trail-of-tom-thomson/index.html",
  "/on-the-trail-of-tom-thomson/project-overview.html",
  "/on-the-trail-of-tom-thomson/videos-from-the-trail/index.html",
  "/original-paintings/index.html",
  "/prints/index.html",
]) {
  const file = path.join(MIRROR, key.replace(/^\//, ""));
  if (!fs.existsSync(file)) continue;
  if (pages[key]) continue;
  const $ = cheerio.load(fs.readFileSync(file, "utf8"));
  pages[key] = narrativeToMarkdown($, key);
}

// Deduplicate artworks by oldPath
const byPath = new Map();
for (const a of artworks) {
  if (!byPath.has(a.oldPath)) byPath.set(a.oldPath, a);
}
const uniqueArtworks = [...byPath.values()];

// homepage.json is curated by hand (design chrome + Gene’s words). Do not overwrite it here.

// Write Markdown narratives
function writeMd(filename, data, extraFront = {}) {
  const fm = {
    title: data.title,
    ...extraFront,
  };
  const body = (data.paragraphs || []).map((p) => p).join("\n\n");
  const yaml = Object.entries(fm)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n");
  fs.writeFileSync(
    path.join(OUT_CONTENT, filename),
    `---\n${yaml}\n---\n\n${body}\n`
  );
}

if (pages["/index.html"]) {
  writeMd("home.md", pages["/index.html"], {
    layout: false,
    permalink: false,
  });
}
if (pages["/biography.html"]) {
  writeMd("biography.md", pages["/biography.html"]);
}
if (pages["/pbs-tvs-journeys-of-an.html"]) {
  writeMd("pbs.md", pages["/pbs-tvs-journeys-of-an.html"]);
}
if (pages["/on-the-trail-of-tom-thomson/project-overview.html"]) {
  writeMd("project-overview.md", pages["/on-the-trail-of-tom-thomson/project-overview.html"]);
}
if (pages["/on-the-trail-of-tom-thomson/index.html"]) {
  writeMd("thomson-home.md", pages["/on-the-trail-of-tom-thomson/index.html"]);
}
if (pages["/original-paintings/index.html"]) {
  writeMd("paintings-home.md", pages["/original-paintings/index.html"]);
}
if (pages["/prints/index.html"]) {
  writeMd("prints-home.md", pages["/prints/index.html"]);
}
if (pages["/contact-gene.html"]) {
  writeMd("contact.md", pages["/contact-gene.html"]);
}
if (pages["/on-the-trail-of-tom-thomson/videos-from-the-trail/index.html"]) {
  writeMd("videos.md", pages["/on-the-trail-of-tom-thomson/videos-from-the-trail/index.html"]);
}

fs.writeFileSync(
  path.join(OUT_DATA, "artworks.json"),
  JSON.stringify(uniqueArtworks, null, 2)
);
fs.writeFileSync(
  path.join(OUT_DATA, "photos.json"),
  JSON.stringify(photos, null, 2)
);
fs.writeFileSync(
  path.join(OUT_DATA, "galleries.json"),
  JSON.stringify(galleries, null, 2)
);
fs.writeFileSync(
  path.join(OUT_DATA, "pages.json"),
  JSON.stringify(pages, null, 2)
);
fs.writeFileSync(
  path.join(OUT_DATA, "urls.json"),
  JSON.stringify(urlList.sort(), null, 2)
);
fs.writeFileSync(
  path.join(OUT_DATA, "parseWarnings.json"),
  JSON.stringify(warnings, null, 2)
);
fs.writeFileSync(
  path.join(OUT_DATA, "wordAudit.json"),
  JSON.stringify(wordAudit, null, 2)
);

// Navigation structure
const navigation = {
  paintings: [
    { label: "African Wildlife", href: "/original-paintings/african-wildlife/" },
    { label: "North American Wildlife", href: "/original-paintings/north-american-wildlife/" },
    { label: "Various Paintings", href: "/original-paintings/various-paintings/" },
  ],
  thomson: [
    { label: "Project Overview", href: "/on-the-trail-of-tom-thomson/project-overview.html" },
    { label: "Spring", href: "/on-the-trail-of-tom-thomson/spring-season-paintings/", season: "spring" },
    { label: "Summer", href: "/on-the-trail-of-tom-thomson/summer-season-paintings/", season: "summer" },
    { label: "Fall", href: "/on-the-trail-of-tom-thomson/fall-season-paintings/", season: "fall" },
    { label: "Winter", href: "/on-the-trail-of-tom-thomson/winter-season-paintings/", season: "winter" },
    { label: "Studio paintings", href: "/on-the-trail-of-tom-thomson/studio-paintings/" },
    { label: "Photos from the Trail", href: "/on-the-trail-of-tom-thomson/photos-from-the-trail/" },
    { label: "Videos from the Trail", href: "/on-the-trail-of-tom-thomson/videos-from-the-trail/" },
  ],
};
fs.writeFileSync(
  path.join(OUT_DATA, "navigation.json"),
  JSON.stringify(navigation, null, 2)
);

console.log(`Extracted ${uniqueArtworks.length} artworks, ${photos.length} photos, ${galleries.length} galleries`);
console.log(`Narrative pages: ${Object.keys(pages).length}`);
console.log(`Parse warnings: ${warnings.length}`);
console.log(`URLs: ${urlList.length}`);
