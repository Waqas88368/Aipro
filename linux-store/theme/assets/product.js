/* LINUX — product page & quick view: variant resolution, gallery, sticky bar,
   lightbox, recommendations, recently viewed. Also powers the quick-view modal
   (same markup, rendered via ?section_id=main-product). */
(function () {
  'use strict';
  const L = window.LINUX;
  const S = L.settings || {};
  const root = S.root && S.root !== '/' ? S.root.replace(/\/$/, '') : '';

  /* ------------------------------------------------------------------ */
  /* Product controller — one per [data-product]                         */
  /* ------------------------------------------------------------------ */
  function initProduct(rootEl) {
    if (!rootEl || rootEl.dataset.ready) return;
    rootEl.dataset.ready = '1';
    const variants = JSON.parse(rootEl.querySelector('[data-variants]')?.textContent || '[]');
    const meta = JSON.parse(rootEl.querySelector('[data-product-json]')?.textContent || '{}');
    const form = rootEl.querySelector('[data-product-form]');
    const optionLabels = JSON.parse(rootEl.querySelector('[data-option-labels]')?.textContent || '{}');
    if (!form || !variants.length) return;
    if (rootEl.hasAttribute('data-customize')) return; // the studio owns its own variant/price logic
    const idInput = form.querySelector('[data-variant-id]');
    const atc = form.querySelector('[data-atc]');
    const atcText = form.querySelector('[data-atc-text]');
    const atcPrice = form.querySelector('[data-atc-price]');
    const priceWrap = rootEl.querySelector('[data-price-wrap]');
    const stock = rootEl.querySelector('[data-stock]');
    const optionCount = variants[0].options.length;

    function selected() {
      const opts = [];
      for (let i = 0; i < optionCount; i++) {
        const checked = form.querySelector(`[data-option-input="${i}"]:checked`);
        opts.push(checked ? checked.value : null);
      }
      return opts;
    }
    function find(opts) { return variants.find((v) => v.options.every((o, i) => o === opts[i])); }

    function paintAvailability(opts) {
      // A pill is disabled when no available variant matches it + the other current selections
      for (let i = 0; i < optionCount; i++) {
        form.querySelectorAll(`[data-option-input="${i}"]`).forEach((input) => {
          const trial = opts.slice(); trial[i] = input.value;
          const exists = variants.some((v) => v.options.every((o, j) => j === i || o === trial[j]) && v.options[i] === input.value);
          const avail = variants.some((v) => v.available && v.options.every((o, j) => o === trial[j]));
          const pill = input.closest('.pill');
          pill.classList.toggle('is-disabled', exists && !avail);
          pill.classList.toggle('is-missing', !exists);
        });
      }
    }

    function update(pushState = true) {
      const opts = selected();
      const v = find(opts);
      paintAvailability(opts);
      opts.forEach((val, i) => { const lbl = rootEl.querySelector(`[data-option-value="${i}"]`); if (lbl && val) lbl.textContent = optionLabels[val] || val; });
      if (!v) {
        atc.disabled = true; atcText.textContent = meta.strings.unavailable; if (atcPrice) atcPrice.textContent = '';
        if (stock) stock.innerHTML = `<span class="dot dot--off"></span>${meta.strings.unavailable}`;
        return;
      }
      idInput.value = v.id;
      if (priceWrap) {
        const sale = v.compare_at_price && v.compare_at_price > v.price;
        priceWrap.innerHTML = `<span class="price price--lg${sale ? ' price--sale' : ''}"><span class="price__current${sale ? ' price__sale' : ''}">${L.money(v.price)}</span>${sale ? `<s class="price__compare">${L.money(v.compare_at_price)}</s>` : ''}</span>`;
        const badge = rootEl.querySelector('[data-badge-sale]'); if (badge) badge.hidden = !sale;
      }
      if (atcPrice) atcPrice.textContent = L.money(v.price);
      atc.disabled = !v.available;
      atcText.textContent = v.available ? meta.strings.addToBag : meta.strings.soldOut;
      if (stock) {
        if (!v.available) stock.innerHTML = `<span class="dot dot--off"></span>${meta.strings.soldOut}`;
        else if (v.inventory_management === 'shopify' && v.inventory_quantity > 0 && v.inventory_quantity <= meta.lowStock) stock.innerHTML = `<span class="dot dot--warn"></span>${meta.strings.lowStock.replace('[count]', v.inventory_quantity)}`;
        else stock.innerHTML = `<span class="dot"></span>${meta.strings.inStock}`;
      }
      // Gallery → variant image
      if (v.featured_media || v.featured_image) {
        const mid = v.featured_media ? v.featured_media.id : null;
        const src = v.featured_image ? (v.featured_image.src || v.featured_image) : null;
        const gallery = rootEl.querySelector('[data-gallery]');
        if (gallery) {
          let slide = mid && gallery.querySelector(`[data-media-id="${mid}"]`);
          if (!slide && src) slide = Array.from(gallery.querySelectorAll('[data-gallery-slide] img')).find((img) => img.src.split('?')[0].endsWith(src.split('?')[0].split('/').pop()))?.closest('[data-gallery-slide]');
          if (slide) gallery.__goTo && gallery.__goTo(Number(slide.dataset.index));
        }
      }
      if (pushState && rootEl.dataset.product !== 'quick' && window.history && window.history.replaceState) {
        const u = new URL(location.href); u.searchParams.set('variant', v.id); history.replaceState({}, '', u);
      }
      L.emit('variant:change', { variant: v, root: rootEl });
    }

    form.addEventListener('change', (e) => { if (e.target.matches('[data-option-input]')) update(); });
    form.querySelectorAll('[data-qty-step]').forEach((b) => b.addEventListener('click', () => {
      const input = form.querySelector('[name="quantity"]');
      input.value = Math.max(1, Number(input.value) + Number(b.dataset.qtyStep));
    }));
    update(false);

    /* Bundle tiers → set quantity + show per-piece price for the live variant */
    const bundle = rootEl.querySelector('[data-bundle]');
    if (bundle) {
      const bStrings = JSON.parse(bundle.querySelector('[data-bundle-strings]')?.textContent || '{}');
      const qtyInput = form.querySelector('[name="quantity"]');
      const tiers = Array.from(bundle.querySelectorAll('[data-bundle-tier]'));
      const paintBundle = (price) => tiers.forEach((t) => {
        const each = Math.round(price * (100 - Number(t.dataset.pct)) / 100);
        const el = t.querySelector('[data-bundle-each]');
        if (el && bStrings.each) el.textContent = bStrings.each.replace('[price]', L.money(each));
      });
      const syncActive = () => {
        const q = Number(qtyInput.value || 1);
        let best = tiers[0];
        tiers.forEach((t) => { if (Number(t.dataset.qty) <= q) best = t; });
        tiers.forEach((t) => { t.classList.toggle('is-active', t === best); t.setAttribute('aria-pressed', String(t === best)); });
      };
      tiers.forEach((t) => t.addEventListener('click', () => { qtyInput.value = t.dataset.qty; syncActive(); L.buzz(); qtyInput.dispatchEvent(new Event('change', { bubbles: true })); }));
      qtyInput.addEventListener('change', syncActive);
      form.querySelectorAll('[data-qty-step]').forEach((b) => b.addEventListener('click', () => setTimeout(syncActive, 0)));
      L.on('variant:change', ({ variant, root: r }) => { if (r === rootEl) paintBundle(variant.price); });
      syncActive();
    }

    /* Fit finder: height/weight → size. Heuristic (weight band, nudged by height + BMI);
       the cut is oversized, so "true to size" shifts one down. */
    const fit = rootEl.querySelector('[data-fit]');
    if (fit) {
      const fStrings = JSON.parse(fit.querySelector('[data-fit-strings]')?.textContent || '{}');
      const ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
      const norm = (v) => v.toUpperCase().replace('XXL', '2XL');
      const sizeInputs = Array.from(form.querySelectorAll('[data-option-input]')).filter((i) => ORDER.includes(norm(i.value)));
      const available = ORDER.filter((sz) => sizeInputs.some((i) => norm(i.value) === sz));
      let style = 'oversized';
      fit.querySelectorAll('[data-fit-style]').forEach((b) => b.addEventListener('click', () => {
        style = b.dataset.fitStyle;
        fit.querySelectorAll('[data-fit-style]').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      }));
      const suggest = (h, w) => {
        const bmi = w / Math.pow(h / 100, 2);
        let idx = w < 58 ? 1 : w < 70 ? 2 : w < 84 ? 3 : w < 98 ? 4 : w < 112 ? 5 : 6;
        if (h >= 186) idx += 1; else if (h < 165) idx -= 1;
        if (bmi >= 30) idx += 1; else if (bmi < 19) idx -= 1;
        if (style === 'regular') idx -= 1;
        return Math.max(0, Math.min(ORDER.length - 1, idx));
      };
      const result = fit.querySelector('[data-fit-result]');
      fit.querySelector('[data-fit-calc]').addEventListener('click', () => {
        const h = Number(fit.querySelector('[data-fit-height]').value), w = Number(fit.querySelector('[data-fit-weight]').value);
        if (!h || !w) { fit.querySelector(h ? '[data-fit-weight]' : '[data-fit-height]').focus(); return; }
        const idx = suggest(h, w);
        let size = ORDER[idx];
        if (available.length && !available.includes(size)) {
          size = available.reduce((best, sz) => (Math.abs(ORDER.indexOf(sz) - idx) < Math.abs(ORDER.indexOf(best) - idx) ? sz : best), available[0]);
        }
        const alt = available.find((sz) => ORDER.indexOf(sz) === ORDER.indexOf(size) + 1);
        fit.querySelector('[data-fit-size]').textContent = size;
        fit.querySelector('[data-fit-alt]').textContent = alt && fStrings.alt ? fStrings.alt.replace('[size]', alt) : '';
        result.hidden = false; result.dataset.size = size; L.buzz();
      });
      fit.querySelector('[data-fit-select]').addEventListener('click', () => {
        const target = sizeInputs.find((i) => norm(i.value) === result.dataset.size);
        if (target) { target.checked = true; target.dispatchEvent(new Event('change', { bubbles: true })); target.closest('.pill')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      });
    }

    /* Gallery */
    const gallery = rootEl.querySelector('[data-gallery]');
    if (gallery) {
      const track = gallery.querySelector('[data-gallery-track]');
      const slides = Array.from(gallery.querySelectorAll('[data-gallery-slide]'));
      const thumbs = Array.from(gallery.querySelectorAll('[data-gallery-thumb]'));
      const dots = Array.from(gallery.querySelectorAll('.gallery__dot'));
      let index = 0;
      const paint = () => {
        thumbs.forEach((t, i) => t.classList.toggle('is-active', i === index));
        dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
      };
      const goTo = (i, smooth = true) => {
        index = Math.max(0, Math.min(slides.length - 1, i));
        const target = slides[index];
        if (target) track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
        paint();
      };
      gallery.__goTo = goTo;
      thumbs.forEach((t) => t.addEventListener('click', () => goTo(Number(t.dataset.galleryThumb))));
      gallery.querySelector('[data-gallery-prev]')?.addEventListener('click', () => goTo(index - 1));
      gallery.querySelector('[data-gallery-next]')?.addEventListener('click', () => goTo(index + 1));
      let st;
      track.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(() => { const w = track.clientWidth; index = Math.round(Math.abs(track.scrollLeft) / w); paint(); }, 80); }, { passive: true });
      // Lightbox
      const lb = document.querySelector('[data-lightbox]');
      const openLb = () => {
        const img = slides[index]?.querySelector('img'); if (!img || !lb) return;
        lb.querySelector('[data-lightbox-img]').src = img.dataset.zoomSrc || img.src;
        lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false'); lb.removeAttribute('inert'); document.body.classList.add('drawer-open');
      };
      const closeLb = () => { if (!lb) return; lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); lb.setAttribute('inert', ''); document.body.classList.remove('drawer-open'); };
      gallery.querySelector('[data-gallery-zoom]')?.addEventListener('click', openLb);
      slides.forEach((s) => s.addEventListener('click', (e) => { if (matchMedia('(pointer: fine)').matches && e.target.tagName === 'IMG') openLb(); }));
      lb?.addEventListener('click', closeLb);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); if (lb?.classList.contains('is-open')) return; if (document.activeElement.closest && document.activeElement.closest('[data-gallery]')) { if (e.key === 'ArrowRight') goTo(index + 1); if (e.key === 'ArrowLeft') goTo(index - 1); } });
    }

    /* Sticky ATC (page only) */
    const sticky = document.querySelector('[data-sticky-atc]');
    if (sticky && atc && rootEl.dataset.product !== 'quick') {
      const io = new IntersectionObserver(([en]) => { const show = !en.isIntersecting && en.boundingClientRect.top < 0; sticky.classList.toggle('is-visible', show); sticky.setAttribute('aria-hidden', String(!show)); }, { threshold: 0 });
      io.observe(atc);
      sticky.querySelector('[data-sticky-submit]')?.addEventListener('click', () => { if (atc.disabled) { atc.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } form.requestSubmit(); });
      L.on('variant:change', ({ variant }) => { const p = sticky.querySelector('[data-sticky-price]'); if (p) p.textContent = L.money(variant.price); });
    }

    /* Recently viewed: record */
    if (rootEl.dataset.product !== 'quick' && meta.handle) {
      try {
        const key = 'linux:recent';
        const list = JSON.parse(localStorage.getItem(key) || '[]').filter((h) => h !== meta.handle);
        list.unshift(meta.handle);
        localStorage.setItem(key, JSON.stringify(list.slice(0, 10)));
      } catch {}
    }
  }

  document.querySelectorAll('[data-product]').forEach(initProduct);
  L.initProduct = initProduct;

  /* ------------------------------------------------------------------ */
  /* Quick view                                                          */
  /* ------------------------------------------------------------------ */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-quick-view]');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const handle = btn.dataset.quickView;
    const modal = document.querySelector('[data-modal="quick-view"]');
    const content = modal?.querySelector('[data-quick-view-content]');
    if (!modal || !content) { location.href = `${root}/products/${handle}`; return; }
    content.innerHTML = '<div class="skeleton" style="height:320px;border-radius:var(--r-lg)"></div>';
    L.drawers.open('quick-view', btn);
    try {
      const res = await fetch(`${root}/products/${handle}?section_id=main-product`);
      const html = await res.text();
      const tpl = document.createElement('div'); tpl.innerHTML = html;
      const pdp = tpl.querySelector('[data-product]');
      if (!pdp) throw new Error('no product');
      pdp.dataset.product = 'quick';
      pdp.classList.add('pdp--quick');
      pdp.querySelector('.pdp__crumbs')?.remove();
      pdp.querySelector('.pdp__details')?.remove();
      const link = document.createElement('a');
      link.className = 'btn btn--ghost btn--sm btn--block'; link.href = `${root}/products/${handle}`; link.textContent = L.strings.view_full || 'View full details';
      pdp.querySelector('.pdp__panel')?.appendChild(link);
      content.innerHTML = ''; content.appendChild(pdp);
      initProduct(pdp);
    } catch (err) { content.innerHTML = `<p class="muted" style="padding:40px;text-align:center">${L.strings.error}</p>`; }
  });
  L.on('drawer:close', ({ name, el }) => { if (name === 'quick-view') { const c = el.querySelector('[data-quick-view-content]'); c && (c.innerHTML = ''); } });

  /* ------------------------------------------------------------------ */
  /* Recommendations                                                     */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll('[data-recommendations]').forEach(async (sec) => {
    if (sec.querySelector('.product-grid')) return;
    try {
      const res = await fetch(sec.dataset.url);
      if (!res.ok) return;
      const html = await res.text();
      const tpl = document.createElement('div'); tpl.innerHTML = html;
      const fresh = tpl.querySelector('[data-recommendations]');
      if (fresh && fresh.innerHTML.trim()) sec.innerHTML = fresh.innerHTML;
    } catch {}
  });

  /* ------------------------------------------------------------------ */
  /* Recently viewed rail                                                */
  /* ------------------------------------------------------------------ */
  const rv = document.querySelector('[data-recently-viewed]');
  if (rv) {
    const current = document.querySelector('[data-product-handle]')?.dataset.productHandle;
    let list = [];
    try { list = JSON.parse(localStorage.getItem('linux:recent') || '[]'); } catch {}
    list = list.filter((h) => h !== current).slice(0, 8);
    if (list.length) {
      const track = rv.querySelector('[data-recently-viewed-track]');
      Promise.all(list.map(async (h) => {
        try {
          const p = await L.fetchJSON(`${root}/products/${h}.js`);
          const img = p.featured_image ? (p.featured_image.includes('cdn.shopify.com') ? p.featured_image.replace(/(\.[a-z]+)(\?|$)/, '_720x$1$2') : p.featured_image) : '';
          const sale = p.compare_at_price && p.compare_at_price > p.price;
          return `<article class="card glass glass--hover" data-product-card data-handle="${p.handle}"><div class="card__media"><a href="${p.url}"><img class="card__img--main" src="${img}" alt="${p.title}" width="720" height="960" loading="lazy"></a><button class="card__wish" type="button" data-wishlist-toggle="${p.handle}" aria-pressed="false"><svg class="icon icon--heart" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg><svg class="icon icon--heart-fill" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg></button><div class="card__quick glass glass--solid"><button class="btn btn--ghost btn--sm btn--block" type="button" data-quick-view="${p.handle}">${L.strings.products ? '' : ''}Quick view</button></div></div><div class="card__body"><h3 class="card__title"><a href="${p.url}">${p.title}</a></h3><p class="card__meta">${p.type || ''}</p><div class="card__price"><span class="price"><span class="price__current${sale ? ' price__sale' : ''}">${L.money(p.price)}</span>${sale ? `<s class="price__compare">${L.money(p.compare_at_price)}</s>` : ''}</span></div></div></article>`;
        } catch { return ''; }
      })).then((cards) => { const html = cards.join(''); if (html) { track.innerHTML = html; rv.hidden = false; } });
    }
  }
})();
