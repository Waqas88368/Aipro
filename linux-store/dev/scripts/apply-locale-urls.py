"""Harness: localize every object URL like Shopify does (product.url, collection.url, link.url, page.url,
article.url, blog.url, policy.url, item.url, order.customer_url) by deep-cloning the env objects per request
with the locale root prefixed."""
import pathlib

p = pathlib.Path(__file__).resolve().parents[1] / "store.mjs"
s = p.read_text(encoding="utf-8")

old = """      return {
        shop, settings, routes, cart: this.cartObject(), customer, linklists, collections, all_products: byHandle, pages, blogs, images: {},"""
new = """      // Shopify emits every object URL under the locale root (/ar/products/…); mirror that here.
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
        shop: lz(shop), settings, routes, cart: lz(this.cartObject()), customer: lz(customer), linklists: lz(linklists), collections: lz(collections), all_products: lz(byHandle), pages: lz(pages), blogs: lz(blogs), images: {},"""
assert old in s
s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8")
print("ok")
