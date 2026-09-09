"""One-off: named garment colours in the Customize studio + friendlier cart property display."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "theme"


def sub(rel, old, new):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    assert old in s, (rel, old[:70])
    p.write_text(s.replace(old, new, 1), encoding="utf-8")


DEFAULT = "Forest:#043020,Black:#111111,Cream:#f5f5f0,Beige:#e6d5b8,Burgundy:#6b1e2b,Navy:#1b2a4a"

sub("sections/main-customize.liquid",
    """          {%- assign colors = s.colors | default: '#043020,#111111,#f5f5f0,#e6d5b8,#6b1e2b,#1b2a4a' | split: ',' -%}
          {%- for c in colors -%}
            <button class="pill swatch{% if forloop.first %} is-active{% endif %}" type="button" style="--swatch: {{ c | strip }}" data-cz-color="{{ c | strip }}" aria-label="{{ c | strip }}" aria-pressed="{% if forloop.first %}true{% else %}false{% endif %}"></button>
          {%- endfor -%}""",
    """          {%- assign colors = s.colors | default: '""" + DEFAULT + """' | split: ',' -%}
          {%- for c in colors -%}
            {%- liquid
              assign parts = c | strip | split: ':'
              if parts.size > 1
                assign c_name = parts[0] | strip
                assign c_hex = parts[1] | strip
              else
                assign c_name = parts[0] | strip
                assign c_hex = parts[0] | strip
              endif
            -%}
            <button class="pill swatch{% if forloop.first %} is-active{% endif %}" type="button" style="--swatch: {{ c_hex }}" data-cz-color="{{ c_hex }}" data-cz-color-name="{{ c_name | escape }}" aria-label="{{ c_name | escape }}" aria-pressed="{% if forloop.first %}true{% else %}false{% endif %}" title="{{ c_name | escape }}"></button>
          {%- endfor -%}""")

sub("sections/main-customize.liquid",
    """<input type="hidden" name="properties[Colour]" data-cz-color-prop value="{{ s.default_color | default: '#043020' }}">""",
    """{%- assign first_color = s.colors | default: '""" + DEFAULT + """' | split: ',' | first | split: ':' | first | strip -%}
      <input type="hidden" name="properties[Colour]" data-cz-color-prop value="{{ first_color | escape }}">""")

sub("sections/main-customize.liquid",
    """{ "type": "text", "id": "colors", "label": "Garment colours (comma-separated hex)", "default": "#043020,#111111,#f5f5f0,#e6d5b8,#6b1e2b,#1b2a4a" },""",
    """{ "type": "text", "id": "colors", "label": "Garment colours (Name:#hex, comma-separated)", "default": \"""" + DEFAULT + """\" },""")

# Default garment colour follows the first swatch instead of a separate setting
sub("sections/main-customize.liquid",
    """<div class="cz__garment" data-cz-garment style="--gc: {{ s.default_color | default: '#043020' }}">""",
    """{%- assign first_hex = s.colors | default: '""" + DEFAULT + """' | split: ',' | first | split: ':' | last | strip -%}
        <div class="cz__garment" data-cz-garment style="--gc: {{ first_hex }}">""")
sub("sections/main-customize.liquid",
    """    { "type": "color", "id": "default_color", "label": "Default colour", "default": "#043020" }\n""",
    "")
sub("sections/main-customize.liquid",
    """    { "type": "text", "id": "colors", "label": "Garment colours (Name:#hex, comma-separated)", "default": \"""" + DEFAULT + """\" },""",
    """    { "type": "text", "id": "colors", "label": "Garment colours (Name:#hex, comma-separated)", "default": \"""" + DEFAULT + """\" }""")

# JS: store the colour *name* as the line-item property
sub("assets/customize.js",
    """garment.style.setProperty('--gc', btn.dataset.czColor); colorProp.value = btn.dataset.czColor;""",
    """garment.style.setProperty('--gc', btn.dataset.czColor); colorProp.value = btn.dataset.czColorName || btn.dataset.czColor;""")

# Cart: Shopify stores uploaded files as a URL; show a friendly label + link
sub("snippets/cart-body.liquid",
    """            {%- if p.last != blank and first_char != '_' -%}<p class="cart-line__meta">{{ p.first }}: {{ p.last }}</p>{%- endif -%}""",
    """            {%- if p.last != blank and first_char != '_' -%}
              <p class="cart-line__meta">{{ p.first }}:
                {%- if p.last contains '/uploads/' -%} <a href="{{ p.last }}" target="_blank" rel="noopener">{{ 'cart.view_file' | t }}</a>
                {%- elsif p.last contains 'upload:' -%} {{ p.last | remove_first: 'upload:' }}
                {%- else -%} {{ p.last }}{%- endif -%}
              </p>
            {%- endif -%}""")

for rel, value in (("locales/en.default.json", "View file"), ("locales/ar.json", "عرض الملف")):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    anchor = '"free_shipping_away_html":'
    assert anchor in s, rel
    s = s.replace(anchor, f'"view_file": {json.dumps(value, ensure_ascii=False)},\n    ' + anchor, 1)
    p.write_text(s, encoding="utf-8")
    json.loads(s)
print("ok")
