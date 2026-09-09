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
