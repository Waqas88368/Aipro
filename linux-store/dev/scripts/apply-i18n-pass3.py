"""Third i18n pass: menu titles, policy titles, marquee array keys, product type line, misc strings."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "theme"


def rw(rel, pairs):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    for old, new in pairs:
        assert old in s, rel + ": " + old[:90]
        s = s.replace(old, new)
    p.write_text(s, encoding="utf-8")


MT = "{%% render 'menu-title', title: %s %%}"
rw("sections/header.liquid", [
    ("                  {{ link.title }}{% render 'icon', name: 'chevron-down', px: 14, class: 'nav-link__caret' %}", "                  " + MT % "link.title" + "{% render 'icon', name: 'chevron-down', px: 14, class: 'nav-link__caret' %}"),
    ("<span>{{ child.title }}</span>", "<span>" + MT % "child.title" + "</span>"),
    ('class="nav-link{% if link.active %} is-active{% endif %}">{{ link.title }}</a>', 'class="nav-link{% if link.active %} is-active{% endif %}">' + MT % "link.title" + '</a>'),
])
rw("sections/footer.liquid", [
    ("<h4>{{ block.settings.title | default: menu.title }}</h4>", "<h4>{%- if block.settings.title != blank -%}{{ block.settings.title }}{%- else -%}" + MT % "menu.title" + "{%- endif -%}</h4>"),
    ('<li><a href="{{ link.url }}">{{ link.title }}</a></li>', '<li><a href="{{ link.url }}">' + MT % "link.title" + '</a></li>'),
    ('<a href="{{ policy.url }}">{{ policy.title }}</a>', '<a href="{{ policy.url }}">' + MT % "policy.title" + '</a>'),
])
rw("snippets/menu-drawer.liquid", [
    ('<summary class="menu-drawer__link">{{ link.title }}', '<summary class="menu-drawer__link">' + MT % "link.title"),
    ('class="menu-drawer__sublink{% if child.active %} is-active{% endif %}">{{ child.title }}</a>', 'class="menu-drawer__sublink{% if child.active %} is-active{% endif %}">' + MT % "child.title" + '</a>'),
    ('class="menu-drawer__link{% if link.active %} is-active{% endif %}">{{ link.title }}{% render', 'class="menu-drawer__link{% if link.active %} is-active{% endif %}">' + MT % "link.title" + '{% render'),
])

# footer group: drop English column titles so menu titles translate
p = ROOT / "sections/footer-group.json"
g = json.loads(p.read_text(encoding="utf-8"))
for sec in g["sections"].values():
    for blk in (sec.get("blocks") or {}).values():
        blk.get("settings", {}).pop("title", None)
p.write_text(json.dumps(g, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# marquee: array index keys don't resolve through `t`; use flat keys
for rel in ("locales/en.default.json", "locales/ar.json"):
    p = ROOT / rel
    d = json.loads(p.read_text(encoding="utf-8"))
    arr = d["home"].pop("marquee")
    for i, v in enumerate(arr):
        d["home"]["marquee_%d" % (i + 1)] = v
    d["nav"]["menu"] = (
        {"shop": "Shop", "all_products": "All products", "customize": "Customize", "customize_print": "Customize print", "journal": "Journal", "about": "About", "our_story": "Our story", "contact": "Contact", "help": "Help",
         "size_guide": "Size guide", "shipping_and_returns": "Shipping & returns", "faq": "FAQ", "winter_collection": "Winter collection", "summer_collection": "Summer collection",
         "privacy_policy": "Privacy policy", "terms_of_service": "Terms of service", "refund_policy": "Refund policy", "shipping_policy": "Shipping policy", "legal_notice": "Legal notice", "contact_information": "Contact information", "subscription_policy": "Subscription policy",
         "new_arrivals": "New arrivals", "best_sellers": "Best sellers", "hoodies": "Hoodies", "t_shirts": "T-shirts", "caps": "Caps", "sale": "Sale", "home": "Home", "search": "Search", "account": "Account", "wishlist": "Saved", "cart": "Bag"}
        if rel.startswith("locales/en") else
        {"shop": "تسوّق", "all_products": "كل المنتجات", "customize": "صمّم بنفسك", "customize_print": "طباعة مخصّصة", "journal": "المدوّنة", "about": "عن LINUX", "our_story": "قصتنا", "contact": "تواصل معنا", "help": "مساعدة",
         "size_guide": "دليل المقاسات", "shipping_and_returns": "الشحن والاستبدال", "faq": "الأسئلة الشائعة", "winter_collection": "مجموعة الشتاء", "summer_collection": "مجموعة الصيف",
         "privacy_policy": "سياسة الخصوصية", "terms_of_service": "شروط الخدمة", "refund_policy": "سياسة الاستبدال", "shipping_policy": "سياسة الشحن", "legal_notice": "إشعار قانوني", "contact_information": "بيانات التواصل", "subscription_policy": "سياسة الاشتراك",
         "new_arrivals": "وصل حديثاً", "best_sellers": "الأكثر مبيعاً", "hoodies": "هوديز", "t_shirts": "تيشيرتات", "caps": "كابات", "sale": "تخفيضات", "home": "الرئيسية", "search": "بحث", "account": "حسابي", "wishlist": "المحفوظ", "cart": "الشنطة"}
    )
    d["products"]["by_type"] = "{{ brand }} · {{ type }}"
    d["general"]["page_title_sep"] = " – "
    if rel.startswith("locales/ar"):
        d["products"]["option_values"].update({"sada": "سادة", "anime": "أنمي", "hoodie": "هودي", "hoodies": "هوديز", "shirt": "تيشيرت", "shirts": "تيشيرتات", "t-shirt": "تيشيرت", "cap": "كاب", "customize": "مخصّص", "flower": "ورد", "tee": "تيشيرت"})
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

p = ROOT / "templates/index.json"
t = json.loads(p.read_text(encoding="utf-8"))
for i in range(5):
    t["sections"]["marquee"]["blocks"]["m%d" % (i + 1)]["settings"]["key"] = "home.marquee_%d" % (i + 1)
p.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# marquee schema info text
rw("sections/marquee.liquid", [("home.marquee[0]", "home.marquee_1")])

# collection card meta on the collection grid: product type
rw("snippets/product-card.liquid", [])

# tab bar labels?
tb = (ROOT / "snippets/tab-bar.liquid").read_text(encoding="utf-8")
print("tab-bar uses t:", "| t" in tb)
print("ok")
