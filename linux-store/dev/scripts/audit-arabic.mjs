// Renders the Arabic storefront and lists visible text nodes that contain no
// Arabic letters (i.e. untranslated strings), grouped by page.
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const pages = ['/ar/', '/ar/collections/winter-collection', '/ar/products/hoodie-sada-black', '/ar/products/hoodie-customize', '/ar/pages/customize', '/ar/cart', '/ar/search?q=hoodie', '/ar/search?view=wishlist', '/ar/pages/about', '/ar/pages/contact', '/ar/blogs/news', '/ar/blogs/news/the-embroidery-issue', '/ar/account/login', '/ar/account/register', '/ar/account', '/ar/account/addresses', '/ar/account/orders/1001', '/ar/collections', '/ar/404', '/ar/password', '/ar/gift_cards/preview'];

const ARABIC = /[\u0600-\u06FF]/;
const strip = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ');

const seen = new Map();
for (const p of pages) {
  const res = await fetch(BASE + p, { headers: { Cookie: 'linux_dev_customer=1' } });
  const html = strip(await res.text());
  // text nodes + placeholder/aria-label/alt/title attributes
  const texts = [];
  for (const m of html.matchAll(/>([^<>]+)</g)) texts.push(m[1]);
  for (const m of html.matchAll(/(?:placeholder|aria-label|title|alt|data-label)="([^"]+)"/g)) texts.push(m[1]);
  for (let t of texts) {
    t = t.replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t || ARABIC.test(t)) continue;
    if (/^[\d\s.,:%+\-–—→←•·|/()×✓#@LE]+$/.test(t)) continue;           // numbers / prices / punctuation
    if (/^(LINUX|Shopify|WhatsApp|Instagram|Facebook|TikTok|EN|AR|EGP|LE|Egypt|Cairo|Apple Wallet)$/i.test(t)) continue; // brand names
    if (/^https?:|^\/|^#|^[a-z0-9_-]+@|^\+?\d/.test(t)) continue;
    if (/^(Hoodie|Anime|Sada|Shirt|Flower|Customize|Winter|Summer|Print|Embroidery|Beige|Black|White|Burgundy|Cream|Forest|Navy|M|L|XL|2XL|S|XS|Journal)\b/i.test(t) && t.split(' ').length <= 4) continue; // catalog data
    if (!seen.has(t)) seen.set(t, new Set());
    seen.get(t).add(p);
  }
}
const rows = [...seen.entries()].sort((a, b) => b[1].size - a[1].size);
for (const [t, ps] of rows) console.log(`${String(ps.size).padStart(2)}  ${t.slice(0, 90)}   ← ${[...ps][0]}`);
console.log(`\n${rows.length} untranslated strings`);
