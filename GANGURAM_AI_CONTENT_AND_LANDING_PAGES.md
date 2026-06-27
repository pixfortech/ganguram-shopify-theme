# Ganguram Sweets — Content & AI-Query Coverage Pack

**Brand:** Ganguram Sweets (ganguram.com) · KrownThemes "Local" v2.3.2 · Shopify
**Scope:** Audit-grade content draft for 6 target pages + content-gap list + reusable product template + fix-owner classification.
**Audit date:** 2026-06-26 · British English throughout.

---

## How to read this pack

- This is a **drafting deliverable**, not a code change. No theme files were edited.
- Slugs, H1s, meta, intros, FAQs and internal links below are written to be pasted into **Shopify Admin** (Pages / Search & Discovery / Collections), or where noted, to inform a small **THEME_CODE** change for FAQ structured data.
- **Grounded facts** drawn from the live theme (do not contradict): heritage since **1885**; flagship outlets at **Beadon Street, Alambazar, Ariadaha, and Mishti Hub (Eco Park)**; support line **+91 90730 96322 / support@ganguram.com**; WhatsApp **+91 98306 96322**; delivery is **Kolkata local (pin-code gated)** for perishables **plus PAN-India** for tagged products; reviews app is **Judge.me**; a 4-hour / Quick Commerce delivery option exists for Kolkata.
- **Confirmed existing collections** referenced in the theme (use these as internal links — do not invent handles): `/collections/sandesh`, `/collections/doi`, `/collections/gur-mishti`, `/collections/packed-mishti`, `/collections/dry-fruits-mishti`, `/collections/ghee-mishti`, `/collections/packed-snacks`, `/collections/gift-boxes`, `/collections/gift-items`, `/collections/sweets-tray`, `/collections/tattya`, `/collections/rabri`, `/collections/rosher-mishti`, `/collections/doodher-mishti`, `/collections/baked-mishti`, `/collections/4-hour-delivery`.
- **The 6 target slugs below are NEW** (they do not yet exist in the theme/menu). They must be created in Shopify Admin.

### Critical delivery-logic guardrail (carried into all copy)
PAN-India deliverability is gated by the product **tag `PAN India`** (theme: `snippets/product-item.liquid`, `layout/theme.liquid`, `sections/header.liquid`, `assets/section-header.js`). Kolkata-only perishables are pin-code gated (700xxx / 711xxx / 712xxx list in `header-group.json`). **No copy below promises PAN-India delivery for a Kolkata-only item.** Where a page mixes both, the copy explicitly distinguishes "delivered fresh across Kolkata" from "shipped across India (tinned/packed)."

### Structured-data reality check (affects every block)
- The homepage already renders a visible FAQ via the theme **`content-toggles`** section — but that section emits **NO `FAQPage` JSON-LD** (its `{% schema %}` is Shopify section config, not Schema.org). So today these FAQs are human-readable only, invisible to FAQ-rich-result/AEO parsing.
- Therefore: **`FAQPage` schema is only "applicable" where you also implement it.** For every block I mark FAQPage as *recommended but currently NOT emitted* and flag the THEME_CODE work needed. Never add FAQPage markup for FAQs that aren't actually on the page.
- `BreadcrumbList`, `WebSite`, `Organization` already emit site-wide (theme + EComposer snippets). `CollectionPage`/`ItemList` is **not** currently emitted by the theme for collections — noted per block as optional THEME_CODE.

---

# PAGE 1 — Bengali Sweets Online from Kolkata

- **Recommended page type:** **Shopify Page** (Admin > Pages). This is an editorial hub/landing page, not a product filter. Build as a Page; link out to live collections. *(SHOPIFY_ADMIN)*
- **Slug:** `/pages/bengali-sweets-online-kolkata`
- **H1:** Authentic Bengali Sweets Online, Made Fresh in Kolkata
- **Meta title:** `Bengali Sweets Online from Kolkata | Ganguram` — **51 chars** ✅
- **Meta description:** `Order authentic Bengali sweets online from Kolkata. Sandesh, rosogolla, mishti doi & gift boxes from Ganguram, sweet-makers since 1885.` — **133 chars** ✅

**Intro paragraph (British English, factual, no stuffing):**
> Ganguram has been making Bengali sweets in Kolkata since 1885, and you can now order our mishti online for doorstep delivery. From soft sandesh and syrup-soaked rosogolla to creamy mishti doi and seasonal nolen gur specialities, every sweet is prepared by our karigars using traditional Bengali recipes. Fresh sweets are delivered across Kolkata, while our tinned and packed ranges travel across India. Browse by category below, or pick a ready-made gift box for a festival, wedding or corporate occasion.

**FAQs (answer real AI buying questions):**
1. **Q: Can I order Bengali sweets online from Ganguram?**
   A: Yes. You can order online for doorstep delivery in Kolkata, and tinned or packed sweets are available for delivery across India. Fresh, perishable sweets are delivered within our Kolkata service area, which is confirmed by entering your pin code at checkout.
2. **Q: Which Bengali sweets is Ganguram best known for?**
   A: Our best-known sweets include jalbhara sandesh, rosogolla (fresh and tinned), mishti doi, kaju katli and khirer chop, alongside seasonal nolen gur sweets in winter.
3. **Q: Are the sweets made fresh?**
   A: Yes — sweets are prepared fresh using milk, khoya and traditional recipes. Fresh items are best enjoyed within a short window; please see each product page for storage guidance. [CONFIRM exact shelf life per product]
4. **Q: Do you deliver Bengali sweets outside Kolkata?**
   A: Tinned and packed sweets (such as tin rosogolla and dry-fruit sweets) can be shipped across India. Fresh, perishable items are limited to our Kolkata delivery zone.
5. **Q: Since when has Ganguram been making sweets?**
   A: Ganguram has been a Kolkata sweet-maker since 1885, with flagship outlets at Beadon Street, Alambazar, Ariadaha and Mishti Hub (Eco Park).
6. **Q: Can I order Bengali sweets for a festival or as a gift?**
   A: Yes. We offer gift boxes and hampers suited to Durga Puja, Diwali, weddings and corporate gifting — see our gift box range.

**Recommended internal links (existing handles only):**
`/collections/sandesh` · `/collections/doi` · `/collections/gur-mishti` · `/collections/packed-mishti` · `/collections/gift-boxes` · `/collections/dry-fruits-mishti` · `/collections/4-hour-delivery`

**Structured data:**
- `FAQPage` — **recommended, NOT currently emitted** (the FAQ would render via `content-toggles`, which has no JSON-LD). To earn it: add a guarded FAQPage snippet *(THEME_CODE)*.
- `BreadcrumbList`, `Organization`, `WebSite` — already emit site-wide; no action.
- Do **not** add Product schema to this hub page (no single product).

---

# PAGE 2 — Nolen Gur Sweets Online

- **Recommended page type:** **Collection** (best built in **Search & Discovery** / a collection with automated conditions). Nolen gur products already exist (jalbhara, manohara, pata, ratabi, shankh, aata sandesh variants seen in the store's product list). Build an **automated collection** with condition *Product tag contains `nolen gur`* (or `nolen-gur`) — confirm/assign that tag in Admin. *(SHOPIFY_ADMIN)*
   - Note: `gur-mishti` already exists, but it appears broader (includes patali/khejur gur products). A dedicated **nolen-gur** collection is the buyer-intent match; keep `gur-mishti` as the parent and link between them.
- **Slug:** `/collections/nolen-gur-sweets`
- **H1:** Nolen Gur Sweets, Made with Winter Date-Palm Jaggery
- **Meta title:** `Nolen Gur Sweets Online | Ganguram Kolkata` — **42 chars** ✅
- **Meta description:** `Shop nolen gur sweets from Ganguram: nolen gurer sandesh, jalbhara & more, made with winter date-palm jaggery. Fresh delivery in Kolkata.` — **135 chars** ✅

**Intro paragraph:**
> Nolen gur — the prized date-palm jaggery of a Bengali winter — gives our seasonal sweets their deep caramel aroma and unmistakable flavour. This collection brings together Ganguram's nolen gur range, including nolen gurer jalbhara sandesh, manohara, pata and shankh sandesh, made when the fresh gur is at its best. Nolen gur sweets are a winter speciality, so availability is seasonal. Fresh items are delivered within our Kolkata service area.

**FAQs:**
1. **Q: What is nolen gur?**
   A: Nolen gur is fresh liquid jaggery tapped from date palms during the Bengali winter. It has a distinctive caramel-like aroma and is used to flavour sandesh, rosogolla and other classic Bengali sweets.
2. **Q: Are nolen gur sweets available all year round?**
   A: Nolen gur is a winter ingredient, so these sweets are seasonal and availability is highest in the cooler months. [CONFIRM exact seasonal window]
3. **Q: Which nolen gur sweets does Ganguram make?**
   A: The range includes nolen gurer jalbhara sandesh, manohara, maharani, pata, ratabi, shankh and aata sandesh, among others — see the products in this collection.
4. **Q: Can nolen gur sweets be delivered outside Kolkata?**
   A: Fresh nolen gur sandesh is perishable and delivered within our Kolkata service area. For India-wide delivery, please check our tinned and packed ranges.
5. **Q: How should I store nolen gur sandesh?**
   A: Keep refrigerated and enjoy fresh. Please follow the storage note on each product page. [CONFIRM exact shelf life]
6. **Q: Is nolen gurer sandesh suitable for vegetarians?**
   A: Yes — our sandesh is vegetarian, made from chhena (milk solids) and nolen gur. [CONFIRM no gelatine/animal rennet in this line]

**Recommended internal links:**
`/collections/sandesh` (parent) · `/collections/gur-mishti` · individual products: `/products/nolen-gurer-jalbhara-sandesh-1`, `/products/nolen-gurer-manohara-sandesh-1`, `/products/nolen-gurer-pata-sandesh`, `/products/nolen-gurer-shankh-sandesh-1` (handles confirmed present in store data).

**Structured data:**
- `BreadcrumbList` — emits site-wide.
- `Product` schema — emits per product card via existing snippets (aggregateRating is GUARDED — fine).
- `CollectionPage` / `ItemList` — **not currently emitted**; optional *(THEME_CODE)*.
- `FAQPage` — only if FAQ is rendered on the collection (collections can't host the Page FAQ easily); **recommend instead a short FAQ on a linked Page** or via the FAQ-schema snippet *(THEME_CODE)*.

---

# PAGE 3 — Mishti Doi Delivery in Kolkata

- **Recommended page type:** **Shopify Page** (Admin > Pages) — a delivery-intent landing page that links to the live `doi` collection. (The `doi` collection already exists; a Page lets you carry the FAQ + delivery-zone explanation that buyers and AI assistants ask for.) *(SHOPIFY_ADMIN)*
- **Slug:** `/pages/mishti-doi-delivery-kolkata`
- **H1:** Mishti Doi Delivery in Kolkata, Fresh from Ganguram
- **Meta title:** `Mishti Doi Delivery in Kolkata | Ganguram` — **41 chars** ✅
- **Meta description:** `Order Ganguram mishti doi online for fresh delivery in Kolkata. Classic sweet curd in cups, handis & dabbas, made daily since 1885.` — **129 chars** ✅

**Intro paragraph:**
> Mishti doi — Bengal's slow-set sweet curd — is one of Ganguram's most-loved everyday sweets. We set it the traditional way, giving it its caramel colour and thick, creamy texture, and offer it in cups, handis and dabbas to suit a single serving or a family gathering. Because mishti doi is perishable, we deliver it fresh within our Kolkata service area; enter your pin code to confirm delivery to your address.

**FAQs:**
1. **Q: Can I get mishti doi delivered in Kolkata?**
   A: Yes — we deliver fresh mishti doi across our Kolkata service area. Enter your delivery pin code at checkout to confirm availability for your address.
2. **Q: How soon can mishti doi be delivered?**
   A: Same-area Kolkata delivery is available, and a faster delivery option operates during daytime hours for eligible products and areas. [CONFIRM exact delivery timelines/cut-off]
3. **Q: Do you deliver mishti doi outside Kolkata?**
   A: Mishti doi is perishable and is delivered within Kolkata only. It is not shipped across India.
4. **Q: What sizes does mishti doi come in?**
   A: It is available in single cups, traditional clay handis and larger dabbas — choose the size that suits your occasion on the product pages.
5. **Q: Is the mishti doi made fresh?**
   A: Yes, it is prepared fresh using milk and traditional setting methods. Keep refrigerated and consume fresh. [CONFIRM exact shelf life]
6. **Q: Is mishti doi vegetarian?**
   A: Yes — mishti doi is made from milk and is vegetarian.

**Recommended internal links:**
`/collections/doi` (primary) · products: `/products/mishti-doi-cup`, `/products/mishti-doi-handi`, `/products/sada-doi-cup`, `/products/mango-doi-cup` (handles confirmed present) · `/collections/4-hour-delivery` (Kolkata fast delivery) · `/pages/delivery-charges` (existing page linked in header).

**Structured data:**
- `FAQPage` — **recommended, NOT currently emitted**; needs the guarded snippet *(THEME_CODE)*.
- `BreadcrumbList`, `Organization` — emit site-wide.
- No Product schema on the Page itself (products carry their own on `/collections/doi`).

---

# PAGE 4 — Bengali Mithai Gift Boxes

- **Recommended page type:** **Collection** (built via **Search & Discovery** / automated collection). Gift-box products already exist (`gift-box-small/medium/large/extra-small/extra-large`, plus `gift-boxes` and `sweets-tray` collections). Create an automated collection on condition *Product type = Gift Box* or *tag contains `gift-box`*. *(SHOPIFY_ADMIN)*
   - Note: a `gift-boxes` collection already exists — decide whether to (a) rename/repoint it to this SEO slug, or (b) create the new slug and 301 the old one. Avoid two competing gift-box collections.
- **Slug:** `/collections/bengali-mithai-gift-boxes`
- **H1:** Bengali Mithai Gift Boxes & Sweet Hampers
- **Meta title:** `Bengali Mithai Gift Boxes | Ganguram Kolkata` — **44 chars** ✅
- **Meta description:** `Bengali mithai gift boxes & sweet hampers from Ganguram. Assorted sandesh, rosogolla & more for Durga Puja, Diwali, weddings & corporate gifts.` — **141 chars** ✅

**Intro paragraph:**
> A box of Ganguram mithai is a heartfelt way to mark any occasion. Our gift boxes bring together an assortment of Bengali sweets — sandesh, rosogolla, dry-fruit sweets and seasonal specialities — in presentation packaging suited to festivals, weddings and corporate gifting. Choose from a range of box sizes, from a small token to a generous hamper. Fresh assortments are delivered within Kolkata, while tinned and dry-fruit gift options can travel further across India.

**FAQs:**
1. **Q: What is included in a Ganguram gift box?**
   A: Gift boxes contain an assortment of Bengali sweets such as sandesh, rosogolla and dry-fruit sweets. The exact mix depends on the box size and option you choose — see each product page. [CONFIRM fixed vs customisable contents]
2. **Q: Do you offer gift boxes for Diwali and Durga Puja?**
   A: Yes — our gift boxes and hampers are well suited to Durga Puja, Diwali, weddings and other celebrations.
3. **Q: Can I order a corporate gift box / bulk gifting?**
   A: Yes, we cater to corporate and bulk gifting. For larger or customised orders, contact us on +91 90730 96322 or support@ganguram.com. [CONFIRM bulk lead time / MOQ]
4. **Q: What gift box sizes are available?**
   A: Boxes range from extra-small and small through to large and extra-large — choose the size that fits your gift list and budget.
5. **Q: Can gift boxes be delivered across India?**
   A: Gift boxes built around tinned or dry-fruit sweets can be shipped across India. Boxes containing fresh, perishable sweets are delivered within Kolkata only.
6. **Q: Can I add a personal message or custom packaging?**
   A: Customised packaging options are available for gifting occasions. [CONFIRM message-card / personalisation availability]

**Recommended internal links:**
`/collections/gift-boxes` · `/collections/sweets-tray` · `/collections/gift-items` · `/collections/dry-fruits-mishti` · `/collections/packed-mishti` · `/collections/tattya` (wedding tattya cross-link) · products: `/products/gift-box-small`, `/products/gift-box-large`, `/products/gift-box-extra-large`.

**Structured data:**
- `Product` schema per card — emits via existing snippets.
- `BreadcrumbList` — emits.
- `CollectionPage`/`ItemList` — optional *(THEME_CODE)*.
- `FAQPage` — **not currently emitted**; for the gifting FAQ above, render it on a linked Page or via the FAQ snippet *(THEME_CODE)*.

---

# PAGE 5 — Tin Rosogolla Pan India Delivery

- **Recommended page type:** **Collection** (via **Search & Discovery** / automated collection), because this is the page where PAN-India deliverability is the whole point. Build with condition: *Product tag contains `PAN India`* **AND** *tag/type contains `tin`* (or product handles like `tin-sada-rosogolla`). This guarantees only genuinely tag-gated, India-shippable tinned items appear — directly honouring the delivery guardrail. *(SHOPIFY_ADMIN)*
   - **Guardrail note:** because membership is keyed off the existing `PAN India` tag, no Kolkata-only product can leak into this collection. Do **not** hand-add fresh perishables here.
- **Slug:** `/collections/tin-sweets-pan-india`
- **H1:** Tin Rosogolla & Tinned Sweets, Delivered Across India
- **Meta title:** `Tin Rosogolla Pan India Delivery | Ganguram` — **43 chars** ✅
- **Meta description:** `Order Ganguram tin rosogolla & tinned Bengali sweets for pan-India delivery. Sealed tins that travel, made in Kolkata. Shop the range online.` — **139 chars** ✅

**Intro paragraph:**
> Some sweets are made to travel. Our tinned rosogolla and tinned Bengali sweets are sealed to stay fresh on the journey, so the taste of Kolkata can reach family and friends across India. This collection brings together our tin-packed range that ships pan-India — ideal for gifting at a distance or stocking up. Fresh, perishable sweets remain Kolkata-only; everything in this collection is selected specifically because it can be shipped nationwide.

**FAQs:**
1. **Q: Can tin rosogolla be delivered across India?**
   A: Yes. The tinned sweets in this collection are selected specifically for pan-India delivery, because the sealed tin keeps them fresh in transit.
2. **Q: How is tin rosogolla different from fresh rosogolla?**
   A: Tin rosogolla is sealed in syrup in a tin for a longer shelf life and safe shipping, whereas fresh rosogolla is made for immediate enjoyment and Kolkata delivery only.
3. **Q: How long does pan-India delivery take?**
   A: Delivery time depends on your destination. [CONFIRM exact pan-India delivery timelines/courier]
4. **Q: What is the shelf life of tinned sweets?**
   A: Tinned sweets keep considerably longer than fresh sweets; check the best-before date printed on each tin. [CONFIRM exact shelf life]
5. **Q: Are these tins good for gifting?**
   A: Yes — sealed tins travel well and make a reliable gift for relatives and friends outside Kolkata, including at festival times.
6. **Q: Which tinned sweets are available besides rosogolla?**
   A: Our packed and tinned range includes other long-keeping Bengali sweets; browse this collection and our packed-mishti range for the full selection.

**Recommended internal links:**
`/collections/packed-mishti` · `/collections/dry-fruits-mishti` · `/collections/gift-boxes` · products: `/products/rosogolla`, `/products/tin-sada-rosogolla` *(verify exact tin handle in Admin)* · cross-link to `/pages/bengali-sweets-online-kolkata`.

**Structured data:**
- `Product` schema per card with `offers` — emits via existing theme/EComposer snippets (offers + GUARDED aggregateRating). Ensure availability/price reflect the tinned variant.
- `BreadcrumbList` — emits.
- `FAQPage` — **not currently emitted**; render FAQ + snippet to earn it *(THEME_CODE)*.

---

# PAGE 6 — Wedding Tattya and Dala Sweets Kolkata

- **Recommended page type:** **Shopify Page** (Admin > Pages) as an editorial/intent landing page, linking to the existing `tattya` collection and the "sweets dala" products. Tattya/dala are tradition-specific and benefit from explanatory copy that a bare collection can't carry. *(SHOPIFY_ADMIN)*
   - The `tattya` collection already exists and `sweets-dala-*` products are confirmed in the store; keep the Page as the SEO/intent layer and the collection as the shopping layer.
- **Slug:** `/pages/wedding-tattya-dala-sweets-kolkata`
- **H1:** Wedding Tattya & Dala Sweets in Kolkata
- **Meta title:** `Wedding Tattya & Dala Sweets Kolkata | Ganguram` — **47 chars** ✅
- **Meta description:** `Bengali wedding tattya & dala sweets from Ganguram, Kolkata. Decorated sweet trays & dalas for weddings, annaprasan & ceremonies. Order online.` — **142 chars** ✅

**Intro paragraph:**
> In a Bengali wedding, the tattwa (tattya) — the exchange of beautifully arranged gifts and sweets between families — is a cherished tradition. Ganguram prepares wedding tattya and decorated sweet dalas for weddings, annaprasan and other ceremonies, with sweets arranged and presented for the occasion. Choose from a range of dala shapes and sizes, or speak to us about a customised arrangement. Tattya and dala orders are prepared fresh and delivered within our Kolkata service area; we recommend ordering ahead for ceremony dates.

**FAQs:**
1. **Q: What is a wedding tattya / dala?**
   A: Tattwa (tattya) is the traditional exchange of gifts and sweets between families in a Bengali wedding, often presented in a decorated tray or dala. Ganguram prepares both the sweets and the arranged presentation.
2. **Q: Can I order wedding tattya sweets from Ganguram in Kolkata?**
   A: Yes — we prepare wedding tattya and dala arrangements for delivery within our Kolkata service area.
3. **Q: How far in advance should I order?**
   A: We recommend ordering well ahead of your ceremony date so the arrangement can be prepared. [CONFIRM exact advance-notice / lead time]
4. **Q: What dala sizes and shapes are available?**
   A: Dalas come in several shapes and sizes — small, medium, large, oval and square arrangements are available. See the products to choose.
5. **Q: Can the tattya be customised for our ceremony?**
   A: Yes, arrangements can be tailored for weddings, annaprasan and other ceremonies. For a customised tattya, contact us on +91 90730 96322 or support@ganguram.com. [CONFIRM customisation scope]
6. **Q: Do you deliver tattya/dala outside Kolkata?**
   A: Decorated dala arrangements include fresh sweets and are delivered within Kolkata. For gifting at a distance, consider our tinned and packed gift ranges instead.

**Recommended internal links:**
`/collections/tattya` (primary) · `/collections/sweets-tray` · `/collections/gift-boxes` · products: `/products/sweets-dala-small`, `/products/sweets-dala-medium`, `/products/sweets-dala-large`, `/products/sweets-dala-oval`, `/products/sweets-dala-square`, `/products/annaprasan`, `/products/shubh-vivah` (handles confirmed present) · cross-link `/pages/bengali-sweets-online-kolkata`.

**Structured data:**
- `FAQPage` — **recommended, NOT currently emitted** *(THEME_CODE to add guarded snippet)*.
- `BreadcrumbList`, `Organization` — emit site-wide.
- No Product schema on the Page (products carry their own in `/collections/tattya`).

---

# (a) Prioritised CONTENT GAP list

**P0 — High impact, directly answers AI buying queries & fixes structured-data gap**
1. **No `FAQPage` JSON-LD anywhere.** The homepage FAQ (and any new page FAQs) render as visible text only via `content-toggles` — zero FAQ structured data is emitted. *Fix owner: THEME_CODE* (add a guarded FAQPage snippet rendered only where a real, visible FAQ exists). This single fix uplifts every page in this pack.
2. **The 6 target pages do not exist.** None of the 6 slugs are in the theme or `main-menu`. Create them. *Fix owner: SHOPIFY_ADMIN* (Pages + Search & Discovery collections).
3. **Tin / PAN-India collection missing.** There is strong PAN-India tag infrastructure but no customer-facing "ships across India" collection. Build `tin-sweets-pan-india` off the `PAN India` tag. *SHOPIFY_ADMIN.*
4. **Mishti doi delivery intent uncaptured.** High-intent query "mishti doi delivery Kolkata" has only the broad `doi` collection. Add the landing Page. *SHOPIFY_ADMIN.*

**P1 — High value, builds topical authority / AEO answers**
5. **Nolen gur has no dedicated collection.** Products exist but live diffused across `sandesh`/`gur-mishti`. Create `nolen-gur-sweets` automated collection. *SHOPIFY_ADMIN.*
6. **No "delivery & service-area" explainer that AI can cite.** Buyers/assistants repeatedly ask "do you deliver to X / outside Kolkata". A clear Page (or expanded `delivery-charges` page) stating Kolkata pin-code zone vs PAN-India tinned shipping. *SHOPIFY_ADMIN* (content) — distinct from the pin-code logic, which stays THEME_CODE/untouched.
7. **Gift-box collection duplication risk.** A `gift-boxes` collection already exists; creating `bengali-mithai-gift-boxes` needs a decide-and-301 plan to avoid two competing pages. *SHOPIFY_ADMIN.*
8. **Wedding tattya/dala intent uncaptured as an editorial page.** Tradition-specific copy that the bare `tattya` collection can't carry. *SHOPIFY_ADMIN.*

**P2 — Supporting / hygiene**
9. **Shelf-life & storage facts are missing/inconsistent** across product pages, forcing `[CONFIRM]` placeholders throughout this pack. Populate a storage/shelf-life metafield per product. *SHOPIFY_ADMIN* (metafield content) + optional *THEME_CODE* to render it.
10. **Veg / sugar-free / ingredient declarations** are not consistently surfaced (relevant to "sugar-free Bengali sweets", "vegetarian sweets from Kolkata" keywords). Add ingredient/dietary metafields and surface on PDP. *SHOPIFY_ADMIN* + *THEME_CODE* to display.
11. **No `CollectionPage`/`ItemList` JSON-LD** for collections. Optional enhancement. *THEME_CODE.*
12. **`llms.txt` / `llms-full.txt` / `agents.md` absent** (established fact). These are not theme-rendered by default on Shopify; if desired they'd be served via app/proxy or Admin — *out of pure THEME_CODE scope; classify as SHOPIFY_ADMIN/APP_SETTING* and treat as a separate workstream.

---

# (b) Reusable product-page copy template

Use per product (Admin > Products, body + metafields). Keep British English; never fabricate ratings, shelf life, or delivery times — use `[CONFIRM]` until verified.

```
H1 / Title:
  [Sweet name] – [one-line descriptor] | Ganguram
  e.g. "Nolen Gurer Jalbhara Sandesh – Liquid-Filled Winter Sandesh | Ganguram"

Meta title (<=60): [Sweet name] | Ganguram Sweets Kolkata
Meta description (<=155): [What it is] from Ganguram, made fresh in Kolkata
  since 1885. [Delivery line matching its tag]. Order online.

Intro (2-3 sentences, factual):
  - What the sweet is and what it's made of (chhena/khoya/gur/dry fruit etc.).
  - One sentence of provenance/tradition (no superlatives unless verifiable).
  - One sentence on occasion/use (festival, gifting, everyday).

Key details (bullets):
  - Main ingredients: [list]
  - Vegetarian: Yes / [CONFIRM]
  - Sugar-free: Yes / No / N/A
  - Available sizes/weights: [list]
  - Storage: [Refrigerate / ambient] — [CONFIRM shelf life]
  - Delivery: 
      • If tagged "PAN India": "Ships across India (sealed/tinned/packed)."
      • If Kolkata-only/perishable: "Fresh delivery within our Kolkata
        service area — confirm with your pin code at checkout."
      • NEVER state PAN-India for an untagged perishable.

Mini-FAQ (2-4, only if genuinely useful and rendered on the page):
  - Is it vegetarian? / How is it served? / Does it travel / ship outside
    Kolkata? / How should I store it?
  (Mark unknowns [CONFIRM]. FAQPage schema applies ONLY if these are
   actually rendered + the guarded snippet is in place — THEME_CODE.)

Internal links:
  - Parent collection (e.g. /collections/sandesh)
  - 1-2 related products
  - Relevant gifting/seasonal collection

Structured data note:
  - Product + offers + GUARDED aggregateRating already emit via theme/
    EComposer snippets. Do NOT add review/rating markup manually.
  - Ensure variant price/availability are correct so offers schema is valid.
```

---

# (c) Fix-owner classification (SHOPIFY_ADMIN vs THEME_CODE vs APP_SETTING)

| Item | Owner | Notes |
|---|---|---|
| Create Pages 1, 3, 6 (Page type) | **SHOPIFY_ADMIN** | Admin > Pages; paste H1/meta/intro/FAQ/links above |
| Create Collections 2, 4, 5 | **SHOPIFY_ADMIN** | Search & Discovery / automated collections with tag conditions |
| Set meta title / meta description per page | **SHOPIFY_ADMIN** | Admin SEO fields (or Tapita/EComposer SEO if used) |
| Assign/normalise tags: `nolen gur`, `gift-box`, ensure `PAN India` on tin items | **SHOPIFY_ADMIN** | Drives collection membership & delivery gating |
| Decide & 301 the duplicate gift-box collection | **SHOPIFY_ADMIN** | URL Redirects in Admin |
| Add storage/shelf-life, dietary (veg/sugar-free) metafield **content** | **SHOPIFY_ADMIN** | Resolves the `[CONFIRM]` placeholders |
| Internal-link blocks within page bodies | **SHOPIFY_ADMIN** | Page/collection rich-text editor |
| Add menu entries for new pages | **SHOPIFY_ADMIN** | Online Store > Navigation (`main-menu`) |
| **Guarded `FAQPage` JSON-LD snippet** (render only where visible FAQ exists) | **THEME_CODE** | New snippet; current `content-toggles` emits none |
| Render storage/dietary metafields on PDP | **THEME_CODE** | `sections/main-product.liquid` |
| Optional `CollectionPage`/`ItemList` JSON-LD | **THEME_CODE** | Enhancement only |
| SEO field population *if* done via Tapita/EComposer instead of native | **APP_SETTING** | Choose one source of truth to avoid duplicate meta |
| `llms.txt` / `llms-full.txt` / `agents.md` provisioning | **SHOPIFY_ADMIN / APP_SETTING** | Not native theme-rendered; separate workstream |
| Reviews/ratings markup | *(none — leave as-is)* | Judge.me + GUARDED aggregateRating already correct; **do not add fake/manual ratings** |

**Guardrails honoured:** no edits made (audit only); no fake ratings/reviews/awards, no hidden text, no doorway/keyword-stuffed pages; PAN-India messaging kept strictly tag-gated; Kolkata-only perishables never described as PAN-India deliverable; pin-code/ShipZip/checkout logic untouched. All unverifiable specifics (shelf life, exact delivery timelines, seasonal windows, customisation scope, bulk MOQ) are marked `[CONFIRM]` rather than fabricated.

**Key audit facts behind this pack (verified in repo):**
- Homepage FAQ renders via `sections/content-toggles.liquid`, which has **no FAQPage JSON-LD** — so FAQ structured data is currently absent sitewide.
- PAN-India deliverability is a **product tag** (`PAN India`) consumed in `snippets/product-item.liquid`, `layout/theme.liquid`, `sections/header.liquid`, `assets/section-header.js`; Kolkata pin-code allow-list lives in `sections/header-group.json`.
- Confirmed existing collection handles used for internal links are listed at the top of this pack; the 6 target slugs are **new** and must be created.