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
2. `contact@example.com` in `about.html` and `privacy.html`.
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

## Updating later

Make your change and upload the whole folder again. Cloudflare and Netlify replace the old version and keep the domain.
