/*
 * Local preview harness for the LINUX theme.
 *
 * Renders the Shopify theme in ../theme with LiquidJS against a mock storefront
 * built from a snapshot of the live store's catalog (data/*.json). It emulates
 * the Liquid objects, filters, tags, AJAX Cart API, Section Rendering API and
 * predictive search that the theme relies on, so pages can be exercised in a
 * browser without a Shopify store. It is a development aid only and is not part
 * of the theme package.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid, Tag, Value } from 'liquidjs';
import { buildStore } from './store.mjs';
import { registerFilters } from './filters.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THEME = path.resolve(__dirname, '../theme');
const PORT = Number(process.env.PORT || 3000);

const store = buildStore(path.join(__dirname, 'data'));

// ---------------------------------------------------------------------------
// Liquid engine
// ---------------------------------------------------------------------------
const engine = new Liquid({
  root: [path.join(THEME, 'snippets')],
  partials: [path.join(THEME, 'snippets')],
  extname: '.liquid',
  jsTruthy: false,
  strictFilters: false,
  strictVariables: false,
  cache: false,
  ownPropertyOnly: false,
  relativeReference: false,
});

registerFilters(engine, store);

// {% schema %} … {% endschema %} → nothing
engine.registerTag('schema', {
  parse(tagToken, remainTokens) {
    this.tokens = [];
    const stream = this.liquid.parser.parseStream(remainTokens);
    stream.on('tag:endschema', () => stream.stop()).on('token', (t) => this.tokens.push(t)).on('end', () => { throw new Error('endschema missing'); });
    stream.start();
  },
  render() { return ''; },
});

function wrapTag(name, open, close) {
  engine.registerTag(name, {
    parse(tagToken, remainTokens) {
      this.tpls = [];
      const stream = this.liquid.parser.parseStream(remainTokens);
      stream.on(`tag:end${name}`, () => stream.stop())
        .on('template', (tpl) => this.tpls.push(tpl))
        .on('end', () => { throw new Error(`end${name} missing`); });
      stream.start();
    },
    * render(ctx, emitter) {
      emitter.write(open);
      yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
      emitter.write(close);
    },
  });
}
wrapTag('style', '<style data-shopify>', '</style>');
wrapTag('stylesheet', '<style>', '</style>');
wrapTag('javascript', '<script>', '</script>');

// {% form 'type', object, attr: value %}
const FORM_ACTIONS = {
  product: (o) => ['/cart/add', 'post', 'multipart/form-data', '<input type="hidden" name="form_type" value="product"><input type="hidden" name="utf8" value="✓">'],
  cart: () => ['/cart', 'post', null, '<input type="hidden" name="form_type" value="cart">'],
  customer_login: () => ['/account/login', 'post', null, '<input type="hidden" name="form_type" value="customer_login">'],
  create_customer: () => ['/account', 'post', null, '<input type="hidden" name="form_type" value="create_customer">'],
  recover_customer_password: () => ['/account/recover', 'post', null, '<input type="hidden" name="form_type" value="recover_customer_password">'],
  reset_customer_password: () => ['/account/reset', 'post', null, '<input type="hidden" name="form_type" value="reset_customer_password">'],
  activate_customer_password: () => ['/account/activate', 'post', null, '<input type="hidden" name="form_type" value="activate_customer_password">'],
  customer_address: () => ['/account/addresses', 'post', null, '<input type="hidden" name="form_type" value="customer_address">'],
  customer: () => ['/contact#newsletter', 'post', null, '<input type="hidden" name="form_type" value="customer"><input type="hidden" name="contact[tags]" value="newsletter">'],
  contact: () => ['/contact#contact', 'post', null, '<input type="hidden" name="form_type" value="contact">'],
  localization: () => ['/localization', 'post', null, '<input type="hidden" name="form_type" value="localization"><input type="hidden" name="return_to" value="/">'],
  storefront_password: () => ['/password', 'post', null, '<input type="hidden" name="form_type" value="storefront_password">'],
};
engine.registerTag('form', {
  parse(tagToken, remainTokens) {
    // Hand-parse: `'type', obj, attr: value, data-x: ''` — LiquidJS's readHash
    // rejects hyphenated names, which Shopify's form tag accepts.
    const src = tagToken.args.trim();
    const parts = [];
    let cur = '', q = null;
    for (const ch of src) {
      if (q) { cur += ch; if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === ',') { parts.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    this.type = parts.shift();
    this.args = [];
    this.attrs = {};
    for (const p of parts) {
      const m = p.match(/^([\w-]+)\s*:\s*(.*)$/s);
      if (m) this.attrs[m[1]] = m[2]; else this.args.push(p);
    }
    this.tpls = [];
    const stream = this.liquid.parser.parseStream(remainTokens);
    stream.on('tag:endform', () => stream.stop()).on('template', (t) => this.tpls.push(t)).on('end', () => { throw new Error('endform missing'); });
    stream.start();
  },
  * render(ctx, emitter) {
    const type = yield this.liquid.evalValue(this.type, ctx);
    const attrs = {};
    for (const [k, v] of Object.entries(this.attrs)) attrs[k] = yield this.liquid.evalValue(v, ctx);
    const builder = FORM_ACTIONS[type] || (() => ['/', 'post', null, '']);
    let [action, method, enctype, hidden] = builder();
    // Shopify emits locale-aware action URLs (/ar/account/login …)
    const prefix = ctx.get(['routes', 'root_url']);
    if (prefix && prefix !== '/') action = prefix.replace(/\/$/, '') + action;
    const attrStr = Object.entries(attrs).map(([k, v]) => ` ${k}="${String(v ?? '').replace(/"/g, '&quot;')}"`).join('');
    emitter.write(`<form action="${action}" method="${method}"${enctype ? ` enctype="${enctype}"` : ''}${attrStr} accept-charset="UTF-8">${hidden}`);
    ctx.push({ form: store.formObject(type, ctx.environments.request) });
    yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    ctx.pop();
    emitter.write('</form>');
  },
});

// {% paginate collection.products by 12 %}
engine.registerTag('paginate', {
  parse(tagToken, remainTokens) {
    const tk = this.tokenizer;
    this.collection = tk.readValue();
    tk.skipBlank();
    tk.readWord(); // by
    this.size = tk.readValue();
    this.tpls = [];
    const stream = this.liquid.parser.parseStream(remainTokens);
    stream.on('tag:endpaginate', () => stream.stop()).on('template', (t) => this.tpls.push(t)).on('end', () => { throw new Error('endpaginate missing'); });
    stream.start();
  },
  * render(ctx, emitter) {
    const items = (yield this.liquid.evalValue(this.collection.getText(), ctx)) || [];
    const size = Number(yield this.liquid.evalValue(this.size.getText(), ctx)) || 12;
    const req = ctx.environments.request;
    const page = Math.max(1, Number(req.query.page || 1));
    const pages = Math.max(1, Math.ceil(items.length / size));
    const slice = items.slice((page - 1) * size, page * size);
    const root = (ctx.get(['routes', 'root_url']) || '/').replace(/\/$/, '');
    const urlFor = (p) => { const u = new URL(root + req.path, 'http://x'); for (const [k, v] of Object.entries(req.query)) if (k !== 'page') u.searchParams.set(k, v); if (p > 1) u.searchParams.set('page', p); return u.pathname + u.search; };
    const parts = [];
    for (let p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 1) parts.push({ title: String(p), url: urlFor(p), is_link: p !== page });
      else if (parts[parts.length - 1]?.title !== '…') parts.push({ title: '…', url: '', is_link: false });
    }
    const paginate = {
      current_page: page, current_offset: (page - 1) * size, items: items.length, page_size: size, pages, parts,
      next: page < pages ? { title: 'Next', url: urlFor(page + 1), is_link: true } : null,
      previous: page > 1 ? { title: 'Previous', url: urlFor(page - 1), is_link: true } : null,
      page_param: 'page',
    };
    // Swap the paginated collection's products for the current slice.
    const collPath = this.collection.getText().split('.');
    const scopeObj = ctx.get(collPath.slice(0, -1));
    const key = collPath[collPath.length - 1];
    const original = scopeObj ? scopeObj[key] : undefined;
    if (scopeObj) scopeObj[key] = slice;
    ctx.push({ paginate });
    yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    ctx.pop();
    if (scopeObj) scopeObj[key] = original;
  },
});

// {% section 'name' %} — static section
engine.registerTag('section', {
  parse() { this.name = this.tokenizer.readValue(); },
  * render(ctx) {
    const name = yield this.liquid.evalValue(this.name.getText(), ctx);
    return yield renderSection(name, name, {}, [], ctx.environments);
  },
});

// {% sections 'group' %} — section group
engine.registerTag('sections', {
  parse() { this.name = this.tokenizer.readValue(); },
  * render(ctx) {
    const name = yield this.liquid.evalValue(this.name.getText(), ctx);
    const group = readJSON(path.join(THEME, 'sections', `${name}.json`));
    let out = '';
    for (const id of group.order) {
      const s = group.sections[id];
      if (s.disabled) continue;
      out += yield renderSection(s.type, id, s.settings || {}, blocksOf(s), ctx.environments);
    }
    return out;
  },
});

// {% layout none %}
engine.registerTag('layout', {
  parse() { this.name = this.tokenizer.readValue(); },
  * render(ctx) {
    const v = this.name?.getText?.() || 'none';
    ctx.environments.__layout = v === 'none' ? null : v.replace(/['"]/g, '');
    return '';
  },
});

// ---------------------------------------------------------------------------
// Section / template rendering
// ---------------------------------------------------------------------------
const sectionCache = new Map();
function loadSection(type) {
  const file = path.join(THEME, 'sections', `${type}.liquid`);
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  let schema = { settings: [], blocks: [] };
  if (m) {
    try { schema = JSON.parse(m[1]); } catch (e) { console.error(`[schema] ${type}: ${e.message}`); }
  }
  const body = src.replace(/{%-?\s*schema\s*-?%}[\s\S]*?{%-?\s*endschema\s*-?%}/, '');
  return { body, schema, file };
}

function schemaDefaults(list = []) {
  const out = {};
  for (const s of list) if (s.id && s.default !== undefined) out[s.id] = s.default;
  return out;
}

function blocksOf(s) {
  if (!s.blocks) return [];
  const order = s.block_order || Object.keys(s.blocks);
  return order.map((bid) => ({ id: bid, type: s.blocks[bid].type, settings: s.blocks[bid].settings || {} }));
}

async function renderSection(type, id, settings, blocks, env) {
  const sec = loadSection(type);
  if (!sec) return `<!-- section ${type} missing -->`;
  const merged = { ...schemaDefaults(sec.schema.settings), ...resolveSettings(settings, env) };
  const blockSchemas = Object.fromEntries((sec.schema.blocks || []).map((b) => [b.type, b]));
  const fullBlocks = blocks.map((b, i) => ({
    id: b.id, type: b.type, shopify_attributes: '', index: i + 1, index0: i,
    settings: { ...schemaDefaults(blockSchemas[b.type]?.settings), ...resolveSettings(b.settings, env) },
  }));
  const section = { id, settings: merged, blocks: fullBlocks, index: 1, index0: 0, location: 'template' };
  try {
    const html = await engine.parseAndRender(sec.body, { ...env, section }, { globals: globalsOf(env) });
    return `<div id="shopify-section-${id}" class="shopify-section shopify-section--${type}">${html}</div>`;
  } catch (e) {
    console.error(`[render] section ${type}: ${e.message}`);
    return `<div style="padding:24px;background:#400;color:#fff;font:14px monospace"><b>Section "${type}" error:</b> ${escapeHtml(e.message)}</div>`;
  }
}

// Shopify exposes these inside {% render %} (which is otherwise isolated).
const GLOBAL_KEYS = ['shop', 'settings', 'routes', 'cart', 'customer', 'linklists', 'collections', 'all_products', 'pages', 'blogs', 'images', 'request', 'localization', 'canonical_url', 'template', 'page_title', 'page_description', 'current_tags', 'current_page', '__locale', 'product', 'collection', 'page', 'blog', 'article', 'search', 'recommendations'];
function globalsOf(env) {
  const g = {};
  for (const k of GLOBAL_KEYS) if (env[k] !== undefined) g[k] = env[k];
  return g;
}

// Settings that reference store objects (collection handles, products, menus,
// images) are resolved into the mock objects Shopify would provide.
function resolveSettings(settings, env) {
  const out = {};
  for (const [k, v] of Object.entries(settings || {})) {
    if (typeof v === 'string' && /^shopify:\/\/collections\//.test(v)) out[k] = env.__lz ? env.__lz(store.collections[v.split('/').pop()] || null) : (store.collections[v.split('/').pop()] || null);
    else if (typeof v === 'string' && /^shopify:\/\/products\//.test(v)) out[k] = env.__lz ? env.__lz(store.productByHandle(v.split('/').pop()) || null) : (store.productByHandle(v.split('/').pop()) || null);
    else if (typeof v === 'string' && /^shopify:\/\/shop_images\//.test(v)) out[k] = store.imageObject('/assets/' + v.split('/').pop());
    else if (typeof v === 'string' && /^\/(collections|products|pages|blogs|search|cart|account|policies)(\/|\?|$)/.test(v) && env.routes?.root_url && env.routes.root_url !== '/') out[k] = env.routes.root_url.replace(/\/$/, '') + v; // Shopify localizes url settings
    else out[k] = v;
  }
  return out;
}

function readJSON(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

async function renderTemplate(name, env) {
  const jsonFile = path.join(THEME, 'templates', `${name}.json`);
  const liquidFile = path.join(THEME, 'templates', `${name}.liquid`);
  if (fs.existsSync(jsonFile)) {
    const tpl = readJSON(jsonFile);
    let out = '';
    for (const id of tpl.order) {
      const s = tpl.sections[id];
      if (s.disabled) continue;
      out += await renderSection(s.type, id, s.settings || {}, blocksOf(s), env);
    }
    return { html: out, layout: tpl.layout === false ? null : (tpl.layout || 'theme') };
  }
  if (fs.existsSync(liquidFile)) {
    const src = fs.readFileSync(liquidFile, 'utf8');
    const html = await engine.parseAndRender(src, env, { globals: globalsOf(env) });
    return { html, layout: env.__layout === undefined ? 'theme' : env.__layout };
  }
  return null;
}

async function renderPage(templateName, env) {
  const tpl = await renderTemplate(templateName, env);
  if (!tpl) return null;
  const layoutName = tpl.layout === undefined ? 'theme' : tpl.layout;
  if (!layoutName) return tpl.html;
  const layout = fs.readFileSync(path.join(THEME, 'layout', `${layoutName}.liquid`), 'utf8');
  return engine.parseAndRender(layout, { ...env, content_for_layout: tpl.html }, { globals: globalsOf(env) });
}

function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };

function send(res, status, body, type = 'text/html; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function json(res, obj, status = 200) { send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8'); }

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/json')) { try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { return {}; } }
  if (ct.includes('multipart/form-data')) return parseMultipart(raw, ct);
  return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
}
function parseMultipart(raw, ct) {
  const boundary = ct.split('boundary=')[1];
  const out = {};
  if (!boundary) return out;
  for (const part of raw.toString('latin1').split(`--${boundary}`)) {
    const m = part.match(/name="([^"]+)"(?:; filename="([^"]*)")?\r\n(?:Content-Type: [^\r\n]+\r\n)?\r\n([\s\S]*)\r\n$/);
    if (!m) continue;
    out[m[1]] = m[2] !== undefined ? (m[2] ? `upload:${m[2]}` : '') : Buffer.from(m[3], 'latin1').toString('utf8');
  }
  return out;
}
// Expand a[b][c]=v style keys into nested objects (properties[Design], etc.)
function nest(flat) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    const keys = k.replace(/\]/g, '').split('[');
    let o = out;
    keys.forEach((kk, i) => { if (i === keys.length - 1) o[kk] = v; else o = o[kk] = o[kk] || {}; });
  }
  return out;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(url.pathname);
    const query = Object.fromEntries(url.searchParams);

    // Dev-only: side-by-side phone frames for mobile layout checks
    if (pathname === '/__device') return send(res, 200, fs.readFileSync(path.join(__dirname, 'scripts/device-frame.html'), 'utf8'));

    // Static theme assets
    if (pathname.startsWith('/assets/')) {
      const file = path.join(THEME, 'assets', path.basename(pathname).split('?')[0]);
      if (!fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
      const stat = fs.statSync(file);
      const ext = path.extname(file).toLowerCase();
      const range = req.headers.range;
      if (range && ext === '.mp4') {
        const [s, e] = range.replace('bytes=', '').split('-');
        const start = Number(s); const end = e ? Number(e) : stat.size - 1;
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': MIME[ext] });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' });
      return fs.createReadStream(file).pipe(res);
    }

    // Locale prefix (/ar/...)
    let locale = 'en';
    if (pathname === '/ar' || pathname.startsWith('/ar/')) { locale = 'ar'; pathname = pathname.slice(3) || '/'; }
    const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]));
    const env = store.environment({ locale, path: pathname, query, cookies });
    const rootPrefix = locale === 'ar' ? '/ar' : '';

    // ---- AJAX / JSON APIs ------------------------------------------------
    if (pathname === '/cart.js' || pathname === '/cart.json') return json(res, store.cartJSON());
    if (pathname === '/cart/add.js' || pathname === '/cart/add') {
      const body = nest(await readBody(req));
      const items = body.items || [{ id: body.id, quantity: body.quantity || 1, properties: body.properties }];
      let last;
      for (const it of items) {
        try { last = store.cartAdd(Number(it.id), Number(it.quantity || 1), it.properties || {}); }
        catch (e) { return json(res, { status: 422, message: 'Cart Error', description: e.message }, 422); }
      }
      if (pathname === '/cart/add') return send(res, 302, '', 'text/plain', { Location: `${rootPrefix}/cart` });
      return json(res, items.length > 1 ? { items: store.cartJSON().items } : last);
    }
    if (pathname === '/cart/change.js') { const b = await readBody(req); store.cartChange(b.id || b.line, Number(b.quantity)); return json(res, store.cartJSON()); }
    if (pathname === '/cart/update.js') { const b = nest(await readBody(req)); if (b.discount !== undefined) store.setDiscounts(String(b.discount)); if (b.updates) for (const [k, q] of Object.entries(b.updates)) store.cartChange(k, Number(q)); if (b.note !== undefined) store.cart.note = b.note; return json(res, store.cartJSON()); }
    if (pathname === '/cart/clear.js') { store.cartClear(); return json(res, store.cartJSON()); }
    if (pathname === '/cart' && req.method === 'POST') {
      const b = nest(await readBody(req));
      if (b.updates) Object.entries(b.updates).forEach(([k, q]) => store.cartChange(k, Number(q)));
      if (b.checkout !== undefined) return send(res, 302, '', 'text/plain', { Location: `${rootPrefix}/checkout` });
      return send(res, 302, '', 'text/plain', { Location: `${rootPrefix}/cart` });
    }
    if (pathname === '/checkout' || pathname === '/checkouts') return send(res, 200, '<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:40px;background:#043222;color:#f4e8d8"><h1>Checkout (mock)</h1><p>On Shopify this is the hosted checkout.</p><a href="/" style="color:#8fcb5a">← Back</a>');
    if (pathname === '/search/suggest.json') return json(res, store.predictiveSearch(query.q || '', query));
    if (pathname === '/recommendations/products.json') return json(res, { products: store.recommendations(Number(query.product_id), Number(query.limit || 4)).map((p) => store.productJSON(p)) });
    if (pathname === '/localization' && req.method === 'POST') {
      const b = await readBody(req);
      const target = b.language_code === 'ar' ? '/ar' : '';
      const back = (b.return_to || '/').replace(/^\/ar(?=\/|$)/, '') || '/';
      return send(res, 302, '', 'text/plain', { Location: `${target}${back}` || '/' });
    }
    const pjs = pathname.match(/^\/products\/([^/]+)\.js(?:on)?$/);
    if (pjs) { const p = store.productByHandle(pjs[1]); return p ? json(res, store.productJSON(p)) : json(res, { error: 'not found' }, 404); }
    const cjs = pathname.match(/^\/collections\/([^/]+)\/products\.json$/);
    if (cjs) { const c = store.collections[cjs[1]]; return c ? json(res, { products: c.products.map((p) => store.productJSON(p)) }) : json(res, { products: [] }); }

    // Form posts that would go to Shopify — accept and redirect with a flag.
    if (req.method === 'POST') {
      const b = nest(await readBody(req));
      const type = b.form_type;
      if (type === 'customer_login') { store.loginMock(); return send(res, 302, '', 'text/plain', { Location: `${rootPrefix}/account` }); }
      if (type === 'create_customer') { store.loginMock(); return send(res, 302, '', 'text/plain', { Location: `${rootPrefix}/account` }); }
      if (type === 'customer_address') return send(res, 302, '', 'text/plain', { Location: `${rootPrefix}/account/addresses` });
      if (type === 'storefront_password') return send(res, 302, '', 'text/plain', { Location: `${rootPrefix}/` });
      return send(res, 302, '', 'text/plain', { Location: `${rootPrefix}${pathname}?posted=1${pathname.includes('#') ? '' : ''}` });
    }
    if (pathname === '/account/logout') { store.logoutMock(); return send(res, 302, '', 'text/plain', { Location: `${rootPrefix}/` }); }

    // ---- Storefront pages ------------------------------------------------
    const route = store.route(pathname, query, env);
    if (!route) return send(res, 404, await renderPage('404', { ...env, template: { name: '404', suffix: null, directory: null }, page_title: 'Not found' }));

    // Section Rendering API — ids resolve against the current template's
    // JSON first (like Shopify), then the header/footer section groups, then
    // a bare section file name.
    const sectionSpec = (id) => {
      const jsonFile = path.join(THEME, 'templates', `${route.template}.json`);
      if (fs.existsSync(jsonFile)) {
        const s = readJSON(jsonFile).sections[id];
        if (s) return { type: s.type, settings: s.settings || {}, blocks: blocksOf(s) };
      }
      return { type: id, settings: store.sectionSettingsFor(id), blocks: store.sectionBlocksFor(id) };
    };
    if (query.section_id) {
      const spec = sectionSpec(query.section_id);
      const html = await renderSection(spec.type, query.section_id, spec.settings, spec.blocks, { ...env, ...route.env });
      return send(res, 200, html);
    }
    if (query.sections) {
      const out = {};
      for (const id of query.sections.split(',')) {
        const spec = sectionSpec(id);
        out[id] = await renderSection(spec.type, id, spec.settings, spec.blocks, { ...env, ...route.env });
      }
      return json(res, out);
    }

    const html = await renderPage(route.template, { ...env, ...route.env });
    if (html === null) return send(res, 404, `template ${route.template} not found`, 'text/plain');
    return send(res, route.status || 200, html);
  } catch (e) {
    console.error(e);
    return send(res, 500, `<pre style="padding:24px;font:14px monospace;background:#300;color:#fff">${escapeHtml(e.stack || e.message)}</pre>`);
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`LINUX theme preview → http://localhost:${PORT}`));
