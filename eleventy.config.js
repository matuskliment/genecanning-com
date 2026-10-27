import path from "node:path";
import fs from "node:fs";
import Image from "@11ty/eleventy-img";
import markdownIt from "markdown-it";

const SITE_URL = "https://www.genecanning.com";
const MIRROR = "/Users/matuskliment/www.genecanning.com";

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
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ public: "." });


  eleventyConfig.addGlobalData("site", {
    url: SITE_URL,
    name: "Gene Canning",
    tagline: "Painter of the natural world",
    email: "genecanning@hotmail.com",
    location: "Peterborough, Ontario",
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

  eleventyConfig.addFilter("galleryByPath", (gals, p) =>
    (gals || []).find((g) => g.path === p)
  );

  eleventyConfig.addFilter("statusLabel", (art) => {
    if (!art) return "";
    const s = (art.status || "").toLowerCase();
    if (s === "sold") return "Sold";
    if (s === "private") return "Private Collection";
    if (s === "artist") return "Artist Collection";
    if (art.price) return `Available · $${Number(art.price).toLocaleString("en-CA")}`;
    if (s === "available") return "Available";
    return art.status || "";
  });

  eleventyConfig.addFilter("json", (obj) => JSON.stringify(obj));

  eleventyConfig.addFilter("slugFromPath", (p) => {
    if (!p) return "";
    return path.basename(p, ".html");
  });

  // Shortcode: responsive painting image
  eleventyConfig.addShortcode(
    "paintingImg",
    async function (src, alt, widths, sizes, attrs = "") {
      const source = resolveImageSource(src);
      if (!source) {
        return `<img alt="${alt || ""}" width="400" height="300" ${attrs}>`;
      }
      const w = widths || [400, 800, 1200, 1800, 2400];
      const metadata = await Image(source, {
        widths: w,
        formats: ["avif", "webp", "jpeg"],
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
        const w = widths || [400, 800, 1200, 1800, 2400];
        const metadata = await Image(source, {
          widths: w,
          formats: ["avif", "webp", "jpeg"],
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
          widths: [24, 400, 800],
          formats: ["avif", "webp", "jpeg"],
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
          widths: [1200, 1800, 2400],
          formats: ["avif", "webp", "jpeg"],
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
          widths: [4000],
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
