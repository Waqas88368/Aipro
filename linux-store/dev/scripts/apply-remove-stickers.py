"""Remove the astronaut penguin everywhere and drop every sticker that overlays content
(hero, campaign, collection/search/list-collections header, newsletter). Penguins that live *inside* layout
(footer corner, empty states, penguin-row, brand statement) stay — they don't cover anything."""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2] / "theme"


def sub(rel, pattern, repl, count=0, regex=True, must=True):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    n = len(re.findall(pattern, s, flags=re.S)) if regex else s.count(pattern)
    if must:
        assert n, f"{rel}: pattern not found: {pattern[:70]}"
    s = re.sub(pattern, repl, s, count=count, flags=re.S) if regex else s.replace(pattern, repl)
    p.write_text(s, encoding="utf-8")


# 1. astro → classic wherever rendered
for rel in ["sections/main-404.liquid", "sections/main-search.liquid", "sections/newsletter.liquid", "sections/penguin-row.liquid"]:
    sub(rel, r"name: 'astro'", "name: 'classic'", must=False)
sub("templates/password.liquid", r"\{\{ 'mascot-astro\.webp' \| asset_url \}\}", "{{ 'mascot-classic.webp' | asset_url }}")
sub("snippets/mascot.liquid", r"  Brand penguin\. name: classic \| skate \| skate-spray \| hoodie-sit \| boombox \| astro", "  Brand penguin. name: classic | skate | skate-spray | hoodie-sit | boombox")
sub("snippets/mascot.liquid", r"\n    when 'astro'\n      assign ratio = 0\.79", "")
# penguin-row now has classic twice → drop the duplicate (last one)
p = ROOT / "sections/penguin-row.liquid"
s = p.read_text(encoding="utf-8")
first = s.find("{% render 'mascot', name: 'classic', width: 120 %}")
last = s.rfind("{% render 'mascot', name: 'classic', width: 120 %}")
if first != last:
    s = s[:last] + s[last:].replace("    {% render 'mascot', name: 'classic', width: 120 %}\n", "", 1)
    p.write_text(s, encoding="utf-8")
(ROOT / "assets/mascot-astro.webp").unlink(missing_ok=True)

# 2. hero: remove sticker block + its schema settings
sub("sections/hero-embroidery.liquid", r"\s*\{%- if s\.show_mascot -%\}\s*<div class=\"hero__sticker\".*?</div>\s*\{%- endif -%\}", "\n")
sub("sections/hero-embroidery.liquid", r"\s*\{ \"type\": \"checkbox\", \"id\": \"show_mascot\", \"label\": \"Show penguin sticker\", \"default\": true \},\n\s*\{ \"type\": \"select\", \"id\": \"mascot\",[^\n]*\n", "\n")
# 3. campaign: sticker overlays the image — remove
sub("sections/campaign.liquid", r"\s*\{%- if s\.show_mascot -%\}<div class=\"campaign__mascot\" aria-hidden=\"true\">\{% render 'mascot', name: s\.mascot, width: 170 %\}</div>\{%- endif -%\}", "")
sub("sections/campaign.liquid", r"\s*\{ \"type\": \"checkbox\", \"id\": \"show_mascot\"[^\n]*\n", "\n", must=False)
sub("sections/campaign.liquid", r"\s*\{ \"type\": \"select\", \"id\": \"mascot\"[^\n]*\n", "\n", must=False)
# 4. collection / list-collections / search page headers
sub("sections/main-collection.liquid", r"\s*\{%- if s\.show_mascot -%\}<div class=\"collection__mascot\" aria-hidden=\"true\">\{% render 'mascot', name: 'skate', width: 150 %\}</div>\{%- endif -%\}", "")
sub("sections/main-collection.liquid", r"\s*\{ \"type\": \"checkbox\", \"id\": \"show_mascot\"[^\n]*\n", "\n", must=False)
sub("sections/main-list-collections.liquid", r"\s*<div class=\"collection__mascot\" aria-hidden=\"true\">\{% render 'mascot', name: 'boombox', width: 150 %\}</div>", "")
sub("sections/main-search.liquid", r"\s*<div class=\"collection__mascot\" aria-hidden=\"true\">\{% render 'mascot', name: 'hoodie-sit', width: 150 %\}</div>", "")
# 5. newsletter sticker
sub("sections/newsletter.liquid", r"\s*\{%- if s\.show_mascot -%\}<div class=\"newsletter__mascot\" aria-hidden=\"true\">\{% render 'mascot', name: 'classic', width: 120 %\}</div>\{%- endif -%\}", "")
sub("sections/newsletter.liquid", r"\s*\{ \"type\": \"checkbox\", \"id\": \"show_mascot\"[^\n]*\n", "\n", must=False)

# 6. templates/json: drop any stale show_mascot/mascot settings so theme-check doesn't flag unknown settings
for jp in list((ROOT / "templates").rglob("*.json")) + [ROOT / "config/settings_data.json"]:
    t = jp.read_text(encoding="utf-8")
    t2 = re.sub(r"\n\s*\"(show_mascot|mascot)\": [^\n]*,?", "", t)
    # fix trailing comma before a closing brace produced by removal
    t2 = re.sub(r",(\s*})", r"\1", t2)
    if t2 != t:
        jp.write_text(t2, encoding="utf-8")
print("ok")
