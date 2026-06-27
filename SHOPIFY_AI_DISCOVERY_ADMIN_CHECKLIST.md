# Ganguram Sweets — Shopify AI-Discovery Admin Checklist

**Brand:** Ganguram Sweets (ganguram.com) — heritage Kolkata Bengali mithai on Shopify
**Theme:** KrownThemes "Local" v2.3.2
**Date:** 26 June 2026
**Scope:** Admin / app / GA4 actions to maximise AI-shopping-agent and AI-referral discovery. Theme-code fixes are tracked separately; this checklist is for the **merchant working in Shopify Admin, the apps, and GA4**.

> **British English.** Every item is an actionable checkbox with the exact Admin path. Where a finding could not be confirmed against the live site it is marked **UNVERIFIED — confirm live**. (The audit could not fetch `ganguram.com` because the sandbox's **network egress allow-list** excludes the host — `Host not in allowlist: ganguram.com` — *not* Shopify/bot-protection; verify these in a browser or after allow-listing the host.)
>
> **Non-negotiable guardrails (do NOT break):** PAN-India delivery messaging must show **only** for products tagged `PAN India`; Kolkata-only products must **never** appear PAN-India deliverable. Never publish fake ratings, reviews or awards. Never fabricate GTINs, shelf life, ingredients, allergens or weights — leave a field blank rather than guess.

---

## 1) Shopify Agentic Storefront settings to verify / enable

> Context: In Spring '26 Shopify shipped the Universal Commerce Protocol (UCP), the Shopify Catalog, Universal Cart / Instant Checkout and Storefront MCP, with ChatGPT / Microsoft Copilot / Google AI Mode / Gemini integrations centralised under **Agentic Storefronts**. None of this is theme code — it is all Admin/channel configuration. The theme's only contribution is an accurate `agents.md` narrative and clean structured data (covered in groups 3 and 5).

- [ ] **Open the Agentic Storefronts settings.** Shopify Admin → **Settings → Agentic storefronts** (also surfaced under **Settings → Sales channels** / **Markets**). Confirm the feature is enabled for the store.
- [ ] **Opt the store into the Shopify Catalog** so products are surfaced to ChatGPT, Copilot, Perplexity and Google AI Mode/Gemini. Shopify Admin → **Settings → Agentic storefronts → Product discovery / Catalog** → enable. (Shopify cites structured Catalog data converting at ~2× scraped data.)
- [ ] **Confirm the UCP manifest resolves and is correct.** Visit `https://ganguram.com/.well-known/ucp` and check it reflects: currency **INR**, market **India**, and correct shipping zones. This endpoint is Shopify-generated with **no theme override** — its correctness depends on Admin config only. **UNVERIFIED — confirm live (was HTTP 403 to fetcher).**
- [ ] **Confirm the agentic discovery sitemap resolves.** Visit `https://ganguram.com/sitemap_agentic_discovery.xml` (auto-shipped May 2026, platform-generated, no theme override). **UNVERIFIED — confirm live.**
- [ ] **Enable Universal Cart / Instant Checkout** (agent-driven checkout) in the relevant sales channels. Shopify Admin → **Settings → Checkout** and **Settings → Sales channels** → confirm agentic checkout is turned on.
- [ ] **CRITICAL — protect the delivery rules in agentic checkout.** Shopify Admin → **Settings → Shipping and delivery → Shipping profiles**. Verify that Kolkata-only products are restricted to Kolkata-area / pickup zones so an AI agent **cannot** complete a PAN-India order for a Kolkata-only SKU. The agentic checkout must honour the existing PAN-India tag gating, pincode logic and ShipZip/pickup rules. **Do not weaken these to "make agents work".**
- [ ] **Confirm Online Store is the canonical sales channel** feeding the Catalog and sitemaps. Shopify Admin → **Settings → Sales channels** → ensure **Online Store** is active and products are published to it.

### Agent-discovery files (`/agents.md`, `/llms.txt`, `/llms-full.txt`)

> As of May 2026 Shopify auto-generates `/llms.txt`, `/llms-full.txt`, `/agents.md`, `/.well-known/ucp` and `/sitemap_agentic_discovery.xml` for every store. The theme currently has **no** `agents.md.liquid`, `llms.txt.liquid` or `llms-full.txt.liquid`, so Ganguram is serving Shopify's **generic defaults**. Adding a single `agents.md.liquid` is a **THEME_CODE** task (it also feeds `/llms.txt` and `/llms-full.txt` by fallback) — flagged here so the merchant knows to request it and then verify the output.

- [ ] **Request the theme team add `templates/agents.md.liquid`** (THEME_CODE) curating: brand identity (heritage Kolkata Bengali mithai, est. 1885), priority collections (rasgulla, sandesh, gift boxes, festival ranges), the **PAN-India vs Kolkata-only delivery distinction**, and contact/returns. This single file also feeds `/llms.txt` and `/llms-full.txt`.
- [ ] **After it ships, verify the rendered output.** Visit `https://ganguram.com/agents.md`, `https://ganguram.com/llms.txt` and `https://ganguram.com/llms-full.txt` and confirm they read accurately and never imply nationwide delivery of Kolkata-only items. **UNVERIFIED — confirm live.**
- [ ] **Leave `robots.txt` on Shopify default — take NO action.** The 2026 default already allows GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Googlebot, Bingbot, Applebot and Amazonbot. Do **not** add a `robots.txt.liquid` override (Shopify documents it as unsupported; a bad edit can lose all traffic; you forfeit future best-practice updates).
- [ ] **One-time check once the 403 clears:** fetch `https://ganguram.com/robots.txt` and confirm no legacy app/agency edit injected a stale "block all AI" rule that disallows GPTBot/ClaudeBot/PerplexityBot. If found, the fix is to **remove** the offending `robots.txt.liquid` (a THEME_CODE revert), not to maintain a custom file. **UNVERIFIED — confirm live.**

---

## 2) Shopify Catalog checks

> The Shopify Catalog reads **Admin product fields**, not theme code. Clean, complete, correctly-categorised product data is what surfaces Ganguram to AI shopping agents.

- [ ] **Assign the Standard Product Taxonomy category to every product.** Shopify Admin → **Products → [product] → Product organisation → Category** → choose **Food, Beverages & Tobacco → Food Items → Snack Foods** (or **Candy & Chocolate** where appropriate).
- [ ] **Set a consistent `Product type`** across the catalogue, e.g. `Bengali Sweets`. Shopify Admin → **Products → [product] → Product organisation → Product type**.
- [ ] **Populate `Barcode (GTIN)` where a genuine one exists.** Shopify Admin → **Products → [product] → Variants → [variant] → Inventory → Barcode**. **Never fabricate a GTIN** — leave blank if none exists.
- [ ] **Confirm products are published and out of hidden/draft states** so they feed the Catalog and sitemap. Shopify Admin → **Products** → filter **Status: Active** and **Sales channel: Online Store**.
- [ ] **Set net weight on each variant** (used by Catalog/Merchant feeds for food). Shopify Admin → **Products → [product] → Variants → [variant] → Shipping → Weight**.
- [ ] **Verify the standard sitemap lists products & collections.** Visit `https://ganguram.com/sitemap.xml` and confirm it links the product and collection sub-sitemaps. **UNVERIFIED — confirm live.** No theme action — sitemap is Shopify-auto-generated.
- [ ] **After any Catalog/data change, sanity-check surfacing** by searching the brand/products in ChatGPT, Perplexity and Google AI Mode and confirming accurate product, price and availability data (no Kolkata-only item shown as nationwide).

---

## 3) Product data fields to complete (exact metafield `namespace.key` + type)

> The theme already reads a strong set of food metafields, but two **overlapping key sets** split data across blocks, producing half-empty PDPs. **Standardise on ONE canonical key per concept**, migrate content off the duplicates, then ask the theme team to remove the dead second `custom_liquid` block (THEME_CODE follow-up). Create/manage metafields at: Shopify Admin → **Settings → Custom data → Metafields → Products → Add definition**.

### Canonical metafields — keep and populate on every product

- [ ] `custom.short_description` — **single_line_text** (or rich_text) — AI-friendly one-to-two-sentence plain-language summary. Migrate any `custom.intro_line` / `custom.taste_summary` content into this, then retire those.
- [ ] `custom.ingredients` — **rich_text (multi_line)** — full ingredient list in descending order of weight. Migrate `custom.key_features` into this and retire it.
- [ ] `custom.allergen_information` — **rich_text** — explicit allergen declaration (e.g. "Contains milk. May contain traces of nuts."). Migrate `custom.allergen_note` into this and retire it.
- [ ] `custom.nutrition_per_100g` — **rich_text** — nutrition table.
- [ ] `custom.calorie_advisory` — **single_line_text** — calorie note line.
- [ ] `custom.shelf_life` — **single_line_text** — e.g. "Best consumed within X days of delivery". Migrate `custom.shelf_life_storage` content here and retire it.
- [ ] `custom.storage_instructions` — **rich_text** — storage guidance (e.g. "Keep refrigerated below 5°C").
- [ ] `custom.food_type` — **single_line_text** — values **`Vegetarian`** / **`Non-Vegetarian`** only (must match the green/brown mark).
- [ ] `custom.fssai_note` — **rich_text** — FSSAI / regulatory note.

### New metafields to create (currently missing — important for Catalog & agents)

- [ ] `custom.net_weight` — **single_line_text** — e.g. "250 g". Net content; pack size currently lives only in variant option text, which is a weak signal.
- [ ] `custom.piece_count` — **number_integer** — pieces per pack, e.g. `12`.
- [ ] `custom.serves` — **single_line_text** — e.g. "Serves 4–6".

### Duplicate keys to RETIRE (migrate content first, then ask theme team to remove the dead block)

- [ ] Retire `custom.shelf_life_storage` → merged into `custom.shelf_life` + `custom.storage_instructions`.
- [ ] Retire `custom.allergen_note` → merged into `custom.allergen_information`.
- [ ] Retire `custom.key_features` → merged into `custom.ingredients`.
- [ ] Retire `custom.intro_line` → merged into `custom.short_description`.

### Image alt text (multimodal-agent comprehension)

- [ ] **Set descriptive alt text on every product image.** Shopify Admin → **Products → [product] → Media → [image] → Add alt text**, e.g. "Ganguram Sandesh box, 250 g, 12 pieces". (A theme-side fallback to product title is a separate THEME_CODE fix; admin alt text is the quality source.)

> **Guardrail for all of the above:** never invent shelf life, ingredients, allergens, weight, piece count or food type. Leave the field empty where the value is not yet verified — the theme renders nothing for blank fields.

---

## 4) Collection / page creation (the 6 target pages) — Admin Pages + Search & Discovery

> Create curated, crawler-and-agent-visible pages that an AI agent can read and recommend. Use real, brand-authored content only — **no doorway pages, no keyword stuffing, no hidden text**. Two creation surfaces are used: standard **Pages** (Shopify Admin → **Online Store → Pages → Add page**) and **Search & Discovery** for collection metafields, filters and synonyms (Shopify Admin → **Apps → Search & Discovery**).

**Page 1 — "Delivery & Serviceability" (PAN-India vs Kolkata-only)**
- [ ] Create the page. Shopify Admin → **Online Store → Pages → Add page**. State plainly which products ship PAN-India (only those tagged `PAN India`) and which are Kolkata-only / pickup, and how pincode serviceability is checked. **Never imply nationwide delivery of Kolkata-only items.**
- [ ] Set its SEO listing. On the page editor → **Search engine listing → Edit** → write a clear title + meta description.
- [ ] Link it from the footer/menu. Shopify Admin → **Online Store → Navigation**.

**Page 2 — "About Ganguram / Our Heritage" (est. 1885)**
- [ ] Create the page (Online Store → Pages → Add page) with the factual brand story — Kolkata Bengali mithai heritage, no fabricated awards.
- [ ] Fill **Search engine listing** title + meta description.

**Page 3 — "FAQ" (delivery, shelf life, veg/non-veg, gifting)**
- [ ] Create the page (Online Store → Pages → Add page). Answer the common agent questions: "Is this suitable for vegetarians?", "How long does it stay fresh?", "Can it be delivered outside Kolkata?" — answers must match `custom.food_type`, `custom.shelf_life` and the delivery tag.
- [ ] Fill **Search engine listing**.

**Page 4 — "Returns & Refunds policy"**
- [ ] Create/confirm the policy. Shopify Admin → **Settings → Policies → Refund policy** (and/or a readable Page under Online Store → Pages). Keep consistent with what `agents.md` states.
- [ ] Link it in the footer. Online Store → **Navigation**.

**Page 5 — Curated collection: "Festival & Gifting" (seasonal/festival ranges, gift boxes)**
- [ ] Create the collection. Shopify Admin → **Products → Collections → Create collection** (automated by tag, or manual). Add a real description.
- [ ] Set its SEO. Collection editor → **Search engine listing → Edit**.
- [ ] In **Apps → Search & Discovery → Filters / Metafields**, expose relevant product metafields (e.g. `custom.food_type`, `custom.net_weight`) as filters so agents and shoppers can refine.

**Page 6 — Curated collection: "Signature Bengali Sweets" (rasgulla, sandesh, rasmalai hero range)**
- [ ] Create the collection. Shopify Admin → **Products → Collections → Create collection**. Add a real, descriptive intro.
- [ ] Set its SEO listing (Collection editor → **Search engine listing → Edit**).
- [ ] **Search & Discovery synonyms** for spelling variants. Shopify Admin → **Apps → Search & Discovery → Synonyms → Add synonym group**, e.g. `rasgulla / rosogolla / roshogolla`, `sandesh / sondesh`, `rasmalai / rosomalai`, `mishti / mithai / sweets`.

**Cross-cutting Search & Discovery hygiene for all 6**
- [ ] Add **product boosts** for hero products. Shopify Admin → **Apps → Search & Discovery → Product boosts**.
- [ ] Ensure each new page/collection is in **Navigation** (Online Store → Navigation) so it is internally linked and crawlable.

---

## 5) Tapita / EComposer / PageFly / review-app + schema settings — duplicate-schema dedup

> **Decision (recommended):** make the **theme** (`microdata-schema.liquid`) the single authoritative JSON-LD source — it is version-controlled, already guards `aggregateRating` against fake/empty values, and is on by default. Then ensure no app re-emits Organization / WebSite / Product / Article schema. The two app schema files in the repo are currently **dormant** (EComposer's `ecom_google_snippet.liquid` is orphaned; Tapita's `tapita-seo-schema.liquid` emits no JSON-LD), but the apps' **runtime embeds** could still inject schema — that can only be confirmed live or in the app dashboards.

### Step A — Keep the theme as the authoritative schema source (recommended path)

- [ ] **Leave the theme microdata ON.** Shopify Admin → **Online Store → Themes → Customize → Theme settings → SEO** → confirm **Disable microdata / structured data** is **unticked** (i.e. `settings.disable_microdata = false`, which is the default).

### Step B — Pick ONE source: exact clicks for EACH option (do A **or** B, not both)

**Option A — Theme is authoritative, disable app schema (RECOMMENDED):**
- [ ] **EComposer:** Shopify Admin → **Apps → EComposer → Settings → SEO / Structured data (JSON-LD)** → **turn OFF** structured-data/schema output so it cannot duplicate the theme's Organization/WebSite/Product/Article. (Do **not** delete `ecom_google_snippet.liquid` or `ecom_header.liquid` — EComposer manages those.)
- [ ] **Tapita:** Shopify Admin → **Online Store → Themes → Customize → App embeds → Tapita SEO (tapita-seo-speed)**, and/or **Apps → Tapita SEO → Schema / Rich snippets** → **turn OFF** its JSON-LD / rich-schema (Product, Organization, Breadcrumb). You may keep Tapita's meta-title/speed features (they emit no schema). Do **not** delete `tapita-seo-schema.liquid` (it drives meta rewriting).

**Option B — App is authoritative, disable the theme microdata (only if you deliberately prefer the app):**
- [ ] Shopify Admin → **Online Store → Themes → Customize → Theme settings → SEO** → **tick Disable microdata** (`settings.disable_microdata = true`).
- [ ] Then enable structured data in **exactly one** app (EComposer **or** Tapita, not both) and disable it in the other, via the same app paths as Option A.

> **Recommended choice: Option A** (theme authoritative). Rationale: the theme schema is in version control, already guards `aggregateRating` (no fake ratings), and is on by default; the EComposer file even has an **unguarded** review-app rating branch that could emit a 0/empty rating if ever wired up — a reason not to let the app own schema.

### Step C — Review-app rating safety (never fake ratings)

- [ ] **Confirm `aggregateRating` only appears where genuine, visible reviews exist.** In your review app (Judge.me / Loox / Yotpo / etc.), confirm it only writes the review metafield when a real review count exists, and that on-page reviews are visible. Shopify Admin → **Apps → [your review app] → Settings → Rich snippets / SEO**.
- [ ] **Disable schema output in the review app if the theme already emits it** (avoid a second Product/aggregateRating node). Same app path as above.

### Step D — Meta / title / OG duplication (EComposer & Tapita)

- [ ] **EComposer alternate layout (`ecom.liquid`) rebuilds `<title>`, meta description and OG.** Shopify Admin → **Apps → EComposer → Settings → SEO/OG** → confirm only ONE meta/OG source is active per page; disable EComposer's duplicate OG/title where the theme already provides it.
- [ ] **Tapita can override `<title>`/meta/canonical/robots at runtime.** Shopify Admin → **Apps → Tapita SEO → per-page SEO** → confirm it is **not** injecting a duplicate `<title>` or a conflicting `noindex`/robots meta.

### Step E — PageFly analytics/schema awareness

- [ ] **PageFly:** confirm it is not adding a duplicate Product/Organization schema on PageFly-built pages. Shopify Admin → **Apps → PageFly → Settings**. (PageFly's GA4 is handled in group 6.)

### Step F — Validate the dedup (REQUIRED, because app embeds are UNVERIFIED from source)

- [ ] **Run Google Rich Results Test** on a live **product**, **collection** and **article** URL and confirm exactly **one** Organization, **one** WebSite, **one** Product and **one** BreadcrumbList per page, and that `aggregateRating` appears **only** where genuine visible reviews exist. (`https://search.google.com/test/rich-results`) **UNVERIFIED — confirm live.**
- [ ] **Cross-check in Search Console.** Shopify Admin is not enough here: Google Search Console → **Enhancements / Rich results** → confirm no duplicate-entity or invalid-rating errors.

---

## 6) GA4 / Shopify analytics — measure ChatGPT / Copilot / Perplexity / shop.app referrals

> **First, fix double-counting.** The theme hard-codes GTM container **GTM-WBWKK5KN** in the layout, **and** a "Google Tag Manager & GA4" app embed is enabled — two mechanisms can load GTM/GA4 and double-count.

### Step A — De-duplicate GTM/GA4 (top priority)

- [ ] **Inspect the app embed.** Shopify Admin → **Online Store → Themes → Customize → App embeds → Google Tag Manager & GA4** → note whether it injects its own GTM container and which container ID.
- [ ] **Choose ONE source of truth.** Either keep the hardcoded **GTM-WBWKK5KN** in the theme and **disable** the GTM-GA4 app embed's container injection, **or** keep the app embed and have the theme team remove the hardcoded GTM from `layout/theme.liquid` and `layout/theme.pagefly.liquid` (THEME_CODE). End with exactly **one** GTM container site-wide.
- [ ] **Verify single firing.** Use GTM Preview / Tag Assistant and GA4 → **Admin → DebugView** (and **Reports → Realtime**) to confirm the GA4 config tag fires **exactly once** per page.
- [ ] **Confirm GA4 is receiving data at all** (purchase events included): place a test order, then GA4 → **Reports → Realtime** → confirm `purchase` appears.
- [ ] **PageFly GA4:** if `shop.metafields.pagefly.measurementId` points at the **same** GA4 property as GTM, PageFly pages will double-count. Shopify Admin → **Apps → PageFly → Settings → Analytics** → either disable its analytics or point it at a separate property (its events are namespaced `send_to:'pagefly'`).

### Step B — See AI-assistant referrals in GA4 (native channel)

- [ ] **Traffic acquisition report.** GA4 → **Reports → Acquisition → Traffic acquisition** → set primary dimension to **Session default channel group** → look for the **"AI Assistant"** channel (native since 13 May 2026; auto-classifies ChatGPT, Gemini, Claude by referrer).

### Step C — Full-coverage Exploration (captures what the native channel misses)

- [ ] **Build a free-form Exploration.** GA4 → **Explore → Free form** → Dimension: **Session source** (or **Session source/medium**); Metrics: **Sessions, Engaged sessions, Conversions**. Add a filter: **Session source matches regex**:
  `chatgpt\.com|chat\.openai\.com|openai\.com|copilot\.microsoft\.com|bing\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|shop\.app`
- [ ] This isolates **shop.app** (Shopify Shop app) traffic too. Treat the totals as a **lower bound** — no-referrer AI clicks land in **Direct** (recover those with UTMs, group 7).

### Step D — Custom "AI Referral" channel group (appears in standard reports going forward)

- [ ] GA4 → **Admin → Data display → Channel groups → Create new channel group** → add a rule named **"AI Referral"** using **Source matches regex** with the same pattern as Step C. (Applies going forward / limited backfill.)

### Step E — Cross-check at the Shopify level

- [ ] Shopify Admin → **Analytics → Reports → Sessions by referrer** (or **Online store sessions by referrer**) → cross-check the same domains (chatgpt.com, perplexity.ai, copilot.microsoft.com, gemini.google.com, claude.ai, shop.app).

---

## 7) Monitor AI-referral performance over time

> Recover no-referrer AI clicks with UTMs, then track the trend on a fixed cadence.

### Step A — Adopt a UTM convention for links Ganguram publishes (only for outbound links you control)

- [ ] **Standardise UTMs** on any link you place on AI/referral surfaces (chatbot answers, social bios, partner sites, your own `agents.md` external links):
  - `utm_source` = platform host: `chatgpt` | `perplexity` | `copilot` | `gemini` | `bing` | `shop_app` | (partner host)
  - `utm_medium` = `ai_referral` (AI surfaces) | `referral` (partners) | `social`
  - `utm_campaign` = stable lowercase label, e.g. `mithai_evergreen` or `2026_rosogolla_launch`
  - `utm_content` (optional) = placement/link variant
  - Example: `https://ganguram.com/products/rosogolla?utm_source=chatgpt&utm_medium=ai_referral&utm_campaign=mithai_evergreen`
- [ ] **Keep `utm_source`/`utm_medium` values from this fixed list** (always lowercase, no spaces) so reports stay clean.
- [ ] **Never** add UTMs to internal site links, and **never** append them to canonical or sitemap URLs.

### Step B — Recurring monitoring cadence

- [ ] **Monthly:** GA4 → **Reports → Acquisition → Traffic acquisition** → check the **AI Assistant** channel and your **AI Referral** custom channel group for Sessions, Engaged sessions and Conversions trend.
- [ ] **Monthly:** GA4 → **Explore** → open the saved AI-referral Exploration (Step 6C) and review per-source breakdown (chatgpt / perplexity / copilot / gemini / claude / shop.app).
- [ ] **Monthly:** GA4 → **Reports → Acquisition → Traffic acquisition** → filter **Session medium = `ai_referral`** to see all UTM-tagged AI links in one view.
- [ ] **Monthly:** Shopify Admin → **Analytics → Reports → Sessions by referrer** → trend the AI domains and compare against GA4 (gaps indicate no-referrer/Direct leakage to fix with more UTMs).
- [ ] **Quarterly:** Re-run the **Google Rich Results Test** and check **Search Console → Enhancements** to confirm schema dedup (group 5) is still clean after any app update.
- [ ] **Quarterly:** Re-check `https://ganguram.com/agents.md`, `/llms.txt`, `/.well-known/ucp` and `/sitemap_agentic_discovery.xml` resolve and are accurate (especially the delivery distinction). **UNVERIFIED until live-fetched.**
- [ ] **On every catalogue change:** spot-check the brand and 2–3 hero products in ChatGPT, Perplexity and Google AI Mode and confirm correct price, availability and that no Kolkata-only item is shown as nationwide-deliverable.
- [ ] **Watch for new AI referrers:** when a new assistant appears in GA4 Referral/Direct, add its domain to the Step 6C regex and the Step 6D custom channel group so the trend stays complete.

---

### Fix-owner legend
- **SHOPIFY_ADMIN** — Agentic Storefronts, Catalog, metafields, pages/collections, Search & Discovery, GA4/analytics config, UTM process.
- **APP_SETTING** — EComposer, Tapita, PageFly, review-app schema/OG/analytics toggles.
- **THEME_CODE** (requested via the theme team, tracked separately) — `agents.md.liquid`, schema enrichment, GTM de-dup removal, alt-text fallback, homepage meta/OG fallbacks.

**Reminder:** every change must preserve the PAN-India tag gating, pincode logic and ShipZip/pickup/checkout rules, and must never introduce fake ratings, reviews, awards, fabricated GTINs or unverified product facts.
