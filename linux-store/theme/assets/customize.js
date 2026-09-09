/* LINUX — Customize studio v2: hoodie/tee mockup with live recolour, drag/scale
   artwork, front/back, quantity + per-piece sizes, method rules (print from 1,
   embroidery from N), notes, and a WhatsApp handoff. Variant/price comes from
   the merchant's Customize product: the method maps to its "Type" option. */
(function () {
  'use strict';
  const L = window.LINUX;
  const root = document.querySelector('[data-customize]');
  if (!root) return;
  const meta = JSON.parse(root.querySelector('[data-product-json]')?.textContent || '{}');
  const variants = JSON.parse(root.querySelector('[data-variants]')?.textContent || '[]');
  const strings = meta.strings || {};
  const MAX = 10 * 1024 * 1024;
  const MIN_EMB = Number(root.dataset.minEmbroidery || 10);
  const MAX_QTY = Number(root.dataset.maxQty || 50);

  const q = (s) => root.querySelector(s);
  const qa = (s) => Array.from(root.querySelectorAll(s));
  const canvas = q('[data-cz-canvas]'), garment = q('[data-cz-garment]'), design = q('[data-cz-design]'), designImg = q('[data-cz-design-img]');
  const empty = q('[data-cz-pick]'), fileInput = q('[data-cz-file]'), drop = q('[data-cz-drop]'), fileRow = q('[data-cz-file-row]'), err = q('[data-cz-error]');
  const posInput = q('[data-cz-pos]'), garmentProp = q('[data-cz-garment-prop]'), colorProp = q('[data-cz-color-prop]'), methodProp = q('[data-cz-method-prop]'), sizesProp = q('[data-cz-sizes-prop]');
  const qtyField = q('[data-cz-qty-field]'), qtyInput = q('[data-cz-qty]'), sizesList = q('[data-cz-sizes-list]'), sizeTpl = q('[data-cz-size-row]');
  const scale = q('[data-cz-scale]'), form = q('[data-cz-form]'), submitErr = q('[data-cz-submit-error]'), total = q('[data-cz-total]'), breakdown = q('[data-cz-breakdown]');
  const minNotice = q('[data-cz-min-notice]'), eta = q('[data-cz-eta]'), idInput = q('[data-variant-id]'), atcPrice = q('[data-atc-price]'), wa = q('[data-cz-wa]');

  const state = { x: 50, y: 40, s: 42, side: 'front', shape: 'hoodie', label: q('[data-cz-garment-opt].is-active')?.dataset.label || 'Hoodie', color: colorProp.value, method: 'Print', qty: 1, sizes: [], hasDesign: false, unit: meta.price || 0 };

  /* ---- Variant / price: pick the variant whose method option matches ---- */
  function methodVariant() {
    const optName = (meta.methodOption || 'Type').toLowerCase();
    const want = (meta.methodValues || {})[state.method] || state.method;
    // find option index by inspecting the first variant's option names if exposed; fall back to scanning values
    let v = variants.find((x) => x.available && x.options.some((o) => String(o).toLowerCase() === String(want).toLowerCase()));
    if (!v) v = variants.find((x) => x.options.some((o) => String(o).toLowerCase() === String(want).toLowerCase()));
    if (!v) v = variants.find((x) => x.available) || variants[0];
    return v;
  }

  function paint() {
    design.style.setProperty('--dx', state.x + '%');
    design.style.setProperty('--dy', state.y + '%');
    design.style.setProperty('--ds', state.s);
    posInput.value = `x:${Math.round(state.x)},y:${Math.round(state.y)},scale:${state.s},side:${state.side}`;
    garmentProp.value = state.label;
    methodProp.value = state.method;
    qa('[data-cz-mock]').forEach((m) => { m.hidden = m.dataset.czMock !== `${state.shape}-${state.side}`; });
    // print area guide differs per garment (chest vs full front)
    root.dataset.shape = state.shape;
    // quantity + sizes
    qtyField.value = state.qty;
    sizesProp.value = state.sizes.map((sz, i) => `${i + 1}:${sz}`).join(', ');
    // price
    const v = methodVariant();
    if (v) { state.unit = v.price; idInput.value = v.id; }
    const sum = state.unit * state.qty;
    if (total) total.textContent = L.money(sum);
    if (atcPrice) atcPrice.textContent = L.money(sum);
    if (breakdown) breakdown.textContent = state.qty > 1 && strings.perPiece ? strings.perPiece.replace('[price]', L.money(state.unit)) : '';
    // method rule
    const short = state.method === 'Embroidery' && state.qty < MIN_EMB;
    minNotice.hidden = state.method !== 'Embroidery';
    minNotice.classList.toggle('is-blocking', short);
    if (eta) eta.textContent = state.method === 'Embroidery' ? (strings.etaEmbroidery || '') : (strings.etaPrint || strings.etaEmbroidery || '');
    // WhatsApp prefill carries the current config
    if (wa) {
      const txt = `${strings.wa || ''} ${state.label} · ${state.color} · ${state.method} · ${state.qty} pcs${state.sizes.length ? ' (' + state.sizes.join(', ') + ')' : ''}`;
      wa.href = wa.href.replace(/\?text=.*$/, '') + '?text=' + encodeURIComponent(txt.trim());
    }
  }

  /* ---- Sizes: one row per piece, collapsed to a compact list when many ---- */
  function renderSizes() {
    const prev = state.sizes.slice();
    sizesList.innerHTML = '';
    state.sizes = [];
    for (let i = 0; i < state.qty; i++) {
      const row = sizeTpl.content.firstElementChild.cloneNode(true);
      row.querySelector('.cz__size-n').textContent = (strings.piece || 'Piece [n]').replace('[n]', i + 1);
      const inputs = row.querySelectorAll('input');
      inputs.forEach((inp) => { inp.name = `cz-size-${i}`; inp.checked = false; });
      const want = prev[i];
      const match = want && Array.from(inputs).find((inp) => inp.value === want);
      (match || inputs[Math.min(1, inputs.length - 1)]).checked = true;
      state.sizes.push((match || inputs[Math.min(1, inputs.length - 1)]).value);
      row.addEventListener('change', (e) => { if (e.target.matches('input')) { state.sizes[i] = e.target.value; paint(); } });
      sizesList.appendChild(row);
    }
    q('[data-cz-sizes]').classList.toggle('is-many', state.qty > 6);
  }
  function setQty(n) {
    state.qty = Math.max(1, Math.min(MAX_QTY, Math.round(Number(n) || 1)));
    qtyInput.value = state.qty;
    qa('[data-cz-qty-set]').forEach((c) => c.classList.toggle('is-active', Number(c.dataset.czQtySet) === state.qty));
    renderSizes(); paint();
  }
  qa('[data-cz-qty-step]').forEach((b) => b.addEventListener('click', () => { setQty(state.qty + Number(b.dataset.czQtyStep)); L.buzz(); }));
  qa('[data-cz-qty-set]').forEach((b) => b.addEventListener('click', () => { setQty(b.dataset.czQtySet); L.buzz(); }));
  qtyInput.addEventListener('change', () => setQty(qtyInput.value));

  /* ---- Method ---- */
  qa('[data-cz-method]').forEach((b) => b.addEventListener('click', () => {
    qa('[data-cz-method]').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    state.method = b.dataset.czMethod;
    if (state.method === 'Embroidery' && state.qty < MIN_EMB) { minNotice.hidden = false; minNotice.classList.add('is-pulse'); setTimeout(() => minNotice.classList.remove('is-pulse'), 700); }
    paint(); L.buzz();
  }));

  /* ---- Upload ---- */
  function showError(msg) { err.textContent = msg; err.hidden = !msg; }
  function setFile(file) {
    showError('');
    if (!file) return;
    if (file.size > MAX) { showError(strings.fileTooBig); fileInput.value = ''; return; }
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.type)) { showError(strings.fileType); fileInput.value = ''; return; }
    const url = URL.createObjectURL(file);
    designImg.src = url; q('[data-cz-thumb]').src = url;
    q('[data-cz-filename]').textContent = file.name; q('[data-cz-filesize]').textContent = (file.size / 1024).toFixed(0) + ' KB';
    design.hidden = false; empty.hidden = true; fileRow.hidden = false; drop.hidden = true; state.hasDesign = true;
    design.classList.remove('is-pop'); void design.offsetWidth; design.classList.add('is-pop');
    L.buzz();
  }
  fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
  empty.addEventListener('click', () => fileInput.click());
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  const takeDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { try { fileInput.files = e.dataTransfer.files; } catch {} setFile(f); } };
  drop.addEventListener('drop', takeDrop);
  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', takeDrop);
  q('[data-cz-remove]').addEventListener('click', () => { fileInput.value = ''; designImg.src = ''; design.hidden = true; empty.hidden = false; fileRow.hidden = true; drop.hidden = false; state.hasDesign = false; });

  /* ---- Drag to position (pointer events → touch too), pinch/wheel to scale ---- */
  let dragging = null, pinch = null;
  design.addEventListener('pointerdown', (e) => {
    const r = garment.getBoundingClientRect();
    dragging = { ox: e.clientX, oy: e.clientY, sx: state.x, sy: state.y, w: r.width, h: r.height };
    design.classList.add('is-dragging'); design.setPointerCapture(e.pointerId); e.preventDefault();
  });
  design.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    state.x = Math.max(12, Math.min(88, dragging.sx + (e.clientX - dragging.ox) / dragging.w * 100));
    state.y = Math.max(10, Math.min(90, dragging.sy + (e.clientY - dragging.oy) / dragging.h * 100));
    paint();
  });
  ['pointerup', 'pointercancel'].forEach((ev) => design.addEventListener(ev, () => { dragging = null; design.classList.remove('is-dragging'); }));
  canvas.addEventListener('wheel', (e) => { if (!state.hasDesign) return; e.preventDefault(); state.s = Math.max(14, Math.min(70, state.s - Math.sign(e.deltaY) * 2)); scale.value = state.s; paint(); }, { passive: false });
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 2) pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), s: state.s }; }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { if (pinch && e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); state.s = Math.max(14, Math.min(70, Math.round(pinch.s * d / pinch.d))); scale.value = state.s; paint(); } }, { passive: true });
  canvas.addEventListener('touchend', () => { pinch = null; });
  scale.addEventListener('input', () => { state.s = Number(scale.value); paint(); });
  q('[data-cz-reset]').addEventListener('click', () => { state.x = 50; state.y = 40; state.s = 42; scale.value = 42; paint(); });
  q('[data-cz-center]').addEventListener('click', () => { state.x = 50; paint(); });

  /* ---- 3D tilt when idle ---- */
  if (matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.addEventListener('pointermove', (e) => {
      if (dragging) return;
      const r = canvas.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - .5) * -8, ry = ((e.clientX - r.left) / r.width - .5) * 12;
      garment.style.transform = `rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
    });
    canvas.addEventListener('pointerleave', () => { garment.style.transform = ''; });
  }

  /* ---- Garment / colour / side ---- */
  qa('[data-cz-garment-opt]').forEach((btn) => btn.addEventListener('click', () => {
    qa('[data-cz-garment-opt]').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    state.shape = btn.dataset.czGarmentOpt; state.label = btn.dataset.label || state.shape;
    garment.classList.remove('is-swap'); void garment.offsetWidth; garment.classList.add('is-swap');
    paint(); L.buzz();
  }));
  qa('[data-cz-color]').forEach((btn) => btn.addEventListener('click', () => {
    qa('[data-cz-color]').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    garment.style.setProperty('--gc', btn.dataset.czColor); state.color = btn.dataset.czColorName || btn.dataset.czColor; colorProp.value = state.color;
    // light garments need a dark artwork shadow, dark garments a light one
    const hex = btn.dataset.czColor.replace('#', ''); const n = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    garment.classList.toggle('is-light', lum > .6);
    paint();
  }));
  qa('[data-cz-side]').forEach((btn) => btn.addEventListener('click', () => {
    qa('[data-cz-side]').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    state.side = btn.dataset.czSide;
    garment.style.transition = 'transform .45s cubic-bezier(.2,.8,.2,1)';
    garment.style.transform = 'rotateY(90deg)';
    setTimeout(() => { paint(); garment.style.transform = ''; }, 220);
  }));

  /* ---- Submit guard: design + embroidery minimum ---- */
  form.addEventListener('submit', (e) => {
    let msg = '';
    if (!state.hasDesign) msg = strings.needDesign;
    else if (state.method === 'Embroidery' && state.qty < MIN_EMB) msg = strings.minEmbroidery;
    if (msg) { e.preventDefault(); e.stopImmediatePropagation(); submitErr.textContent = msg; submitErr.hidden = false; (state.hasDesign ? minNotice : drop).scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    submitErr.hidden = true;
  }, true);

  renderSizes();
  paint();
})();
