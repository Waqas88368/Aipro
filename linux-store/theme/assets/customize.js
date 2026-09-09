/* LINUX — Customize studio: upload preview, drag to position, scale, garment
   shape/colour, 3D tilt, front/back, line-item properties. Variant/price
   handling is delegated to product.js (same [data-product] contract). */
(function () {
  'use strict';
  const L = window.LINUX;
  const root = document.querySelector('[data-customize]');
  if (!root) return;
  const meta = JSON.parse(root.querySelector('[data-product-json]')?.textContent || '{}');
  const strings = meta.strings || {};
  const MAX = 10 * 1024 * 1024;

  const canvas = root.querySelector('[data-cz-canvas]');
  const garment = root.querySelector('[data-cz-garment]');
  const design = root.querySelector('[data-cz-design]');
  const designImg = root.querySelector('[data-cz-design-img]');
  const empty = root.querySelector('[data-cz-pick]');
  const fileInput = root.querySelector('[data-cz-file]');
  const drop = root.querySelector('[data-cz-drop]');
  const fileRow = root.querySelector('[data-cz-file-row]');
  const err = root.querySelector('[data-cz-error]');
  const posInput = root.querySelector('[data-cz-pos]');
  const garmentProp = root.querySelector('[data-cz-garment-prop]');
  const colorProp = root.querySelector('[data-cz-color-prop]');
  const scale = root.querySelector('[data-cz-scale]');
  const form = root.querySelector('[data-cz-form]');
  const submitErr = root.querySelector('[data-cz-submit-error]');
  const total = root.querySelector('[data-cz-total]');

  const state = { x: 50, y: 42, s: 45, side: 'front', shape: root.querySelector('[data-cz-garment-opt].is-active')?.dataset.czGarmentOpt || 'tee', fee: 0, hasDesign: false, price: meta.price || 0 };

  function paint() {
    design.style.setProperty('--dx', state.x + '%');
    design.style.setProperty('--dy', state.y + '%');
    design.style.setProperty('--ds', state.s);
    posInput.value = `x:${Math.round(state.x)},y:${Math.round(state.y)},scale:${state.s},side:${state.side}`;
    garmentProp.value = state.shape;
    root.querySelectorAll('[data-cz-shape]').forEach((g) => { g.style.display = g.dataset.czShape === state.shape ? '' : 'none'; });
    if (total) total.textContent = L.money(state.price + state.fee);
  }

  function showError(msg) { err.textContent = msg; err.hidden = !msg; }

  function setFile(file) {
    showError('');
    if (!file) return;
    if (file.size > MAX) { showError(strings.fileTooBig); fileInput.value = ''; return; }
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.type)) { showError(strings.fileType); fileInput.value = ''; return; }
    const url = URL.createObjectURL(file);
    designImg.src = url;
    root.querySelector('[data-cz-thumb]').src = url;
    root.querySelector('[data-cz-filename]').textContent = file.name;
    root.querySelector('[data-cz-filesize]').textContent = (file.size / 1024).toFixed(0) + ' KB';
    design.hidden = false; empty.hidden = true; fileRow.hidden = false; drop.hidden = true;
    state.hasDesign = true;
    L.buzz();
  }

  fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
  empty.addEventListener('click', () => fileInput.click());
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) { try { fileInput.files = e.dataTransfer.files; } catch {} setFile(f); } });
  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { try { fileInput.files = e.dataTransfer.files; } catch {} setFile(f); } });
  root.querySelector('[data-cz-remove]').addEventListener('click', () => {
    fileInput.value = ''; designImg.src = ''; design.hidden = true; empty.hidden = false; fileRow.hidden = true; drop.hidden = false; state.hasDesign = false;
  });

  /* Drag to position (pointer events, works for touch) */
  let dragging = null;
  design.addEventListener('pointerdown', (e) => {
    const r = garment.getBoundingClientRect();
    dragging = { ox: e.clientX, oy: e.clientY, sx: state.x, sy: state.y, w: r.width, h: r.height };
    design.classList.add('is-dragging'); design.setPointerCapture(e.pointerId); e.preventDefault();
  });
  design.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    state.x = Math.max(15, Math.min(85, dragging.sx + (e.clientX - dragging.ox) / dragging.w * 100));
    state.y = Math.max(12, Math.min(88, dragging.sy + (e.clientY - dragging.oy) / dragging.h * 100));
    paint();
  });
  ['pointerup', 'pointercancel'].forEach((ev) => design.addEventListener(ev, () => { dragging = null; design.classList.remove('is-dragging'); }));
  // Pinch / wheel to scale
  canvas.addEventListener('wheel', (e) => { if (!state.hasDesign) return; e.preventDefault(); state.s = Math.max(15, Math.min(70, state.s - Math.sign(e.deltaY) * 2)); scale.value = state.s; paint(); }, { passive: false });
  scale.addEventListener('input', () => { state.s = Number(scale.value); paint(); });
  root.querySelector('[data-cz-reset]').addEventListener('click', () => { state.x = 50; state.y = 42; state.s = 45; scale.value = 45; paint(); });

  /* 3D tilt follows the pointer when not dragging */
  if (matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.addEventListener('pointermove', (e) => {
      if (dragging) return;
      const r = canvas.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - .5) * -10;
      const ry = ((e.clientX - r.left) / r.width - .5) * 14;
      garment.style.transform = `rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
    });
    canvas.addEventListener('pointerleave', () => { garment.style.transform = ''; });
  }

  /* Garment shape */
  root.querySelectorAll('[data-cz-garment-opt]').forEach((btn) => btn.addEventListener('click', () => {
    root.querySelectorAll('[data-cz-garment-opt]').forEach((b) => b.classList.toggle('is-active', b === btn));
    state.shape = btn.dataset.czGarmentOpt; state.fee = Number(btn.dataset.fee || 0);
    garmentProp.value = btn.dataset.label || state.shape;
    if (state.shape === 'cap') { state.y = Math.min(state.y, 40); state.s = Math.min(state.s, 30); scale.value = state.s; }
    paint();
  }));
  /* Colour */
  root.querySelectorAll('[data-cz-color]').forEach((btn) => btn.addEventListener('click', () => {
    root.querySelectorAll('[data-cz-color]').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    garment.style.setProperty('--gc', btn.dataset.czColor); colorProp.value = btn.dataset.czColor;
  }));
  /* Side */
  root.querySelectorAll('[data-cz-side]').forEach((btn) => btn.addEventListener('click', () => {
    root.querySelectorAll('[data-cz-side]').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    state.side = btn.dataset.czSide;
    garment.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)';
    garment.style.transform = 'rotateY(90deg)';
    setTimeout(() => { garment.style.transform = ''; paint(); }, 260);
  }));

  /* Price follows variant (product.js emits) */
  L.on('variant:change', ({ variant, root: r }) => { if (r === root) { state.price = variant.price; paint(); } });

  /* Guard submit: a design is required. Falls through to cart.js's delegated
     submit handler (which reads properties from the form, including the file
     input — Shopify's /cart/add accepts multipart with file properties). */
  form.addEventListener('submit', (e) => {
    if (!state.hasDesign) { e.preventDefault(); e.stopImmediatePropagation(); submitErr.textContent = strings.needDesign; submitErr.hidden = false; drop.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    submitErr.hidden = true;
  }, true);

  paint();
})();
