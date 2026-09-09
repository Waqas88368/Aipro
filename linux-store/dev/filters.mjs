/*
 * Shopify Liquid filters emulated for the preview harness.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEME = path.resolve(__dirname, '../theme');

const locales = {};
function loadLocale(code) {
  const file = path.join(THEME, 'locales', code === 'en' ? 'en.default.json' : `${code}.json`);
  // Re-read when the file changes so locale edits show up without a restart.
  const mtime = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  if (locales[code] && locales[code].mtime === mtime) return locales[code].data;
  const data = mtime ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  locales[code] = { mtime, data };
  return data;
}
function lookup(obj, key) { return key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj); }

function hashArgs(args) {
  const out = {};
  for (const a of args) {
    if (Array.isArray(a) && a.length === 2 && typeof a[0] === 'string') out[a[0]] = a[1];
  }
  return out;
}

function formatMoney(cents, format = 'LE {{amount}}') {
  if (cents == null || cents === '') return '';
  const n = Number(cents) / 100;
  const two = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const noZeros = two.replace(/\.00$/, '');
  return format
    .replace(/{{\s*amount_no_decimals\s*}}/g, Math.round(n).toLocaleString('en-US'))
    .replace(/{{\s*amount_with_comma_separator\s*}}/g, n.toFixed(2).replace('.', ','))
    .replace(/{{\s*amount_no_trailing_zeros\s*}}/g, noZeros)
    .replace(/{{\s*amount\s*}}/g, two);
}

function assetUrl(name) { return `/assets/${name}`; }

// Image URLs: local assets are served as-is; CDN URLs get Shopify's width param.
function imageUrl(img, opts = {}) {
  if (!img) return '';
  let src = typeof img === 'string' ? img : (img.src || img.url || img.preview_image?.src || '');
  if (!src) return '';
  if (src.startsWith('//')) src = 'https:' + src;
  if (/cdn\.shopify\.com/.test(src)) {
    const u = new URL(src);
    if (opts.width) u.searchParams.set('width', opts.width);
    if (opts.height) u.searchParams.set('height', opts.height);
    if (opts.crop) u.searchParams.set('crop', opts.crop);
    return u.toString();
  }
  return src;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function attrs(o) { return Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => ` ${k}="${esc(v)}"`).join(''); }

export function registerFilters(engine, store) {
  const F = (name, fn) => engine.registerFilter(name, fn);

  // ---- URLs & assets ------------------------------------------------------
  F('asset_url', assetUrl);
  F('asset_img_url', (n) => assetUrl(n));
  F('file_url', (n) => assetUrl(n));
  F('file_img_url', (n) => assetUrl(n));
  F('shopify_asset_url', (n) => `https://cdn.shopify.com/shopifycloud/shopify/assets/${n}`);
  F('format_code', (c) => String(c ?? '').replace(/(.{4})(?=.)/g, '$1 '));
  F('global_asset_url', (n) => `https://cdn.shopify.com/s/global/${n}`);
  F('preload_tag', (url, ...args) => { const h = hashArgs(args); const attrs = Object.entries(h).map(([k, v]) => ` ${k}="${v}"`).join(''); return `<link rel="preload" href="${url}"${attrs}>`; });
  F('stylesheet_tag', (url, ...args) => { const h = hashArgs(args); return `<link href="${url}" rel="stylesheet" type="text/css" media="${h.media || 'all'}"${h.preload ? ' data-preload' : ''}>`; });
  F('script_tag', (url) => `<script src="${url}" type="text/javascript"></script>`);
  F('inline_asset_content', (name) => { const f = path.join(THEME, 'assets', name); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; });
  F('image_url', (img, ...args) => imageUrl(img, hashArgs(args)));
  F('img_url', (img, size) => { const m = String(size || '').match(/(\d+)?x(\d+)?/); return imageUrl(img, { width: m?.[1] ? Number(m[1]) : undefined, height: m?.[2] ? Number(m[2]) : undefined }); });
  F('product_img_url', (img, size) => engine.filters.get?.('img_url')?.(img, size) ?? imageUrl(img));
  F('article_img_url', (img) => imageUrl(img));
  F('collection_img_url', (img) => imageUrl(img));
  F('image_tag', (url, ...args) => {
    const h = hashArgs(args);
    const src = typeof url === 'string' ? url : imageUrl(url);
    const w = h.width || (typeof url === 'object' ? url.width : undefined);
    const hgt = h.height || (typeof url === 'object' ? url.height : undefined);
    return `<img src="${esc(src)}"${attrs({ alt: h.alt ?? '', width: w, height: hgt, loading: h.loading, class: h.class, sizes: h.sizes, srcset: h.srcset, fetchpriority: h.fetchpriority, decoding: h.decoding, style: h.style })}>`;
  });
  F('media_tag', (m) => `<img src="${esc(imageUrl(m))}" alt="${esc(m?.alt || '')}">`);
  F('video_tag', (v, ...args) => { const h = hashArgs(args); return `<video${attrs({ class: h.class, poster: h.poster, autoplay: h.autoplay, loop: h.loop, muted: h.muted, playsinline: h.playsinline, controls: h.controls, preload: h.preload })}><source src="${esc(v?.sources?.[0]?.url || v?.src || '')}" type="video/mp4"></video>`; });
  F('external_video_tag', () => '');
  F('placeholder_svg_tag', (name, cls) => `<svg class="${esc(cls || '')}" viewBox="0 0 525 525" xmlns="http://www.w3.org/2000/svg"><rect width="525" height="525" fill="#0a4a33"/><text x="50%" y="50%" fill="#f4e8d8" font-size="28" text-anchor="middle">${esc(name || 'image')}</text></svg>`);
  F('payment_type_svg_tag', (type) => `<svg class="payment-icon" viewBox="0 0 38 24" width="38" height="24" role="img" aria-label="${esc(type)}"><rect width="38" height="24" rx="4" fill="#f4e8d8" opacity=".9"/><text x="19" y="15" font-size="7" font-family="system-ui" text-anchor="middle" fill="#043222">${esc(String(type).replace(/_/g, ' ').slice(0, 10))}</text></svg>`);
  F('payment_type_img_url', () => '');
  F('within', function (url, collection) {
    if (!collection?.handle || collection.handle === 'all') return url;
    // Shopify: /ar/products/x within collection → /ar/collections/c/products/x
    const m = String(url).match(/^(\/[a-z]{2}(?:-[A-Za-z]{2})?)?(\/products\/.*)$/);
    return m ? `${m[1] || ''}/collections/${collection.handle}${m[2]}` : url;
  });
  F('link_to', (text, url, title) => `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''}>${text}</a>`);
  F('link_to_tag', (label, tag) => `<a href="/collections/all/${encodeURIComponent(tag)}" title="Show tag ${esc(tag)}">${esc(label)}</a>`);
  F('link_to_type', (t) => `<a href="/collections/types?q=${encodeURIComponent(t)}">${esc(t)}</a>`);
  F('link_to_vendor', (v) => `<a href="/collections/vendors?q=${encodeURIComponent(v)}">${esc(v)}</a>`);
  F('url_for_type', (t) => `/collections/types?q=${encodeURIComponent(t)}`);
  F('url_for_vendor', (v) => `/collections/vendors?q=${encodeURIComponent(v)}`);
  F('customer_login_link', (t) => `<a href="/account/login" id="customer_login_link">${esc(t)}</a>`);
  F('customer_logout_link', (t) => `<a href="/account/logout" id="customer_logout_link">${esc(t)}</a>`);
  F('customer_register_link', (t) => `<a href="/account/register" id="customer_register_link">${esc(t)}</a>`);
  F('url_encode', (s) => encodeURIComponent(String(s ?? '')));
  F('url_decode', (s) => decodeURIComponent(String(s ?? '')));
  F('url_param_escape', (s) => encodeURIComponent(String(s ?? '')));
  F('url_escape', (s) => encodeURI(String(s ?? '')));
  F('structured_data', (o) => JSON.stringify({ '@context': 'https://schema.org', '@type': o?.variants ? 'Product' : 'Thing', name: o?.title }));

  // ---- Money ----------------------------------------------------------------
  F('money', (c) => formatMoney(c, store.shop.money_format));
  F('money_with_currency', (c) => formatMoney(c, store.shop.money_with_currency_format));
  F('money_without_currency', (c) => formatMoney(c, '{{amount}}'));
  F('money_without_trailing_zeros', (c) => formatMoney(c, store.shop.money_format.replace('amount', 'amount_no_trailing_zeros')));

  // ---- Translation ----------------------------------------------------------
  F('t', function (key, ...args) {
    const h = hashArgs(args);
    // Inside {% render %} the environments object is the snippet's own scope;
    // the locale is passed as a global so it resolves everywhere.
    const locale = this.context.get(['__locale']) || 'en';
    let val = lookup(loadLocale(locale), key);
    if (val === undefined) val = lookup(loadLocale('en'), key);
    if (val && typeof val === 'object') {
      const n = Number(h.count);
      val = (n === 1 ? val.one : n === 0 && val.zero ? val.zero : val.other) ?? val.other ?? val.one;
    }
    if (val === undefined) return `translation missing: ${locale}.${key}`;
    return String(val).replace(/{{\s*(\w+)\s*}}/g, (m, k) => (h[k] !== undefined ? h[k] : m));
  });

  // ---- Strings ------------------------------------------------------------------
  F('handle', handleize);
  F('handleize', handleize);
  F('camelize', (s) => String(s ?? '').replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^\w/, (c) => c.toUpperCase()));
  F('pluralize', (n, one, many) => (Number(n) === 1 ? one : many));
  F('highlight', (text, q) => (q ? String(text).replace(new RegExp(`(${String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<strong class="highlight">$1</strong>') : text));
  F('md5', (s) => Buffer.from(String(s)).toString('hex').slice(0, 32));
  F('sha256', (s) => Buffer.from(String(s)).toString('hex').slice(0, 64));
  F('hmac_sha256', (s) => Buffer.from(String(s)).toString('hex').slice(0, 64));
  F('base64_encode', (s) => Buffer.from(String(s ?? '')).toString('base64'));
  F('base64_decode', (s) => Buffer.from(String(s ?? ''), 'base64').toString('utf8'));
  F('format_address', (a) => (a ? `<p>${[a.name, a.company, a.address1, a.address2, [a.city, a.province, a.zip].filter(Boolean).join(' '), a.country, a.phone].filter(Boolean).map(esc).join('<br>')}</p>` : ''));
  F('weight_with_unit', (w, unit) => `${Number(w) >= 1000 ? (Number(w) / 1000).toFixed(1) + ' kg' : `${w} ${unit || 'g'}`}`);
  F('time_tag', (d, fmt) => { const dt = new Date(d); return `<time datetime="${dt.toISOString()}">${dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</time>`; });
  F('json', (o) => JSON.stringify(o ?? null, (k, v) => (k === 'collections' || k === 'product' ? undefined : v)));
  F('default_errors', () => '');
  F('default_pagination', (p) => (p?.parts || []).map((x) => (x.is_link ? `<a href="${x.url}">${x.title}</a>` : `<span>${x.title}</span>`)).join(' '));
  F('sort_natural', (a, key) => (Array.isArray(a) ? [...a].sort((x, y) => String(key ? x[key] : x).localeCompare(String(key ? y[key] : y), undefined, { sensitivity: 'base' })) : a));
  F('item_count_for_variant', (cart, id) => (cart?.items || []).filter((i) => i.variant_id === Number(id)).reduce((s, i) => s + i.quantity, 0));
  F('line_items_for', (cart) => cart?.items || []);
  F('metafield_tag', (m) => esc(m?.value ?? ''));
  F('metafield_text', (m) => (m?.value ?? ''));

  // ---- Fonts (font_picker settings are strings in the mock) --------------------
  F('font_face', () => '');
  F('font_url', () => '');
  F('font_modify', (f) => f);

  // ---- Colors -------------------------------------------------------------------
  const rgb = (c) => { const h = String(c || '#000').replace('#', ''); const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h; return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) || 0); };
  const hex = ([r, g, b]) => '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  F('color_to_rgb', (c) => `rgb(${rgb(c).join(', ')})`);
  F('color_to_hex', (c) => hex(rgb(c)));
  F('color_extract', (c, ch) => { const [r, g, b] = rgb(c); const hsl = rgbToHsl(r, g, b); return { red: r, green: g, blue: b, hue: hsl[0], saturation: hsl[1], lightness: hsl[2], alpha: 1 }[ch]; });
  F('color_modify', (c, ch, v) => { if (ch === 'alpha') { const [r, g, b] = rgb(c); return `rgba(${r}, ${g}, ${b}, ${v})`; } return c; });
  F('color_lighten', (c, p) => hex(rgb(c).map((x) => x + (255 - x) * (p / 100))));
  F('color_darken', (c, p) => hex(rgb(c).map((x) => x * (1 - p / 100))));
  F('color_saturate', (c) => c);
  F('color_desaturate', (c) => c);
  F('color_mix', (a, b, w) => hex(rgb(a).map((x, i) => x * (w / 100) + rgb(b)[i] * (1 - w / 100))));
  F('color_brightness', (c) => { const [r, g, b] = rgb(c); return Math.round((r * 299 + g * 587 + b * 114) / 1000); });
  F('brightness_difference', (a, b) => { const br = (c) => { const [r, g, bb] = rgb(c); return (r * 299 + g * 587 + bb * 114) / 1000; }; return Math.round(Math.abs(br(a) - br(b))); });
  F('color_contrast', () => 4.5);
  F('color_difference', () => 500);

  // ---- Misc overrides -----------------------------------------------------------
  F('escape', (s) => esc(s));
  F('escape_once', (s) => esc(String(s ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]))));
  F('strip_html', (s) => String(s ?? '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ''));
  F('where', (arr, key, val) => (Array.isArray(arr) ? arr.filter((x) => (val === undefined ? !!x?.[key] : x?.[key] === val)) : []));
  F('date', (d, ...args) => {
    if (!d) return '';
    const h = hashArgs(args);
    let fmt = typeof args[0] === 'string' ? args[0] : null;
    if (h.format) { const lf = lookup(loadLocale('en'), `date_formats.${h.format}`); fmt = lf || '%B %d, %Y'; }
    const dt = d === 'now' || d === 'today' ? new Date() : new Date(d);
    if (isNaN(dt)) return d;
    return strftime(dt, fmt || '%b %d, %Y');
  });
}

function handleize(s) { return String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/[\s-]+/g, '-'); }

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function strftime(d, fmt) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pad = (n) => String(n).padStart(2, '0');
  return fmt.replace(/%([a-zA-Z%-])/g, (m, c) => ({
    Y: d.getFullYear(), y: String(d.getFullYear()).slice(2), m: pad(d.getMonth() + 1), d: pad(d.getDate()), e: d.getDate(), '-d': d.getDate(), B: months[d.getMonth()], b: months[d.getMonth()].slice(0, 3),
    A: days[d.getDay()], a: days[d.getDay()].slice(0, 3), H: pad(d.getHours()), M: pad(d.getMinutes()), S: pad(d.getSeconds()), I: pad(d.getHours() % 12 || 12), p: d.getHours() < 12 ? 'AM' : 'PM', '%': '%',
  }[c] ?? m));
}
