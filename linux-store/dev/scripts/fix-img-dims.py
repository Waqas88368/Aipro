"""One-off: add explicit width/height to <img> tags flagged by theme-check, and use routes object."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "theme"


def sub(rel, old, new):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    assert old in s, (rel, old[:70])
    p.write_text(s.replace(old, new, 1), encoding="utf-8")


sub("sections/about-story.liquid",
    '<img src="{{ s.image | image_url: width: 1200 }}" alt="" loading="eager">',
    '<img src="{{ s.image | image_url: width: 1200 }}" alt="{{ s.image.alt | escape }}" width="{{ s.image.width }}" height="{{ s.image.height }}" loading="eager">')
sub("sections/main-blog.liquid",
    '<img src="{{ \'brand-still-life.webp\' | asset_url }}" alt="" loading="lazy">',
    '<img src="{{ \'brand-still-life.webp\' | asset_url }}" alt="" width="1400" height="875" loading="lazy">')
sub("sections/main-customize.liquid",
    '<img alt="{{ \'customize.preview_alt\' | t }}" data-cz-design-img>',
    '<img alt="{{ \'customize.preview_alt\' | t }}" width="400" height="400" data-cz-design-img>')
sub("sections/main-customize.liquid",
    '<img alt="" data-cz-thumb>',
    '<img alt="" width="48" height="48" data-cz-thumb>')
sub("sections/main-list-collections.liquid",
    '<img src="{{ \'brand-lookbook-2.webp\' | asset_url }}" alt="" loading="lazy">',
    '<img src="{{ \'brand-lookbook-2.webp\' | asset_url }}" alt="" width="900" height="1200" loading="lazy">')
sub("sections/main-product.liquid",
    '<img class="lightbox__img" src="" alt="" data-lightbox-img>',
    '<img class="lightbox__img" src="{{ \'hero-poster.webp\' | asset_url }}" alt="" width="1600" height="1600" data-lightbox-img>')
sub("sections/main-addresses.liquid",
    'action="/account/addresses/{{ address.id }}"',
    'action="{{ routes.account_addresses_url }}/{{ address.id }}"')
print("ok")
