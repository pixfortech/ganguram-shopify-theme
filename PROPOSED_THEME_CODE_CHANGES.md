# Proposed theme-code changes — AI discovery (FOR APPROVAL, NOT YET APPLIED)

**Status:** **Proposal only.** No Liquid/theme files have been changed in this PR — it contains **documentation only**. Per the brief, theme code is changed **only after you approve**, and only where evidence is clear. Each item below lists the **file, change, why, risk and rollback**.

**Guardrails on every item:** all changes are **additive and guarded** (`{% if … != blank %}` / tag-present). **None** touch the PAN-India tag gating, pincode logic, ShipZip/store-selector/pickup, checkout gating, product availability/inventory, or any app's settings. Nothing fabricates ratings, reviews, awards, GTINs, shelf life, ingredients, allergens or weights. Liquid edits take effect **only when the theme is published** — on a branch/preview they have zero live impact.

Recommended sequence: **A (clear bug) → B, C, E (low-risk, high-value) → D (after you confirm the live `/agents.md` default) → F (after you confirm the exact PAN-India/Kolkata tag strings).**

---

## Impact disclosure — does each change touch a protected system?

| # | Change | ShipZip | Pincode logic | PAN-India **gating** | Checkout gating | Tapita | Judge.me | Schema (JSON-LD) | Product availability |
|---|---|---|---|---|---|---|---|---|---|
| A | Article breadcrumb fix | No | No | No | No | No | No | **Yes** — fixes BreadcrumbList | No |
| B | Offer `priceValidUntil` | No | No | No | No | No | No | **Yes** — adds an Offer field | No |
| C | PDP gallery `alt` fallback | No | No | No | No | No | No | No — `img` alt, not JSON-LD | No |
| D | `templates/agents.md.liquid` | No | No | No¹ | No | No | No | No — agent text file, not JSON-LD | No |
| E | Homepage meta-description fallback | No | No | No | No | No | No | No — meta tag | No |
| F | PDP delivery-area line | No | No | No² | No | No | No | Optional³ | No |
| G | Org enrich / `additionalProperty` / og:image | No | No | No | No | No | No | **Yes** — additive, guarded | No |

¹ **D** describes the PAN-India-vs-Kolkata delivery reality in agent-facing **text**; it does **not** read or change the gating logic.
² **F** **reads/echoes** the existing `PAN India` / `Kolkata` product **tags** as a visible line; it does **not** change the gating, pincode, ShipZip or checkout logic, and **never** marks a Kolkata-only product PAN-India.
³ **F** optionally adds a tag-guarded `areaServed` to Product JSON-LD.

**Summary:** **none** of the proposed changes modify ShipZip, pincode logic, PAN-India delivery **gating**, checkout gating, Tapita app behaviour, Judge.me/review behaviour, or product availability/inventory. The only system intentionally touched is **structured data (JSON-LD)** by the schema items (A, B, G; optional F) — which is the purpose of those fixes and is fully guarded by `!= blank`.

---

## A. Fix article BreadcrumbList position-3 title bug — **risk: very low** — *recommend apply*
- **File:** `snippets/microdata-schema.liquid` (~line 162)
- **Change:** position 3 of the article breadcrumb currently uses `{{ blog.title | json }}`; change it to `{{ article.title | json }}`.
- **Why:** clear bug — the article breadcrumb repeats the blog title instead of the article title, producing incorrect structured data.
- **Risk:** very low (one value, article pages only; no UI change).
- **Rollback:** revert the single line.

## B. Add `priceValidUntil` to Product Offers — **risk: low** — *recommend apply*
- **File:** `snippets/microdata-schema.liquid` (Offer object, ~lines 11–33)
- **Change:** add `"priceValidUntil": "{{ 'now' | date: '%s' | plus: 31536000 | date: '%Y-%m-%d' }}"` (~1 year) to each Offer.
- **Why:** Google merchant-listing recommends it; reduces Search Console warnings.
- **Risk:** low (additive JSON-LD field; no price/availability logic touched). `shippingDetails`/`hasMerchantReturnPolicy` are **not** hardcoded here — they belong in Admin/Merchant Center so they stay accurate per India shipping.
- **Rollback:** revert the added field.

## C. PDP gallery image `alt` fallback — **risk: low** — *recommend apply*
- **File:** `snippets/product-media.liquid` (~lines 37, 79)
- **Change:** pass `alt: product.title` to `{% render 'lazy-image', image: media, … %}` so a blank Shopify image-alt falls back to the product name (cards already do this).
- **Why:** main PDP gallery images currently emit `alt=""` when the admin alt field is blank — weak image SEO / multimodal comprehension.
- **Risk:** low (presentational attribute only). Admin-set alt text remains the quality source and still wins.
- **Rollback:** remove the `alt:` argument.

## D. Add `templates/agents.md.liquid` (curated AI-agent narrative) — **risk: medium** — *apply after confirming the live default*
- **File (new):** `templates/agents.md.liquid` (sample in the audit, §4.5)
- **Change:** brand-authored AI-agent guide (identity, priority collections, **PAN-India-vs-Kolkata-only delivery reality**, contact/returns). Shopify uses it for `/agents.md` and, by fallback, `/llms.txt` + `/llms-full.txt`.
- **Why:** highest-value agentic-discovery win; gives AI shopping agents accurate, brand-authored facts instead of Shopify's generic default.
- **Risk:** **medium** — (1) the 2026 `agents.md.liquid` capability is **WebSearch-verified but postdates this assistant's training — confirm on shopify.dev first**; (2) a custom template **replaces** (does not merge with) Shopify's auto-generated default, so it could **drop the auto UCP/agent-discovery links** — we must view the current `/agents.md` (egress-blocked now; see audit §2A) and preserve those links; (3) text endpoints only — **zero storefront UI impact**.
- **Rollback:** delete the template file → reverts instantly to Shopify's auto-generated default.

## E. Homepage meta-description fallback — **risk: low** — *apply, or do it in Admin instead*
- **File:** `layout/theme.liquid` (~line 59)
- **Change:** `{%- assign meta_desc = page_description | default: shop.description -%}{%- if meta_desc != blank -%}<meta name="description" content="{{ meta_desc | escape }}">{%- endif -%}`.
- **Why:** the homepage emits **no** meta description when the SEO field is blank (no fallback, unlike OG).
- **Risk:** low (single tag; mirrors the existing OG fallback). **Preferred alternative is Admin** (set the homepage SEO description) — then no code change is needed.
- **Rollback:** revert to the original `{%- if page_description -%}` block.

## F. Crawler-visible, tag-driven delivery-area line on the PDP — **risk: medium** — *defer until tag strings confirmed*
- **File:** small new block/snippet rendered in `sections/main-product.liquid`
- **Change:** print a **read-only** line that merely echoes existing tags, e.g. "Delivery: Available across India" when `product.tags contains 'PAN India'`, else "Delivery: Kolkata only" when `product.tags contains 'Kolkata'`. Optionally mirror into JSON-LD `areaServed` (tag-guarded).
- **Why:** deliverability is currently only client-side JS tagging — invisible to crawlers/agents reading static HTML.
- **Risk:** **medium** — touches PDP UI and **must mirror the exact tag strings** (UNVERIFIED here) and the existing gating semantics. It is **presentation only** and **never** marks a Kolkata-only product as PAN-India — but the exact tag strings must be confirmed with you first, and it adds a visible line to every PDP (design review advisable).
- **Rollback:** remove the block (no data/logic change to revert).

## G. (Optional, lower priority)
- **Enrich theme Organization** (`microdata-schema.liquid`: add `logo`/`telephone`/`PostalAddress`/`sameAs`, guarded) — *risk low, but only worthwhile once you confirm no app embed also emits Organization (else it duplicates).* Rollback: revert.
- **Default `og:image`** — add `settings.social_share_image` (image_picker) in `config/settings_schema.json` + a fallback in `snippets/open-graph.liquid`; then upload a 1200×630 image in theme settings. *Risk low (additive setting).* Rollback: revert + remove setting.
- **Rich metafields → guarded JSON-LD `additionalProperty`** (ingredients/allergens/shelf life/storage/food type/weight) in `microdata-schema.liquid`, each `{% if … != blank %}`. *Risk low–medium; emits nothing for empty fields.* Rollback: revert.
- **Slideshow H1 governance** — set blocks to `h2`/`h3` (Admin) or add editor `info` guidance. *Risk low.*

---

## Explicitly NOT proposed (evidence says leave alone)
- **`robots.txt.liquid`** — do **not** add one. Shopify's default is already AI-open; overriding is unsupported and risky. Only *remove* a legacy AI-blocking `robots.txt.liquid` **if** one is found live (a revert-to-default, not a custom file).
- **Deleting** `ecom_google_snippet.liquid`, `ecom_header.liquid`, `tapita-seo-schema.liquid`, or `layout/ecom.liquid` — app-managed; disable behaviour via **app settings**, never delete.
- **Disabling theme microdata** in code — that is a merchant decision via the `settings.disable_microdata` theme setting, and only after live Rich Results testing proves duplication.
