"""Hero layout v2: headline sits in the bottom strip beside the CTAs; trust row inline; video stays clear."""
import pathlib

p = pathlib.Path(__file__).resolve().parents[2] / "theme/assets/components.css"
s = p.read_text(encoding="utf-8")
start = s.index("/* ---- Hero: the video is the hero")
end = s.index("/* ---- Marquee")
new = r"""/* ---- Hero: the video is the hero ------------------------------------------ */
.hero { position: relative; isolation: isolate; overflow: hidden; min-height: var(--hero-h, 100svh); display: grid; align-items: end; padding: calc(var(--header-h) + 60px) 0 clamp(20px, 3vh, 36px); border-radius: 0 0 var(--r-hero) var(--r-hero); margin-bottom: clamp(8px, 2vw, 24px); background: var(--forest-deep, #021a12); }
.hero__media { position: absolute; inset: 0; z-index: 0; will-change: transform; }
.hero__video { position: absolute; inset: -3%; width: 106%; height: 106%; object-fit: cover; object-position: center; filter: saturate(1.08) contrast(1.03); transform: scale(1.02); animation: hero-breathe 18s ease-in-out infinite alternate; }
@keyframes hero-breathe { to { transform: scale(1.07); } }
/* Light touch: keep the stitching visible; only ground the bottom strip */
.hero__scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(2 26 18 / calc(var(--hero-dim, .25) * .8)) 0%, rgb(2 26 18 / 0) 26%, rgb(2 26 18 / 0) 62%, rgb(2 26 18 / .7) 100%); }
.hero__vignette { position: absolute; inset: 0; background: radial-gradient(120% 90% at 50% 45%, transparent 60%, rgb(2 26 18 / calc(var(--hero-dim, .25) * 1.2)) 100%); }
.hero__sticker { position: absolute; z-index: 2; top: calc(var(--header-h) + 84px); inset-inline-end: clamp(16px, 5vw, 80px); width: clamp(120px, 13vw, 190px); pointer-events: auto; }
.hero__sticker img { width: 100%; height: auto; filter: drop-shadow(0 24px 30px rgb(0 0 0 / .4)); transform: rotate(6deg); }
html[dir="rtl"] .hero__sticker img { transform: rotate(-6deg); }
.hero__chip { position: absolute; bottom: 6%; inset-inline-start: -10%; transform: rotate(-4deg); }
.hero__inner { position: relative; z-index: 2; display: grid; gap: 12px; }
.hero__strip { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: end; gap: clamp(16px, 3vw, 40px); padding: clamp(18px, 2.2vw, 30px) clamp(20px, 2.6vw, 36px); border-radius: var(--r-2xl); }
.hero__copy { display: grid; gap: 10px; min-width: 0; }
.hero__eyebrow { margin: 0; color: var(--cream); display: inline-flex; align-items: center; gap: 8px; }
.hero__title { color: var(--cream); font-size: clamp(30px, 3.6vw, 56px); line-height: 1; letter-spacing: -.03em; margin: 0; }
html[dir="rtl"] .hero__title { letter-spacing: 0; line-height: 1.25; font-size: clamp(28px, 3.3vw, 52px); }
.hero__side { display: grid; gap: 14px; justify-items: end; }
html[dir="rtl"] .hero__side { justify-items: start; }
.hero__sub { margin: 0; color: rgb(244 232 216 / .84); font-size: 15px; max-width: 36ch; text-align: end; }
.hero__cta { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.hero__trust { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 0; padding: 0 8px; list-style: none; }
.hero__trust li { display: inline-flex; align-items: center; gap: 8px; font: 500 13px var(--font-body); color: rgb(244 232 216 / .78); }
.hero__trust svg { color: var(--accent); }
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
  .hero { padding-bottom: clamp(84px, 13vh, 110px); }
  .hero__sticker { width: 104px; top: calc(var(--header-h) + 60px); inset-inline-end: 12px; }
  .hero__strip { grid-template-columns: 1fr; padding: 18px; border-radius: var(--r-xl); gap: 14px; }
  .hero__title { font-size: clamp(30px, 8.6vw, 40px); }
  .hero__side { justify-items: stretch; }
  html[dir="rtl"] .hero__side { justify-items: stretch; }
  .hero__sub { max-width: none; text-align: start; font-size: 14px; }
  .hero__cta { justify-content: stretch; }
  .hero__cta .btn { flex: 1 1 0; }
  .hero__trust { gap: 6px 14px; padding: 0 4px; }
  .hero__trust li { font-size: 12px; }
  .hero__controls { top: auto; bottom: 14px; inset-inline-start: auto; inset-inline-end: 12px; }
}
"""
s = s[:start] + new + s[end:]
p.write_text(s, encoding="utf-8")
print("ok")
