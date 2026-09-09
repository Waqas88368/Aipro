"""One-off: replace the hero CSS block (lines .hero … .hero__toggle) with the wide-video layout."""
import pathlib, re

p = pathlib.Path(__file__).resolve().parents[2] / "theme/assets/components.css"
s = p.read_text(encoding="utf-8")

start = s.index(".hero { position: relative;")
end = s.index("/* ---- Marquee")
old_block = s[start:end]
assert "@keyframes bob" in old_block and "@keyframes scroll-hint" in old_block and ".hero__pane" in old_block

new_block = r"""/* ---- Hero: the video is the hero ------------------------------------------ */
.hero { position: relative; isolation: isolate; overflow: hidden; min-height: var(--hero-h, 100svh); display: grid; align-items: end; padding: calc(var(--header-h) + 60px) 0 clamp(28px, 4vh, 48px); border-radius: 0 0 var(--r-hero) var(--r-hero); margin-bottom: clamp(8px, 2vw, 24px); background: var(--forest-deep, #021a12); }
.hero__media { position: absolute; inset: 0; z-index: 0; will-change: transform; }
.hero__video { position: absolute; inset: -3%; width: 106%; height: 106%; object-fit: cover; object-position: center; filter: saturate(1.08) contrast(1.03); transform: scale(1.02); animation: hero-breathe 18s ease-in-out infinite alternate; }
@keyframes hero-breathe { to { transform: scale(1.07); } }
/* Light touch: keep the stitching visible, only ground the bottom for the strip */
.hero__scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(2 26 18 / calc(var(--hero-dim, .25) * .9)) 0%, rgb(2 26 18 / 0) 30%, rgb(2 26 18 / 0) 55%, rgb(2 26 18 / .78) 100%); }
.hero__vignette { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 40%, transparent 55%, rgb(2 26 18 / calc(var(--hero-dim, .25) * 1.4)) 100%); }
.hero__sticker { position: absolute; z-index: 2; top: calc(var(--header-h) + 84px); inset-inline-end: clamp(16px, 5vw, 80px); width: clamp(120px, 14vw, 200px); pointer-events: none; }
.hero__sticker img { width: 100%; height: auto; filter: drop-shadow(0 24px 30px rgb(0 0 0 / .4)); transform: rotate(6deg); }
html[dir="rtl"] .hero__sticker img { transform: rotate(-6deg); }
.hero__chip { position: absolute; bottom: 6%; inset-inline-start: -10%; transform: rotate(-4deg); }
.hero__inner { position: relative; z-index: 2; display: grid; gap: clamp(16px, 2.4vh, 26px); justify-items: start; }
.hero__copy { display: grid; gap: 12px; max-width: min(100%, 16ch); }
.hero__eyebrow { margin: 0; color: var(--cream); display: inline-flex; align-items: center; gap: 8px; }
.hero__title { color: var(--cream); font-size: clamp(38px, 7vw, 104px); line-height: .96; letter-spacing: -.035em; text-shadow: 0 2px 30px rgb(2 26 18 / .45); }
html[dir="rtl"] .hero__title { letter-spacing: 0; line-height: 1.15; font-size: clamp(34px, 6vw, 92px); }
.hero__bar { display: flex; align-items: center; gap: clamp(14px, 2vw, 28px); padding: 10px 10px 10px clamp(18px, 2vw, 28px); max-width: 100%; border-radius: var(--r-pill); }
html[dir="rtl"] .hero__bar { padding: 10px clamp(18px, 2vw, 28px) 10px 10px; }
.hero__sub { margin: 0; color: rgb(244 232 216 / .86); font-size: 15px; max-width: 34ch; text-wrap: balance; }
.hero__cta { display: flex; flex-wrap: nowrap; gap: 8px; margin-inline-start: auto; flex: none; }
.hero__trust { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 0; padding: 0 6px; list-style: none; }
.hero__trust li { display: inline-flex; align-items: center; gap: 8px; font: 500 13px var(--font-body); color: rgb(244 232 216 / .78); }
.hero__trust svg { color: var(--accent); }
.hero--quiet { align-items: end; }
@keyframes bob { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-12px) rotate(1.5deg); } }
[data-float] { animation: bob 6s ease-in-out infinite; }
@keyframes scroll-hint { 0% { transform: translateY(0); opacity: 1; } 80% { transform: translateY(16px); opacity: 0; } 100% { transform: translateY(16px); opacity: 0; } }
.hero__controls { position: absolute; z-index: 3; top: calc(var(--header-h) + 84px); inset-inline-start: var(--gutter); display: flex; gap: 8px; pointer-events: none; }
.hero__controls > * { pointer-events: auto; }
.hero__scroll { display: none; }
.hero__toggle { color: var(--cream); width: 40px; height: 40px; }
.hero__toggle-play { display: none; }
.hero__toggle[aria-pressed="true"] .hero__toggle-play { display: block; }
.hero__toggle[aria-pressed="true"] .hero__toggle-pause { display: none; }
@media (max-width: 900px) {
  .hero { padding-bottom: clamp(88px, 14vh, 120px); }
  .hero__sticker { width: 108px; top: auto; bottom: 34%; inset-inline-end: 12px; }
  .hero__bar { flex-direction: column; align-items: stretch; padding: 14px; border-radius: var(--r-xl); width: 100%; }
  html[dir="rtl"] .hero__bar { padding: 14px; }
  .hero__sub { max-width: none; }
  .hero__cta { margin-inline-start: 0; }
  .hero__cta .btn { flex: 1 1 0; }
  .hero__trust { gap: 6px 14px; }
  .hero__trust li { font-size: 12px; }
  .hero__controls { top: auto; bottom: 16px; inset-inline-start: auto; inset-inline-end: 12px; }
}
"""
s = s[:start] + new_block + s[end:]
p.write_text(s, encoding="utf-8")
print("replaced", len(old_block), "->", len(new_block))
