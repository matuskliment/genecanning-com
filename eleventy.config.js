import path from "node:path";
import fs from "node:fs";
import Image from "@11ty/eleventy-img";
import markdownIt from "markdown-it";

const SITE_URL = "https://www.genecanning.com";
const MIRROR = "/Users/matuskliment/www.genecanning.com";

/** Netlify cold builds time out if we encode AVIF + 2400/4000px for every painting. */
const ON_NETLIFY = Boolean(process.env.NETLIFY);
const RESPONSIVE_FORMATS = ON_NETLIFY
  ? ["webp", "jpeg"]
  : ["avif", "webp", "jpeg"];
const DISPLAY_WIDTHS = ON_NETLIFY ? [1200, 1800] : [1200, 1800, 2400];
const DEFAULT_WIDTHS = ON_NETLIFY
  ? [400, 800, 1200, 1800]
  : [400, 800, 1200, 1800, 2400];
const ZOOM_WIDTH = ON_NETLIFY ? 2400 : 4000;
const THUMB_WIDTHS = ON_NETLIFY ? [400, 800] : [24, 400, 800];

/** Resolve best source image path under mirror _Media or img-source */
export function resolveImageSource(filename) {
  if (!filename) return null;
  const candidates = [
    path.join("img-source", filename),
    path.join(MIRROR, "_Media", filename),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Try without path prefixes if already absolute-ish
  if (fs.existsSync(filename)) return filename;
  return null;
}

export default async function (eleventyConfig) {
  eleventyConfig.ignores.add("src/content/**");
  eleventyConfig.watchIgnores.add("_site/**");
  eleventyConfig.watchIgnores.add("node_modules/**");
  eleventyConfig.watchIgnores.add(".git/**");
  eleventyConfig.watchIgnores.add(".cache/**");
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ public: "." });


  eleventyConfig.addGlobalData("site", {
    url: SITE_URL,
    name: "Gene Canning",
    tagline: "Painter of the natural world",
    email: "genecanning@hotmail.com",
    location: "Peterborough, Ontario",
    year: new Date().getFullYear(),
  });

  const md = markdownIt({ html: true, breaks: false, linkify: true });
  eleventyConfig.setLibrary("md", md);
  eleventyConfig.addFilter("markdown", (str) => (str ? md.render(str) : ""));
  eleventyConfig.addFilter("markdownInline", (str) =>
    str ? md.renderInline(str) : ""
  );

  eleventyConfig.addFilter("absoluteUrl", (url) => {
    if (!url) return SITE_URL;
    if (url.startsWith("http")) return url;
    return SITE_URL + (url.startsWith("/") ? url : `/${url}`);
  });

  eleventyConfig.addFilter("formatPrice", (n) => {
    if (n == null || n === "") return "";
    const num = Number(n);
    if (Number.isNaN(num)) return String(n);
    return `$${num.toLocaleString("en-CA")}`;
  });

  eleventyConfig.addFilter("inchSize", (h, w) => {
    // Display as height × width (matching original captions)
    if (!w || !h) return "";
    return `${h}″ × ${w}″`;
  });

  eleventyConfig.addFilter("sizeLabel", (art) => {
    if (!art || !art.widthIn || !art.heightIn) return "";
    return `${art.heightIn}″ × ${art.widthIn}″`;
  });

  eleventyConfig.addFilter("ratio", (art) => {
    if (!art || !art.widthIn || !art.heightIn) return "4/3";
    return `${art.widthIn}/${art.heightIn}`;
  });

  eleventyConfig.addFilter("metaLine", (art) => {
    if (!art) return "";
    const bits = [];
    if (art.medium) bits.push(art.medium);
    if (art.heightIn && art.widthIn)
      bits.push(`${art.heightIn}″ × ${art.widthIn}″`);
    if (art.edition) bits.push(art.edition);
    return bits.join(" · ");
  });

  eleventyConfig.addFilter("artAlt", (art) => {
    if (!art) return "";
    const bits = [art.title];
    if (art.medium) bits.push(art.medium);
    if (art.kind === "photo") return art.title;
    return bits.join(", ");
  });

  eleventyConfig.addFilter("bySeries", (arts, series) =>
    (arts || []).filter((a) => a.series === series)
  );

  eleventyConfig.addFilter("findBySlug", (arts, slug) =>
    (arts || []).find((a) => a.slug === slug) || null
  );

  eleventyConfig.addFilter("galleryByPath", (gals, p) =>
    (gals || []).find((g) => g.path === p)
  );

  function statusLabel(art) {
    if (!art) return "";
    if (art.kind === "photo") return "";
    const s = (art.status || "").toLowerCase();
    if (s === "sold") return "Sold";
    if (s === "private") return "Private Collection";
    if (s === "artist") return "Artist Collection";
    if (art.price)
      return `Available · $${Number(art.price).toLocaleString("en-CA")}`;
    if (s === "available") return "Available";
    return art.status || "";
  }

  function metaLine(art) {
    if (!art) return "";
    const bits = [];
    if (art.medium) bits.push(art.medium);
    if (art.heightIn && art.widthIn)
      bits.push(`${art.heightIn}″ × ${art.widthIn}″`);
    if (art.edition) bits.push(art.edition);
    return bits.join(" · ");
  }

  function artAlt(art) {
    if (!art) return "";
    if (art.kind === "photo") return art.title;
    const bits = [art.title];
    if (art.medium) bits.push(art.medium);
    return bits.join(", ");
  }

  function artRatio(art) {
    if (!art || !art.widthIn || !art.heightIn) return "4/3";
    return `${art.widthIn}/${art.heightIn}`;
  }

  function escapeAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  async function buildThumbHtml(src, alt, eager) {
    const fallback = `<span class="gc-img"><img alt="${escapeAttr(alt)}" width="400" height="300"></span>`;
    const source = resolveImageSource(src);
    if (!source) return fallback;
    try {
      const metadata = await Image(source, {
        widths: [400, 800],
        formats: RESPONSIVE_FORMATS,
        outputDir: "_site/img",
        urlPath: "/img/",
      });
      const jpeg = metadata.jpeg || [];
      const webp = metadata.webp || [];
      const avif = metadata.avif || [];
      const primary = jpeg[jpeg.length - 1] || jpeg[0];
      if (!primary?.url) return fallback;
      const loading = eager
        ? 'loading="eager" fetchpriority="high"'
        : 'loading="lazy"';
      const srcset = (arr) =>
        arr.map((i) => `${i.url} ${i.width}w`).join(", ");
      let html = `<span class="gc-img" style="--gc-lqip-color:#D8D0BF"><picture>`;
      if (avif.length)
        html += `<source type="image/avif" srcset="${srcset(avif)}" sizes="(min-width: 700px) 33vw, 100vw">`;
      if (webp.length)
        html += `<source type="image/webp" srcset="${srcset(webp)}" sizes="(min-width: 700px) 33vw, 100vw">`;
      html += `<img src="${primary.url}" srcset="${srcset(jpeg)}" sizes="(min-width: 700px) 33vw, 100vw" width="${primary.width}" height="${primary.height}" alt="${escapeAttr(alt)}" ${loading} decoding="async" data-gc-fade>`;
      html += `</picture></span>`;
      return html;
    } catch {
      return fallback;
    }
  }

  eleventyConfig.addFilter("statusLabel", statusLabel);

  eleventyConfig.addFilter("json", (obj) => JSON.stringify(obj));

  /** Link bare “contact us” phrases in gallery notes to the contact page */
  eleventyConfig.addFilter("linkContactUs", (str) => {
    if (!str) return "";
    return String(str).replace(
      /\b(contact us)\b/gi,
      '<a href="/contact-gene.html">$1</a>'
    );
  });

  eleventyConfig.addFilter("galleryIntroParas", (page) => {
    if (!page?.paragraphs) return [];
    const skip = new Set(["contact gene", "prints", "original paintings"]);
    return page.paragraphs.filter((p) => {
      const t = String(p || "").trim();
      if (!t || t.length < 40) return false;
      if (skip.has(t.toLowerCase())) return false;
      return true;
    });
  });


  eleventyConfig.addFilter("slugFromPath", (p) => {
    if (!p) return "";
    return path.basename(p, ".html");
  });

  function mediumKeyFrom(medium) {
    if (!medium) return "";
    const m = String(medium).toLowerCase();
    if (/\boil\b/.test(m)) return "oil";
    if (/\bacrylic\b/.test(m)) return "acrylic";
    if (/\bgraphite\b/.test(m)) return "graphite";
    return "";
  }

  eleventyConfig.addFilter("mediumKey", (artOrMedium) => {
    if (!artOrMedium) return "";
    if (typeof artOrMedium === "string") return mediumKeyFrom(artOrMedium);
    return artOrMedium.mediumKey || mediumKeyFrom(artOrMedium.medium);
  });

  // Async shortcode — safe in loops (unlike async filters inside {% include %})
  eleventyConfig.addNunjucksAsyncShortcode(
    "galleryCard",
    async function (art, eager = false) {
      if (!art) return "";
      const isPhoto = art.kind === "photo";
      const statusText = isPhoto ? "" : statusLabel(art);
      const alt = artAlt(art);
      const meta = metaLine(art);
      const ratio = artRatio(art);
      const thumb = await buildThumbHtml(art.image, alt, Boolean(eager));
      const statusKey = isPhoto ? "" : (art.status || "").toLowerCase();
      const mediumKey = art.mediumKey || mediumKeyFrom(art.medium);

      let fullUrl = "";
      let fullSrcset = "";
      const source = resolveImageSource(art.image);
      if (source) {
        try {
          const fullMeta = await Image(source, {
            widths: DISPLAY_WIDTHS,
            formats: ["jpeg"],
            outputDir: "_site/img",
            urlPath: "/img/",
          });
          const jpegs = fullMeta.jpeg || [];
          fullUrl = jpegs[jpegs.length - 1]?.url || jpegs[0]?.url || "";
          fullSrcset = jpegs.map((i) => `${i.url} ${i.width}w`).join(", ");
        } catch {
          fullUrl = "";
        }
      }

      const soldAttr = art.status === "sold" ? " data-gc-sold" : "";
      const statusHtml =
        art.status === "sold"
          ? `<span class="gc-sold">Sold</span>`
          : statusText
            ? `<span class="status">${escapeAttr(statusText)}</span>`
            : "";
      const mediumHtml = art.medium
        ? `<span class="meta">${escapeAttr(art.medium)}</span>`
        : "";
      const enquire = isPhoto ? "" : `${art.oldPath}#enquire`;
      const dataStatus = statusKey
        ? ` data-status="${escapeAttr(statusKey)}"`
        : "";
      const dataMedium = mediumKey
        ? ` data-medium="${escapeAttr(mediumKey)}"`
        : "";
      const srcsetAttr = fullSrcset
        ? `\n   data-gc-full-srcset="${escapeAttr(fullSrcset)}"`
        : "";
      const matClass = isPhoto ? "gc-photo" : "gc-mat";

      return `<a class="gc-card"
   data-gc-item
   href="${escapeAttr(art.oldPath)}"${soldAttr}${dataStatus}${dataMedium}
   data-gc-full="${escapeAttr(fullUrl)}"${srcsetAttr}
   data-gc-ratio="${escapeAttr(ratio)}"
   data-gc-title="${escapeAttr(art.title)}"
   data-gc-meta="${escapeAttr(meta)}"
   data-gc-status="${escapeAttr(statusText)}"
   data-gc-enquire="${escapeAttr(enquire)}">
  <span class="${matClass}">${thumb}</span>
  <span class="gc-title">${escapeAttr(art.title)}</span>
  ${mediumHtml}
  ${statusHtml}
</a>`;
    }
  );

  eleventyConfig.addNunjucksAsyncShortcode(
    "heroPhoto",
    async function (src, alt) {
      const source = resolveImageSource(src);
      if (!source) {
        return `<img class="gc-hero-photo" alt="${escapeAttr(alt)}" width="1600" height="800" fetchpriority="high">`;
      }
      try {
        const metadata = await Image(source, {
          widths: [1200, 1600, 2400],
          formats: ["jpeg", "webp"],
          outputDir: "_site/img",
          urlPath: "/img/",
        });
        const jpeg = metadata.jpeg || [];
        const primary = jpeg.find((i) => i.width >= 1600) || jpeg[jpeg.length - 1] || jpeg[0];
        const srcset = jpeg.map((i) => `${i.url} ${i.width}w`).join(", ");
        return `<img class="gc-hero-photo" src="${primary.url}" srcset="${srcset}" sizes="(min-width: 1200px) 1200px, 100vw" width="${primary.width}" height="${primary.height}" alt="${escapeAttr(alt)}" fetchpriority="high" decoding="async">`;
      } catch {
        return `<img class="gc-hero-photo" alt="${escapeAttr(alt)}" width="1600" height="800" fetchpriority="high">`;
      }
    }
  );

  eleventyConfig.addNunjucksAsyncShortcode(
    "heroRevealImg",
    async function (art) {
      if (!art) return "";
      const source = resolveImageSource(art.image);
      let url = "";
      let w = 800;
      let h = 640;
      if (source) {
        try {
          const metadata = await Image(source, {
            widths: [1200],
            formats: ["jpeg"],
            outputDir: "_site/img",
            urlPath: "/img/",
          });
          const jpeg = metadata.jpeg?.[0];
          if (jpeg) {
            url = jpeg.url;
            w = jpeg.width;
            h = jpeg.height;
          }
        } catch {
          /* ignore */
        }
      }
      if (!url) return "";
      const alt = escapeAttr(artAlt(art));
      return `<div class="gc-hero-painting" hidden>
        <img data-src="${escapeAttr(url)}" width="${w}" height="${h}" alt="${alt}">
        <p class="gc-hero-caption"><a href="${escapeAttr(art.oldPath)}">${escapeAttr(art.title)}</a> · painted here</p>
      </div>`;
    }
  );

  /**
   * Landscape Tom Thomson paintings for the homepage reveal pool.
   * Skips portrait files — the hang UI is sized for ~10×8 landscape boards.
   */
  eleventyConfig.addNunjucksAsyncShortcode(
    "heroRevealPoolJson",
    async function (artworks) {
      const thomson = new Set([
        "spring-season-paintings",
        "summer-season-paintings",
        "fall-season-paintings",
        "winter-season-paintings",
        "studio-paintings",
      ]);
      const arts = (Array.isArray(artworks) ? artworks : []).filter(
        (a) => a && a.kind !== "photo" && thomson.has(a.series)
      );
      const out = [];
      const seen = new Set();
      for (const art of arts) {
        if (!art.image || seen.has(art.image)) continue;
        const source = resolveImageSource(art.image);
        if (!source) continue;
        try {
          const metadata = await Image(source, {
            widths: [1200],
            formats: ["jpeg"],
            outputDir: "_site/img",
            urlPath: "/img/",
          });
          const jpeg = metadata.jpeg?.[0];
          if (!jpeg || jpeg.width / jpeg.height < 1.1) continue;
          seen.add(art.image);
          out.push({
            src: jpeg.url,
            w: jpeg.width,
            h: jpeg.height,
            alt: artAlt(art),
            title: art.title,
            href: art.oldPath,
          });
        } catch {
          /* ignore */
        }
      }
      return JSON.stringify(out).replace(/</g, "\\u003c");
    }
  );

  /**
   * Landscape Tom Thomson paintings for the homepage reveal pool.
   * Only landscape files (w/h ≥ 1.1) so they hang correctly on the wide wall.
   */
  eleventyConfig.addNunjucksAsyncShortcode(
    "heroRevealPaintingsJson",
    async function (artworks) {
      const thomson = new Set([
        "spring-season-paintings",
        "summer-season-paintings",
        "fall-season-paintings",
        "winter-season-paintings",
        "studio-paintings",
      ]);
      const arts = (Array.isArray(artworks) ? artworks : []).filter(
        (a) => a && a.kind !== "photo" && thomson.has(a.series)
      );
      const seen = new Set();
      const out = [];
      for (const art of arts) {
        const source = resolveImageSource(art.image);
        if (!source) continue;
        try {
          const metadata = await Image(source, {
            widths: [1200],
            formats: ["jpeg"],
            outputDir: "_site/img",
            urlPath: "/img/",
          });
          const jpeg = metadata.jpeg?.[0];
          if (!jpeg) continue;
          if (jpeg.width / jpeg.height < 1.1) continue;
          if (seen.has(jpeg.url)) continue;
          seen.add(jpeg.url);
          out.push({
            src: jpeg.url,
            w: jpeg.width,
            h: jpeg.height,
            alt: artAlt(art),
            title: art.title,
            href: art.oldPath,
          });
        } catch {
          /* ignore */
        }
      }
      return JSON.stringify(out).replace(/</g, "\\u003c");
    }
  );

  // Shortcode: responsive painting image
  eleventyConfig.addShortcode(
    "paintingImg",
    async function (src, alt, widths, sizes, attrs = "") {
      const source = resolveImageSource(src);
      if (!source) {
        return `<img alt="${alt || ""}" width="400" height="300" ${attrs}>`;
      }
      const w = widths || DEFAULT_WIDTHS;
      const metadata = await Image(source, {
        widths: w,
        formats: RESPONSIVE_FORMATS,
        outputDir: "_site/img",
        urlPath: "/img/",
        sharpOptions: { sequentialRead: true },
        transformOnRequest: false,
      });
      return Image.generateHTML(metadata, {
        alt: alt || "",
        sizes: sizes || "(min-width: 700px) 33vw, 100vw",
        loading: attrs.includes("fetchpriority") ? "eager" : "lazy",
        decoding: "async",
      }).replace("<img ", `<img data-gc-fade ${attrs} `);
    }
  );

  // Filter to get image metadata for templates needing srcset / dimensions
  eleventyConfig.addNunjucksAsyncFilter(
    "imgMeta",
    async function (src, widths, callback) {
      try {
        const source = resolveImageSource(src);
        if (!source) return callback(null, null);
        const w = widths || DEFAULT_WIDTHS;
        const metadata = await Image(source, {
          widths: w,
          formats: RESPONSIVE_FORMATS,
          outputDir: "_site/img",
          urlPath: "/img/",
        });
        callback(null, metadata);
      } catch (err) {
        callback(err);
      }
    }
  );

  eleventyConfig.addNunjucksAsyncFilter(
    "thumbImg",
    async function (src, alt, eager, callback) {
      try {
        const source = resolveImageSource(src);
        if (!source) {
          return callback(
            null,
            `<span class="gc-img"><img alt="${alt || ""}" width="400" height="300"></span>`
          );
        }
        const metadata = await Image(source, {
          widths: THUMB_WIDTHS,
          formats: RESPONSIVE_FORMATS,
          outputDir: "_site/img",
          urlPath: "/img/",
        });
        const low = metadata.jpeg?.[0];
        const jpeg = metadata.jpeg?.filter((i) => i.width >= 400) || [];
        const webp = metadata.webp?.filter((i) => i.width >= 400) || [];
        const avif = metadata.avif?.filter((i) => i.width >= 400) || [];
        const primary = jpeg[jpeg.length - 1] || jpeg[0];
        const lqip = low
          ? `style="--gc-lqip-color:#D8D0BF"`
          : `style="--gc-lqip-color:#D8D0BF"`;
        const loading = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
        const srcset = (arr) =>
          arr.map((i) => `${i.url} ${i.width}w`).join(", ");
        let html = `<span class="gc-img" ${lqip}><picture>`;
        if (avif.length)
          html += `<source type="image/avif" srcset="${srcset(avif)}" sizes="(min-width: 700px) 33vw, 100vw">`;
        if (webp.length)
          html += `<source type="image/webp" srcset="${srcset(webp)}" sizes="(min-width: 700px) 33vw, 100vw">`;
        html += `<img src="${primary.url}" srcset="${srcset(jpeg)}" sizes="(min-width: 700px) 33vw, 100vw" width="${primary.width}" height="${primary.height}" alt="${alt || ""}" ${loading} decoding="async" data-gc-fade>`;
        html += `</picture></span>`;
        callback(null, html);
      } catch (err) {
        callback(err);
      }
    }
  );

  eleventyConfig.addNunjucksAsyncFilter(
    "displayImg",
    async function (src, alt, callback) {
      try {
        const source = resolveImageSource(src);
        if (!source) {
          return callback(
            null,
            `<span class="gc-img"><img alt="${alt || ""}" width="1200" height="800"></span>`
          );
        }
        const metadata = await Image(source, {
          widths: DISPLAY_WIDTHS,
          formats: RESPONSIVE_FORMATS,
          outputDir: "_site/img",
          urlPath: "/img/",
        });
        const jpeg = metadata.jpeg || [];
        const webp = metadata.webp || [];
        const avif = metadata.avif || [];
        const primary = jpeg[jpeg.length - 1] || jpeg[0];
        const srcset = (arr) =>
          arr.map((i) => `${i.url} ${i.width}w`).join(", ");
        let html = `<span class="gc-img" style="--gc-lqip-color:#D8D0BF"><picture>`;
        if (avif.length)
          html += `<source type="image/avif" srcset="${srcset(avif)}" sizes="(min-width: 700px) 70vw, 100vw">`;
        if (webp.length)
          html += `<source type="image/webp" srcset="${srcset(webp)}" sizes="(min-width: 700px) 70vw, 100vw">`;
        html += `<img src="${primary.url}" srcset="${srcset(jpeg)}" sizes="(min-width: 700px) 70vw, 100vw" width="${primary.width}" height="${primary.height}" alt="${alt || ""}" fetchpriority="high" decoding="async" data-gc-fade>`;
        html += `</picture></span>`;
        callback(null, html);
      } catch (err) {
        callback(err);
      }
    }
  );

  eleventyConfig.addNunjucksAsyncFilter(
    "fullJpegUrl",
    async function (src, callback) {
      try {
        const source = resolveImageSource(src);
        if (!source) return callback(null, "");
        const metadata = await Image(source, {
          widths: [1800],
          formats: ["jpeg"],
          outputDir: "_site/img",
          urlPath: "/img/",
        });
        callback(null, metadata.jpeg?.[0]?.url || "");
      } catch (err) {
        callback(err);
      }
    }
  );

  eleventyConfig.addNunjucksAsyncFilter(
    "zoomJpegUrl",
    async function (src, callback) {
      try {
        const source = resolveImageSource(src);
        if (!source) return callback(null, "");
        const metadata = await Image(source, {
          widths: [ZOOM_WIDTH],
          formats: ["jpeg"],
          outputDir: "_site/img",
          urlPath: "/img/",
          sharpJpegOptions: { quality: 85 },
        });
        // If source smaller than 4000, eleventy-img returns actual width
        const last = metadata.jpeg?.[metadata.jpeg.length - 1];
        callback(null, last?.url || "");
      } catch (err) {
        callback(err);
      }
    }
  );

  eleventyConfig.addNunjucksAsyncFilter(
    "ogImageUrl",
    async function (src, callback) {
      try {
        const source = resolveImageSource(src);
        if (!source) return callback(null, "");
        const metadata = await Image(source, {
          widths: [1200],
          formats: ["jpeg"],
          outputDir: "_site/img",
          urlPath: "/img/",
        });
        const url = metadata.jpeg?.[0]?.url || "";
        callback(null, url ? SITE_URL + url : "");
      } catch (err) {
        callback(err);
      }
    }
  );

  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data",
      output: "_site",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  };
}
