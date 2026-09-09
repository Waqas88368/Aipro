"""Adds the `home` + `sections.hero` translation namespaces (EN/AR) used as fallbacks for merchant copy."""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "theme"

EN = {
    "hero": {
        "eyebrow": "LINUX · Cairo · FW26",
        "heading": "Stitched in Cairo. Worn everywhere.",
        "subheading": "Heavyweight streetwear, embroidered — not printed.",
        "cta": "Shop the drop",
        "cta2": "Customize yours",
        "trust_1": "Free shipping over LE 2,000",
        "trust_2": "14-day easy exchange",
        "trust_3": "Embroidered, not printed",
    },
    "home": {
        "marquee": ["Free shipping over LE 2,000", "Embroidered, not printed", "14-day easy exchange", "Heavyweight 340 gsm melton", "Cash on delivery across Egypt"],
        "bestsellers_eyebrow": "Best sellers",
        "bestsellers_heading": "Most wanted",
        "collections_eyebrow": "Collections",
        "collections_heading": "Shop by drop",
        "collections_customize_label": "Customize",
        "collections_customize_sub": "Your design, our thread",
        "collections_all_label": "Everything",
        "campaign_eyebrow": "The drop",
        "campaign_heading": "Green is the new black.",
        "campaign_body": "Forest heavyweight fleece, cream embroidery, rounded everything. Built for Cairo nights.",
        "campaign_primary": "Shop hoodies",
        "campaign_secondary": "Customize yours",
        "campaign_note": "LIMITED RUN · FW26",
        "arrivals_eyebrow": "New arrivals",
        "arrivals_heading": "Fresh off the machine",
        "look_eyebrow": "Shop the look",
        "look_heading": "Full fit, one tap",
        "look_body": "Tap a dot on the photo, or add straight from the list.",
        "prop_1_title": "Fast delivery", "prop_1_text": "1–2 days in Cairo, 2–4 across Egypt.",
        "prop_2_title": "Cash on delivery", "prop_2_text": "Pay when it lands. Cards too.",
        "prop_3_title": "14-day exchange", "prop_3_text": "Wrong size? Swap it, no drama.",
        "prop_4_title": "Embroidered, not printed", "prop_4_text": "Thread that outlives the trend.",
        "statement_eyebrow": "Who we are",
        "statement_heading_html": "<p>A penguin with a spray can. A brand with a <em>needle</em>.</p>",
        "statement_body": "LINUX is a Cairo streetwear label. Every piece is embroidered — not printed — so the mark lives in the fabric, not on it.",
        "statement_cta": "Our story",
        "reviews_eyebrow": "Reviews",
        "reviews_heading": "Worn & rated",
        "reviews_rating": "4.9 / 5 · 300+ orders",
        "review_1_quote": "Heaviest hoodie I own and the embroidery is unreal. Worth every pound.", "review_1_name": "Omar K.", "review_1_meta": "Cairo",
        "review_2_quote": "Exchange was painless and the fit guide was spot on.", "review_2_name": "Salma A.", "review_2_meta": "Alexandria",
        "review_3_quote": "The penguin sticker alone is worth it. Site looks insane too.", "review_3_name": "Youssef M.", "review_3_meta": "Giza",
        "ugc_eyebrow": "Community",
        "ugc_heading": "Worn in the wild",
        "faq_eyebrow": "FAQ",
        "faq_heading": "Questions, answered",
        "faq_body": "Delivery, exchanges and sizing in one place.",
        "faq_cta": "Ask on WhatsApp",
        "faq_1_q": "How long does delivery take?", "faq_1_a": "<p>Cairo &amp; Giza: 1–2 days. Rest of Egypt: 2–4 days. Your estimate is confirmed at checkout.</p>",
        "faq_2_q": "Can I exchange my size?", "faq_2_a": "<p>Yes — within 14 days, unworn with tags. Start an exchange from your account page or WhatsApp.</p>",
        "faq_3_q": "Do you accept cash on delivery?", "faq_3_a": "<p>Yes, everywhere in Egypt. Cards and Meeza too.</p>",
        "faq_4_q": "How does Customize work?", "faq_4_a": "<p>Upload your design in the Customize studio, pick a garment and colour, preview it live and order. We stitch it in 3–5 days.</p>",
        "newsletter_eyebrow": "Join the flock",
        "newsletter_heading": "Early access to every drop.",
        "newsletter_body": "10% off your first order. No spam — just penguins.",
        "recommendations_heading": "Complete the look",
        "footer_tagline": "Cairo streetwear. Embroidered, not printed. Built to outlive the trend.",
        "announcement": "Free shipping over LE 2,000 · Cash on delivery across Egypt · 14-day exchange",
        "mega_promo": "FW26 drop",
        "shop_cta": "Shop",
        "customize_eyebrow": "Customize studio",
        "customize_heading": "Your design. Our thread.",
        "garment_tee": "Tee", "garment_hoodie": "Hoodie", "garment_cap": "Cap",
        "customize_faq_title": "Good to know",
        "customize_faq_1_q": "What files work best?", "customize_faq_1_a": "High-resolution PNG with a transparent background, or SVG. Keep it under 10 MB.",
        "customize_faq_2_q": "How many thread colours?", "customize_faq_2_a": "Up to 6 colours per design. We'll match your artwork as closely as thread allows.",
        "customize_faq_3_q": "How long does it take?", "customize_faq_3_a": "3–5 working days to stitch, then delivery.",
        "about_eyebrow": "Our story",
        "about_heading": "Thread over trend.",
        "about_body": "LINUX is a Cairo streetwear label. Every piece is embroidered — not printed — so the mark lives in the fabric, not on it.",
        "about_stat_1_v": "4,000", "about_stat_1_l": "stitches per minute",
        "about_stat_2_v": "340 gsm", "about_stat_2_l": "melton cotton",
        "about_stat_3_v": "27", "about_stat_3_l": "governorates delivered",
        "about_stat_4_v": "1", "about_stat_4_l": "penguin",
        "about_moment_1_y": "2023", "about_moment_1_t": "The first hoodie", "about_moment_1_x": "Stitched on a borrowed machine in Nasr City. Sold out in a week.",
        "about_moment_2_y": "2024", "about_moment_2_t": "The penguin arrives", "about_moment_2_x": "A doodle on a receipt becomes the face of the brand.",
        "about_moment_3_y": "2025", "about_moment_3_t": "Customize studio", "about_moment_3_x": "Your artwork, our thread. Live preview, stitched in 3–5 days.",
        "about_why_eyebrow": "Why embroidery",
        "about_why_heading_html": "<p>Print fades. <em>Thread</em> doesn't.</p>",
        "about_why_body": "Our wordmark is sewn at 4,000 stitches per minute, and it will outlive the hoodie it sits on. That is the whole idea.",
        "contact_heading": "Contact us",
        "contact_body": "Questions about an order, a size, or a custom design? Reach us on WhatsApp or drop a message — we reply within a few hours.",
        "contact_faq_title": "Before you ask",
        "contact_faq_1_q": "How long does delivery take?", "contact_faq_1_a": "Cairo &amp; Giza: 1–2 days. Rest of Egypt: 2–4 days.",
        "contact_faq_2_q": "Can I exchange my size?", "contact_faq_2_a": "Yes — within 14 days, unworn with tags.",
        "contact_faq_3_q": "Do you ship outside Egypt?", "contact_faq_3_a": "Not yet — message us on WhatsApp and we'll sort something out.",
    },
}

AR = {
    "hero": {
        "eyebrow": "LINUX · القاهرة · FW26",
        "heading": "مطرّز في القاهرة. ملبوس في كل مكان.",
        "subheading": "ستريت وير تقيل، مطرّز — مش مطبوع.",
        "cta": "تسوّق الإصدار",
        "cta2": "صمّم بنفسك",
        "trust_1": "شحن مجاني فوق 2,000 جنيه",
        "trust_2": "استبدال سهل خلال 14 يوم",
        "trust_3": "تطريز، مش طباعة",
    },
    "home": {
        "marquee": ["شحن مجاني فوق 2,000 جنيه", "تطريز، مش طباعة", "استبدال سهل خلال 14 يوم", "قماش ميلتون تقيل 340 جرام", "الدفع عند الاستلام في كل مصر"],
        "bestsellers_eyebrow": "الأكثر مبيعاً",
        "bestsellers_heading": "الأكثر طلباً",
        "collections_eyebrow": "المجموعات",
        "collections_heading": "تسوّق حسب الإصدار",
        "collections_customize_label": "صمّم بنفسك",
        "collections_customize_sub": "تصميمك، وخيطنا",
        "collections_all_label": "كل المنتجات",
        "campaign_eyebrow": "الإصدار",
        "campaign_heading": "الأخضر هو الأسود الجديد.",
        "campaign_body": "فليس تقيل بلون الغابة، تطريز كريمي، وكل حاجة دايرية. معمول لليالي القاهرة.",
        "campaign_primary": "تسوّق الهوديز",
        "campaign_secondary": "صمّم بنفسك",
        "campaign_note": "إصدار محدود · FW26",
        "arrivals_eyebrow": "وصل حديثاً",
        "arrivals_heading": "طازة من الماكينة",
        "look_eyebrow": "تسوّق اللوك",
        "look_heading": "اللوك كامل بضغطة واحدة",
        "look_body": "دوس على نقطة في الصورة، أو ضيف مباشرة من القائمة.",
        "prop_1_title": "توصيل سريع", "prop_1_text": "١-٢ يوم في القاهرة، ٢-٤ أيام في باقي مصر.",
        "prop_2_title": "الدفع عند الاستلام", "prop_2_text": "ادفع لما يوصلك. وبالكارت كمان.",
        "prop_3_title": "استبدال خلال 14 يوم", "prop_3_text": "المقاس مش مظبوط؟ بدّله من غير وجع دماغ.",
        "prop_4_title": "تطريز، مش طباعة", "prop_4_text": "خيط يعيش أكثر من الترند.",
        "statement_eyebrow": "مين إحنا",
        "statement_heading_html": "<p>بطريق ماسك بخّاخة. وبراند ماسك <em>إبرة</em>.</p>",
        "statement_body": "LINUX براند ستريت وير من القاهرة. كل قطعة مطرّزة — مش مطبوعة — عشان العلامة تعيش في القماش، مش عليه.",
        "statement_cta": "قصتنا",
        "reviews_eyebrow": "آراء العملاء",
        "reviews_heading": "لبسوه وقيّموه",
        "reviews_rating": "4.9 / 5 · أكثر من 300 أوردر",
        "review_1_quote": "أتقل هودي عندي والتطريز مش طبيعي. يستاهل كل جنيه.", "review_1_name": "عمر ك.", "review_1_meta": "القاهرة",
        "review_2_quote": "الاستبدال كان سهل جداً ودليل المقاسات مظبوط.", "review_2_name": "سلمى أ.", "review_2_meta": "الإسكندرية",
        "review_3_quote": "ستيكر البطريق لوحده يستاهل. والموقع شكله جامد.", "review_3_name": "يوسف م.", "review_3_meta": "الجيزة",
        "ugc_eyebrow": "المجتمع",
        "ugc_heading": "ملبوس في الشارع",
        "faq_eyebrow": "الأسئلة الشائعة",
        "faq_heading": "أسئلة وإجابات",
        "faq_body": "التوصيل والاستبدال والمقاسات في مكان واحد.",
        "faq_cta": "اسأل على واتساب",
        "faq_1_q": "التوصيل بياخد قد إيه؟", "faq_1_a": "<p>القاهرة والجيزة: ١-٢ يوم. باقي مصر: ٢-٤ أيام. الموعد بيتأكد عند الدفع.</p>",
        "faq_2_q": "أقدر أبدّل المقاس؟", "faq_2_a": "<p>أيوه — خلال 14 يوم، من غير لبس وبالتيكت. ابدأ الاستبدال من صفحة حسابك أو على واتساب.</p>",
        "faq_3_q": "بتقبلوا الدفع عند الاستلام؟", "faq_3_a": "<p>أيوه، في كل مصر. وكمان الكارت وميزة.</p>",
        "faq_4_q": "التخصيص بيشتغل إزاي؟", "faq_4_a": "<p>ارفع تصميمك في استوديو التخصيص، اختار القطعة واللون، شوفه لايف واطلب. بنطرّزه في ٣-٥ أيام.</p>",
        "newsletter_eyebrow": "انضم للقطيع",
        "newsletter_heading": "وصول مبكر لكل إصدار.",
        "newsletter_body": "خصم 10% على أول أوردر. من غير سبام — بطاريق بس.",
        "recommendations_heading": "كمّل اللوك",
        "footer_tagline": "ستريت وير من القاهرة. تطريز، مش طباعة. معمول يعيش أكثر من الترند.",
        "announcement": "شحن مجاني فوق 2,000 جنيه · الدفع عند الاستلام في كل مصر · استبدال خلال 14 يوم",
        "mega_promo": "إصدار FW26",
        "shop_cta": "تسوّق",
        "customize_eyebrow": "استوديو التخصيص",
        "customize_heading": "تصميمك. خيطنا.",
        "garment_tee": "تيشيرت", "garment_hoodie": "هودي", "garment_cap": "كاب",
        "customize_faq_title": "معلومات مهمة",
        "customize_faq_1_q": "إيه أحسن نوع ملفات؟", "customize_faq_1_a": "PNG بدقة عالية وخلفية شفافة، أو SVG. وخلّيه أقل من 10 ميجا.",
        "customize_faq_2_q": "كام لون خيط؟", "customize_faq_2_a": "لحد 6 ألوان في التصميم. بنطابق تصميمك بأقرب ما يسمح الخيط.",
        "customize_faq_3_q": "بياخد وقت قد إيه؟", "customize_faq_3_a": "٣-٥ أيام عمل للتطريز، وبعدها التوصيل.",
        "about_eyebrow": "قصتنا",
        "about_heading": "الخيط قبل الترند.",
        "about_body": "LINUX براند ستريت وير من القاهرة. كل قطعة مطرّزة — مش مطبوعة — عشان العلامة تعيش في القماش، مش عليه.",
        "about_stat_1_v": "4,000", "about_stat_1_l": "غرزة في الدقيقة",
        "about_stat_2_v": "340 جرام", "about_stat_2_l": "قطن ميلتون",
        "about_stat_3_v": "27", "about_stat_3_l": "محافظة بنوصّل لها",
        "about_stat_4_v": "1", "about_stat_4_l": "بطريق",
        "about_moment_1_y": "2023", "about_moment_1_t": "أول هودي", "about_moment_1_x": "اتطرّز على ماكينة مستلفة في مدينة نصر. خلص في أسبوع.",
        "about_moment_2_y": "2024", "about_moment_2_t": "وصول البطريق", "about_moment_2_x": "شخبطة على فاتورة بقت وش البراند.",
        "about_moment_3_y": "2025", "about_moment_3_t": "استوديو التخصيص", "about_moment_3_x": "تصميمك وخيطنا. معاينة لايف، وتطريز في ٣-٥ أيام.",
        "about_why_eyebrow": "ليه التطريز",
        "about_why_heading_html": "<p>الطباعة بتبهت. <em>الخيط</em> لا.</p>",
        "about_why_body": "علامتنا بتتخيّط بسرعة 4,000 غرزة في الدقيقة، وهتعيش أكثر من الهودي نفسه. ودي الفكرة كلها.",
        "contact_heading": "تواصل معنا",
        "contact_body": "عندك سؤال عن أوردر أو مقاس أو تصميم خاص؟ كلّمنا على واتساب أو ابعت رسالة — بنرد خلال ساعات.",
        "contact_faq_title": "قبل ما تسأل",
        "contact_faq_1_q": "التوصيل بياخد قد إيه؟", "contact_faq_1_a": "القاهرة والجيزة: ١-٢ يوم. باقي مصر: ٢-٤ أيام.",
        "contact_faq_2_q": "أقدر أبدّل المقاس؟", "contact_faq_2_a": "أيوه — خلال 14 يوم، من غير لبس وبالتيكت.",
        "contact_faq_3_q": "بتشحنوا خارج مصر؟", "contact_faq_3_a": "لسه لا — ابعتلنا على واتساب ونشوف حل.",
    },
}

for rel, data in (("locales/en.default.json", EN), ("locales/ar.json", AR)):
    p = ROOT / rel
    d = json.loads(p.read_text(encoding="utf-8"))
    d["sections"]["hero"].update(data["hero"])
    d["home"] = data["home"]
    # sort options for the collection page
    d["collections"]["sort_options"] = (
        {"manual": "Featured", "best-selling": "Best selling", "title-ascending": "Alphabetically, A–Z", "title-descending": "Alphabetically, Z–A", "price-ascending": "Price, low to high", "price-descending": "Price, high to low", "created-descending": "Date, new to old", "created-ascending": "Date, old to new"}
        if rel.startswith("locales/en") else
        {"manual": "مميّز", "best-selling": "الأكثر مبيعاً", "title-ascending": "أبجدياً، أ–ي", "title-descending": "أبجدياً، ي–أ", "price-ascending": "السعر، من الأقل للأعلى", "price-descending": "السعر، من الأعلى للأقل", "created-descending": "الأحدث أولاً", "created-ascending": "الأقدم أولاً"}
    )
    d["collections"]["min"] = "Min" if rel.startswith("locales/en") else "الأدنى"
    d["collections"]["max"] = "Max" if rel.startswith("locales/en") else "الأعلى"
    d["collections"]["tags"] = "Tags" if rel.startswith("locales/en") else "الوسوم"
    d["general"]["breadcrumb"] = "Breadcrumb" if rel.startswith("locales/en") else "مسار التنقل"
    d["general"]["english"] = "English"
    d["general"]["arabic"] = "العربية"
    d["general"]["by_brand"] = "{{ brand }} · {{ type }}"
    d["products"]["option_names"] = (
        {"color": "Color", "colour": "Colour", "size": "Size", "type": "Type", "material": "Material", "style": "Style"}
        if rel.startswith("locales/en") else
        {"color": "اللون", "colour": "اللون", "size": "المقاس", "type": "النوع", "material": "الخامة", "style": "الستايل"}
    )
    d["products"]["option_values"] = (
        {} if rel.startswith("locales/en") else
        {"black": "أسود", "white": "أبيض", "beige": "بيج", "burgundy": "برجندي", "cream": "كريمي", "forest": "أخضر غابة", "navy": "كحلي", "grey": "رصاصي", "gray": "رصاصي", "print": "طباعة", "embroidery": "تطريز", "s": "S", "m": "M", "l": "L", "xl": "XL", "2xl": "2XL", "xxl": "2XL"}
    )
    d["blog"]["tag_prefix"] = "· {{ tag }}"
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("ok")
