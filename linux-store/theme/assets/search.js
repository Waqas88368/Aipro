/* LINUX — predictive search via /search/suggest.json */
(function () {
  'use strict';
  const L = window.LINUX;
  const S = L.settings || {};
  const root = S.root && S.root !== '/' ? S.root.replace(/\/$/, '') : '';
  const wrap = document.querySelector('[data-search]');
  if (!wrap) return;
  const input = wrap.querySelector('[data-search-input]');
  const results = wrap.querySelector('[data-search-results]');
  const initial = results.innerHTML;
  const strings = L.strings || {};
  let controller = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (v) => L.money(Math.round(Number(v) * 100));
  const thumb = (url) => (url && url.includes('cdn.shopify.com') ? url.replace(/(\.[a-z]+)(\?|$)/, '_400x$1$2') : url);

  async function search(q) {
    if (!q || q.trim().length < 2) { results.innerHTML = initial; return; }
    if (controller) controller.abort();
    controller = new AbortController();
    const url = `${root}/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product,collection,page,article&resources[limit]=8&resources[options][unavailable_products]=last&resources[options][fields]=title,product_type,variants.title,vendor,tag`;
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const data = await res.json();
      render(data.resources?.results || {}, q);
    } catch (e) { if (e.name !== 'AbortError') console.error('[search]', e); }
  }

  function render(r, q) {
    const products = r.products || [];
    const collections = r.collections || [];
    const pages = [...(r.pages || []), ...(r.articles || [])];
    if (!products.length && !collections.length && !pages.length) {
      results.innerHTML = `<div class="search-empty"><img src="${wrap.dataset.emptyImg || ''}" alt="" hidden><p>${esc(strings.no_results)}</p><a class="btn btn--glass btn--sm" href="${root}/search?q=${encodeURIComponent(q)}">${esc(q)} →</a></div>`;
      return;
    }
    let html = '';
    if (products.length) {
      html += `<section class="search-group"><p class="search-group__title">${esc(strings.products)}</p><div class="search-products">` + products.map((p) => {
        const img = p.featured_image ? thumb(p.featured_image.url) : (p.image ? thumb(p.image) : '');
        const sale = p.compare_at_price_min && Number(p.compare_at_price_min) > Number(p.price);
        return `<a class="search-product" href="${p.url}">${img ? `<img src="${img}" alt="" loading="lazy" width="200" height="266">` : ''}<strong>${esc(p.title)}</strong><span class="price"><span class="price__current${sale ? ' price__sale' : ''}">${money(p.price)}</span>${sale ? `<s class="price__compare">${money(p.compare_at_price_min)}</s>` : ''}</span></a>`;
      }).join('') + '</div></section>';
    }
    if (collections.length || pages.length) {
      html += `<section class="search-group"><p class="search-group__title">${esc(strings.collections)} · ${esc(strings.pages)}</p><div class="search-links">` +
        collections.map((c) => `<a class="chip" href="${c.url}">${esc(c.title)}</a>`).join('') +
        pages.map((p) => `<a class="chip" href="${p.url}">${esc(p.title)}</a>`).join('') + '</div></section>';
    }
    html += `<a class="btn btn--ghost btn--sm" href="${root}/search?q=${encodeURIComponent(q)}" style="justify-self:center">${esc(q)} — ${esc(strings.products)} →</a>`;
    results.innerHTML = html;
  }

  input.addEventListener('input', L.debounce((e) => search(e.target.value), 180));
  wrap.addEventListener('click', (e) => {
    const s = e.target.closest('[data-search-suggest]');
    if (s) { input.value = s.dataset.searchSuggest; input.focus(); search(input.value); }
  });
  // "/" opens search anywhere
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); L.drawers && L.drawers.open('search'); }
  });
})();
