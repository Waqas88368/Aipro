"""Build brand imagery for the theme from the raw brand-identity folder and the
prior V2 theme's renders. Run once; outputs land in theme/assets.

usage: python3 build-assets.py <brand-identity-dir> <v2-assets-dir> <out-dir>
"""
import os
import sys

from PIL import Image

brand_dir, v2_dir, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)


def trim(im):
    bbox = im.getchannel("A").getbbox()
    return im.crop(bbox) if bbox else im


def size_kb(path):
    return os.path.getsize(path) // 1024


# Mascots: trimmed, capped at 900px on the long edge, lossy WebP with alpha.
mascots = {
    "البطريق.png": "mascot-classic",
    "البطريق-2.png": "mascot-skate-spray",
    "بطريق-3.png": "mascot-hoodie-sit",
    "البطريق-4.png": "mascot-skate",
    "البطريق-5.png": "mascot-boombox",
}
for src, name in mascots.items():
    im = trim(Image.open(os.path.join(brand_dir, src)).convert("RGBA"))
    r = 900 / max(im.size)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    dest = f"{out}/{name}.webp"
    im.save(dest, quality=90, method=6)
    print(name, im.size, size_kb(dest), "KB")

# Badge logo (round forest disc with wordmark + penguin) and favicons.
logo = trim(Image.open(os.path.join(brand_dir, "Logo1.PNG")).convert("RGBA"))
badge = logo.resize((640, round(640 * logo.height / logo.width)), Image.LANCZOS)
badge.save(f"{out}/brand-badge.webp", quality=92, method=6)
for s in (32, 180, 512):
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    l = logo.copy()
    l.thumbnail((s, s), Image.LANCZOS)
    canvas.paste(l, ((s - l.width) // 2, (s - l.height) // 2), l)
    canvas.save(f"{out}/favicon-{s}.png", optimize=True)

# Astronaut penguin from the V2 render set.
astro = trim(Image.open(os.path.join(v2_dir, "penguin-astro-1.webp")).convert("RGBA"))
astro.thumbnail((900, 900), Image.LANCZOS)
astro.save(f"{out}/mascot-astro.webp", quality=88, method=6)

# Editorial / placeholder photography, capped at 1400px.
photos = {
    "product-hoodie-green.webp": "placeholder-hoodie",
    "product-tee-cream.webp": "placeholder-tee",
    "product-cap-green.webp": "placeholder-cap",
    "product-jacket-green.webp": "placeholder-jacket",
    "product-pants-green.webp": "placeholder-pants",
    "brand-editorial.webp": "brand-editorial",
    "brand-lookbook-1.webp": "brand-lookbook-1",
    "brand-lookbook-2.webp": "brand-lookbook-2",
    "brand-still-life.webp": "brand-still-life",
    "brand-hero.webp": "brand-campaign",
}
for src, name in photos.items():
    im = Image.open(os.path.join(v2_dir, src)).convert("RGB")
    im.thumbnail((1400, 1400), Image.LANCZOS)
    dest = f"{out}/{name}.webp"
    im.save(dest, quality=80, method=6)
    print(name, im.size, size_kb(dest), "KB")
