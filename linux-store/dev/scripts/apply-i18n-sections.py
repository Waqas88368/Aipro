"""One-off: route every merchant copy field through the `tr` snippet (setting -> translation fallback),
add optional translation-key settings to blocks, and blank the hardcoded English in templates so
the fallbacks apply. Exact-string replacements, asserted."""
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
    """setting with fixed translation key"""
    return "{% render 'tr', value: " + value + ", key: '" + key + "' %}"


def T2(value, key_var):
    """setting with translation key held in another setting"""
    return "{% render 'tr', value: " + value + ", key: " + key_var + " %}"


NUM = '{% if s.number != blank %}<span class="eyebrow__num">{{ s.number }}</span>{% endif %}'
HEAD_OLD = '      {%- if s.eyebrow != blank -%}<p class="eyebrow">' + NUM + '{{ s.eyebrow }}</p>{%- endif -%}\n      <h2>{{ s.heading }}</h2>'


def head_new(ns):
    return '      <p class="eyebrow">' + NUM + T('s.eyebrow', 'home.' + ns + '_eyebrow') + '</p>\n      <h2>' + T('s.heading', 'home.' + ns + '_heading') + '</h2>'


rw("sections/featured-collections.liquid", [
    (HEAD_OLD, head_new("collections")),
    ("        assign label = bs.label | default: coll.title",
     "        capture label\n          render 'tr', value: bs.label, key: bs.key_label\n        endcapture\n        assign label = label | strip\n        if label == blank\n          assign label = coll.title\n        endif\n        capture sub\n          render 'tr', value: bs.sub, key: bs.key_sub\n        endcapture\n        assign sub = sub | strip"),
    ("{% elsif bs.sub != blank %}<small>{{ bs.sub }}</small>", "{% elsif sub != blank %}<small>{{ sub }}</small>"),
])

rw("sections/testimonials.liquid", [
    (HEAD_OLD, head_new("reviews")),
    ('{%- if s.rating_text != blank -%}<p class="chip" data-reveal>{% render \'icon\', name: \'star\', px: 14 %} {{ s.rating_text }}</p>{%- endif -%}',
     '<p class="chip" data-reveal>{% render \'icon\', name: \'star\', px: 14 %} ' + T('s.rating_text', 'home.reviews_rating') + '</p>'),
    ('<p class="review__quote">“{{ b.quote }}”</p>',
     '{%- capture who -%}' + T2('b.name', 'b.key_name') + '{%- endcapture -%}{%- capture where -%}' + T2('b.meta', 'b.key_meta') + '{%- endcapture -%}\n        <p class="review__quote">“' + T2('b.quote', 'b.key_quote') + '”</p>'),
    ('<span class="review__avatar">{{ b.name | slice: 0 }}</span>', '<span class="review__avatar">{{ who | strip | slice: 0 }}</span>'),
    ('<span><strong>{{ b.name }}</strong>{% if b.meta != blank %} · {{ b.meta }}{% endif %}</span>', '<span><strong>{{ who | strip }}</strong>{% if where != blank %} · {{ where | strip }}{% endif %}</span>'),
])

rw("sections/shop-the-look.liquid", [
    (HEAD_OLD, head_new("look")),
    ('{%- if s.body != blank -%}<p class="lede" data-reveal>{{ s.body }}</p>{%- endif -%}', '<p class="lede" data-reveal>' + T('s.body', 'home.look_body') + '</p>'),
])

for rel, ns in (("sections/product-carousel.liquid", "bestsellers"), ("sections/product-grid.liquid", "arrivals")):
    rw(rel, [
        ('      {%- if s.eyebrow != blank -%}<p class="eyebrow">' + NUM + '{{ s.eyebrow }}</p>{%- endif -%}',
         '      <p class="eyebrow">' + NUM + T('s.eyebrow', 'home.' + ns + '_eyebrow') + '</p>'),
        ('<h2>{{ s.heading | default: coll.title }}</h2>', '<h2>' + T('s.heading', 'home.' + ns + '_heading') + '</h2>'),
    ])

rw("sections/campaign.liquid", [
    ('{%- if s.eyebrow != blank -%}<p class="eyebrow">{{ s.eyebrow }}</p>{%- endif -%}', '<p class="eyebrow">' + T('s.eyebrow', 'home.campaign_eyebrow') + '</p>'),
    ('<h2 class="display" style="font-size:clamp(34px,4.4vw,64px)">{{ s.heading }}</h2>', '<h2 class="display" style="font-size:clamp(34px,4.4vw,64px)">' + T('s.heading', 'home.campaign_heading') + '</h2>'),
    ('{%- if s.body != blank -%}<p class="lede">{{ s.body }}</p>{%- endif -%}', '<p class="lede">' + T('s.body', 'home.campaign_body') + '</p>'),
    ('{%- if s.primary_label != blank -%}<a href="{{ s.primary_link | default: routes.all_products_collection_url }}" class="btn btn--primary" data-magnetic>{{ s.primary_label }}{% render \'icon\', name: \'arrow-right\' %}</a>{%- endif -%}',
     '<a href="{{ s.primary_link | default: routes.all_products_collection_url }}" class="btn btn--primary" data-magnetic>' + T('s.primary_label', 'home.campaign_primary') + '{% render \'icon\', name: \'arrow-right\' %}</a>'),
    ('{%- if s.secondary_label != blank -%}<a href="{{ s.secondary_link | default: routes.all_products_collection_url }}" class="btn btn--glass">{{ s.secondary_label }}</a>{%- endif -%}',
     '<a href="{{ s.secondary_link | default: routes.all_products_collection_url }}" class="btn btn--glass">' + T('s.secondary_label', 'home.campaign_secondary') + '</a>'),
    ('{%- if s.note != blank -%}<p class="mono muted">{{ s.note }}</p>{%- endif -%}', '<p class="mono muted">' + T('s.note', 'home.campaign_note') + '</p>'),
    ('alt="{{ s.heading | escape }}"', 'alt=""'),
])

rw("sections/brand-statement.liquid", [
    ('{%- if s.eyebrow != blank -%}<p class="eyebrow">{{ s.eyebrow }}</p>{%- endif -%}', '<p class="eyebrow">' + T('s.eyebrow', 'home.statement_eyebrow') + '</p>'),
    ('<h2 class="statement__quote">{{ s.heading }}</h2>', '<h2 class="statement__quote">' + T('s.heading', 'home.statement_heading_html') + '</h2>'),
    ('{%- if s.body != blank -%}<p class="lede" style="text-align:center">{{ s.body }}</p>{%- endif -%}', '<p class="lede" style="text-align:center">' + T('s.body', 'home.statement_body') + '</p>'),
    ('{%- if s.cta_label != blank -%}<a href="{{ s.cta_url | default: \'/pages/about\' }}" class="btn btn--glass">{{ s.cta_label }}{% render \'icon\', name: \'arrow-up-right\', px: 16 %}</a>{%- endif -%}',
     '<a href="{{ s.cta_url | default: \'/pages/about\' }}" class="btn btn--glass">' + T('s.cta_label', 'home.statement_cta') + '{% render \'icon\', name: \'arrow-up-right\', px: 16 %}</a>'),
])

rw("sections/instagram-feed.liquid", [
    ('{%- if s.eyebrow != blank -%}<p class="eyebrow">{{ s.eyebrow }}</p>{%- endif -%}', '<p class="eyebrow">' + T('s.eyebrow', 'home.ugc_eyebrow') + '</p>'),
    ('<h2>{{ s.heading }}</h2>', '<h2>' + T('s.heading', 'home.ugc_heading') + '</h2>'),
])

rw("sections/faq.liquid", [
    ('{%- if s.eyebrow != blank -%}<p class="eyebrow">{{ s.eyebrow }}</p>{%- endif -%}', '<p class="eyebrow">' + T('s.eyebrow', 'home.faq_eyebrow') + '</p>'),
    ('<h2>{{ s.heading }}</h2>', '<h2>' + T('s.heading', 'home.faq_heading') + '</h2>'),
    ('{%- if s.body != blank -%}<p class="lede" style="margin-top:14px">{{ s.body }}</p>{%- endif -%}', '<p class="lede" style="margin-top:14px">' + T('s.body', 'home.faq_body') + '</p>'),
    ('{%- if s.cta_label != blank -%}<a href="{{ s.cta_url | default: \'/pages/contact\' }}" class="btn btn--glass" style="margin-top:22px">{% render \'icon\', name: \'whatsapp\', px: 18 %}{{ s.cta_label }}</a>{%- endif -%}',
     '<a href="{{ s.cta_url | default: \'/pages/contact\' }}" class="btn btn--glass" style="margin-top:22px">{% render \'icon\', name: \'whatsapp\', px: 18 %}' + T('s.cta_label', 'home.faq_cta') + '</a>'),
    ('<summary>{{ block.settings.question }}', '<summary>' + T2('block.settings.question', 'block.settings.key_q')),
    ('<div class="rte">{{ block.settings.answer }}</div>', '<div class="rte">' + T2('block.settings.answer', 'block.settings.key_a') + '</div>'),
])

rw("sections/newsletter.liquid", [
    ('{%- if s.eyebrow != blank -%}<p class="eyebrow">{{ s.eyebrow }}</p>{%- endif -%}', '<p class="eyebrow">' + T('s.eyebrow', 'home.newsletter_eyebrow') + '</p>'),
    ('<h2>{{ s.heading }}</h2>', '<h2>' + T('s.heading', 'home.newsletter_heading') + '</h2>'),
    ('{%- if s.body != blank -%}<p class="lede" style="margin-top:10px">{{ s.body }}</p>{%- endif -%}', '<p class="lede" style="margin-top:10px">' + T('s.body', 'home.newsletter_body') + '</p>'),
])

rw("sections/value-props.liquid", [
    ('<strong>{{ block.settings.title }}</strong>', '<strong>' + T2('block.settings.title', 'block.settings.key_title') + '</strong>'),
    ('<span>{{ block.settings.text }}</span>', '<span>' + T2('block.settings.text', 'block.settings.key_text') + '</span>'),
])

rw("sections/marquee.liquid", [
    ('{{ block.settings.text }}', T2('block.settings.text', 'block.settings.key')),
])

rw("sections/product-recommendations.liquid", [
    ('<h2>{{ section.settings.heading }}</h2>', '<h2>' + T('section.settings.heading', 'home.recommendations_heading') + '</h2>'),
])

rw("sections/footer.liquid", [
    ('{%- if s.tagline != blank -%}<p class="footer__tagline">{{ s.tagline }}</p>{%- endif -%}', '<p class="footer__tagline">' + T('s.tagline', 'home.footer_tagline') + '</p>'),
])

rw("sections/header.liquid", [
    ('{%- if s.show_announcement and s.announcement_text != blank -%}', '{%- if s.show_announcement -%}{%- capture announcement -%}' + T('s.announcement_text', 'home.announcement') + '{%- endcapture -%}'),
    ('<span class="announcement__item">{{ s.announcement_text }}<span class="announcement__dot"></span></span>', '<span class="announcement__item">{{ announcement }}<span class="announcement__dot"></span></span>'),
    ('<span class="visually-hidden">{{ s.announcement_text }}</span>', '<span class="visually-hidden">{{ announcement }}</span>'),
    ("{{ block.settings.label | default: 'New drop' }}", T('block.settings.label', 'home.mega_promo')),
    ("{{ s.shop_cta_label | default: 'Shop' }}", T('s.shop_cta_label', 'home.shop_cta')),
])


# ---- schemas: add translation-key settings to blocks, drop English defaults ---------------
KEEP_DEFAULT = {"number", "handle", "colors", "chip_1"}


def patch_schema(rel, block_keys):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    a = s.index("{% schema %}") + len("{% schema %}")
    b = s.index("{% endschema %}")
    schema = json.loads(s[a:b])
    for blk in schema.get("blocks", []):
        for x in blk.get("settings", []):
            if x["type"] in ("text", "textarea", "richtext", "inline_richtext") and x["id"] not in KEEP_DEFAULT:
                x.pop("default", None)
        for k, label in block_keys.get(blk["type"], []):
            if not any(x["id"] == k for x in blk["settings"]):
                blk["settings"].append({"type": "text", "id": k, "label": label})
    for x in schema.get("settings", []):
        if x["type"] in ("text", "textarea", "richtext", "inline_richtext") and x["id"] not in KEEP_DEFAULT:
            x.pop("default", None)
            if x["id"] in ("eyebrow", "heading", "subheading", "body", "cta_label", "cta2_label", "primary_label", "secondary_label", "note", "rating_text", "tagline", "announcement_text", "shop_cta_label") and "(blank" not in x["label"]:
                x["label"] += " (blank = translated)"
    # presets carry English copy too
    for pr in schema.get("presets", []):
        pr.pop("settings", None)
        for blk in pr.get("blocks", []):
            blk.pop("settings", None)
    s = s[:a] + "\n" + json.dumps(schema, ensure_ascii=False, indent=2) + "\n" + s[b:]
    p.write_text(s, encoding="utf-8")


patch_schema("sections/faq.liquid", {"question": [("key_q", "Translation key — question (optional)"), ("key_a", "Translation key — answer (optional)")]})
patch_schema("sections/value-props.liquid", {"prop": [("key_title", "Translation key — title (optional)"), ("key_text", "Translation key — text (optional)")]})
patch_schema("sections/testimonials.liquid", {"quote": [("key_quote", "Translation key — quote (optional)"), ("key_name", "Translation key — name (optional)"), ("key_meta", "Translation key — city (optional)")]})
patch_schema("sections/featured-collections.liquid", {"collection": [("key_label", "Translation key — label (optional)"), ("key_sub", "Translation key — subtitle (optional)")]})
patch_schema("sections/marquee.liquid", {"item": [("key", "Translation key (e.g. home.marquee[0])")]})
for rel in ("sections/campaign.liquid", "sections/brand-statement.liquid", "sections/instagram-feed.liquid", "sections/newsletter.liquid", "sections/shop-the-look.liquid", "sections/product-carousel.liquid", "sections/product-grid.liquid", "sections/footer.liquid", "sections/product-recommendations.liquid", "sections/header.liquid"):
    patch_schema(rel, {})

# header: announcement visibility no longer depends on text
p = ROOT / "sections/header.liquid"
s = p.read_text(encoding="utf-8")
if '"id": "show_announcement"' not in s:
    s = s.replace('{ "type": "text", "id": "announcement_text"', '{ "type": "checkbox", "id": "show_announcement", "label": "Show announcement bar", "default": true },\n    { "type": "text", "id": "announcement_text"', 1)
    p.write_text(s, encoding="utf-8")

# ---- index.json: drop hardcoded English so translations apply ----------------------------
p = ROOT / "templates/index.json"
t = json.loads(p.read_text(encoding="utf-8"))
COPY = {"eyebrow", "heading", "subheading", "body", "cta_label", "cta2_label", "primary_label", "secondary_label", "note", "trust_1", "trust_2", "trust_3", "chip_2", "rating_text", "tagline", "text", "title", "quote", "name", "meta", "question", "answer", "label", "sub"}
for sid, sec in t["sections"].items():
    for k in [k for k in sec.get("settings", {}) if k in COPY]:
        del sec["settings"][k]
    for blk in (sec.get("blocks") or {}).values():
        for k in [k for k in blk.get("settings", {}) if k in COPY]:
            del blk["settings"][k]
t["sections"]["marquee"]["blocks"] = {"m" + str(i + 1): {"type": "item", "settings": {"key": "home.marquee[" + str(i) + "]"}} for i in range(5)}
t["sections"]["marquee"]["block_order"] = ["m" + str(i + 1) for i in range(5)]
for i, bid in enumerate(t["sections"]["props"]["block_order"]):
    t["sections"]["props"]["blocks"][bid]["settings"].update({"key_title": "home.prop_%d_title" % (i + 1), "key_text": "home.prop_%d_text" % (i + 1)})
for i, bid in enumerate(t["sections"]["reviews"]["block_order"]):
    t["sections"]["reviews"]["blocks"][bid]["settings"].update({"key_quote": "home.review_%d_quote" % (i + 1), "key_name": "home.review_%d_name" % (i + 1), "key_meta": "home.review_%d_meta" % (i + 1)})
for i, bid in enumerate(t["sections"]["faq"]["block_order"]):
    t["sections"]["faq"]["blocks"][bid]["settings"].update({"key_q": "home.faq_%d_q" % (i + 1), "key_a": "home.faq_%d_a" % (i + 1)})
fc = t["sections"]["collections"]["blocks"]
fc["c3"]["settings"].update({"key_label": "home.collections_customize_label", "key_sub": "home.collections_customize_sub"})
fc["c4"]["settings"].update({"key_label": "home.collections_all_label"})
hero = t["sections"]["hero"]["settings"]
t["sections"]["hero"]["settings"] = {k: v for k, v in hero.items() if k in ("height", "cta_url", "cta2_url", "show_trust", "show_mascot", "mascot")}
t["sections"]["hero"]["settings"].update({"overlay": 25, "chip_1": "FW26", "show_headline": True})
p.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# header-group.json: drop the English announcement/shop label so translations apply
p = ROOT / "sections/header-group.json"
g = json.loads(p.read_text(encoding="utf-8"))
for sec in g["sections"].values():
    for k in ("announcement_text", "shop_cta_label"):
        sec.get("settings", {}).pop(k, None)
    for blk in (sec.get("blocks") or {}).values():
        blk.get("settings", {}).pop("label", None)
p.write_text(json.dumps(g, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
p = ROOT / "sections/footer-group.json"
g = json.loads(p.read_text(encoding="utf-8"))
for sec in g["sections"].values():
    sec.get("settings", {}).pop("tagline", None)
p.write_text(json.dumps(g, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("ok")
