# LINUX — Liquid Glass theme · التركيب

**العربي تحت 👇 / English first**

## English

**What's in this folder**
- `linux-liquid-glass-theme.zip` — the Shopify theme. This is the only file you upload.
- `hero-video/` — the embroidery hero video masters (1080p, 720p, poster) in case you want to re-use them elsewhere. They are already inside the theme.
- `brand-assets/` — penguin mascots, wordmark, favicons, editorial images used by the theme.

**Install (5 minutes)**
1. Shopify admin → **Online Store → Themes → Add theme → Upload zip file** → pick `linux-liquid-glass-theme.zip`.
2. Click **Customize** on the new theme (it stays unpublished until you press Publish).
3. **Theme settings → Store**: WhatsApp number, Instagram / Facebook / TikTok links, free-shipping threshold (LE), delivery estimates.
4. **Home page**: every section is a block — reorder or hide. Pick your collections for *Most wanted* / *Shop by drop* / *Fresh off the machine*. Text fields are empty on purpose: empty = the theme's own translation (English + Arabic). Type something only if you want custom copy.
5. **Customize studio**: Online Store → Pages → Add page → title "Customize", template **page.customize**. Then in the theme editor point the section at your *Hoodie Customize* product.
6. **Arabic**: Settings → Languages → **Add language → Arabic → Publish**. The theme flips to RTL with Arabic fonts and every string translated. Your own product titles/descriptions are translated word-by-word by the theme (hoodie → هودي, black → أسود…); for perfect copy use Shopify's free **Translate & Adapt** app.
7. **Publish**.

**Bundle offer (Buy 2 / Buy 3)**: the product page shows the tiers you set in the theme editor (Product page → *Bundle offer* block → quantities and %). The tiers are display + a quantity shortcut; the real discount is a Shopify **automatic discount** you create once: Discounts → Create → *Amount off products* → **Automatic** → *Minimum quantity of items* = 2 → 10% off (repeat for 3 → 15%). Keep the numbers in the block and in Discounts in sync.

**Find your size**: also a block on the product page. It suggests a size from height/weight with a visible "rough guide" disclaimer. Turn it off per product by removing the block.

**Discount code in the cart**: works out of the box on Shopify (uses the 2025 Cart API). Codes must exist in Discounts.

**Customize studio v2**: hoodie + tee, live recolour, drag/scale, front/back, quantity with a size per piece, print from 1 piece / embroidery from 10 (both editable in the section), notes, WhatsApp button. The section maps *Print / Embroidery* to your Customize product's **Type** option — keep those two values on the product so pricing switches correctly. Everything arrives on the order as line-item properties (Garment, Colour, Method, Sizes, Notes, Design file).

**Fonts**: Unbounded + Space Grotesk (English), Cairo + Readex Pro (Arabic) — self-hosted inside the theme, no Google request. Toggle *Use system fonts* in Theme settings if you ever want to drop them.

---

## العربي

**اللي في الفولدر**
- `linux-liquid-glass-theme.zip` — الثيم نفسه. ده الملف الوحيد اللي بترفعه.
- `hero-video/` — فيديو التطريز (1080p و720p وصورة البوستر) لو عايز تستخدمه في مكان تاني. هو موجود جوه الثيم أصلاً.
- `brand-assets/` — البطاريق، اللوجو، الفافيكون، وصور البراند اللي الثيم بيستخدمها.

**التركيب (٥ دقايق)**
1. لوحة تحكم Shopify ← **Online Store ← Themes ← Add theme ← Upload zip file** ← اختار `linux-liquid-glass-theme.zip`.
2. دوس **Customize** على الثيم الجديد (مش هينزل لايف غير لما تدوس Publish).
3. **Theme settings ← Store**: رقم الواتساب، لينكات إنستجرام/فيسبوك/تيك توك، حد الشحن المجاني، مواعيد التوصيل.
4. **الصفحة الرئيسية**: كل سكشن بلوك تقدر ترتّبه أو تخفيه. اختار الكوليكشنز لـ *الأكثر طلباً* / *تسوّق حسب الإصدار* / *طازة من الماكينة*. خانات النص فاضية عن قصد: فاضية = الثيم بيكتب النص بنفسه بالإنجليزي والعربي. اكتب فيها بس لو عايز نص مخصوص.
5. **استوديو التخصيص**: Online Store ← Pages ← Add page ← الاسم "Customize" والقالب **page.customize**. بعدين من محرر الثيم اربط السكشن بمنتج *Hoodie Customize*.
6. **العربي**: Settings ← Languages ← **Add language ← Arabic ← Publish**. الثيم بيتحوّل RTL بخطوط عربية وكل كلمة متعرّبة. أسماء منتجاتك ووصفها الثيم بيترجمها كلمة كلمة (hoodie ← هودي، black ← أسود…)، ولو عايز ترجمة أدق استخدم تطبيق Shopify المجاني **Translate & Adapt**.
7. **Publish**.

**عرض الباندل (اشتري 2 / اشتري 3)**: صفحة المنتج بتعرض الشرايح اللي بتحددها من محرر الثيم (Product page ← بلوك *Bundle offer* ← الكمية والنسبة). البلوك ده للعرض وتغيير الكمية بسرعة؛ الخصم الفعلي بتعمله مرة واحدة من Shopify: Discounts ← Create ← *Amount off products* ← **Automatic** ← *Minimum quantity of items* = 2 ← خصم 10% (وكرّرها لـ 3 ← 15%). خلّي الأرقام في البلوك وفي Discounts متطابقة.

**اعرف مقاسك**: بلوك في صفحة المنتج كمان. بيقترح مقاس من الطول والوزن ومكتوب تحته إنه استرشادي مش مؤكد. تقدر تشيله من أي منتج بحذف البلوك.

**كود الخصم في الشنطة**: شغال على Shopify مباشرة (بيستخدم Cart API الجديد 2025). الكود لازم يكون موجود في Discounts.

**استوديو التخصيص v2**: هودي + تيشيرت، اللون بيتغيّر لايف على الموكب، سحب وتكبير التصميم، قدام/ورا، عدد القطع ومقاس لكل قطعة، طباعة من قطعة واحدة / تطريز من 10 (الرقمين بتعدّلهم من السكشن)، ملاحظات، وزرار واتساب. السكشن بيربط *Print / Embroidery* بخيار **Type** في منتج Customize — خلّي القيمتين دول موجودين على المنتج عشان السعر يتغيّر صح. كل حاجة بتوصل في الأوردر كـ line-item properties.

**الخطوط**: Unbounded + Space Grotesk للإنجليزي، Cairo + Readex Pro للعربي — محمّلة جوه الثيم من غير أي طلب لجوجل.
