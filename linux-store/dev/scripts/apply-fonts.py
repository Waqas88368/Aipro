"""One-off: swap Google Fonts <link>s for the self-hosted fonts snippet in all layouts, and update type tokens."""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2] / "theme"

# theme.liquid
p = ROOT / "layout/theme.liquid"
s = p.read_text(encoding="utf-8")
old = re.search(r"  \{%- unless settings\.type_system_fonts -%\}\n    <link rel=\"preconnect\" href=\"https://fonts\.googleapis\.com\">[\s\S]*?  \{%- endunless -%\}\n", s).group(0)
s = s.replace(old, "  {%- unless settings.type_system_fonts -%}{% render 'fonts', is_rtl: is_rtl %}{%- endunless -%}\n", 1)
p.write_text(s, encoding="utf-8")

# password.liquid
p = ROOT / "layout/password.liquid"
s = p.read_text(encoding="utf-8")
old = re.search(r"  \{%- unless settings\.type_system_fonts -%\}\n    <link rel=\"preconnect\" href=\"https://fonts\.googleapis\.com\">[\s\S]*?  \{%- endunless -%\}\n", s).group(0)
s = s.replace(old, "  {%- unless settings.type_system_fonts -%}{% render 'fonts', is_rtl: is_rtl %}{%- endunless -%}\n", 1)
p.write_text(s, encoding="utf-8")

# gift_card.liquid
p = ROOT / "layout/gift_card.liquid"
s = p.read_text(encoding="utf-8")
old = re.search(r"  \{%- unless settings\.type_system_fonts -%\}\n    <link rel=\"stylesheet\" href=\"https://fonts\.googleapis\.com[^\n]*\n  \{%- endunless -%\}\n", s).group(0)
s = s.replace(old, "  {%- unless settings.type_system_fonts -%}{% render 'fonts', is_rtl: is_rtl %}{%- endunless -%}\n", 1)
p.write_text(s, encoding="utf-8")

# glass.css tokens
p = ROOT / "assets/glass.css"
s = p.read_text(encoding="utf-8")
s = s.replace(
    '  --font-display: "Archivo", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", system-ui, sans-serif;\n'
    '  --font-body:    "Manrope", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;\n',
    '  --font-display: "Unbounded", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", system-ui, sans-serif;\n'
    '  --font-body:    "Space Grotesk", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;\n', 1)
s = s.replace(
    'html[dir="rtl"] {\n  --font-display: "Alexandria", "Archivo", system-ui, sans-serif;\n  --font-body: "IBM Plex Sans Arabic", "Manrope", system-ui, sans-serif;\n  --tracking-label: 0;\n}',
    'html[dir="rtl"] {\n  --font-display: "Cairo", "Unbounded", system-ui, sans-serif;\n  --font-body: "Readex Pro", "Space Grotesk", system-ui, sans-serif;\n  --tracking-label: 0;\n  --fs-display: clamp(36px, 5.6vw, 80px);\n  --fs-h1: clamp(30px, 4vw, 54px);\n  --fs-h2: clamp(26px, 3vw, 40px);\n}', 1)
assert '"Unbounded"' in s and '"Cairo"' in s
p.write_text(s, encoding="utf-8")
print("ok")
