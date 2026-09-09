"""Build recolourable garment mockups for the Customize studio.

Strategy: take the brand's real product photography (white hoodie flat-front, white tee front),
cut the garment from its white background into an alpha mask, and convert the garment to a
luminance "shading" map (mid-grey = base colour, darker = fold shadow, lighter = highlight).
The theme renders `<div style="background: COLOR">` masked by the alpha, with the shading
layer composited on top in `mix-blend-mode: multiply`/`screen` — so a single PNG recolours
to any hex the merchant sets. Output: theme/assets/mock-{hoodie,tee}-{alpha,shade}.png (+ webp).
"""
import pathlib
import sys
from PIL import Image, ImageFilter, ImageOps, ImageChops

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("/tmp/ph")
OUT = ROOT / "theme" / "assets"
SIZE = 1200


def cutout(path, thresh=238, feather=1.2, pad=0.06):
    im = Image.open(path).convert("RGB")
    g = im.convert("L")
    # background is near-white: mask = pixels darker than thresh, cleaned up
    mask = g.point(lambda v: 255 if v < thresh else 0)
    # remove specks / fill hood interior holes by morphological close
    mask = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
    # keep the largest connected region: flood-fill from corners to find background instead
    bg = Image.new("L", mask.size, 0)
    from PIL import ImageDraw
    ImageDraw.floodfill(mask, (0, 0), 128, thresh=0)
    ImageDraw.floodfill(mask, (mask.width - 1, 0), 128, thresh=0)
    ImageDraw.floodfill(mask, (0, mask.height - 1), 128, thresh=0)
    ImageDraw.floodfill(mask, (mask.width - 1, mask.height - 1), 128, thresh=0)
    alpha = mask.point(lambda v: 0 if v == 128 else 255)
    alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    # crop to bbox with padding, square canvas
    bbox = alpha.getbbox()
    im = im.crop(bbox)
    alpha = alpha.crop(bbox)
    w, h = im.size
    side = int(max(w, h) * (1 + pad * 2))
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    acanvas = Image.new("L", (side, side), 0)
    ox, oy = (side - w) // 2, (side - h) // 2
    canvas.paste(im, (ox, oy))
    acanvas.paste(alpha, (ox, oy))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS), acanvas.resize((SIZE, SIZE), Image.LANCZOS)


def shading(rgb, alpha):
    """Luminance → shading map centred on mid-grey so multiply/screen recolour works."""
    g = rgb.convert("L")
    # normalise garment luminance range to ~[80, 235] then re-centre at 160
    g = ImageOps.autocontrast(g, cutoff=1)
    g = g.point(lambda v: int(80 + (v / 255) * 155))
    shade = Image.merge("LA", (g, alpha))
    return shade


def build(name, src, **kw):
    rgb, alpha = cutout(SRC / src, **kw)
    shade = shading(rgb, alpha)
    shade_rgba = shade.convert("RGBA")
    shade_rgba.save(OUT / f"mock-{name}.png", optimize=True)
    shade_rgba.save(OUT / f"mock-{name}.webp", quality=88, method=6)
    print(name, "→", OUT / f"mock-{name}.webp", (OUT / f"mock-{name}.webp").stat().st_size // 1024, "KB")


build("hoodie", "Sada_White_1_24e825f4-e9f5-4d70-92c4-1b1c14f7ff13.jpg", thresh=236)
build("tee", "IMG_2756.jpg", thresh=200, feather=1.0)
