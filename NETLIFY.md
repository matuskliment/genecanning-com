# Connect this repo to Netlify

Repo: https://github.com/matuskliment/genecanning-com

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project** → GitHub → `genecanning-com`.
2. Build settings (from `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `_site`
   - **Node:** 20
3. Deploy the site. Open the Netlify preview URL and spot-check home, a gallery, a painting, and Contact.
4. **Forms:** Site configuration → Forms → Form notifications → Email notification to `genecanning@hotmail.com`.
5. Send a test from `/contact-gene.html` and from a painting page enquiry. Confirm delivery in Hotmail Inbox **and Junk**.
6. **Domain:** Add `www.genecanning.com` as primary; redirect apex `genecanning.com` → www; wait for HTTPS.
7. After go-live, submit `https://www.genecanning.com/sitemap.xml` in Google Search Console.

Form fields posted: `name`, `email`, `message`, optional `painting-url` / `painting-title`, honeypot `bot-field`.
