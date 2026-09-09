"""One-off: fix filter chains where a filter after `| t:` was meant for the argument."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "theme"


def sub(rel, old, new):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    assert old in s, (rel, old[:70])
    p.write_text(s.replace(old, new, 1), encoding="utf-8")


# PDP: "Free shipping over LE 2,000" — dedicated key, no string surgery
sub("sections/main-product.liquid",
    """<div>{% render 'icon', name: 'return', px: 18 %}<span>{{ 'cart.free_shipping_away' | t: amount: settings.free_shipping_threshold | times: 100 | money | replace: ' away from free shipping', '' }} → {{ 'products.shipping' | t | downcase }}</span></div>""",
    """{%- if settings.free_shipping_threshold > 0 -%}{%- assign fs_amount = settings.free_shipping_threshold | times: 100 | money -%}<div>{% render 'icon', name: 'return', px: 18 %}<span>{{ 'products.free_shipping_over' | t: amount: fs_amount }}</span></div>{%- endif -%}""")

# Order page: format the date first
sub("sections/main-order.liquid",
    """{{ 'customer.order.placed' | t: date: order.created_at | date: format: 'month_day_year' }}""",
    """{%- assign placed_date = order.created_at | date: format: 'month_day_year' -%}{{ 'customer.order.placed' | t: date: placed_date }}""")

# Add the new locale key next to "shipping" in both locales
for rel, value in (("locales/en.default.json", "Free shipping over {{ amount }}"),
                   ("locales/ar.json", "شحن مجاني للطلبات فوق {{ amount }}")):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    anchor = '"shipping_body":'
    assert anchor in s, rel
    line = f'"free_shipping_over": {json.dumps(value, ensure_ascii=False)},\n    '
    s = s.replace(anchor, line + anchor, 1)
    p.write_text(s, encoding="utf-8")
    json.loads(s)  # validate
print("ok")
