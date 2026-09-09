// Crawls the Arabic storefront: every internal link must (a) return 200 and (b) stay in Arabic (/ar/ prefix).
const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const start = ['/ar/', '/ar/collections/winter-collection', '/ar/products/hoodie-sada-black', '/ar/pages/customize', '/ar/cart', '/ar/account/login', '/ar/search?q=hoodie'];
const seen = new Set();
const bad = [];
const queue = [...start];
while (queue.length && seen.size < 120) {
  const p = queue.shift();
  if (seen.has(p)) continue;
  seen.add(p);
  const res = await fetch(BASE + p, { redirect: 'manual' });
  const html = res.status === 200 ? await res.text() : '';
  if (res.status !== 200) { bad.push([p, 'HTTP ' + res.status + (res.headers.get('location') ? ' → ' + res.headers.get('location') : '')]); continue; }
  if (/Section .* error|Liquid error|translation missing/.test(html)) bad.push([p, 'render error/missing translation']);
  for (const m of html.matchAll(/href="([^"#]+)"/g)) {
    const h = m[1];
    if (/^(https?:|mailto:|tel:|javascript:)/.test(h) || h.startsWith('/assets/') || h.startsWith('/cdn')) continue;
    if (!h.startsWith('/')) continue;
    if (!h.startsWith('/ar')) { bad.push([p, 'link drops Arabic: ' + h]); continue; }
    if (!seen.has(h) && !queue.includes(h)) queue.push(h);
  }
}
const uniq = [...new Set(bad.map((b) => b.join('  |  ')))];
console.log(uniq.join('\n'));
console.log(`\n${seen.size} pages crawled, ${uniq.length} problems`);
