/*
 * Mock storefront for the preview harness. Builds Liquid-shaped objects
 * (product, collection, cart, shop, linklists, …) from a snapshot of the live
 * store's public JSON so the theme renders realistic data offline.
 */
import fs from 'node:fs';
import path from 'node:path';

const readJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

export function buildStore(dataDir) {
  const themeDir = path.resolve(dataDir, '../../theme');
  const listing = readJSON(path.join(dataDir, 'products.json')).products;
  const collectionsRaw = readJSON(path.join(dataDir, 'collections.json')).collections;

  // ---- Products -------------------------------------------------------------
  const products = listing.map((p, idx) => {
    const js = readJSON(path.join(dataDir, `product-${p.handle}.json`));
    return makeProduct(js, p, idx);
  });
  const byHandle = Object.fromEntries(products.map((p) => [p.handle, p]));
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const variantsById = {};
  for (const p of products) for (const v of p.variants) variantsById[v.id] = { variant: v, product: p };

  // ---- Collections ----------------------------------------------------------
  const collections = {};
  for (const c of collectionsRaw) {
    const handles = readJSON(path.join(dataDir, `collection-${c.handle}.json`)).products.map((p) => p.handle);
    collections[c.handle] = makeCollection(c, handles.map((h) => byHandle[h]).filter(Boolean));
  }
  collections.all = makeCollection({ id: 0, title: 'All products', handle: 'all', description: '' }, products);
  for (const p of products) p.collections = Object.values(collections).filter((c) => c.handle !== 'all' && c.products.includes(p));

  // ---- Pages / blog ---------------------------------------------------------
  const pages = {
    about: page('about', 'Our story', `<p>LINUX is a Cairo streetwear label. Every piece is embroidered — not printed — so the mark lives in the fabric, not on it. We cut heavyweight melton cotton, stitch it in our Cairo studio and ship it across Egypt.</p><h2>Why embroidery</h2><p>Print cracks. Thread doesn't. Our wordmark is sewn at 4,000 stitches per minute, and it will outlive the hoodie it sits on.</p>`),
    contact: page('contact', 'Contact us', '<p>Questions about an order, a size, or a custom design? Reach us on WhatsApp or drop a message below.</p>'),
    customize: page('customize', 'Customize studio', ''),
    faq: page('faq', 'FAQ', '<h3>Delivery</h3><p>Cairo &amp; Giza 1–2 days, the rest of Egypt 2–4 days.</p><h3>Exchanges</h3><p>14 days, unworn with tags.</p>'),
    'size-guide': page('size-guide', 'Size guide', '<p>All garments are oversized. If you are between sizes, size down.</p>'),
    'shipping-returns': page('shipping-returns', 'Shipping & returns', '<p>Cash on delivery available across Egypt. Exchanges within 14 days.</p>'),
  };
  const articles = [
    article('the-embroidery-issue', 'Why we stitch, not print', '2026-08-12', 'brand-still-life.webp', '<p>Four thousand stitches a minute. A cream thread on forest melton. Here is why every LINUX piece is embroidered.</p><p>Print sits on the fabric. Thread becomes part of it. It survives 100 washes, it catches light, it has weight.</p>', ['Studio']),
    article('fw26-drop-notes', 'FW26 drop notes', '2026-09-01', 'brand-editorial.webp', '<p>Heavier fleece, wider cuts, two new colourways. Everything we changed for the winter drop and why.</p>', ['Drops']),
    article('penguin-origin', 'The penguin: an origin story', '2026-07-20', 'brand-lookbook-2.webp', '<p>How a doodle on a receipt became the face of the brand.</p>', ['Brand']),
  ];
  const blogs = { news: { id: 1, title: 'Journal', handle: 'news', url: '/blogs/news', articles, articles_count: articles.length, all_tags: ['Studio', 'Drops', 'Brand'], comments_enabled: false } };
  for (const a of articles) a.url = `/blogs/news/${a.handle}`;

  // ---- Menus ----------------------------------------------------------------
  const link = (title, url, links = []) => ({ title, url, links, levels: links.length ? 1 : 0, handle: title.toLowerCase().replace(/\s+/g, '-'), type: 'http_link', object: null });
  const linklists = {
    'main-menu': { title: 'Main menu', handle: 'main-menu', links: [
      link('Shop', '/collections/all', [link('Winter collection', '/collections/winter-collection'), link('Summer collection', '/collections/summer-collection'), link('Customize print', '/collections/customize-print'), link('All products', '/collections/all')]),
      link('Customize', '/pages/customize'),
      link('Journal', '/blogs/news'),
      link('About', '/pages/about'),
      link('Contact', '/pages/contact'),
    ] },
    'footer-shop': { title: 'Shop', handle: 'footer-shop', links: [link('Winter collection', '/collections/winter-collection'), link('Summer collection', '/collections/summer-collection'), link('Customize print', '/pages/customize'), link('All products', '/collections/all')] },
    'footer-help': { title: 'Help', handle: 'footer-help', links: [link('Size guide', '/pages/size-guide'), link('Shipping & returns', '/pages/shipping-returns'), link('FAQ', '/pages/faq'), link('Contact', '/pages/contact')] },
    'footer-about': { title: 'About', handle: 'footer-about', links: [link('Our story', '/pages/about'), link('Journal', '/blogs/news'), link('Privacy policy', '/policies/privacy-policy'), link('Terms of service', '/policies/terms-of-service')] },
    'footer': { title: 'Footer', handle: 'footer', links: [link('Search', '/search'), link('Privacy policy', '/policies/privacy-policy'), link('Terms of service', '/policies/terms-of-service')] },
  };

  // ---- Settings -------------------------------------------------------------
  const schema = readJSON(path.join(themeDir, 'config/settings_schema.json'));
  const settingsData = readJSON(path.join(themeDir, 'config/settings_data.json'));
  const settings = {};
  for (const group of schema) for (const s of group.settings || []) if (s.id && s.default !== undefined) settings[s.id] = s.default;
  Object.assign(settings, settingsData.current || {});
  for (const [k, v] of Object.entries(settings)) {
    if (typeof v === 'string' && v.startsWith('shopify://shop_images/')) settings[k] = imageObject('/assets/' + v.split('/').pop());
  }

  // ---- Cart (in-memory, single session) -------------------------------------
  const cart = { items: [], note: '', attributes: {}, discount_codes: [] };
  let customer = null;

  const shop = {
    name: 'LINUX', email: 'hello@linux-eg.com', url: 'https://linux-eg.com', domain: 'linux-eg.com', permanent_domain: 'linux-eg.myshopify.com',
    currency: 'EGP', money_format: 'LE {{amount}}', money_with_currency_format: 'LE {{amount}} EGP', enabled_currencies: [{ iso_code: 'EGP', symbol: 'LE' }],
    description: 'Cairo streetwear. Embroidered, not printed.', phone: '+20 111 035 1549', customer_accounts_enabled: true, customer_accounts_optional: true,
    address: { summary: 'Cairo, Egypt', city: 'Cairo', country: 'Egypt' }, published_locales: [
      { iso_code: 'en', name: 'English', endonym_name: 'English', primary: true, root_url: '/' },
      { iso_code: 'ar', name: 'Arabic', endonym_name: 'العربية', primary: false, root_url: '/ar' },
    ],
    policies: [{ title: 'Privacy policy', url: '/policies/privacy-policy' }, { title: 'Refund policy', url: '/policies/refund-policy' }, { title: 'Terms of service', url: '/policies/terms-of-service' }],
    privacy_policy: { title: 'Privacy policy', url: '/policies/privacy-policy', body: '<p>Mock policy.</p>' },
    refund_policy: { title: 'Refund policy', url: '/policies/refund-policy', body: '<p>Mock policy.</p>' },
    shipping_policy: { title: 'Shipping policy', url: '/policies/shipping-policy', body: '<p>Mock policy.</p>' },
    terms_of_service: { title: 'Terms of service', url: '/policies/terms-of-service', body: '<p>Mock policy.</p>' },
    enabled_payment_types: ['visa', 'master', 'meeza', 'cash_on_delivery'], metafields: {}, brand: {}, types: [...new Set(products.map((p) => p.type))], vendors: ['LINUX'],
  };

  const store = {
    products, collections, pages, blogs, articles, linklists, settings, shop, cart,
    productByHandle: (h) => byHandle[h],
    productById: (id) => byId[id],
    imageObject,

    environment({ locale, path: reqPath, query, cookies }) {
      const root = locale === 'ar' ? '/ar' : '';
      const localeObj = shop.published_locales.find((l) => l.iso_code === locale);
      const routes = {
        root_url: root || '/', account_url: `${root}/account`, account_login_url: `${root}/account/login`, account_logout_url: `${root}/account/logout`,
        account_register_url: `${root}/account/register`, account_addresses_url: `${root}/account/addresses`, account_recover_url: `${root}/account/recover`,
        all_products_collection_url: `${root}/collections/all`, cart_url: `${root}/cart`, cart_add_url: `${root}/cart/add`, cart_change_url: `${root}/cart/change`,
        cart_clear_url: `${root}/cart/clear`, cart_update_url: `${root}/cart/update`, collections_url: `${root}/collections`, search_url: `${root}/search`,
        predictive_search_url: `${root}/search/suggest`, product_recommendations_url: `${root}/recommendations/products`,
      };
      // Shopify emits every object URL under the locale root (/ar/products/…); mirror that here.
      const L = (v, depth = 0) => {
        if (!root || depth > 6) return v;
        if (Array.isArray(v)) return v.map((x) => L(x, depth + 1));
        if (v && typeof v === 'object') {
          const o = {};
          for (const [k, val] of Object.entries(v)) {
            if ((k === 'url' || k === 'customer_url') && typeof val === 'string' && val.startsWith('/') && !val.startsWith(root + '/') && val !== root && !val.startsWith('/assets/') && !val.startsWith('/cdn/')) o[k] = root + val;
            else o[k] = L(val, depth + 1);
          }
          return o;
        }
        return v;
      };
      const lz = (x) => L(x);
      return {
        shop: lz(shop), settings, routes, cart: lz(this.cartObject()), customer: lz(customer), linklists: lz(linklists), collections: lz(collections), all_products: lz(byHandle), pages: lz(pages), blogs: lz(blogs), images: {},
        request: { locale: localeObj, path: reqPath, query, host: 'localhost', design_mode: false, visual_preview_mode: false, page_type: 'index', origin: 'http://localhost:3000' },
        localization: {
          available_languages: shop.published_locales.map((l) => ({ ...l, primary: l.primary })), language: localeObj,
          available_countries: [{ iso_code: 'EG', name: 'Egypt', currency: { iso_code: 'EGP', symbol: 'LE' } }], country: { iso_code: 'EG', name: 'Egypt', currency: { iso_code: 'EGP', symbol: 'LE' } },
          market: { handle: 'eg', id: 1 },
        },
        canonical_url: `https://linux-eg.com${reqPath}`, content_for_header: '<!-- content_for_header (mock) -->', powered_by_link: '', current_tags: null, current_page: Number(query.page || 1),
        template: { name: 'index', suffix: null, directory: null }, page_title: 'LINUX', page_description: shop.description,
        __locale: locale, __cookies: cookies, __lz: lz,
      };
    },

    route(p, query, env) {
      const set = (name, extra = {}, suffix = null) => ({ template: suffix ? `${name}.${suffix}` : name, env: { ...(env.__lz ? env.__lz(extra) : extra), template: { name: name.replace(/^customers\//, ''), suffix, directory: name.startsWith('customers/') ? 'customers' : null }, request: { ...env.request, page_type: name } } });
      if (p === '/' || p === '') return set('index', { page_title: 'LINUX — Cairo streetwear, embroidered' });
      let m;
      if (p === '/collections' || p === '/collections/') return set('list-collections', { collections, page_title: 'Collections' });
      if ((m = p.match(/^\/collections\/([^/]+)(?:\/([^/]+))?$/))) {
        const c = collections[m[1]];
        if (!c) return null;
        const tags = m[2] ? m[2].split('+') : null;
        const view = this.collectionView(c, query, tags);
        return set('collection', { collection: view, current_tags: tags, page_title: c.title });
      }
      // /collections/<c>/products/<p> keeps the collection as breadcrumb context (Shopify behaviour)
      if ((m = p.match(/^(?:\/collections\/([^/]+))?\/products\/([^/]+)$/))) {
        const prod = byHandle[m[2]];
        if (!prod) return null;
        const inColl = m[1] ? collections[m[1]] : null;
        const product = { ...prod };
        if (query.variant) product.selected_variant = prod.variants.find((v) => String(v.id) === query.variant) || null;
        product.selected_or_first_available_variant = product.selected_variant || prod.selected_or_first_available_variant;
        return set('product', { product, collection: inColl || undefined, page_title: prod.title, page_description: prod.description.replace(/<[^>]+>/g, '').slice(0, 160), recommendations: { performed: true, products_count: 4, products: this.recommendations(prod.id, 4), intent: 'related' } });
      }
      if (p === '/cart') return set('cart', { page_title: 'Your bag' });
      if (p === '/search') {
        const q = (query.q || '').trim();
        const results = q ? this.searchProducts(q) : [];
        return set('search', { search: { performed: !!q, terms: q, results_count: results.length, results, types: ['product'] }, page_title: q ? `Search: ${q}` : 'Search' });
      }
      if ((m = p.match(/^\/pages\/([^/]+)$/))) {
        const pg = pages[m[1]];
        if (!pg) return null;
        const suffix = fs.existsSync(path.join(themeDir, 'templates', `page.${m[1]}.json`)) ? m[1] : null;
        return set('page', { page: pg, page_title: pg.title }, suffix);
      }
      if ((m = p.match(/^\/policies\/([^/]+)$/))) return set('page', { page: page(m[1], m[1].replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), '<p>Policy text is managed from Shopify Settings → Policies.</p>'), page_title: 'Policy' });
      if ((m = p.match(/^\/blogs\/([^/]+)$/))) { const b = blogs[m[1]]; return b ? set('blog', { blog: b, page_title: b.title }) : null; }
      if ((m = p.match(/^\/blogs\/([^/]+)\/tagged\/([^/]+)$/))) { const b = blogs[m[1]]; if (!b) return null; const tag = m[2]; const arts = b.articles.filter((a) => a.tags.some((t) => t.toLowerCase().replace(/\s+/g, '-') === tag)); return set('blog', { blog: { ...b, articles: arts, articles_count: arts.length }, current_tags: [tag], page_title: b.title }); }
      if ((m = p.match(/^\/blogs\/([^/]+)\/([^/]+)$/))) { const b = blogs[m[1]]; const a = b?.articles.find((x) => x.handle === m[2]); return a ? set('article', { blog: b, article: a, page_title: a.title }) : null; }
      if (p === '/account/login') return customer ? { ...set('customers/account', { customer }), status: 200 } : set('customers/login', { page_title: 'Sign in' });
      if (p === '/account/register') return set('customers/register', { page_title: 'Create account' });
      if (p === '/account/addresses') return customer ? set('customers/addresses', { customer, page_title: 'Addresses' }) : set('customers/login');
      if ((m = p.match(/^\/account\/orders\/(\w+)$/))) return customer ? set('customers/order', { customer, order: customer.orders[0], page_title: 'Order' }) : set('customers/login');
      if (p === '/account/activate' || p.startsWith('/account/activate/')) return set('customers/activate_account', { page_title: 'Activate' });
      if (p === '/account/reset' || p.startsWith('/account/reset/')) return set('customers/reset_password', { page_title: 'Reset password' });
      if (p === '/account') return customer ? set('customers/account', { customer, page_title: 'Account' }) : set('customers/login', { page_title: 'Sign in' });
      if (p === '/404') return set('404');
      // Dev-only previews of the standalone templates
      if (p === '/password') return set('password', { page_title: 'Coming soon' });
      if (p === '/gift_cards/preview') return set('gift_card', { page_title: 'Gift card', gift_card: { code: 'LNX4PENG9UIN2026', initial_value: 100000, balance: 64900, enabled: true, expired: false, expires_on: '2027-12-31', qr_identifier: 'shopify-giftcard-v1-LNX4PENG9UIN2026', pass_url: null, currency: 'EGP', product: null, properties: {} } });
      return null;
    },

    collectionView(c, query, tags) {
      let list = c.products.slice();
      if (tags) list = list.filter((p) => tags.every((t) => p.tags.map((x) => x.toLowerCase()).includes(t.toLowerCase())));
      const filterTags = Object.entries(query).filter(([k]) => k.startsWith('filter.p.tag')).map(([, v]) => v);
      if (filterTags.length) list = list.filter((p) => filterTags.some((t) => p.tags.includes(t)));
      if (query['filter.v.availability'] === '1') list = list.filter((p) => p.available);
      const min = Number(query['filter.v.price.gte']); const max = Number(query['filter.v.price.lte']);
      if (min) list = list.filter((p) => p.price >= min * 100);
      if (max) list = list.filter((p) => p.price <= max * 100);
      const sort = query.sort_by || c.default_sort_by;
      const sorters = {
        'price-ascending': (a, b) => a.price - b.price, 'price-descending': (a, b) => b.price - a.price,
        'title-ascending': (a, b) => a.title.localeCompare(b.title), 'title-descending': (a, b) => b.title.localeCompare(a.title),
        'created-descending': (a, b) => new Date(b.created_at) - new Date(a.created_at), 'created-ascending': (a, b) => new Date(a.created_at) - new Date(b.created_at),
        'best-selling': () => 0, manual: () => 0,
      };
      if (sorters[sort]) list.sort(sorters[sort]);
      return { ...c, products: list, products_count: list.length, sort_by: sort, current_type: null, current_vendor: null, filters: [] };
    },

    searchProducts(q) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      return products.filter((p) => { const hay = `${p.title} ${p.type} ${p.tags.join(' ')} ${p.description}`.toLowerCase(); return terms.every((t) => hay.includes(t)); });
    },

    predictiveSearch(q, query) {
      const limit = Number(query['resources[limit]'] || 6);
      const found = this.searchProducts(q).slice(0, limit);
      const ql = q.toLowerCase();
      return { resources: { results: {
        products: found.map((p) => ({ id: p.id, title: p.title, handle: p.handle, url: p.url, available: p.available, price: (p.price / 100).toFixed(2), compare_at_price_min: p.compare_at_price ? (p.compare_at_price / 100).toFixed(2) : null, type: p.type, vendor: p.vendor, tags: p.tags, featured_image: p.featured_image ? { url: p.featured_image.src, alt: p.featured_image.alt, width: p.featured_image.width, height: p.featured_image.height } : null, image: p.featured_image?.src, variants: [{ id: p.variants[0].id, price: (p.variants[0].price / 100).toFixed(2), available: p.variants[0].available }] })),
        collections: Object.values(collections).filter((c) => c.handle !== 'all' && c.title.toLowerCase().includes(ql)).slice(0, 3).map((c) => ({ id: c.id, title: c.title, handle: c.handle, url: c.url })),
        pages: Object.values(pages).filter((pg) => pg.title.toLowerCase().includes(ql)).slice(0, 2).map((pg) => ({ title: pg.title, handle: pg.handle, url: pg.url })),
        articles: articles.filter((a) => a.title.toLowerCase().includes(ql)).slice(0, 2).map((a) => ({ title: a.title, handle: a.handle, url: a.url, image: a.image?.src })),
        queries: [],
      } } };
    },

    recommendations(productId, limit) {
      const p = byId[productId];
      const pool = products.filter((x) => x.id !== productId);
      const scored = pool.map((x) => ({ x, s: (p && x.type === p.type ? 2 : 0) + (p ? x.tags.filter((t) => p.tags.includes(t)).length : 0) }));
      return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((s) => s.x);
    },

    // ---- Cart -------------------------------------------------------------
    cartAdd(variantId, qty, properties) {
      const hit = variantsById[variantId];
      if (!hit) throw new Error('Variant not found');
      if (!hit.variant.available) throw new Error(`${hit.product.title} — ${hit.variant.title} is sold out`);
      const propKey = JSON.stringify(properties || {});
      const key = `${variantId}:${Buffer.from(propKey).toString('base64').slice(0, 12)}`;
      let line = cart.items.find((i) => i.key === key);
      if (line) line.quantity += qty; else { line = { key, variant_id: variantId, quantity: qty, properties: properties || {} }; cart.items.unshift(line); }
      return this.lineJSON(line);
    },
    cartChange(idOrLine, qty) {
      let idx = cart.items.findIndex((i) => i.key === idOrLine || String(i.variant_id) === String(idOrLine));
      if (idx === -1 && /^\d+$/.test(String(idOrLine)) && Number(idOrLine) <= cart.items.length) idx = Number(idOrLine) - 1;
      if (idx === -1) return;
      if (qty <= 0) cart.items.splice(idx, 1); else cart.items[idx].quantity = qty;
    },
    cartClear() { cart.items = []; },
    lineJSON(line) {
      const { variant, product } = variantsById[line.variant_id];
      const img = variant.featured_image || product.featured_image;
      return {
        id: variant.id, key: line.key, variant_id: variant.id, product_id: product.id, quantity: line.quantity, title: `${product.title} - ${variant.title}`,
        product_title: product.title, variant_title: variant.title === 'Default Title' ? null : variant.title, price: variant.price, original_price: variant.price, final_price: variant.price,
        line_price: variant.price * line.quantity, original_line_price: variant.price * line.quantity, final_line_price: variant.price * line.quantity,
        url: product.url, image: img?.src || null, featured_image: img ? { url: img.src, aspect_ratio: img.aspect_ratio, alt: img.alt } : null, handle: product.handle, vendor: product.vendor, product_type: product.type,
        sku: variant.sku, grams: variant.weight, requires_shipping: true, properties: line.properties, options_with_values: product.options.map((o, i) => ({ name: o, value: variant.options[i] })),
        variant_options: variant.options, discounts: [], line_level_discount_allocations: [], product_has_only_default_variant: product.has_only_default_variant,
      };
    },
    setDiscounts(csv) { cart.discount_codes = csv.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean); },
    cartJSON() {
      const items = cart.items.map((l) => this.lineJSON(l));
      const total = items.reduce((s, i) => s + i.final_line_price, 0);
      // Mock discount codes: LINUX10 = 10%, FLOCK = 15%; anything else is kept but flagged applicable:false (Shopify semantics)
      const RATES = { LINUX10: 0.10, FLOCK: 0.15 };
      const discount_codes = (cart.discount_codes || []).map((code) => ({ code, applicable: code in RATES }));
      const rate = discount_codes.reduce((r, c) => r + (RATES[c.code] || 0), 0);
      const total_discount = Math.round(total * rate);
      const total_price = total - total_discount;
      return { token: 'mock', note: cart.note, attributes: cart.attributes, discount_codes, original_total_price: total, total_price, total_discount, total_weight: 0, item_count: items.reduce((s, i) => s + i.quantity, 0), items, requires_shipping: true, currency: 'EGP', items_subtotal_price: total, cart_level_discount_applications: [] };
    },
    cartObject() {
      const j = this.cartJSON();
      const items = j.items.map((i) => {
        const { variant, product } = variantsById[i.variant_id];
        const img = variant.featured_image || product.featured_image;
        return { ...i, product, variant, image: img, properties: i.properties, title: product.title, url: product.url };
      });
      return { ...j, items, 'empty?': items.length === 0, checkout_charge_amount: j.total_price, discount_applications: [], taxes_included: false, duties_included: false };
    },

    // ---- Customer mock ----------------------------------------------------
    loginMock() {
      const order = { id: 1001, name: '#1001', order_number: 1001, created_at: '2026-08-30T10:00:00Z', financial_status: 'paid', financial_status_label: 'Paid', fulfillment_status: 'fulfilled', fulfillment_status_label: 'Fulfilled', total_price: products[0].price, subtotal_price: products[0].price, total_shipping_price: 0, shipping_price: 0, tax_price: 0, total_discounts: 0, customer_url: '/account/orders/1001', line_items: [{ title: products[0].title, quantity: 1, final_line_price: products[0].price, final_price: products[0].price, original_price: products[0].price, url: products[0].url, image: products[0].featured_image, product: products[0], variant_title: products[0].variants[0].title, sku: '', properties: {} }], shipping_address: { name: 'Omar K.', address1: '12 Tahrir St', city: 'Cairo', country: 'Egypt', phone: '+20 100 000 0000' }, billing_address: { name: 'Omar K.', address1: '12 Tahrir St', city: 'Cairo', country: 'Egypt' }, shipping_methods: [{ title: 'Cairo courier', price: 0 }], transactions: [] };
      const addr = { id: 1, first_name: 'Omar', last_name: 'K.', name: 'Omar K.', address1: '12 Tahrir St', address2: '', city: 'Cairo', province: 'Cairo', zip: '11511', country: 'Egypt', country_code: 'EG', phone: '+20 100 000 0000', company: '', url: '/account/addresses/1' };
      customer = { id: 1, first_name: 'Omar', last_name: 'K.', name: 'Omar K.', email: 'omar@example.com', phone: addr.phone, accepts_marketing: true, orders: [order], orders_count: 1, addresses: [addr], addresses_count: 1, default_address: addr, tags: [], total_spent: order.total_price, has_account: true };
    },
    logoutMock() { customer = null; },
    get customer() { return customer; },

    formObject(type, request) {
      const posted = request?.query?.posted === '1';
      const base = { errors: null, 'posted_successfully?': posted, posted_successfully: posted, email: '', author: '', body: '', password_needed: false };
      if (type === 'customer_address') return { ...base, id: 'new', first_name: '', last_name: '', address1: '', address2: '', city: '', province: '', zip: '', country: '', phone: '', company: '', set_as_default_checkbox: '<input type="checkbox" name="address[default]" id="address_default_address_new">' };
      return base;
    },

    sectionSettingsFor(sectionId) {
      for (const group of ['header-group', 'footer-group']) {
        const g = readJSON(path.join(themeDir, 'sections', `${group}.json`));
        if (g.sections[sectionId]) return g.sections[sectionId].settings || {};
      }
      return {};
    },
    sectionBlocksFor(sectionId) {
      for (const group of ['header-group', 'footer-group']) {
        const g = readJSON(path.join(themeDir, 'sections', `${group}.json`));
        const s = g.sections[sectionId];
        if (s?.blocks) return (s.block_order || Object.keys(s.blocks)).map((bid) => ({ id: bid, type: s.blocks[bid].type, settings: s.blocks[bid].settings || {} }));
      }
      return [];
    },
    productJSON(p) {
      return { id: p.id, title: p.title, handle: p.handle, description: p.description, published_at: p.published_at, created_at: p.created_at, vendor: p.vendor, type: p.type, tags: p.tags, price: p.price, price_min: p.price_min, price_max: p.price_max, available: p.available, price_varies: p.price_varies, compare_at_price: p.compare_at_price, compare_at_price_min: p.compare_at_price_min, compare_at_price_max: p.compare_at_price_max, compare_at_price_varies: false, variants: p.variants.map((v) => ({ ...v, featured_image: v.featured_image ? { src: v.featured_image.src, width: v.featured_image.width, height: v.featured_image.height } : null })), images: p.images.map((i) => i.src), featured_image: p.featured_image?.src, options: p.options_with_values, url: p.url, media: p.media.map((m) => ({ ...m, preview_image: { src: m.src, width: m.width, height: m.height, aspect_ratio: m.aspect_ratio } })), requires_selling_plan: false, selling_plan_groups: [] };
    },
  };
  return store;

  // ---- builders -------------------------------------------------------------
  function imageObject(src, alt = '', width = 1600, height = 1600, extra = {}) {
    return { src, url: src, alt, width, height, aspect_ratio: width / height, media_type: 'image', id: Math.abs(hash(src)), position: 1, preview_image: { src, width, height, aspect_ratio: width / height }, ...extra };
  }
  function makeProduct(js, listing, idx) {
    const media = (js.media || []).map((m, i) => imageObject(m.src, m.alt || js.title, m.width, m.height, { position: i + 1, id: m.id, media_type: m.media_type }));
    const images = media.filter((m) => m.media_type === 'image');
    const variants = js.variants.map((v) => {
      const fi = v.featured_image ? imageObject(v.featured_image.src, js.title, v.featured_image.width, v.featured_image.height) : null;
      const qty = v.available ? (hash(String(v.id)) % 9) + 1 : 0;
      return { id: v.id, title: v.title, option1: v.option1, option2: v.option2, option3: v.option3, options: v.options, price: v.price, compare_at_price: v.compare_at_price, available: v.available, featured_image: fi, featured_media: fi, image: fi, sku: v.sku || '', requires_shipping: true, taxable: false, weight: v.weight, weight_unit: 'g', inventory_quantity: qty, inventory_management: 'shopify', inventory_policy: 'deny', barcode: v.barcode, url: `${js.url}?variant=${v.id}`, incoming: false, unit_price: null, selling_plan_allocations: [] };
    });
    const prices = variants.map((v) => v.price);
    const firstAvail = variants.find((v) => v.available) || variants[0];
    const options_with_values = js.options.map((o) => ({ name: o.name, position: o.position, values: o.values, selected_value: firstAvail.options[o.position - 1] }));
    const desc = js.description || '';
    return {
      id: js.id, title: js.title, handle: js.handle, url: js.url, description: desc, content: desc, vendor: js.vendor, type: js.type || 'Hoodie', tags: js.tags || [],
      price: Math.min(...prices), price_min: Math.min(...prices), price_max: Math.max(...prices), price_varies: Math.min(...prices) !== Math.max(...prices),
      compare_at_price: js.compare_at_price, compare_at_price_min: js.compare_at_price_min, compare_at_price_max: js.compare_at_price_max, compare_at_price_varies: js.compare_at_price_varies,
      available: js.available, featured_image: images[0] || null, featured_media: media[0] || null, images, media, options: js.options.map((o) => o.name), options_with_values, variants,
      selected_or_first_available_variant: firstAvail, first_available_variant: firstAvail, selected_variant: null, has_only_default_variant: variants.length === 1 && variants[0].title === 'Default Title',
      created_at: js.created_at, published_at: js.published_at, collections: [], metafields: {}, template_suffix: null, requires_selling_plan: false, selling_plan_groups: [], gift_card: false, 'gift_card?': false, sold_out: !js.available, quantity_price_breaks_configured: false, options_by_name: Object.fromEntries(js.options.map((o) => [o.name.toLowerCase(), { name: o.name, values: o.values }])),
    };
  }
  function makeCollection(c, list) {
    return { id: c.id, title: c.title, handle: c.handle, url: `/collections/${c.handle}`, description: c.description || '', image: c.image ? imageObject(c.image.src, c.title, c.image.width, c.image.height) : null, products: list, products_count: list.length, all_products_count: list.length, all_tags: [...new Set(list.flatMap((p) => p.tags))].sort(), all_types: [...new Set(list.map((p) => p.type))], all_vendors: ['LINUX'], sort_by: '', default_sort_by: 'manual', sort_options: [{ name: 'Featured', value: 'manual' }, { name: 'Best selling', value: 'best-selling' }, { name: 'Alphabetically, A-Z', value: 'title-ascending' }, { name: 'Alphabetically, Z-A', value: 'title-descending' }, { name: 'Price, low to high', value: 'price-ascending' }, { name: 'Price, high to low', value: 'price-descending' }, { name: 'Date, new to old', value: 'created-descending' }, { name: 'Date, old to new', value: 'created-ascending' }], filters: [], featured_image: list[0]?.featured_image || null, template_suffix: null, metafields: {}, published_at: c.published_at };
  }
  function page(handle, title, content) { return { id: hash(handle), handle, title, content, url: `/pages/${handle}`, template_suffix: null, author: 'LINUX', published_at: '2026-06-01T00:00:00Z', metafields: {} }; }
  function article(handle, title, date, asset, content, tags) {
    return { id: hash(handle), handle, title, content, excerpt: content.replace(/<[^>]+>/g, '').slice(0, 140) + '…', excerpt_or_content: content.replace(/<[^>]+>/g, '').slice(0, 140) + '…', image: imageObject(`/assets/${asset}`, title, 1400, 800), author: 'LINUX Studio', user: { name: 'LINUX Studio' }, published_at: `${date}T10:00:00Z`, created_at: `${date}T10:00:00Z`, tags, comments_count: 0, comments: [], 'moderated?': false, url: '' };
  }
}

function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
