/* LINUX — cart: AJAX add/change, drawer refresh via Section Rendering API,
   free-shipping meter, upsell rail, quick add from cards. */
(function () {
  'use strict';
  const L = window.LINUX;
  const S = L.settings || {};
  const root = S.root && S.root !== '/' ? S.root.replace(/\/$/, '') : '';
  const strings = L.strings || {};

  const api = {
    get: () => L.fetchJSON(`${root}/cart.js`),
    add: (items) => L.fetchJSON(`${root}/cart/add.js`, { method: 'POST', body: JSON.stringify({ items }) }),
    change: (id, quantity) => L.fetchJSON(`${root}/cart/change.js`, { method: 'POST', body: JSON.stringify({ id, quantity }) }),
    update: (payload) => L.fetchJSON(`${root}/cart/update.js`, { method: 'POST', body: JSON.stringify(payload) }),
  };

  function paintCount(n) {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      if (el.textContent !== String(n)) {
        const grew = Number(el.textContent) < n;
        el.textContent = n;
        if (grew && el.classList.contains('badge')) { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); }
      }
      if (el.classList.contains('badge')) el.hidden = n === 0;
    });
  }

  async function refresh(cart) {
    try { cart = cart && cart.items ? cart : await api.get(); } catch (e) { console.error('[cart] get failed', e); return; }
    paintCount(cart.item_count);
    try {
      const drawer = document.querySelector('[data-drawer="cart"]');
      if (drawer) {
        const fresh = await L.renderSection('cart-drawer');
        ['body', 'foot'].forEach((r) => {
          const live = drawer.querySelector(`[data-cart-region="${r}"]`);
          const next = fresh.querySelector(`[data-cart-region="${r}"]`);
          if (live && next) live.innerHTML = next.innerHTML;
        });
      }
      const page = document.querySelector('[data-cart-page][data-section-id]');
      if (page) {
        const fresh = await L.renderSection(page.dataset.sectionId);
        const next = fresh.querySelector('[data-cart-page]');
        if (next) page.innerHTML = next.innerHTML;
      }
    } catch (e) { console.error('[cart] refresh failed', e); }
    L.emit('cart:updated', cart);
    loadUpsell(cart);
    return cart;
  }

  async function add(items, { open = true, image } = {}) {
    L.buzz();
    try {
      await api.add(items);
      const cart = await refresh();
      if (S.cartType === 'page') {
        L.toast(strings.added, { image, action: { label: strings.view_bag, href: S.cartUrl } });
      } else if (open) {
        L.drawers && L.drawers.open('cart');
      } else {
        L.toast(strings.added, { image, action: { label: strings.view_bag, onClick: () => L.drawers.open('cart') } });
      }
      return cart;
    } catch (e) {
      L.toast(e.message || strings.error, { type: 'error' });
      e.__toasted = true;
      throw e;
    }
  }

  // Brief ✓ on the button that triggered an add
  function flashSuccess(btn) {
    if (!btn) return;
    const label = btn.querySelector('[data-atc-text]');
    const prev = label ? label.textContent : null;
    btn.classList.add('is-success');
    if (label) label.innerHTML = '<span class="btn__check">✓</span> ' + (strings.added || '');
    setTimeout(() => { btn.classList.remove('is-success'); if (label && prev != null) label.textContent = prev; }, 1400);
  }

  // Product forms (PDP, quick view, customize)
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-product-form]');
    if (!form) return;
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const fd = new FormData(form);
    const id = Number(fd.get('id'));
    if (!id) return;
    btn && btn.classList.add('is-loading');
    try {
      const hasFile = Array.from(fd.values()).some((v) => v instanceof File && v.size > 0);
      if (hasFile) {
        // Shopify accepts multipart on /cart/add.js and stores file properties
        // on the line item — used by the Customize studio for the artwork.
        fd.delete('form_type'); fd.delete('utf8');
        await L.fetchJSON(`${root}/cart/add.js`, { method: 'POST', body: fd });
        await refresh();
        L.buzz();
        if (S.cartType === 'page') L.toast(strings.added, { action: { label: strings.view_bag, href: S.cartUrl } });
        else L.drawers && L.drawers.open('cart');
      } else {
        const quantity = Number(fd.get('quantity') || 1);
        const properties = {};
        for (const [k, v] of fd.entries()) { const m = k.match(/^properties\[(.+)\]$/); if (m && typeof v === 'string' && v) properties[m[1]] = v; }
        await add([{ id, quantity, properties }], { image: form.dataset.image });
      }
      flashSuccess(btn);
    } catch (err) { if (!err.__toasted) L.toast(err.message || strings.error, { type: 'error' }); }
    finally { btn && btn.classList.remove('is-loading'); }
  });

  // Discount codes (Shopify Cart AJAX API, 2025: POST /cart/update.js { discount })
  async function applyDiscount(codes, wrap) {
    const err = wrap && wrap.querySelector('[data-discount-error]');
    const btn = wrap && wrap.querySelector('[data-discount-apply]');
    btn && btn.classList.add('is-loading');
    try {
      const cart = await api.update({ discount: codes.join(',') });
      const bad = (cart.discount_codes || []).filter((c) => !c.applicable).map((c) => c.code);
      if (bad.length) await api.update({ discount: (cart.discount_codes || []).filter((c) => c.applicable).map((c) => c.code).join(',') });
      await refresh(); // re-renders the footer, so surface the message on the fresh node
      const scope = wrap && wrap.closest('[data-drawer], [data-cart-page]');
      const freshErr = (scope || document).querySelector('[data-discount-error]');
      if (freshErr) {
        if (bad.length) { freshErr.textContent = (strings.discount_invalid || 'Code not valid') + ': ' + bad.join(', '); freshErr.hidden = false; }
        else freshErr.hidden = true;
      }
      if (!bad.length) L.toast(strings.discount_applied || 'Applied');
      L.buzz();
    } catch (e) { if (err) { err.textContent = e.message || strings.error; err.hidden = false; } }
    finally { btn && btn.classList.remove('is-loading'); }
  }
  function currentCodes(wrap) { return Array.from(wrap.querySelectorAll('[data-discount-remove]')).map((b) => b.dataset.discountRemove); }
  document.addEventListener('click', (e) => {
    const apply = e.target.closest('[data-discount-apply]');
    const remove = e.target.closest('[data-discount-remove]');
    if (!apply && !remove) return;
    const wrap = e.target.closest('[data-cart-discount]');
    if (apply) {
      const input = wrap.querySelector('[data-discount-input]');
      const code = (input.value || '').trim().toUpperCase();
      if (!code) { input.focus(); return; }
      applyDiscount([...new Set([...currentCodes(wrap), code])], wrap);
    } else {
      applyDiscount(currentCodes(wrap).filter((c) => c !== remove.dataset.discountRemove), wrap);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-discount-input]')) { e.preventDefault(); e.target.closest('[data-cart-discount]').querySelector('[data-discount-apply]').click(); }
  });

  // Quick add (cards, upsell)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-quick-add]');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    btn.classList.add('is-loading'); btn.disabled = true;
    const card = btn.closest('[data-product-card]');
    const img = card && card.querySelector('.card__img--main');
    try { await add([{ id: Number(btn.dataset.quickAdd), quantity: 1 }], { open: !btn.closest('[data-drawer="cart"]'), image: img && img.currentSrc }); }
    catch {} finally { btn.classList.remove('is-loading'); btn.disabled = false; }
  });

  // Quantity + remove
  document.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-qty-change]');
    const rm = e.target.closest('[data-line-remove]');
    if (!q && !rm) return;
    const key = (q || rm).dataset.key;
    const line = (q || rm).closest('[data-line]');
    let qty = 0;
    if (q) { const input = line.querySelector('[data-qty-input]'); qty = Math.max(0, Number(input.value) + Number(q.dataset.qtyChange)); input.value = qty; }
    line && line.classList.add('is-removing');
    if (qty === 0) line && (line.style.height = line.offsetHeight + 'px');
    try { const cart = await api.change(key, qty); await refresh(cart); }
    catch (err) { L.toast(err.message || strings.error, { type: 'error' }); line && line.classList.remove('is-removing'); }
  });
  document.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-qty-input]');
    if (!input) return;
    try { const cart = await api.change(input.dataset.key, Math.max(0, Number(input.value))); await refresh(cart); }
    catch (err) { L.toast(err.message || strings.error, { type: 'error' }); }
  });
  document.addEventListener('change', L.debounce(async (e) => {
    const note = e.target.closest('[data-cart-note]');
    if (!note) return;
    try { await api.update({ note: note.value }); } catch {}
  }, 400));

  // Upsell: complete the look — recommendations for the first line item
  let upsellFor = null;
  async function loadUpsell(cart) {
    const wrap = document.querySelector('[data-cart-upsell]');
    if (!wrap) return;
    const list = wrap.querySelector('[data-cart-upsell-list]');
    if (!cart || !cart.items || !cart.items.length) { wrap.hidden = true; upsellFor = null; return; }
    const pid = cart.items[0].product_id;
    const inCart = new Set(cart.items.map((i) => i.product_id));
    if (upsellFor === pid && list.children.length) { wrap.hidden = false; return; }
    try {
      const data = await L.fetchJSON(`${root}/recommendations/products.json?product_id=${pid}&limit=6&intent=complementary`);
      const picks = (data.products || []).filter((p) => !inCart.has(p.id) && p.available).slice(0, 3);
      if (!picks.length) { wrap.hidden = true; return; }
      list.innerHTML = picks.map((p) => {
        const v = p.variants.find((x) => x.available) || p.variants[0];
        const img = p.featured_image ? (typeof p.featured_image === 'string' ? p.featured_image : p.featured_image.src) : '';
        const src = img && img.includes('cdn.shopify.com') ? img.replace(/(\.[a-z]+)(\?|$)/, '_200x$1$2') : img;
        return `<div class="upsell glass glass--clear"><a href="${p.url}"><img src="${src}" alt="" width="56" height="68" loading="lazy"></a><div><strong>${p.title}</strong><span class="price"><span class="price__current">${L.money(v.price)}</span></span></div><button class="btn btn--cream btn--sm" type="button" data-quick-add="${v.id}" aria-label="${strings.add_to_bag}">+</button></div>`;
      }).join('');
      upsellFor = pid; wrap.hidden = false;
    } catch { wrap.hidden = true; }
  }

  L.cart = { api, add, refresh };
  api.get().then((c) => { paintCount(c.item_count); loadUpsell(c); }).catch(() => {});
  L.on('drawer:open', ({ name }) => { if (name === 'cart') api.get().then(loadUpsell).catch(() => {}); });
})();
