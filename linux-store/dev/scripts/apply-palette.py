"""Brand palette lockdown: forest greens + cream + lime only. Gold/sand and red/pink are replaced;
'danger' becomes a cream-on-forest treatment so errors stay legible without introducing red."""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2] / "theme"


def rw(rel, pairs, regex=False):
    p = ROOT / rel
    s = p.read_text(encoding="utf-8")
    for old, new in pairs:
        if regex:
            assert re.search(old, s), rel + ": " + old
            s = re.sub(old, new, s)
        else:
            assert old in s, rel + ": " + old[:80]
            s = s.replace(old, new)
    p.write_text(s, encoding="utf-8")


rw("assets/glass.css", [
    ("  --sand:          #c9a46a;\n  --danger:        #ff7a6e;\n", "  --sand:          var(--lime);      /* legacy alias: gold retired */\n  --danger:        var(--cream);     /* errors: cream text on a forest chip, no red */\n"),
    (".chip--sale { background: var(--sand); color: var(--forest-deep); border-color: transparent; }", ".chip--sale { background: var(--lime); color: var(--forest-deep); border-color: transparent; }"),
    (".field__error, .form-error { color: var(--danger); font-size: var(--fs-sm); }", ".field__error, .form-error { color: var(--cream); background: rgb(143 203 90 / .14); border: 1px solid rgb(143 203 90 / .35); padding: 8px 12px; border-radius: 12px; font-size: var(--fs-sm); }\n.field__error:empty, .form-error:empty { display: none; }"),
])
rw("assets/components.css", [
    (".card__wish.is-active { color: #ff8fa3; }", ".card__wish.is-active { color: var(--lime); }"),
    (".review__stars { display: flex; gap: 2px; color: var(--sand); }", ".review__stars { display: flex; gap: 2px; color: var(--lime); }"),
    (".cart-line__remove:hover { color: var(--danger); }", ".cart-line__remove:hover { color: var(--lime); }"),
    (".toast--error .toast__icon { background: var(--danger); color: #fff; }", ".toast--error .toast__icon { background: var(--forest); color: var(--cream); border: 1px solid var(--lime); }"),
    (".wa-fab svg { color: #64e17a; }", ".wa-fab svg { color: var(--lime); }"),
])
rw("assets/product.css", [
    (".pdp__rating svg { color: var(--sand); }", ".pdp__rating svg { color: var(--lime); }"),
    (".dot--warn { background: var(--sand); box-shadow: 0 0 10px var(--sand); }", ".dot--warn { background: var(--cream); box-shadow: 0 0 10px rgb(244 232 216 / .6); }"),
    (".pdp__wish.is-active { color: #ff8fa3; }", ".pdp__wish.is-active { color: var(--lime); }"),
])
rw("assets/motion.css", [
    ("rgb(255 143 163 / .7)", "rgb(143 203 90 / .7)"),
    ("rgb(255 143 163 / 0)", "rgb(143 203 90 / 0)"),
])
print("ok")
