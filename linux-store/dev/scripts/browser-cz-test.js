// Evaluated inside the Customize page via agent-browser eval. Exercises the
// studio end-to-end without the (crashing) native upload command.
(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);

  // 1. Synthetic PNG "upload" through the real file input
  const c = document.createElement('canvas'); c.width = 400; c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#8fcb5a'; g.beginPath(); g.arc(200, 200, 160, 0, 7); g.fill();
  g.fillStyle = '#043020'; g.font = 'bold 110px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LX', 200, 205);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'lx-badge.png', { type: 'image/png' }));
  const input = q('[data-cz-file]'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(300);
  out.afterUpload = {
    designVisible: !q('[data-cz-design]').hidden && getComputedStyle(q('[data-cz-design]')).display !== 'none',
    emptyGone: getComputedStyle(q('[data-cz-pick]')).display === 'none',
    dropGone: getComputedStyle(q('[data-cz-drop]')).display === 'none',
    fileRowShown: getComputedStyle(q('[data-cz-file-row]')).display !== 'none',
    filename: q('[data-cz-filename]').textContent,
  };

  // 2. Garment → hoodie, colour → cream
  q('[data-cz-garment-opt="hoodie"]').click(); await sleep(50);
  const creamBtn = [...document.querySelectorAll('[data-cz-color]')].find((b) => b.dataset.czColor === '#f5f5f0'); creamBtn.click(); await sleep(50);
  out.garment = {
    prop: q('[data-cz-garment-prop]').value,
    colorProp: q('[data-cz-color-prop]').value,
    visibleShape: [...document.querySelectorAll('[data-cz-shape]')].filter((s) => s.style.display !== 'none').map((s) => s.dataset.czShape),
    gc: q('[data-cz-garment]').style.getPropertyValue('--gc'),
  };

  // 3. Drag the design down-right by 60px,40px
  const d = q('[data-cz-design]');
  const r = d.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const ev = (type, x, y) => new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true, isPrimary: true, pointerType: 'mouse', button: 0, buttons: 1 });
  d.dispatchEvent(ev('pointerdown', cx, cy));
  d.dispatchEvent(ev('pointermove', cx + 30, cy + 20));
  d.dispatchEvent(ev('pointermove', cx + 60, cy + 40));
  d.dispatchEvent(ev('pointerup', cx + 60, cy + 40));
  await sleep(50);
  out.afterDrag = { pos: q('[data-cz-pos]').value, dx: d.style.getPropertyValue('--dx'), dy: d.style.getPropertyValue('--dy') };

  // 4. Scale slider → 60
  const sl = q('[data-cz-scale]'); sl.value = 60; sl.dispatchEvent(new Event('input', { bubbles: true })); await sleep(30);
  out.afterScale = { ds: d.style.getPropertyValue('--ds'), pos: q('[data-cz-pos]').value };

  // 5. Variant → BEIGE / XL / EMBROIDERY, price should follow
  const pick = (val) => { const i = [...document.querySelectorAll('[data-cz-form] input[type=radio]')].find((x) => x.value === val); if (i) { i.click(); i.dispatchEvent(new Event('change', { bubbles: true })); } return !!i; };
  out.variantPicked = [pick('BEIGE'), pick('XL'), pick('EMBROIDERY')];
  await sleep(200);
  out.variant = { id: q('[data-cz-form] [data-variant-id]').value, atc: q('[data-atc]').textContent.replace(/\s+/g, ' ').trim(), legends: [...document.querySelectorAll('[data-cz-form] legend')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()) };

  // 6. Legend layout sanity (legend should be full-width flex, not shrink-wrapped)
  const legend = q('[data-cz-form] legend');
  const fs = legend.closest('fieldset');
  out.legendLayout = { legendW: Math.round(legend.getBoundingClientRect().width), fieldsetW: Math.round(fs.getBoundingClientRect().width), fieldsetBorder: getComputedStyle(fs).borderTopWidth, legendDisplay: getComputedStyle(legend).display };

  // 7. Submit → AJAX add to cart (cart.js) with file property; wait for cart count
  const before = q('[data-cart-count]')?.textContent;
  q('[data-cz-submit]').click();
  let tries = 0; while (tries++ < 40 && (q('[data-cart-count]')?.textContent === before || q('[data-cart-count]')?.hidden)) await sleep(150);
  out.cart = { before, after: q('[data-cart-count]')?.textContent, drawerOpen: !!document.querySelector('[data-drawer="cart"].is-open, .drawer.is-open, [data-cart-drawer].is-open'), submitErr: q('[data-cz-submit-error]')?.hidden };
  const cart = await fetch('/cart.js').then((r) => r.json());
  out.cartJson = { count: cart.item_count, items: cart.items.map((i) => ({ title: i.product_title, variant: i.variant_title, props: i.properties })) };
  return JSON.stringify(out);
})()
