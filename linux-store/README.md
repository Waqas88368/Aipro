# LINUX — Liquid Glass Shopify theme

Custom Shopify Online Store 2.0 theme for [linux-eg.com](https://linux-eg.com), built in
the Apple iOS 26 "Liquid Glass" language: fully rounded glass panes, the LINUX
forest/cream/lime palette, the penguin mascot woven through the pages, and a
macro embroidery video as the hero. English + Egyptian Arabic (RTL).

```
linux-store/
├── theme/   ← the Shopify theme (upload this)
├── dist/    ← packaged zip (node dev/package.mjs)
└── dev/     ← local preview harness + checks (not part of the theme)
```

## Install on Shopify

1. Package: `cd linux-store/dev && npm install && node package.mjs`
   → `linux-store/dist/linux-liquid-glass-theme.zip`
2. Shopify admin → **Online Store → Themes → Add theme → Upload zip file**.
3. **Customize** the new theme (it stays unpublished until you click Publish):
   - **Theme settings → Brand**: nothing to do — colours, glass strength,
     corner radius and motion are already tuned. `Use system fonts` removes
     the Google Fonts request if you prefer.
   - **Theme settings → Store**: WhatsApp number, Instagram/Facebook/TikTok
     URLs, free-shipping threshold (LE), delivery estimates.
   - **Header**: the menu uses your existing `main-menu`; the mega-menu images
     come from the collections' own images.
   - **Home**: every section is a block you can reorder. Pick the collections
     for *Most wanted* / *Shop by drop* / *Fresh off the machine*, and place
     the two *Shop the look* hotspots on your photo.
   - **Customize studio** (`/pages/customize`): create a page with the
     **page.customize** template and point the section at your *Hoodie
     Customize* product. Its variants (colour / size / print-or-embroidery)
     drive the price; the shopper's artwork arrives on the order as a
     line-item file property plus position/scale metadata.
4. Languages: **Settings → Languages → Add Arabic → Publish**. The theme ships
   full `ar.json` strings and flips to RTL automatically.
5. Publish.

## What's inside

| Area | Notes |
| --- | --- |
| `assets/glass.css` | Design tokens, glass material (regular / clear / solid), atmosphere, buttons, pills, swatches, forms |
| `assets/components.css` | Header + mega menu, hero, marquee, cards, rails, bento, drawers, footer, search, tab bar, toasts |
| `assets/*.js` | Vanilla, dependency-free: AJAX cart + section rendering, predictive search (with Arabic term mapping), wishlist (localStorage), product variants/gallery/sticky ATC/quick view, Customize studio |
| `sections/` | 40 sections incl. all `main-*` templates, hero video, bento collections, campaign, shop-the-look hotspots, testimonials, FAQ, newsletter, penguin row |
| `templates/` | JSON templates for every Shopify template type, plus `password` and `gift_card` |
| `locales/` | `en.default.json`, `ar.json` (Egyptian tone) |
| Hero video | `hero-embroidery-1080.mp4` (4.9 MB) / `-720.mp4` / poster, cut from the brand's own embroidery footage with a seamless loop |

## Local preview (no Shopify account needed)

```
cd linux-store/dev && npm install && node server.mjs   # http://localhost:3000
```

`dev/server.mjs` is a LiquidJS-based emulation of Shopify's Liquid objects,
`{% form %}`/`{% paginate %}`/`{% section %}` tags, ~60 filters, the AJAX Cart
and Section Rendering APIs and predictive search, seeded with a snapshot of the
live catalog (`dev/data/*.json`). It is a best-effort stand-in: always sanity
check on a real Shopify preview theme before publishing.

- `/ar/...` renders the Arabic/RTL storefront.
- `/__device?a=/&b=/products/x&c=/collections/y` shows three phone frames;
  add `&desktop=1` for a 1280px frame.
- `node check.mjs` runs Shopify's official theme-check (must be 0 errors).
