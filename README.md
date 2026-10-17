# DFMA Review Studio website

This folder is the whole website. It needs no server code. Upload the folder as it is to any static host.

## What is in it

| File or folder | What it is |
|---|---|
| `index.html` | The tool (DFM review, Drawing QC, tolerances, DFA, Cost and ROI, AI engineer) |
| `guides/` | 13 article pages plus an index. These are what search engines and AdSense read. |
| `about.html`, `privacy.html`, `terms.html` | Pages AdSense expects. The privacy and terms pages are templates; fill in the [brackets] and have them checked. |
| `ads.js` | All advertising settings in one file. Ads stay off until you switch them on here. |
| `ads.txt`, `robots.txt`, `sitemap.xml` | Files for AdSense and search engines. |
| `vendor/`, `engine.js`, `*-worker.js` | Libraries and the check engine. Do not rename. |
| `samples/demo_block.step` | The sample part behind the "Load a sample part" button. |

## Before you publish: replace these

1. `https://www.example.com` in `robots.txt`, `sitemap.xml` and every page's canonical link. Replace it with your domain using find and replace across the folder.
2. The contact email is set to shahidfardeen2204@gmail.com in `about.html`, `privacy.html` and the review form.
3. The [brackets] in `privacy.html` and `terms.html`.

## Launch steps

1. **Buy a domain.** AdSense only accepts a site on a domain you own; free subdomains such as `*.netlify.app` or `*.pages.dev` are not accepted. Cloudflare Registrar, Namecheap and similar sell `.com` names for roughly $10 to $15 a year.
2. **Host the folder for free.**
   - Cloudflare Pages: Workers & Pages > Create > Pages > Upload assets > drag this folder. Then Custom domains > add your domain.
   - Or Netlify: drag the folder onto app.netlify.com/drop, then Domain settings > add your domain.
   - HTTPS is switched on automatically by both.
3. **Search Console.** Add the domain at search.google.com/search-console, verify it, and submit `sitemap.xml`.
4. **Apply to AdSense** at adsense.google.com with the domain. You must be 18 or over. Add the site, paste the verification code AdSense gives you into `index.html` and `guides/index.html` if it asks for a meta tag, or rely on `ads.txt`.
5. **ads.txt.** Put your publisher ID (pub-…, without `ca-`) into `ads.txt` and upload again.
6. **Consent for European visitors.** In AdSense go to Privacy & messaging and switch on the European regulations message. Google requires a certified consent message for visitors from the EEA, the UK and Switzerland. Google's own message is free and certified.
7. **Switch the ads on after approval.** In AdSense create three display ad units: "in-article" and "bottom" (responsive) and "rail" (fixed size 160 × 600). Put the publisher ID and the three slot numbers into `ads.js`, set `enabled: true` and upload the folder again.

Where ads appear: in the empty lower part of the left menu on large screens (160 × 600), below the end of each tool page, and inside the guide articles. They never sit inside the 3D viewer, the findings, the drawing or any form, so the work area keeps its full size. On phones the menu ad is hidden. AdSense forbids placements that cause accidental clicks.

## Updating the site

Your site is the folder in your GitHub repo. Netlify (or GitHub Pages) rebuilds the live site every time the repo changes, usually within a minute.

**Option A, in the browser (no tools needed)**
1. Open the repo on github.com.
2. Click Add file > Upload files, drag in the changed files (or the whole unzipped folder), and click Commit changes.
3. Wait a minute and refresh your site. Press Ctrl+F5 if you still see the old version.

**Option B, with git on your computer**
```
git pull
# copy the new files over the old ones
git add -A
git commit -m "Update DFMA Review Studio"
git push
```

**Getting a change made**
Describe the change to Claude, download the new zip it gives you, and upload the files as above. Only the files that changed need to be uploaded, but uploading everything is always safe.

## Reviews and ratings

Reviews show on the home page as soon as they are sent. They are stored by a small Netlify Function (`netlify/functions/reviews.mjs`) in Netlify Blobs, Netlify's built-in storage. There is no database to run and it is free at this size. Each review is also emailed to shahidfardeen2204@gmail.com through FormSubmit.

**Setup, once**
1. **Deploy from GitHub.** The site must be connected to your GitHub repo in Netlify (Site configuration > Build & deploy shows the repo). Drag-and-drop deploys do not run functions.
2. **Keep these files in the repo root** next to `index.html`: `netlify/` (folder), `netlify.toml`, `package.json`. Netlify installs the one dependency (`@netlify/blobs`) and builds the function on every push.
3. **Set an admin key.** In Netlify go to Site configuration > Environment variables > Add a variable. Key: `ADMIN_KEY`. Value: a long password only you know. Then Deploys > Trigger deploy > Deploy site.
4. **Activate FormSubmit** for the email copies: send one review, open the "Activate" email from FormSubmit (check Spam), and click the link.

**Moderating**
Open `https://dfmareviewstudio.netlify.app/admin-reviews.html`, enter your admin key, and click Hide on any spam. Hidden reviews disappear from the home page at once and can be shown again. Search engines are told not to index that page.

**How it protects itself**
- Ratings must be 1 to 5 and reviews at least 5 characters. Names and roles are capped at 60 characters, and reviews at 2,000.
- One review per visitor per minute, and a hidden field that catches simple bots.
- Visitors who untick "You may show my review" are stored as private. You see them in the admin page and the email, but the public never does.

**Other hosts**
If the function is not available (GitHub Pages, or the preview inside Claude), the page falls back to `reviews.json` for display and to email for sending, as before.
