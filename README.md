# genecanning.com

Static rebuild of [genecanning.com](https://www.genecanning.com) with the Gallery & Trail design. Built with [Eleventy](https://www.11ty.dev/), hosted on Netlify, contact form via Netlify Forms.

## Quick start

```bash
npm install
npm run extract   # re-parse the Sandvox mirror (optional)
npm run build
npm start         # local preview at http://localhost:8080
npm run qa        # confirm every mirror URL exists in _site
```

Mirror path used by the extract script: `/Users/matuskliment/www.genecanning.com`

## Connect to Netlify

1. Create a new Netlify site from this GitHub repo.
2. Build command: `npm run build` · Publish directory: `_site` (already in `netlify.toml`).
3. Domain: set **www.genecanning.com** as primary; redirect apex → www; enable HTTPS.
4. **Forms:** Site settings → Forms → Form notifications → email to `genecanning@hotmail.com`.
5. Submit a test message from `/contact-gene.html` and a painting enquiry; check Inbox **and Junk**.
6. After DNS cutover, submit `/sitemap.xml` in Google Search Console.

### Redirects

`public/_redirects` ships `/GeneCanning/* → /` (301) for the old iWeb URLs.

## Content

- Artwork and gallery data: `src/_data/artworks.json`, `galleries.json`, `photos.json`
- Narrative copy extracted to `src/_data/pages.json` (and Markdown snapshots in `src/content/`)
- Caption parse flags for review: `src/_data/parseWarnings.json`
- Homepage Recognition strip + teasers: `src/_data/homepage.json`
- Painting/photo originals for the build: `img-source/` (required on Netlify; Eleventy reads these before the local Sandvox mirror)

Re-run `npm run extract` after updating the mirror, then spot-check warnings. When new artworks are added, copy their source JPEGs into `img-source/` and commit them so Netlify builds keep working.

## Motion kit

`src/assets/gc-motion.css` and `src/assets/js/` come from the Oct 28 gc-kit (hero reveal, gallery filters, linen mats, pencil underlines, palette dabs). Compare markup to `.tmp-kit/examples/` locally. Run `npm run palettes` before build (also hooked into `npm run build`) to sample painting colours into `src/_data/palettes.json`.

Homepage hero photo: `siteImages.homeHero` (Gene painting in winter, fixed). “See what I painted here” picks a random landscape Tom Thomson painting (portrait files excluded); `heroRevealSlug` is the no-JS fallback.

## Notes for Mat

- Keep wording verbatim unless Gene approves changes.
- Signature in the header is a placeholder SVG until a scan arrives.
- Trail map, audio clips, and hi-res originals are Phase 2 / swap-in later.
- Typos in source captions and paths are preserved on purpose.
