"""Second i18n pass: product option names/values, sort options, filter labels, breadcrumb aria,
customize/about/contact page copy, cart line variant titles, locale switcher labels."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "theme"


def rw(rel, pairs):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    for old, new in pairs:
        assert old in s, rel + ": " + old[:90]
        s = s.replace(old, new, 1)
    p.write_text(s, encoding="utf-8")


def T(value, key):
    return "{% render 'tr', value: " + value + ", key: '" + key + "' %}"


def T2(value, key_var):
    return "{% render 'tr', value: " + value + ", key: " + key_var + " %}"


# ---- option-name / option-value snippets ---------------------------------------------------
(ROOT / "snippets/option-name.liquid").write_text(
    "{%- comment -%} Localized product option name: 'Color' -> 'اللون'. Falls back to the raw name. {%- endcomment -%}\n"
    "{%- assign k = name | downcase | strip | replace: ' ', '_' -%}\n"
    "{%- assign key = 'products.option_names.' | append: k -%}\n"
    "{%- assign out = key | t -%}\n"
    "{%- if out contains 'translation missing' -%}{{ name }}{%- else -%}{{ out }}{%- endif -%}\n", encoding="utf-8")
(ROOT / "snippets/option-value.liquid").write_text(
    "{%- comment -%} Localized option value: 'black' -> 'أسود' in Arabic; English shows the value capitalized. {%- endcomment -%}\n"
    "{%- assign k = value | downcase | strip | replace: ' ', '_' -%}\n"
    "{%- assign key = 'products.option_values.' | append: k -%}\n"
    "{%- assign out = key | t -%}\n"
    "{%- if out contains 'translation missing' -%}{{ value | capitalize }}{%- else -%}{{ out }}{%- endif -%}\n", encoding="utf-8")

rw("sections/main-product.liquid", [
    ("<span>{{ option.name }}</span>", "<span>{% render 'option-name', name: option.name %}</span>"),
    ('<strong data-option-value="{{ forloop.index0 }}">{{ option.selected_value }}</strong>', '<strong data-option-value="{{ forloop.index0 }}">{% render \'option-value\', value: option.selected_value %}</strong>'),
    ("{%- unless is_color -%}{{ value }}{%- else -%}<span class=\"visually-hidden\">{{ value }}</span>{%- endunless -%}",
     "{%- unless is_color -%}{% render 'option-value', value: value %}{%- else -%}<span class=\"visually-hidden\">{% render 'option-value', value: value %}</span>{%- endunless -%}"),
    ('<p class="card__meta">{{ product.vendor }} · {{ product.type }}</p>', '<p class="card__meta">{{ product.vendor }} · {% render \'option-value\', value: product.type %}</p>'),
])
rw("sections/main-customize.liquid", [
    ('<legend class="pdp__option-label"><span>{{ option.name }}</span>', '<legend class="pdp__option-label"><span>{% render \'option-name\', name: option.name %}</span>'),
    ('<p class="eyebrow">{{ s.eyebrow }}</p>', '<p class="eyebrow">' + T('s.eyebrow', 'home.customize_eyebrow') + '</p>'),
    ('<h1 class="display" style="font-size:clamp(36px,5vw,72px)">{{ s.heading | default: page.title }}</h1>', '<h1 class="display" style="font-size:clamp(36px,5vw,72px)">' + T('s.heading', 'home.customize_heading') + '</h1>'),
])
p = ROOT / "sections/main-customize.liquid"
s = p.read_text(encoding="utf-8")
# option values inside the studio's pills + selected value
s = s.replace('<strong data-option-value="{{ forloop.index0 }}">{{ option.selected_value }}</strong>', '<strong data-option-value="{{ forloop.index0 }}">{% render \'option-value\', value: option.selected_value %}</strong>', 1)
s = s.replace('data-option-input="{{ option.position | minus: 1 }}"{% if option.selected_value == value %} checked{% endif %}>{{ value }}</label>',
              'data-option-input="{{ option.position | minus: 1 }}"{% if option.selected_value == value %} checked{% endif %}>{% render \'option-value\', value: value %}</label>', 1)
# garment tile labels: translation fallback by shape
s = s.replace("<strong>{{ block.settings.label }}</strong>", "{%- assign g_key = 'home.garment_' | append: block.settings.shape -%}<strong>" + T2('block.settings.label', 'g_key') + "</strong>", 1)
s = s.replace('data-label="{{ block.settings.label | escape }}"', '{%- capture g_label -%}' + T2('block.settings.label', 'g_key0') + '{%- endcapture -%}data-label="{{ g_label | strip | escape }}"', 1)
s = s.replace("{%- if block.type == 'garment' -%}", "{%- if block.type == 'garment' -%}{%- assign g_key0 = 'home.garment_' | append: block.settings.shape -%}", 1)
p.write_text(s, encoding="utf-8")

# product.js writes the raw selected value into the legend; localize via a data map
rw("sections/main-product.liquid", [
    ('<script type="application/json" data-variants>', '<script type="application/json" data-option-labels>{%- assign labels = "" -%}{ {%- for option in product.options_with_values -%}{%- for value in option.values -%}{%- capture lv -%}{% render \'option-value\', value: value %}{%- endcapture -%}{{ value | json }}: {{ lv | strip | json }}{%- unless forloop.last -%},{%- endunless -%}{%- endfor -%}{%- unless forloop.last -%},{%- endunless -%}{%- endfor -%} }</script>\n  <script type="application/json" data-variants>'),
])
rw("sections/main-customize.liquid", [
    ('<script type="application/json" data-variants>', '<script type="application/json" data-option-labels>{ {%- for option in p.options_with_values -%}{%- for value in option.values -%}{%- capture lv -%}{% render \'option-value\', value: value %}{%- endcapture -%}{{ value | json }}: {{ lv | strip | json }}{%- unless forloop.last -%},{%- endunless -%}{%- endfor -%}{%- unless forloop.last -%},{%- endunless -%}{%- endfor -%} }</script>\n  <script type="application/json" data-variants>'),
])
rw("assets/product.js", [
    ("      opts.forEach((val, i) => { const lbl = rootEl.querySelector(`[data-option-value=\"${i}\"]`); if (lbl && val) lbl.textContent = val; });",
     "      opts.forEach((val, i) => { const lbl = rootEl.querySelector(`[data-option-value=\"${i}\"]`); if (lbl && val) lbl.textContent = optionLabels[val] || val; });"),
])
p = ROOT / "assets/product.js"
s = p.read_text(encoding="utf-8")
anchor = "    const form = rootEl.querySelector('[data-product-form]');"
assert anchor in s
s = s.replace(anchor, anchor + "\n    const optionLabels = JSON.parse(rootEl.querySelector('[data-option-labels]')?.textContent || '{}');", 1)
p.write_text(s, encoding="utf-8")

# cart line: localized option values instead of the raw variant title
rw("snippets/cart-body.liquid", [
    ('{%- unless item.product.has_only_default_variant -%}<p class="cart-line__meta">{{ item.variant.title }}</p>{%- endunless -%}',
     '{%- unless item.product.has_only_default_variant -%}<p class="cart-line__meta">{%- for opt in item.variant.options -%}{% render \'option-value\', value: opt %}{%- unless forloop.last %} / {% endunless -%}{%- endfor -%}</p>{%- endunless -%}'),
])
# product card meta + quick-add title + swatch aria
rw("snippets/product-card.liquid", [
    ('<p class="card__meta">{{ product.type }}</p>', '<p class="card__meta">{% render \'option-value\', value: product.type %}</p>'),
    ("{{ 'products.quick_add' | t }} · {{ size_option.name }}", "{{ 'products.quick_add' | t }} · {% render 'option-name', name: size_option.name %}"),
    ('aria-label="{{ color_option.name }}"', 'aria-label="{% render \'option-name\', name: color_option.name %}"'),
])

# ---- collection: sort options, filter labels, breadcrumb --------------------------------------
rw("sections/main-collection.liquid", [
    ('<option value="{{ opt.value }}"{% if collection.sort_by == opt.value %} selected{% endif %}>{{ opt.name }}</option>',
     '{%- assign sort_key = \'collections.sort_options.\' | append: opt.value -%}{%- assign sort_label = sort_key | t -%}{%- if sort_label contains \'translation missing\' -%}{%- assign sort_label = opt.name -%}{%- endif -%}<option value="{{ opt.value }}"{% if collection.sort_by == opt.value %} selected{% endif %}>{{ sort_label }}</option>'),
    ('<span class="field__label">Min</span>', '<span class="field__label">{{ \'collections.min\' | t }}</span>'),
    ('<span class="field__label">Max</span>', '<span class="field__label">{{ \'collections.max\' | t }}</span>'),
    ("<summary>Tags{% render 'icon', name: 'chevron-down', px: 16 %}</summary>", "<summary>{{ 'collections.tags' | t }}{% render 'icon', name: 'chevron-down', px: 16 %}</summary>"),
    ('aria-label="Breadcrumb"', 'aria-label="{{ \'general.breadcrumb\' | t }}"'),
])
rw("sections/main-product.liquid", [('aria-label="Breadcrumb"', 'aria-label="{{ \'general.breadcrumb\' | t }}"')])

# ---- locale switcher: show the *target* language name ----------------------------------------
rw("snippets/locale-switcher.liquid", [
    ('aria-label="{{ lang.endonym_name }}"', 'aria-label="{{ lang.endonym_name }}" title="{{ lang.endonym_name }}"'),
])

# ---- about / contact / customize FAQ templates: move copy into translations ----------------------
rw("sections/about-story.liquid", [
    ('<p class="eyebrow">{{ s.eyebrow }}</p>', '<p class="eyebrow">' + T('s.eyebrow', 'home.about_eyebrow') + '</p>'),
    ('{{ s.heading | default: page.title }}', T('s.heading', 'home.about_heading')),
    ('<div class="rte">{{ s.intro | default: page.content }}</div>', '<div class="rte">{%- if s.intro != blank -%}{{ s.intro }}{%- elsif page.content != blank -%}{{ page.content }}{%- else -%}<p>{{ \'home.about_body\' | t }}</p>{%- endif -%}</div>'),
    ('<strong>{{ block.settings.value }}</strong>', '<strong>' + T2('block.settings.value', 'block.settings.key_value') + '</strong>'),
    ('<span>{{ block.settings.label }}</span>', '<span>' + T2('block.settings.label', 'block.settings.key_label') + '</span>'),
])
p = ROOT / "sections/about-story.liquid"
s = p.read_text(encoding="utf-8")
for fld in ("year", "title", "text"):
    s = s.replace("{{ block.settings.%s }}" % fld, T2("block.settings." + fld, "block.settings.key_" + fld), 1)
p.write_text(s, encoding="utf-8")


def patch_schema(rel, block_keys, keep=()):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    a = s.index("{% schema %}") + len("{% schema %}")
    b = s.index("{% endschema %}")
    schema = json.loads(s[a:b])
    for blk in schema.get("blocks", []):
        for x in blk.get("settings", []):
            if x["type"] in ("text", "textarea", "richtext", "inline_richtext") and x["id"] not in keep:
                x.pop("default", None)
        for k, label in block_keys.get(blk["type"], []):
            if not any(x["id"] == k for x in blk["settings"]):
                blk["settings"].append({"type": "text", "id": k, "label": label})
    for x in schema.get("settings", []):
        if x["type"] in ("text", "textarea", "richtext", "inline_richtext") and x["id"] not in keep:
            x.pop("default", None)
    s = s[:a] + "\n" + json.dumps(schema, ensure_ascii=False, indent=2) + "\n" + s[b:]
    p.write_text(s, encoding="utf-8")


patch_schema("sections/about-story.liquid", {
    "stat": [("key_value", "Translation key — value (optional)"), ("key_label", "Translation key — label (optional)")],
    "moment": [("key_year", "Translation key — year (optional)"), ("key_title", "Translation key — title (optional)"), ("key_text", "Translation key — text (optional)")],
})
patch_schema("sections/main-customize.liquid", {}, keep=("colors",))

# about template
p = ROOT / "templates/page.about.json"
t = json.loads(p.read_text(encoding="utf-8"))
story = t["sections"]["story"]
for i in range(1, 5):
    story["blocks"]["s%d" % i]["settings"] = {"key_value": "home.about_stat_%d_v" % i, "key_label": "home.about_stat_%d_l" % i}
for i in range(1, 4):
    story["blocks"]["m%d" % i]["settings"] = {"key_year": "home.about_moment_%d_y" % i, "key_title": "home.about_moment_%d_t" % i, "key_text": "home.about_moment_%d_x" % i}
story["settings"] = {k: v for k, v in story["settings"].items() if k not in ("eyebrow", "heading", "intro")}
st = t["sections"]["statement"]["settings"]
for k in ("eyebrow", "heading", "body", "cta_label"):
    st.pop(k, None)
t["sections"]["statement"]["settings"].update({"key_eyebrow": "home.about_why_eyebrow"})
p.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# brand-statement: allow per-instance translation keys (home vs about use different copy)
rw("sections/brand-statement.liquid", [
    (T('s.eyebrow', 'home.statement_eyebrow'), "{%- assign k_eyebrow = s.key_eyebrow | default: 'home.statement_eyebrow' -%}{%- assign k_heading = s.key_heading | default: 'home.statement_heading_html' -%}{%- assign k_body = s.key_body | default: 'home.statement_body' -%}{%- assign k_cta = s.key_cta | default: 'home.statement_cta' -%}" + T2('s.eyebrow', 'k_eyebrow')),
    (T('s.heading', 'home.statement_heading_html'), T2('s.heading', 'k_heading')),
    (T('s.body', 'home.statement_body'), T2('s.body', 'k_body')),
    (T('s.cta_label', 'home.statement_cta'), T2('s.cta_label', 'k_cta')),
])
p = ROOT / "sections/brand-statement.liquid"
s = p.read_text(encoding="utf-8")
a = s.index("{% schema %}") + len("{% schema %}"); b = s.index("{% endschema %}")
schema = json.loads(s[a:b])
for k, label in (("key_eyebrow", "Translation key — eyebrow"), ("key_heading", "Translation key — heading"), ("key_body", "Translation key — body"), ("key_cta", "Translation key — button")):
    if not any(x["id"] == k for x in schema["settings"]):
        schema["settings"].append({"type": "text", "id": k, "label": label + " (optional)"})
s = s[:a] + "\n" + json.dumps(schema, ensure_ascii=False, indent=2) + "\n" + s[b:]
p.write_text(s, encoding="utf-8")
p = ROOT / "templates/page.about.json"
t = json.loads(p.read_text(encoding="utf-8"))
t["sections"]["statement"]["settings"].update({"key_eyebrow": "home.about_why_eyebrow", "key_heading": "home.about_why_heading_html", "key_body": "home.about_why_body", "key_cta": "home.customize_heading"})
p.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# faq section: per-instance keys for eyebrow/heading/body/cta (customize + contact pages)
rw("sections/faq.liquid", [
    (T('s.eyebrow', 'home.faq_eyebrow'), "{%- assign k_eyebrow = s.key_eyebrow | default: 'home.faq_eyebrow' -%}{%- assign k_heading = s.key_heading | default: 'home.faq_heading' -%}{%- assign k_body = s.key_body | default: 'home.faq_body' -%}" + T2('s.eyebrow', 'k_eyebrow')),
    (T('s.heading', 'home.faq_heading'), T2('s.heading', 'k_heading')),
    (T('s.body', 'home.faq_body'), T2('s.body', 'k_body')),
])
p = ROOT / "sections/faq.liquid"
s = p.read_text(encoding="utf-8")
a = s.index("{% schema %}") + len("{% schema %}"); b = s.index("{% endschema %}")
schema = json.loads(s[a:b])
for k, label in (("key_eyebrow", "Translation key — eyebrow"), ("key_heading", "Translation key — heading"), ("key_body", "Translation key — body")):
    if not any(x["id"] == k for x in schema["settings"]):
        schema["settings"].append({"type": "text", "id": k, "label": label + " (optional)"})
s = s[:a] + "\n" + json.dumps(schema, ensure_ascii=False, indent=2) + "\n" + s[b:]
p.write_text(s, encoding="utf-8")

# customize page template
p = ROOT / "templates/page.customize.json"
t = json.loads(p.read_text(encoding="utf-8"))
for sid, sec in t["sections"].items():
    if sec["type"] == "faq":
        for i, bid in enumerate(sec["block_order"]):
            sec["blocks"][bid]["settings"] = {"key_q": "home.customize_faq_%d_q" % (i + 1), "key_a": "home.customize_faq_%d_a" % (i + 1)}
        sec["settings"] = {k: v for k, v in sec["settings"].items() if k not in ("eyebrow", "heading", "body", "cta_label")}
        sec["settings"].update({"key_eyebrow": "home.customize_eyebrow", "key_heading": "home.customize_faq_title", "key_body": "home.faq_body"})
    if sec["type"] == "main-customize":
        for k in ("eyebrow", "heading", "subheading"):
            sec["settings"].pop(k, None)
        for blk in (sec.get("blocks") or {}).values():
            blk["settings"].pop("label", None)
p.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# contact page: heading/body from translations, FAQ keys
rw("sections/contact.liquid", [
    ("<h1>{%- assign t_title = 'contact.title' | t -%}{{ page.title | default: t_title }}</h1>", "<h1>{{ 'home.contact_heading' | t }}</h1>"),
    ('{%- if page.content != blank -%}<div class="lede" style="text-align:center">{{ page.content }}</div>{%- endif -%}', '<div class="lede" style="text-align:center">{%- if page.content != blank -%}{{ page.content }}{%- else -%}{{ \'home.contact_body\' | t }}{%- endif -%}</div>'),
])
p = ROOT / "templates/page.contact.json"
t = json.loads(p.read_text(encoding="utf-8"))
faq = t["sections"]["faq"]
for i, bid in enumerate(faq["block_order"]):
    faq["blocks"][bid]["settings"] = {"key_q": "home.contact_faq_%d_q" % (i + 1), "key_a": "home.contact_faq_%d_a" % (i + 1)}
faq["settings"] = {"open_first": True, "key_eyebrow": "home.faq_eyebrow", "key_heading": "home.contact_faq_title", "key_body": "home.faq_body"}
p.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("ok")
