# Tapita SEO Audit — Admin / App / Google actions (non-theme-code)

Companion to the small theme-code fixes on branch `seo/tapita-audit-fixes`. These items are **not** theme code — they are Shopify Admin, Tapita app, or Google actions. Store SEO score 69; 670 issues across 291 pages. **British English. Never fabricate facts; leave a field blank rather than guess.**

> Much of the content below was already drafted in the earlier deliverables — `ganguram_collections_copy_paste.md` (collections) and `ganguram_product_seo_import.csv` (35 product SEO titles). Re-use those; this doc maps them to the exact Tapita issues.

---

## 1) Collections — descriptions, meta descriptions & SEO titles (SHOPIFY_ADMIN, 16 collections)

Fixes **"Missing collection description" (16)**, **"Missing meta description" (16)** and **"Too short meta titles" (10)** in one pass per collection.
Admin path per collection: **Online Store → … → Products → Collections → [collection] → Edit description** (visible 2–4 sentence description from `ganguram_collections_copy_paste.md`) **and → Search engine listing → Edit** (paste the SEO title + meta description below). The theme already renders `collection.description` (`main-collection-banner.liquid`) once it exists — ensure that section's **"Show collection description"** is ticked in the theme editor.

| Collection | SEO title (≤60) | Meta description (140–160) |
|---|---|---|
| cakes | Cakes for Every Celebration \| Ganguram Sweets | Soft, moist cakes from Ganguram in chocolate, black forest, fruit and vanilla — perfect for birthdays, celebrations and everyday treats. |
| dry-fruits-mishti | Dry Fruit Mishti & Kaju Barfi \| Ganguram Sweets | Rich dry fruit Bengali sweets — kaju barfi, almond and fig mithai. Dense, indulgent and ideal for festivals, weddings and thoughtful gifting. |
| khowa-mishti | Khowa Mishti \| Bengali Khoya Sweets \| Ganguram | Classic khoya-based Bengali sweets with a deep, milky flavour and soft, fudge-like texture. A traditional treat for festivals and family tables. |
| muffins | Muffins \| Soft Everyday Bakes \| Ganguram Sweets | Soft, moist muffins in classic flavours from Ganguram — a light, individual bake for breakfast, tea-time, lunchboxes and sharing on the go. |
| pastries | Pastries \| Cream Pastry Slices \| Ganguram Sweets | Soft, layered cream pastries from Ganguram in chocolate, black forest and fruit flavours — a generous slice for tea-time or a small celebration. |
| pudding | Pudding \| Creamy Cup Desserts \| Ganguram Sweets | Smooth, creamy set puddings from Ganguram, served in cups in familiar flavours — an easy, chilled dessert to round off a meal or share. |
| rabri | Rabri \| Thick & Creamy Milk Dessert \| Ganguram | Thick, creamy rabri from Ganguram — milk slowly reduced in the traditional way for a rich, comforting Bengali dessert loved across generations. |
| rosher-mishti | Rosher Mishti \| Rosogolla & Cham Cham \| Ganguram | Syrup-soaked Bengali sweets from Ganguram — spongy rosogolla, cham cham and more, soaked in light, fragrant syrup. A timeless festive favourite. |
| sugar-free-mishti | Sugar-Free Mishti \| Bengali Sweets \| Ganguram | Traditional Bengali sweets made without added sugar — familiar flavours and textures in a lighter choice for everyday moments and gifting. |
| sweets-tray | Sweets Tray \| Assorted Mithai Trays \| Ganguram | Assorted Bengali sweets in a ready-to-serve tray from Ganguram — variety in one selection, ideal for festivals, gatherings and gifting. |
| tattya | Tattya \| Bengali Ceremonial Sweet Dala \| Ganguram | Decorative Bengali tattya gift dalas arranged with assorted sweets — a traditional gesture for weddings, blessings and auspicious occasions. |
| snacks | Snacks \| Bengali Savoury Tea-Time Bites \| Ganguram | Crisp, savoury Bengali snacks from Ganguram — flaky fried treats and spiced bites made for tea-time, sharing and everyday cravings. |
| confectioneries | Confectioneries \| Cakes, Pastries & More \| Ganguram | Bakery-led confectionery from Ganguram — cakes, muffins, pastries and puddings for birthdays, celebrations and everyday indulgence. |
| sondesh | Sandesh \| Soft Bengali Chenna Sweets \| Ganguram | Soft Bengali sandesh from Ganguram, made from fresh chenna — from plain classics to jalbhara with a date palm jaggery centre. A timeless mithai. |
| modak | Modak \| Festive Bengali Sweet \| Ganguram Sweets | Soft, delicately sweet modak from Ganguram — a cherished festive sweet for Ganesh Chaturthi, enjoyed as prasad and shared with the family. |
| mango-delights | Mango Delights \| Seasonal Mango Sweets \| Ganguram | Seasonal mango sweets from Ganguram — the bright, fragrant flavour of mango in traditional mithai and chilled treats, for a limited season only. |

Also shorten the existing **`/collections/sweets`** SEO title (currently 86 chars) → **`Bengali Sweets & Traditional Mithai | Ganguram`** (46).

## 2) Blog — `/blogs/news` (SHOPIFY_ADMIN)
Fixes the News "too short title" + "missing meta description". Admin: **Online Store → Blog posts → Manage blogs → News → Search engine listing → Edit**.
- SEO title: **`Ganguram News & Stories | Bengali Sweet Traditions`**
- Meta description (≈150): **`News, stories and seasonal updates from Ganguram Sweets — Bengali sweet traditions, festival specials and what's happening across our Kolkata stores.`**

## 3) Too-long product titles — VERIFY TAPITA FIRST (34) (TAPITA_APP → else SHOPIFY_ADMIN)
All 34 share the pattern **"Buy {product} Online | {category} | Ganguram Sweets"** (71–75 chars) — this is almost certainly a **Tapita meta-title *template***, not 34 hand-typed titles.
1. **Verify:** Tapita app → SEO meta / title templates → check for a products title template like `Buy [Product Title] Online | [Category] | Ganguram Sweets`.
2. **If template-driven (fix once):** shorten it, e.g. **`[Product Title] | [Category] | Ganguram`** (drops "Buy"/"Online" and "Sweets") → brings all 34 under 60. Re-scan.
3. **If per-product:** use `ganguram_product_seo_import.csv` (35 SEO titles already drafted) via Products → bulk *Edit* → *SEO title*, or a CSV import of **SEO Title only**. Do **not** import a full product CSV (would overwrite other fields / re-introduce the `U+FFFD` storage-text issue).

## 4) Duplicate meta titles — make unique by pack size (4) (SHOPIFY_ADMIN / TAPITA per-page)
Set a unique SEO title per product (Product → Search engine listing → Edit, or a Tapita per-page override):
- `signature-assortment-nolen-gur-fruit-medley-box-of-14` → **Signature Assortment Nolen Gur & Fruit Medley (14pcs) | Ganguram**
- `signature-assortment-nolen-gur-fruit-medley-box-of-18` → **Signature Assortment Nolen Gur & Fruit Medley (18pcs) | Ganguram**
- `signature-assortment-box-of-20` → **Signature Assortment Box (20pcs) | Ganguram**
- `signature-assortment-box-of-25` → **Signature Assortment Box (25pcs) | Ganguram**

## 5) Homepage meta description — shorten (310 → 150–160) (SHOPIFY_ADMIN; verify Tapita)
Admin: **Online Store → Preferences → Homepage meta description** (and check Tapita isn't overriding the homepage meta). Suggested (144):
> `Heritage Bengali sweets from Kolkata since 1885 — sandesh, jalbhara, mishti doi, rosogolla, snacks, namkeen and gift trays, delivered with care.`

## 6) Homepage image alt text (SHOPIFY_ADMIN + APP/VERIFY)
- **`banner_1_jpg.jpg` & `banner_2_jpg.jpg`** (slideshow): the theme already supports per-image alt (enabled in `main`); set it in **Customise → homepage slideshow → each image block → Alt text** (or the image's alt in **Content → Files**). Suggested only if it matches the artwork: "Ganguram festive Bengali sweets" / "Assorted Ganguram mithai".
- **`nolen-gur-jalbhara-sandesh.jpg` (120×120):** this is **not** a static theme image — every native homepage renderer already outputs an `alt` (slideshow→image alt, collection tiles→collection title, product cards→product title, promo cards→block title). It is almost certainly rendered by the homepage **"apps" section** (an app block such as EComposer), or it is a product media image surfaced by an app. **Fix:** set its alt text in that **app's** image setting, or set the alt on the **product's image in Shopify Admin** (Products → [product] → Media → Add alt text). No safe native theme-Liquid fallback targets this exact image.

## 7) LinkedIn URL — fix malformed value (SHOPIFY_ADMIN)
The live `social_linkedin` value is malformed (`https://linkedin.com//company/ganguramoriginal`, double slash) and is **not** in the repo backup, so it lives only in the live Theme Editor. **Verify the correct live company URL**, then set it in **Customise → Theme settings → Social media → LinkedIn** to:
> `https://www.linkedin.com/company/ganguramoriginal`
(Note: the social/share `rel="nofollow noopener noreferrer"` for the "Dofollow external links" (291) issue is **already in `main`** from the earlier SEO fix — it clears on the next theme publish.)

## 8) Google Search Console — verify (GOOGLE_ADMIN; do NOT fake)
- Quickest: **Online Store → Preferences → Google Search Console** → connect/verify, **or** paste the GSC HTML-tag verification meta into Preferences.
- Alternatively verify in **search.google.com/search-console** via the HTML tag, DNS TXT record, or Google Analytics method. Then submit `https://ganguram.com/sitemap.xml`.

## 9) Google Tag Manager — likely FALSE POSITIVE (VERIFY)
`GTM-WBWKK5KN` **is** installed in the theme (`layout/theme.liquid` head script + `<noscript>` iframe). Tapita's "GTM not installed" is most likely a **detection false-positive** (hardcoded container, or it loads after consent).
- **Verify** with **Google Tag Assistant** / GTM **Preview** on the live homepage — confirm the container fires once.
- Separately, a **"Google Tag Manager & GA4" app embed** is also enabled (Theme → App embeds). Confirm you don't have **two** containers double-counting — keep one source of truth (see the earlier `SHOPIFY_AI_DISCOVERY_ADMIN_CHECKLIST.md`, GA4 section).

## 10) Missing blog articles — FALSE POSITIVE
The XLSX "Missing blog articles" sheet is **header-only with zero data rows** → no actual missing articles. No action beyond the `/blogs/news` meta in item 2.

---

### Classification recap
| Bucket | Items |
|---|---|
| **THEME_CODE** (branch `seo/tapita-audit-fixes`) | Cart link crawlability (`header.liquid`), homepage H1 wording (`theme.liquid`) |
| **THEME_CODE already in `main`** (publish to take effect) | Homepage H1 (present), social/share `rel="nofollow"` (Dofollow-external fix), banner alt *enablement* |
| **SHOPIFY_ADMIN** | 1, 2, 4, 5, 6 (banners), 7 — collection/blog/product/home content, banner alt text, LinkedIn URL |
| **TAPITA_APP** | 3 (title template), possibly 4/5 if Tapita controls those metas |
| **GOOGLE_ADMIN** | 8 — Search Console |
| **FALSE_POSITIVE_OR_VERIFY** | 9 (GTM present), 10 (blog sheet empty), 6 (nolen-gur is app-rendered) |
