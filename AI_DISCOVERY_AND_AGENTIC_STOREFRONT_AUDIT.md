# AI Discovery & Agentic Storefront Audit — Ganguram Sweets

**Brand:** Ganguram Sweets ([ganguram.com](https://ganguram.com)) — heritage Kolkata Bengali sweets / mithai on Shopify
**Theme:** KrownThemes "Local" v2.3.2
**Audit type:** Read-only theme-source audit (no files edited)
**Audit date:** 26 June 2026
**Language:** British English

> **Live-fetch limitation (applies throughout) — and how to clear it:** All five live URLs returned **HTTP 403** in this environment. The 403 is **not** from Shopify and **not** bot-protection — it is the **Claude environment's network egress allow-list**: both the page fetcher and a browser-user-agent `curl` came back with `Host not in allowlist: ganguram.com`. So all five files are classified **LIVE_UNVERIFIED — blocked by Claude environment network egress, not proven missing or broken**. To get live verification, either **(a)** add `ganguram.com` to the environment's network egress settings and re-run this audit, or **(b)** open each URL in a browser and paste the contents back (see **§2A — manual browser checks**). Every statement about live response bodies is **UNVERIFIED** and reasoned from theme source (Glob), Shopify platform knowledge and WebSearch (June 2026).
>
> **On the 2026 Shopify platform facts:** the agentic-commerce capabilities cited below (native `/llms.txt`, `/agents.md`, `/.well-known/ucp`, `agents.md.liquid` theme override, UCP/Shopify Catalog) are **WebSearch-corroborated for June 2026** (including shopify.dev and the Shopify developer changelog) but postdate this assistant's training cut-off — **confirm against Shopify's live documentation before relying on them.** The recommendation that depends on them (`agents.md.liquid`) is a **proposal**, not an applied change.

---

## 1. Executive summary

Ganguram's theme is in **good fundamental health** for both traditional SEO and the new (2026) agentic-commerce surface, but it is **under-optimised for AI discovery** and carries a small number of duplication and data-quality risks that should be addressed before AI shopping agents (ChatGPT, Google AI Mode/Gemini, Microsoft Copilot, Perplexity, Claude) become a material referral channel.

**The single most important 2026 context:** in the first week of **May 2026** Shopify natively shipped four agent-discovery endpoints to **every** store — `/llms.txt`, `/llms-full.txt`, `/agents.md`, plus `/.well-known/ucp` (the UCP / Universal Commerce Protocol JSON manifest) and `/sitemap_agentic_discovery.xml`. The **28 May 2026** changelog then made three of those endpoints **theme-overridable** via Liquid templates (`agents.md.liquid`, `llms.txt.liquid`, `llms-full.txt.liquid`). This overturns the old advice that "Shopify has no llms.txt" and the established-facts assumption that only `robots.txt` and the auto sitemap are theme-influenceable. **Three of the five audited files are now theme-influenceable.**

**What is already right:**

- `robots.txt` is on the Shopify default and is **already AI-open** — no major AI or classic crawler is blocked. The correct action is to **leave it alone**.
- `sitemap.xml` (and the new `/sitemap_agentic_discovery.xml`) are Shopify-auto-generated and AI-discoverable. No theme action.
- The theme's own JSON-LD (`microdata-schema.liquid`) is active by default and its product `aggregateRating` is **correctly guarded** — it only emits with a real review metafield, so **there are no fake/empty ratings in the theme**.
- The other two "schema" snippets are **not actually a duplication problem in the theme**: `tapita-seo-schema.liquid` emits **no JSON-LD at all** (it only rewrites meta title/description), and `ecom_google_snippet.liquid` is **orphaned/dormant** (never rendered).
- Core technical SEO is sound: correct single canonical, no accidental `noindex` on real pages, one `H1` per standard template, correct lazy-loading with the LCP hero preloaded.
- The product-data model is **the right shape** — food-specific custom metafields (ingredients, allergens, shelf life, storage, nutrition, food type) are already in use.

**What needs attention (highest value first):**

1. **Add `templates/agents.md.liquid`** — the single highest-value, low-risk agentic-discovery win. It feeds `/agents.md`, `/llms.txt` and `/llms-full.txt` from one brand-authored file, and is the only place the theme can give AI agents an accurate narrative of the brand and — critically — the **PAN-India-vs-Kolkata-only delivery reality**. *(THEME_CODE, medium)*
2. **Confirm and configure Shopify Agentic Storefronts / Shopify Catalog / UCP in Admin** — this is where discovery and agent transactions are actually enabled; the theme cannot do it. The merchant must also ensure agent-driven checkout honours the existing PAN-India / pincode / pickup gating. *(SHOPIFY_ADMIN, high)*
3. **De-duplicate Google Tag Manager** — the theme hard-codes `GTM-WBWKK5KN` **and** a "Google Tag Manager & GA4" app embed is enabled; this likely double-loads GTM/GA4 and double-counts. Pick one source of truth. *(SHOPIFY_ADMIN / APP_SETTING, high)*
4. **Fix duplicated/inconsistent product metafield keys** (e.g. `custom.shelf_life` vs `custom.shelf_life_storage`) that split data across two PDP blocks and produce half-empty product pages. *(SHOPIFY_ADMIN, high)*
5. **Emit the rich product metafields as structured data** and add a **crawler-visible, tag-driven delivery-area line** plus a **net-weight/pack-size** metafield, so AI agents and Shopify Catalog can actually read ingredients, allergens, weight and deliverability. *(THEME_CODE + SHOPIFY_ADMIN, high)*
6. **Adopt the THEME `microdata-schema.liquid` as the single authoritative JSON-LD source**, enrich its (currently thin) Organization, add Google merchant Offer fields, and disable any duplicate schema in the EComposer and Tapita apps. *(THEME_CODE + APP_SETTING, medium)*
7. **Homepage meta/OG gaps:** no meta-description fallback and no `og:image` on the homepage; plus a UTM convention and GA4 "AI Assistant" reporting to measure AI referrals. *(THEME_CODE + SHOPIFY_ADMIN, medium)*

**Non-negotiable guardrails respected throughout this audit:** no fake ratings/reviews/awards, no hidden text, no doorway/keyword-stuffed pages, and **nothing that alters the delivery logic** (PAN-India tag gating, pincode logic, ShipZip/store-selector/pickup, checkout gating, availability/inventory). The recommended delivery-area line is **read-only** — it merely echoes existing product tags and never marks a Kolkata-only product as PAN-India deliverable.

---

## 2. Live URL audit table (HTTP 403 — UNVERIFIED live)

> All five URLs returned **HTTP 403** to our fetcher, so the **live response body is UNVERIFIED**. The "Platform-knowledge assessment" column is reasoned from theme source (Glob confirms which override templates are present), Shopify platform behaviour, and WebSearch (June 2026).

| URL | Live fetch | Theme override present? | Platform-knowledge assessment | Fix owner |
|---|---|---|---|---|
| `https://ganguram.com/robots.txt` | **403 — UNVERIFIED** | No `templates/robots.txt.liquid` (Glob confirmed) | Served from Shopify **default**. 2026 default does **not** block any major AI/classic crawler (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Googlebot, Bingbot, Applebot, Amazonbot all allowed). Default disallows limited to non-content paths (`/admin`, `/cart`, `/checkout`, `/search`, filtered `/collections/*+*`, `/policies/`, account paths) + a `Sitemap:` line. **Already AI-open — no action.** | SHOPIFY_ADMIN |
| `https://ganguram.com/agents.md` | **403 — UNVERIFIED** | No `templates/agents.md.liquid` (Glob confirmed) | **Auto-generated by Shopify (May 2026)** and serving the **generic default**, not a brand-curated narrative. This is the **primary agent-interaction document** and is theme-overridable since 28 May 2026. **Add `agents.md.liquid`.** | THEME_CODE |
| `https://ganguram.com/llms.txt` | **403 — UNVERIFIED** | No `templates/llms.txt.liquid` and no `agents.md.liquid` (Glob confirmed) | **Auto-generated (May 2026)**; by default **mirrors `/agents.md`**. Currently the generic default. Best fixed via the same `agents.md.liquid` (fallback feeds `/llms.txt`). | THEME_CODE |
| `https://ganguram.com/llms-full.txt` | **403 — UNVERIFIED** | No `templates/llms-full.txt.liquid` and no `agents.md.liquid` (Glob confirmed) | **Auto-generated (May 2026)**; by default **mirrors `/agents.md`**. Covered by the same `agents.md.liquid` override; a dedicated file is only needed for an expanded full-catalogue variant (not required now). | THEME_CODE |
| `https://ganguram.com/sitemap.xml` | **403 — UNVERIFIED** | Not theme-editable (no Liquid override exists) | **Shopify-auto-generated** from products/collections/pages/blogs and referenced by the default `robots.txt`; AI-discoverable. The new **`/sitemap_agentic_discovery.xml`** (auto-shipped May 2026) is likewise platform-generated. **No theme action.** | SHOPIFY_ADMIN |

**Additional platform endpoint (not in the five, but relevant):** `https://ganguram.com/.well-known/ucp` — the **UCP JSON manifest** that agents read first. **Shopify-generated, no theme override.** Its correctness depends on Admin / Agentic-Storefront settings (currency INR, India market, shipping zones), not theme code. **UNVERIFIED** live (403).

---

## 2A. Manual browser checks (do these to clear the LIVE_UNVERIFIED items)

Because this environment cannot reach `ganguram.com` (Claude environment egress allow-list), run these in a normal browser (logged out / incognito; if the storefront is password-protected, log in first), then paste anything back to me — or add `ganguram.com` to the egress list and I will fetch them. **A paste-ready worksheet is in `MANUAL_VERIFICATION_LIVE_URLS.md`.**

| URL to open | Confirm |
|---|---|
| `https://ganguram.com/robots.txt` | Loads as plain text (200); a `Sitemap:` line is present; **no** `Disallow: /` under `User-agent: GPTBot` / `ClaudeBot` / `PerplexityBot` / `OAI-SearchBot` / `Google-Extended` (no AI bot blocked). A stale "block all AI" section = a legacy `robots.txt.liquid` to **remove**. |
| `https://ganguram.com/agents.md` | Loads (200); read it — does it describe Ganguram accurately and the **PAN-India-vs-Kolkata-only** delivery reality? A generic Shopify default = the gap `agents.md.liquid` fixes. |
| `https://ganguram.com/llms.txt` | Loads (200); by default mirrors `/agents.md`; confirm content + that UCP/agent-discovery links are present. |
| `https://ganguram.com/llms-full.txt` | Loads (200); fuller variant; same checks. |
| `https://ganguram.com/sitemap.xml` | Loads (200); valid sitemap index listing `sitemap_products_1.xml`, `sitemap_collections_1.xml`, `sitemap_pages_1.xml`, `sitemap_blogs_1.xml`. |
| `https://ganguram.com/.well-known/ucp` | Loads (200); JSON manifest; currency **INR**, market **India**, shipping zones correct. |
| `https://ganguram.com/sitemap_agentic_discovery.xml` | Loads (200); the May-2026 agentic sitemap. |

Also **view-source** on the homepage, one product and one collection and confirm exactly **one** `<title>`, **one** `<meta name="description">`, **one** `<link rel="canonical">`, and **no** duplicate `og:image` / Product / Organization JSON-LD (this is the only way to confirm whether the Tapita / EComposer app embeds inject cross-source schema — see §5).

---

## 3. Crawler accessibility findings

### 3.1 `robots.txt` is Shopify-default and already AI-open — do NOT override — **severity: no_action** — owner: **SHOPIFY_ADMIN**

**Location:** Live `https://ganguram.com/robots.txt` (UNVERIFIED — 403). Theme: no `templates/robots.txt.liquid` present (Glob confirmed).

**Evidence:** Glob for `templates/robots.txt.liquid` returns no files, so `robots.txt` is served from Shopify's default template. Shopify's 2026 default does **not** disallow any major AI or classic crawler — GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Googlebot, Bingbot, Applebot and Amazonbot are all allowed. The goal is **more** AI discovery, which the default already permits.

**Recommendation:** Take **no action**. Do **not** add `templates/robots.txt.liquid`: Shopify documents it as an unsupported customisation (support will not assist), a faulty edit can "result in loss of all traffic", and overriding forfeits Shopify's automatic future best-practice updates. There is no AI-discovery gain because the default is already open. **One verification step once the 403 clears:** fetch `/robots.txt` and confirm no legacy app/agency edit has injected a `robots.txt.liquid` that blocks GPTBot/ClaudeBot/PerplexityBot (research notes ~90% of stores with a custom file accidentally block at least one AI bot via a stale 2023 "block all AI" snippet). If such a block is found, the fix is to **remove** the offending `robots.txt.liquid` (revert to default) — a **THEME_CODE** action — not to maintain a custom file.

### 3.2 `sitemap.xml` is Shopify-auto-generated and AI-discoverable — no theme action — **severity: no_action** — owner: **SHOPIFY_ADMIN**

**Location:** Live `https://ganguram.com/sitemap.xml` and `https://ganguram.com/sitemap_agentic_discovery.xml` (UNVERIFIED — 403). Not theme-editable.

**Evidence:** `sitemap.xml` is generated by Shopify from products/collections/pages/blogs and is referenced from the default `robots.txt`; it has no Liquid override. Separately, in May 2026 Shopify auto-shipped `/sitemap_agentic_discovery.xml` to every store as part of agentic-commerce discovery — also platform-generated, no theme override.

**Recommendation:** No theme action possible or needed. Keep store hygiene healthy (an Admin/merchandising concern): keep products/collections published and out of hidden states, and confirm Online Store is the canonical sales channel. Once the 403 clears, sanity-check that `/sitemap.xml` loads and lists the product/collection sitemaps; no fix is expected.

### 3.3 No hreflang in theme (expected — Shopify-managed) — **severity: no_action** — owner: **SHOPIFY_ADMIN**

**Evidence:** Grep across the theme found zero `hreflang` / `rel=alternate` tags. The store appears single-locale (`request.locale` logic exists only for RTL direction). Shopify auto-injects hreflang via `content_for_header` when Markets / multiple published locales exist; the theme correctly does not hand-roll it.

**Recommendation:** No action for a single-locale store. If the brand later adds languages/markets, hreflang is handled automatically by Shopify Markets (SHOPIFY_ADMIN) — do **not** add manual hreflang tags, which would conflict.

---

## 4. Shopify Agentic Storefront & Catalog readiness

This is the **highest-impact discovery surface of 2026** and is mostly an **Admin/app enablement task — not theme code**.

### 4.1 Add `templates/agents.md.liquid` — highest-value low-risk theme win — **severity: medium** — owner: **THEME_CODE**

**Location:** Live `https://ganguram.com/agents.md` (UNVERIFIED — 403). Theme override: `templates/agents.md.liquid` (absent — Glob confirmed).

**Evidence:** Shopify auto-generates `/agents.md` for every store as of May 2026, and it is the **primary agent-interaction document** (the 28 May 2026 changelog enabled theme customisation). Visiting a store's `/llms.txt` now effectively resolves to the `agents.md` content. The theme has no `agents.md.liquid`, so Ganguram serves Shopify's generic default rather than a curated brand narrative. The `agents.md.liquid` template exposes a new `agents` Liquid object with auto-populated UCP/agent-interaction metadata that can be combined with standard objects.

**Recommendation:** Add `templates/agents.md.liquid` (sample in §4.5). This is the single best low-risk agentic-discovery improvement available in the theme repo. It authors the brand story, lists priority collections (rasgulla, sandesh, gift boxes, seasonal/festival ranges), states **accurate delivery rules** (PAN-India **only** for tagged products; Kolkata-only/pickup for fresh items — never imply nationwide delivery of Kolkata-only SKUs), and provides contact/returns. Keep it factual — **no fabricated awards, ratings or claims**. Because it also feeds `/llms.txt` and `/llms-full.txt`, **one file covers all three**.

### 4.2 `/llms.txt` is auto-generated (mirrors `agents.md`) and uncustomised — **severity: medium** — owner: **THEME_CODE**

**Evidence:** As of early May 2026 Shopify auto-generates `/llms.txt` for every store, and by default it **mirrors** `/agents.md`. Glob confirms the theme has neither `llms.txt.liquid` nor `agents.md.liquid`, so Ganguram serves Shopify's generic default.

**Recommendation:** Do **not** create a standalone `llms.txt.liquid` in isolation. The single `agents.md.liquid` (§4.1) is used by Shopify for `/agents.md` **and**, by fallback, for `/llms.txt` and `/llms-full.txt`. Use a dedicated `llms.txt.liquid` only if you later want `/llms.txt` to diverge from `/agents.md` (not needed now).

### 4.3 `/llms-full.txt` is auto-generated (mirrors `agents.md`) and uncustomised — **severity: low** — owner: **THEME_CODE**

**Evidence:** Like `/llms.txt`, `/llms-full.txt` was auto-shipped to all stores in May 2026 and by default mirrors `/agents.md`. Glob confirms no `llms-full.txt.liquid` and no `agents.md.liquid`.

**Recommendation:** No separate file needed — the recommended `agents.md.liquid` automatically becomes the source for `/llms-full.txt` too. Add a dedicated `templates/llms-full.txt.liquid` only if you want an expanded, full-catalogue variant; generally unnecessary for a mid-size sweets catalogue. Lower priority than `agents.md.liquid` itself.

### 4.4 Agentic-storefront readiness (UCP, Shopify Catalog, Universal Cart, Storefront MCP) is an Admin/app task — **severity: high** — owner: **SHOPIFY_ADMIN**

**Location:** Shopify Admin — Agentic Storefronts / Markets / Sales Channels. Endpoints `/.well-known/ucp`, `/sitemap_agentic_discovery.xml` (platform-generated, no theme override).

**Evidence:** In Spring '26 (launched 17 June 2026) Shopify shipped the **Universal Commerce Protocol (UCP**, co-developed with Google), the **Shopify Catalog** (a global structured product dataset agents search — cited as converting at ~2× scraped data), public UCP-compliant **MCP servers (Storefront MCP)**, and centralised integrations with ChatGPT, Microsoft Copilot and Google AI Mode/Gemini managed from Admin via **"Agentic Storefronts."** Merchants "set up data once and have it surfaced everywhere." None of this is configured in theme Liquid — the theme only contributes the `agents.md`/`llms.txt` narrative and clean structured data; discovery and transaction enablement live in Admin/channels.

**Recommendation (Admin checklist for the merchant — no repo changes):**

1. In Shopify Admin, enable/confirm the **Agentic Storefronts** settings and opt the store into **Shopify Catalog** so products are surfaced to ChatGPT/Copilot/Perplexity/Google AI Mode.
2. Confirm the **UCP manifest** at `/.well-known/ucp` resolves and reflects correct store config (currency INR, India market, shipping zones) once the 403 clears.
3. Ensure **Universal Cart / Instant Checkout** (agent-driven checkout) is enabled in the relevant sales channels.
4. **CRITICAL guardrail:** agentic checkout must honour the existing **PAN-India tag gating, pincode logic and ShipZip/pickup rules** — verify in Admin that shipping profiles restrict Kolkata-only products so an AI agent **cannot complete a PAN-India order for a Kolkata-only SKU**.

The theme's role is limited to (a) an accurate `agents.md.liquid` and (b) clean, non-duplicated structured data — both covered elsewhere.

### 4.5 Sample `templates/agents.md.liquid` (brand-authored; factual; British English; no fake claims)

```liquid
# {{ shop.name }} — AI agent guide

> Ganguram is a heritage Bengali sweets (mithai) brand from Kolkata, India,
> established 1885. We make traditional sweets such as rasgulla, sandesh,
> rasmalai, and festival gift boxes.

## About
- Brand: {{ shop.name }}
- Site: {{ shop.url }}
- Cuisine/category: Bengali sweets & savouries, gifting
- Currency: {{ shop.currency }} (India)

## Shop these collections
{%- for collection in collections limit: 12 -%}
{%- unless collection.handle == 'frontpage' or collection.handle == 'all' -%}
- [{{ collection.title }}]({{ shop.url }}{{ collection.url }}) — {{ collection.description | strip_html | truncatewords: 20 }}
{%- endunless -%}
{%- endfor -%}

## Delivery — read carefully
- PAN-India delivery is available ONLY for products explicitly marked/tagged
  for PAN-India shipping.
- Many fresh sweets are available for Kolkata-area delivery or in-store
  pickup ONLY and are NOT shippable across India. Do not assume nationwide
  delivery; check each product's availability before recommending or
  transacting.
- Pincode/serviceability is validated at the product and cart stage.

## Help & policies
- Contact: {{ shop.email }}{% if shop.phone %} / {{ shop.phone }}{% endif %}
{%- for link in linklists['agents-md'].links -%}
- [{{ link.title }}]({{ link.url }})
{%- endfor -%}
```

**Notes:** the new `agents` object also exposes auto-populated UCP/agent-interaction metadata you can surface (see Shopify docs for the full property list). Keep the file concise; verify rendered output at `/agents.md` after publishing. Do **not** hard-code Kolkata-only products as PAN-India deliverable — mirror the tag gating already enforced in `header.liquid` / `cart-form.liquid` / `product-item.liquid`.

### 4.6 What is / is not possible from theme code in 2026

| File / endpoint | Auto-generated by Shopify? | Theme-overridable? | Override file |
|---|---|---|---|
| `/robots.txt` | Yes (default template) | Yes (not recommended) | `templates/robots.txt.liquid` |
| `/sitemap.xml` | Yes | No | — |
| `/sitemap_agentic_discovery.xml` | Yes (new, May 2026) | No | — |
| `/llms.txt` | Yes (mirrors `agents.md`) | Yes | `templates/llms.txt.liquid` OR `agents.md.liquid` (fallback) |
| `/llms-full.txt` | Yes (mirrors `agents.md`) | Yes | `templates/llms-full.txt.liquid` OR `agents.md.liquid` (fallback) |
| `/agents.md` | Yes | Yes | `templates/agents.md.liquid` |
| `/.well-known/ucp` | Yes (UCP JSON manifest) | No | — (Admin config only) |

**Fallback rule:** an `agents.md.liquid` alone controls all three of `/agents.md`, `/llms.txt`, `/llms-full.txt`. A dedicated `llms.txt.liquid` or `llms-full.txt.liquid` overrides only its own URL; the others keep mirroring `agents.md`.

**Edge worker / external hosting for `llms.txt`:** **no longer needed** on Shopify in 2026 (it was the pre-May-2026 workaround). Use the native `agents.md.liquid` template. Do **not** proxy these paths through a third-party CDN worker — it would shadow Shopify's native handling and the UCP integration.

---

## 5. Structured-data / schema findings

### 5.1 Lead finding: the "three-source duplication" is **not** a live theme problem — only ONE theme source actually emits JSON-LD

The working assumption was that three theme snippets (`microdata-schema.liquid`, `ecom_google_snippet.liquid`, `tapita-seo-schema.liquid`) duplicate Product/Organization/WebSite/Article schema. Reading the snippets and **every render point** (in `theme.liquid`, `theme.pagefly.liquid`, `ecom.liquid`, `popup.liquid`) overturns this:

| Snippet | Emits JSON-LD? | Rendered where | Live on standard pages? |
|---|---|---|---|
| **THEME `microdata-schema.liquid`** | **YES** (WebSite, Organization[thin], BreadcrumbList, Product[guarded rating], Article) | `unless settings.disable_microdata` in `theme.liquid:65-67`, `theme.pagefly.liquid:69-70`, `popup.liquid:36-38` | **YES** (default=false, not overridden) |
| **ECOMPOSER `ecom_google_snippet.liquid`** | YES *in the file* (Organization[rich], WebSite+SearchAction, Product[offers+rating], Blog, Article) | **Nowhere.** Only caller would be `ecom_header.liquid`, which is EMPTY. Grep `render 'ecom_google_snippet'` = 0 | **NO** (dormant/orphaned in theme) |
| `ecom_header.liquid` | n/a (empty comment) | `theme.liquid:30`, `theme.pagefly.liquid:34`, `ecom.liquid:93` | renders nothing |
| **TAPITA `tapita-seo-schema.liquid`** | **NO JSON-LD** (meta-title/desc JS + preload only) | `if content_for_header contains 'tapita-seo-script-tags'` in `theme.liquid:26-28`, `theme.pagefly.liquid:30-31` | runs, but emits **no schema** |
| Tapita APP EMBED (`shopify://apps/tapita-seo-speed`, `settings_data.json:337`) | UNKNOWN | injected via `content_for_header` at runtime | **UNVERIFIED** (site 403s) |
| EComposer APP runtime (`content_for_header` / Script Tag) | UNKNOWN | runtime | **UNVERIFIED** (site 403s) |

**So duplication *inside the theme* today is NIL — there is exactly one of each `@type`.** The real, verifiable duplication **risk** is **cross-source**: the theme's Organization/WebSite/Product vs whatever the **EComposer and Tapita app embeds inject at runtime** via `content_for_header`. That can only be confirmed by rendering a live page (currently 403) or by viewing the app dashboards.

**aggregateRating is GUARDED — not fake — in both the theme and the EComposer file:** the theme guards on `product.metafields.reviews.rating.value != blank` (`microdata-schema.liquid:40-48`); the EComposer **fallback** branch guards on `!= "0"`. **No fake/empty ratings are emitted.** (One caveat: the EComposer **explicit** review-app branch is unguarded — see §5.4 — but it is dormant.)

### 5.2 Safe de-duplication plan (single authoritative source)

1. **Authoritative source = THEME `microdata-schema.liquid`.** It is version-controlled, already guards `aggregateRating`, and is on by default. Keep `settings.disable_microdata = false` (Theme editor → Theme settings → SEO). Enrich Organization + add Offer merchant fields per the findings below.
2. **EComposer (APP_SETTING):** leave the dormant snippet in place; in the EComposer app, **disable** any "structured data / JSON-LD / SEO schema" feature so it never injects Organization/WebSite/Product/Article that would duplicate the theme. **Do NOT delete** `ecom_google_snippet.liquid` or `ecom_header.liquid` (EComposer manages them; deletion can break app updates / EComposer-built pages on `layout/ecom.liquid`).
3. **Tapita (APP_SETTING):** in the Tapita SEO app (embed `tapita-seo-speed`), turn **off** its JSON-LD / rich-schema feature (Product, Organization, Breadcrumb) so it does not duplicate the theme; keep Tapita's meta-title/speed features (which use `tapita-seo-schema.liquid` and emit no schema). **Do NOT delete** `tapita-seo-schema.liquid` (it drives meta rewriting).
4. **Validation (REQUIRED, because app-embed output is UNVERIFIED from source):** after changes, run the Google Rich Results Test + Search Console on a live product, collection and article URL to confirm exactly **one** Organization, **one** WebSite, **one** Product, **one** BreadcrumbList per page, and that `aggregateRating` only appears where genuine, visible reviews exist.

### 5.3 Tapita snippet emits NO JSON-LD and NO fake/empty aggregateRating — **severity: no_action** — owner: **THEME_CODE**

**Evidence:** `snippets/tapita-seo-schema.liquid` read in full (212 lines). Grep for `application/ld+json|@type|aggregateRating` = no matches. It only sets JS vars `tapita_meta_page_title` / `tapita_meta_page_description` (lines 90-93, 151-155) for meta rewriting and prints `<link rel="preload">` tags (lines 192-210). Rendered only `if content_for_header contains 'tapita-seo-script-tags'`.

**Recommendation:** No action on the theme file. There is **no** hardcoded 0 / 0.00 / ungated rating here — the original concern about Tapita emitting a fake/empty `aggregateRating` does not apply. Do **not** delete it (it drives meta rewriting). Audit Tapita's actual schema, if any, in the Tapita app dashboard. **UNVERIFIED** whether the Tapita embed emits Product/Review schema live.

### 5.4 EComposer snippet is orphaned (never rendered) and its explicit review branch is unguarded — **severity: low** — owner: **APP_SETTING**

**Evidence:** Repo-wide grep `render 'ecom_google_snippet'` = 0 hits. The only would-be caller, `snippets/ecom_header.liquid`, is an empty placeholder (a comment, no render). So the rich Organization/WebSite+SearchAction/Product/Article schema in the file is **not emitted** on standard pages. Within the file, the **fallback** `aggregateRating` branch (lines 171-238) is guarded (`!= "0"`), but the **explicit** review-app branch (lines 84-169, selected by `shop.metafields.ecomposer.app_review`) is **unguarded** and would emit whatever the metafield holds — including a 0/empty rating — *if the snippet were ever wired up*.

**Recommendation:** Treat EComposer structured data as an **APP_SETTING**. Do **not** delete the snippet. Verify in the EComposer app whether it injects structured data at runtime (UNVERIFIED). If EComposer is not your authoritative source, disable its SEO-schema feature so it cannot duplicate the theme. Currently harmless (never rendered); keep it that way.

### 5.5 Theme `microdata-schema.liquid` is the sole theme-rendered JSON-LD and is active by default — **severity: no_action** — owner: **THEME_CODE**

**Evidence:** Rendered `unless settings.disable_microdata` in `theme.liquid:65-67`, `theme.pagefly.liquid:69-70`, `popup.liquid:36-38`. `config/settings_schema.json:1031-1033` sets `disable_microdata` default=false; `settings_data.json` does not override it. Product `aggregateRating` guarded by `product.metafields.reviews.rating.value != blank` (lines 40-48).

**Recommendation:** Adopt the theme snippet as the single authoritative JSON-LD source; leave `settings.disable_microdata = false`. Ensure EComposer and Tapita do **not** also emit Organization/WebSite/Product/Article. Keep the review guard intact — never emit `aggregateRating` without a real review metafield and visible on-page reviews.

### 5.6 Product schema missing Google merchant Offer fields (priceValidUntil, shippingDetails, hasMerchantReturnPolicy) — **severity: medium** — owner: **THEME_CODE**

**Evidence:** `microdata-schema.liquid` Offer object (lines 11-33) contains only `@type/sku/gtin/availability/price/priceCurrency/url`. No `priceValidUntil`, no `shippingDetails` (OfferShippingDetails), no `hasMerchantReturnPolicy` (MerchantReturnPolicy). Google's merchant-listing docs list these as recommended/conditionally-required for rich product results.

**Recommendation:** In `microdata-schema.liquid`, add `priceValidUntil` to each Offer (e.g. `{{ 'now' | date: '%s' | plus: 31536000 | date: '%Y-%m-%d' }}` for ~1 year). Prefer fulfilling `shippingDetails` + `hasMerchantReturnPolicy` via **Shopify Admin → Settings → Shipping/Returns** + the Google & YouTube channel / Merchant Center so values stay accurate per India shipping — do **not** hardcode delivery promises in the theme, and do **not** couple this to the PAN-India tag logic. Only hardcode in JSON-LD if a single policy applies store-wide. Until then, expect "non-critical" Search Console warnings — acceptable for a non-priced-feed store.

### 5.7 BreadcrumbList is shallow + article position-3 title bug — **severity: low** — owner: **THEME_CODE**

**Evidence:** `microdata-schema.liquid:121-175`. Product breadcrumb = position 1 Home → position 2 Product (skips the collection level). Article breadcrumb (153-164) has a **bug**: position 2 and position 3 both use `blog.title` (lines 157 and 162) — position 3 should be the **article** title.

**Recommendation:** (1) Fix the article breadcrumb so position 3 uses `{{ article.title | json }}` instead of `{{ blog.title | json }}` (line 162). (2) Optionally insert a collection level into the product breadcrumb using `product.collections.first` for a Home → Collection → Product path. Keep `item` URLs absolute (already uses `shop.url`). Low priority; the position-3 title bug is the concrete fix.

### 5.8 No collection-page structured data (no CollectionPage / ItemList) — **severity: low** — owner: **THEME_CODE**

**Evidence:** `microdata-schema.liquid` only builds the main entity for `request.page_type` `'product'` and `'article'` (lines 6, 61). On collection pages it emits only WebSite + Organization + a 2-item BreadcrumbList; no CollectionPage or ItemList.

**Recommendation:** Optional enhancement: add a CollectionPage/ItemList block under `elsif request.page_type == 'collection'` listing `collection.products` as ListItem/url entries. Low priority (Google rarely shows ItemList rich results for commerce collections) and must not interfere with PAN-India gating or availability. Skip if effort-constrained.

### 5.9 Organization schema is duplicated and thin (bare name+url) — **severity: low** — owner: **THEME_CODE**

**Evidence:** `microdata-schema.liquid:112-117` emits Organization with only `name` + `url` (no logo, telephone, address, sameAs). The richer Organization (telephone, logo, full PostalAddress) lives in the orphaned `ecom_google_snippet.liquid:1-25`, which never renders. If an app embed also injects an Organization at runtime, the page would carry two Organization nodes — **UNVERIFIED** live.

**Recommendation:** Enrich the theme Organization (add `logo` via `{{ settings.logo | image_url }}`, `telephone {{ shop.phone }}`, PostalAddress from `{{ shop.address.* }}`, and `sameAs` social URLs) so the theme node is the complete authoritative one, **then** disable Organization/SEO schema in EComposer and Tapita (APP_SETTING). Do not delete any snippet.

### 5.10 Multiple JSON-LD script blocks in the theme snippet (note only) — **severity: no_action** — owner: **THEME_CODE**

**Evidence:** `microdata-schema.liquid` outputs three separate JSON-LD scripts: an array `[WebSite, Organization]` (104-119), a BreadcrumbList (121-175), and the conditional Product/Article entity (177-184). Multiple `application/ld+json` blocks on one page are valid; Google merges them.

**Recommendation:** No action. Listed only so it is not mistaken for duplication; the real concern is cross-source (theme vs app embeds).

### 5.11 Schema-by-page-type matrix (what the THEME Liquid actually emits)

App-embed columns are **UNVERIFIED** (403). "thin" = Organization with name+url only.

| Page type | WebSite | Organization | BreadcrumbList | Product | Article | Blog | Collection |
|---|---|---|---|---|---|---|---|
| index (home) | THEME | THEME[thin] | THEME (Home only) | – | – | – | – |
| product | THEME | THEME[thin] | THEME (Home+Product, no collection level) | THEME (guarded rating) | – | – | – |
| collection | THEME | THEME[thin] | THEME (Home+Collection) | – | – | – | **NONE** (no CollectionPage/ItemList) |
| blog | THEME | THEME[thin] | THEME (Home+Blog) | – | – | NONE in theme (EComposer Blog dormant) | – |
| article | THEME | THEME[thin] | THEME (Home+Blog+Article, **pos3 mislabeled as blog.title**) | – | THEME | – | – |
| page | THEME | THEME[thin] | THEME (Home+Page) | – | – | – | – |

**Non-negotiable guardrail reaffirmed:** never emit `aggregateRating`/`Review` without a real, on-page-visible review count. The theme guard and the EComposer fallback guard satisfy this; the EComposer explicit branch does not — one more reason not to wire EComposer schema into the theme.

---

## 6. Product & collection content findings

The PDP is built on KrownThemes "Local" `main-product.liquid` with a block system, and the team has already begun a strong metafield-driven product-data effort. The **building blocks are excellent** but **under-structured, inconsistently keyed, invisible to crawlers as structured data, and missing weight/pack-size and a crawler-visible delivery-area field.** No fake ratings were found.

### 6.1 Duplicate / inconsistent custom metafield keys for the same concepts — **severity: high** — owner: **SHOPIFY_ADMIN**

**Evidence:** `templates/product.json` has two `custom_liquid` blocks reading overlapping but **different** keys. Block 1 (~line 65) reads `custom.ingredients`, `custom.allergen_information`, `custom.shelf_life`, `custom.storage_instructions`, `custom.nutrition_per_100g`, `custom.calorie_advisory`, `custom.food_type`, `custom.fssai_note`. Block 2 (`custom_liquid_gCdRBq`, ~line 101) reads `custom.intro_line`, `custom.key_features`, `custom.taste_summary`, `custom.serving_suggestions`, `custom.shelf_life_storage`, `custom.allergen_note`. So shelf life can live in `custom.shelf_life` **or** `custom.shelf_life_storage`; allergens in `custom.allergen_information` **or** `custom.allergen_note`; ingredients in `custom.ingredients` **or** `custom.key_features`. Data entered against one key renders blank in the other block — producing **partial/half-empty PDPs**.

**Recommendation:** Pick **one canonical key per concept** and standardise all products on it (recommended set in §6.8). Migrate content from the duplicates (`custom.shelf_life_storage`, `custom.allergen_note`, `custom.key_features`) into the canonical keys, then remove the now-dead second `custom_liquid` block (a **THEME_CODE** follow-up). Do **not** keep both — overlapping keys guarantee inconsistent PDPs. *(Confirm in admin which keys are actually populated on live products before deleting the second block — **UNVERIFIED**.)*

### 6.2 Rich product metafields are never emitted as structured data for AI agents / Catalog — **severity: high** — owner: **THEME_CODE**

**Evidence:** Grep of `product.metafields` across schema snippets shows `microdata-schema.liquid` and `ecom_google_snippet.liquid` only read **review** metafields; `tapita-seo-schema.liquid` only builds meta title/description. The custom food fields (ingredients, allergens, shelf life, storage, nutrition, food_type) render **only** as visible HTML in the accordion — in **no** Product JSON-LD. AI agents and Merchant Center therefore receive no structured ingredients/allergen/shelf-life/weight signal.

**Recommendation (safe, no invented data):** extend the Product JSON-LD in `microdata-schema.liquid` (or a small dedicated snippet) to emit `additionalProperty` `PropertyValue` entries **only when the metafield is present** — map `custom.shelf_life`, `custom.storage_instructions`, `custom.food_type`, `custom.ingredients` (as description/additionalProperty), and net weight (§6.3) into schema.org Product fields/additionalProperty. Guard every field with `{% if product.metafields.custom.X != blank %}` so nothing is fabricated. Keep it behind the existing `settings.disable_microdata` gate to avoid double-emit conflicts.

### 6.3 No net-weight / pack-size / piece-count metafield — **severity: high** — owner: **SHOPIFY_ADMIN**

**Evidence:** No grep hit for a weight/pack-size/piece-count product metafield anywhere in the theme; pack size appears only inside variant option values (e.g. "250g") and free-text descriptions. `main-product.liquid` surfaces variant titles but no structured grammage. Catalog/Merchant feeds and AI agents weight net-content (g/kg) and unit count heavily for food.

**Recommendation:** Add product (or variant) metafields: `custom.net_weight` (single_line_text, e.g. "250 g") or use Shopify's standard variant **Weight** plus a display metafield; `custom.piece_count` (number_integer, e.g. 12); `custom.serves` (single_line_text, e.g. "Serves 4-6"). Surface via THEME_CODE in the accordion and JSON-LD `additionalProperty`. Where genuine data is unknown, leave the metafield **empty — never guess grammage**.

### 6.4 Delivery area (PAN India vs Kolkata-only) is only client-side JS tagging — invisible to crawlers/agents — **severity: high** — owner: **THEME_CODE**

**Evidence:** Delivery gating is driven by runtime JS: `sections/header.liquid` pincode logic pushes tags `Kolkata` / `Quick Commerce` / `PAN India` based on the entered pincode (~lines 381-392) and toggles `.delivery-logo`; `snippets/product-item.liquid` adds `pan_code`/`Kolkata`/`no_tag` CSS classes from `product.tags`. The PDP has **no static, crawler-visible statement** of whether a product is PAN-India deliverable or Kolkata-only. An AI agent reading the rendered HTML cannot determine deliverability. **(Do NOT change the gating logic itself.)**

**Recommendation:** Add a **read-only, tag-driven, crawler-visible** line on the PDP that **mirrors existing tags without altering gating** — a small THEME_CODE block that prints e.g. "Delivery: Available across India" when `product.tags contains 'PAN India'`, else "Delivery: Kolkata only" when `product.tags contains 'Kolkata'`. This is purely presentational and echoes the existing source-of-truth tags, **preserves the rule that PAN-India messaging shows only for PAN-India-tagged products**, and never marks a Kolkata-only product as PAN-India. Optionally mirror the same string into JSON-LD as `areaServed`/`additionalProperty` (guarded by the tag). **Verify the exact tag strings with the merchant before shipping.**

### 6.5 PDP gallery images have no alt-text fallback — **severity: medium** — owner: **THEME_CODE**

**Evidence:** `snippets/product-media.liquid` renders gallery images via `{% render 'lazy-image', image: media, ... %}` with **no** `alt:` argument (~lines 37, 79). `lazy-image.liquid` falls back to `image.alt` only and emits `alt=""` when the Shopify image alt field is blank. By contrast `snippets/product-item.liquid` passes `alt: product.title` for cards. So main PDP gallery images are likely missing meaningful alt text — weakening image SEO and multimodal-agent comprehension.

**Recommendation:** (THEME_CODE) pass a fallback in `product-media.liquid`, e.g. `render 'lazy-image', image: media, alt: product.title ...` so a blank image alt falls back to the product name; (SHOPIFY_ADMIN, preferred for quality) set descriptive alt text on each product image in admin (e.g. "Ganguram Sandesh box, 250 g, 12 pieces"). The theme fallback ensures no empty alt even before admin alt text is filled in.

### 6.6 `custom.short_description` overlaps other "summary" fields — **severity: low** — owner: **SHOPIFY_ADMIN**

**Evidence:** `main-product.liquid` description block (lines 333-337) renders `product.metafields.custom.short_description` above `product.description`. This is a good AI-friendly summary field, but it overlaps `custom.intro_line` and `custom.taste_summary` from the second block — duplicate "summary"/"intro" concepts again.

**Recommendation:** Consolidate to **one** short-summary key (keep `custom.short_description`) and populate it on every product with a one-to-two-sentence plain-language summary (ideal for AI snippet extraction). Migrate any `custom.intro_line` content into it and retire the duplicate. Do not invent copy — leave blank where no approved summary exists yet.

### 6.7 Standard Shopify product taxonomy / category & GTIN not leveraged for Catalog — **severity: medium** — owner: **SHOPIFY_ADMIN**

**Evidence:** `product-item.liquid` and `main-product.liquid` surface vendor, title, price, SKU and barcode (`sku_barcode` block) but there is no evidence of Standard Product Taxonomy category assignment or structured `product_type` usage feeding Catalog; the `sku_barcode` block shows barcode only if `current_variant.barcode` is set. AI shopping / Shopify Catalog rely heavily on the standard Category taxonomy and GTIN/barcode.

**Recommendation:** In admin, assign each product the Standard Product Taxonomy category (Food, Beverages & Tobacco → Food Items → Snack Foods / Candy & Chocolate as appropriate), set a consistent `product_type` (e.g. "Bengali Sweets"), and populate barcode/GTIN where a **real** one exists (leave blank otherwise — **do not fabricate GTINs**). Pure SHOPIFY_ADMIN data entry; Catalog reads admin fields, so no theme change is needed.

### 6.8 Recommended canonical metafield set (SHOPIFY_ADMIN)

Standardise on one key per concept and retire the duplicates (migrate, then delete the second `custom_liquid` block as a THEME_CODE follow-up):

| namespace.key | type | purpose | currently duplicated by |
|---|---|---|---|
| `custom.short_description` | single_line_text (or rich_text) | AI-friendly one-line summary | `custom.intro_line`, `custom.taste_summary` (partial) |
| `custom.ingredients` | rich_text | full ingredient list | `custom.key_features` |
| `custom.allergen_information` | rich_text | allergens declaration | `custom.allergen_note` |
| `custom.nutrition_per_100g` | rich_text | nutrition table | — |
| `custom.calorie_advisory` | single_line_text | calorie note line | — |
| `custom.shelf_life` | single_line_text | "Best within X days" | `custom.shelf_life_storage` |
| `custom.storage_instructions` | rich_text | storage guidance | `custom.shelf_life_storage` (combined) |
| `custom.food_type` | single_line_text ('Vegetarian'/'Non-Vegetarian') | veg/non-veg mark | — |
| `custom.fssai_note` | rich_text | FSSAI/regulatory note | — |
| `custom.net_weight` | single_line_text (e.g. "250 g") | **NEW** — net content | (none — missing) |
| `custom.piece_count` | number_integer | **NEW** — pieces per pack | (none — missing) |
| `custom.serves` | single_line_text (e.g. "Serves 4-6") | **NEW** — serving guidance | (none — missing) |

### 6.9 Reusable British-English product description template

Use this structure for each product's long `description` (or split across the canonical metafields). Placeholders in `[[ ]]` must be filled from **verified** brand data — **never fabricate** shelf life, ingredients, allergens, weight or food type. Leave a line out entirely if the fact is not yet verified.

```
[[Product Name]] ([[pack size compact, e.g. 250g]])

What it is
[[One to two plain-English sentences: what the sweet is and its Bengali/Kolkata heritage.]]

Taste & texture
[[Short sensory description.]]

Ingredients
[[Full ingredient list, in descending order of weight. Copy from the verified label.]]

Allergen information
[[State allergens explicitly, e.g. "Contains milk. May contain traces of nuts." If unknown, leave blank.]]

Net weight / pack
[[e.g. "250 g · approx. 12 pieces" — only if verified.]]

Food type
[[Vegetarian / Non-Vegetarian — must match custom.food_type and the green/brown mark.]]

Shelf life
[[e.g. "Best consumed within [[X]] days of delivery." — verified value only.]]

Storage
[[e.g. "Keep refrigerated below 5°C. Bring to room temperature before serving." — verified value only.]]

Delivery area
[[Mirror the product's tag — write "Available across India" ONLY if tagged PAN India; otherwise "Kolkata only".]]

Best for / gifting
[[e.g. "Ideal for Durga Puja, Diwali, weddings and gifting." No invented awards.]]

FAQ
Q: Is this suitable for vegetarians? A: [[Yes/No per custom.food_type — verified only.]]
Q: How long does it stay fresh? A: [[Per verified shelf life.]]
Q: Can it be delivered outside Kolkata? A: [[Per delivery tag — PAN India vs Kolkata only.]]
```

---

## 7. Technical SEO findings

The theme's core technical-SEO plumbing is **largely sound**. Confirmed in source: a single correct canonical (`theme.liquid:70`, uses `canonical_url`); the only `noindex` is correctly gated to the `/apps/pagefly` proxy path (`pagefly-app-header.liquid:5`); exactly one `H1` per standard template (the visual `h2` class is styling only); correct lazy-loading with the LCP hero preloaded; a solid image-alt fallback chain in `lazy-image.liquid` and `product.title` on cards; crawlable pagination; and strong homepage internal linking to key collections/products. The remaining gaps cluster on the **homepage** and in a **second, parallel meta/OG code path**.

### 7.1 Homepage has no H1 in current saved state — **PENDING MERGE via PR #98** — **severity: no_action** — owner: **THEME_CODE**

**Evidence:** The active homepage slideshow block (`templates/index.json`, block `image_9Lyj6G`) has empty `title`/`caption`, so no heading renders; even when a title is set, the block emits `<{{ block.settings.seo_h_tag }}>` defaulting to `h3` (`sections/slideshow.liquid:96,110`). No other homepage section renders an H1. Net: the homepage currently has **zero H1**.

**Recommendation:** Do **not** re-fix here — PR #98 already adds a homepage H1 and is pending merge. **Action: merge PR #98.** After merge, confirm the homepage renders exactly one H1 (and that it did not create a second H1 alongside any slideshow heading set to `h1`).

### 7.2 Homepage hero image has empty alt — **PENDING MERGE via PR #98** — **severity: no_action** — owner: **THEME_CODE**

**Evidence:** `slideshow.liquid:153,159` passes `alt: block.settings.title` for mobile and desktop hero images; the active banner block has `title: ""`, so the LCP hero renders `alt=""`.

**Recommendation:** Covered by PR #98 (pending merge) — do not re-report as open. After merge, verify the homepage hero `<img>` has a descriptive, brand-relevant alt (e.g. "Ganguram Sweets assorted Bengali mithai").

### 7.3 Homepage emits NO meta description (no fallback when page_description is blank) — **severity: medium** — owner: **THEME_CODE**

**Evidence:** `layout/theme.liquid:59-61` — `{%- if page_description -%}<meta name="description" ...>{%- endif -%}`. On the index template `page_description` is the homepage SEO description; if the merchant has not filled it, **no meta description tag is emitted at all** (no `| default: shop.description` fallback, unlike the OG description on `open-graph.liquid:5`, which does fall back to `shop.description` then `shop.name`).

**Recommendation — two safe options:**

- **Preferred (no code, no risk — SHOPIFY_ADMIN):** set the homepage SEO meta description in Online Store → Preferences (or the homepage's Search-engine listing), which populates `page_description`.
- **THEME_CODE option (guaranteed fallback):** change line 59 to `{%- assign meta_desc = page_description | default: shop.description -%}{%- if meta_desc != blank -%}<meta name="description" content="{{ meta_desc | escape }}">{%- endif -%}`. Keep it a single tag to avoid duplication with the EComposer layout.

### 7.4 Homepage emits NO og:image / twitter image (no default social-share image) — **severity: medium** — owner: **THEME_CODE**

**Evidence:** `snippets/open-graph.liquid:22-27` only renders `og:image` `{%- if page_image -%}`. `page_image` is blank on index (Shopify only sets it for resources with an image), and there is no theme setting for a default social image. So shares of the homepage URL — the most-shared URL for a brand — carry no image card; the Twitter card is `summary_large_image` (line 37) but has no image.

**Recommendation:** (THEME_CODE) add a theme `image_picker` setting (e.g. `settings.social_share_image`) and in `open-graph.liquid` use it as a fallback: `{%- assign og_img = page_image | default: settings.social_share_image -%}{%- if og_img -%}<meta property="og:image" content="https:{{ og_img | image_url }}"> ...{%- endif -%}`. Then (SHOPIFY_ADMIN) upload a branded 1200×630 image in theme settings. Low risk; additive only.

### 7.5 EComposer alternate layout duplicates title / meta description / OG construction — **severity: low** — owner: **APP_SETTING**

**Evidence:** `layout/ecom.liquid:34-88` independently rebuilds `<title>` (line 34), the meta description (36-38), and a full OG/og:image block (40-88) for EComposer-built pages. Its logic differs from the theme's: it sets collection `og:type` to `product.group` (line 66) where the theme sets `website`/`product`; it loops up to 3 product images for `og:image` (51-52). Any page rendered through this layout gets a **second, subtly different** title/meta/OG implementation the theme cannot keep in sync — a maintenance/consistency hazard and a risk of duplicate `og:*` tags where both paths run.

**Recommendation:** APP_SETTING (EComposer) — this layout is owned by the app; not safely theme-editable. In EComposer app settings, confirm only **one** meta/OG source is active per page and disable EComposer's duplicate SEO/OG output where the theme already provides it; or standardise on EComposer for EComposer pages and ensure the theme head does not also emit OG for those URLs. Verify the rendered `<head>` on a representative EComposer page. **Do not delete** `layout/ecom.liquid` (would break EComposer pages).

### 7.6 Slideshow heading-tag control is editor-driven and defaults to h3 — H1 governance footgun — **severity: low** — owner: **THEME_CODE**

**Evidence:** Each slideshow image block exposes a `seo_h_tag` select (h1/h2/h3…) used directly as the heading element (`slideshow.liquid:96,110,542-554`); on the homepage the active blocks are set to `h3`. Because the level is fully merchant-controlled per block with no guardrail, an editor can leave the homepage with no H1, or set multiple blocks to `h1` (multiple H1s). This is the structural reason the homepage H1 was missing.

**Recommendation:** THEME_CODE (low-risk hardening, separate from PR #98): constrain the primary banner to a single H1 by convention/documentation, or add schema `info` text warning editors to use exactly one H1 per page. Simplest non-code mitigation (SHOPIFY_ADMIN): once PR #98 lands an explicit homepage H1, set all slideshow blocks' `seo_h_tag` to `h2`/`h3` so they never compete for H1.

### 7.7 Meta title & description can be overridden at runtime by Tapita — **UNVERIFIED** — **severity: low** — owner: **APP_SETTING**

**Evidence:** Tapita SEO is wired into the head (`theme.liquid:26-28` schema include; the app also injects via `content_for_header` at line 84). Tapita commonly rewrites title/meta description/canonical/robots. The theme emits its own `<title>` (line 57) and description (line 60) **before** `content_for_header` (line 84), so a Tapita-injected tag could append a **second** title/description or override values. Because all live URLs returned 403, the rendered `<head>` could not be inspected. **UNVERIFIED.**

**Recommendation:** APP_SETTING (Tapita) — audit per-page title/description/robots overrides in the Tapita app and confirm it is not injecting a duplicate `<title>` or conflicting robots meta. Then verify live: view-source on homepage, a collection and a product, and confirm exactly one `<title>`, one meta description, one canonical, and no app-injected `noindex`. Do not change theme code for this.

---

## 8. Analytics / tracking findings

### 8.1 Hardcoded `GTM-WBWKK5KN` in layout PLUS a GTM-GA4 app embed both enabled — likely duplicate GTM/GA4 loading and double-counting — **severity: high** — owner: **SHOPIFY_ADMIN**

**Evidence:** GTM container hardcoded in `layout/theme.liquid` head (lines 11-24) and noscript (139-144), and again in `layout/theme.pagefly.liquid` (15-28): `gtm.js?id=` with `i='GTM-WBWKK5KN'`. **Separately**, `config/settings_data.json:343-350` enables an app embed `shopify://apps/google-tag-manager-ga4/blocks/gtm-embed/...` with `disabled:false` (plus a consent-embed at 351-376). **Two independent mechanisms can load GTM/GA4.** WebSearch confirms the classic Shopify double-tracking pattern: a hardcoded `gtm.js` snippet running alongside an app/GTM-managed GA4 tag fires duplicate pageviews; the recommended fix is to keep **one** source.

**Recommendation:** Confirm in Admin → Online Store → Themes → Customize → App embeds whether the "Google Tag Manager & GA4" embed injects its own GTM container, and check that container's ID. Decide on a **single source of truth**: either (preferred) keep the hardcoded `GTM-WBWKK5KN` and **disable** the app embed's container injection, or vice versa. Then use GA4 DebugView/Realtime + GTM Preview (Tag Assistant) to verify each page fires the GA4 config tag **exactly once**. **Do not delete the hardcoded snippet blindly** until you confirm which container feeds GA4. This is the **top analytics priority**.

### 8.2 Hardcoded GTM is hand-injected with no setting and no comment — fragile — **severity: low** — owner: **THEME_CODE**

**Evidence:** `layout/theme.liquid:11-24` and `139-144` contain a raw GTM snippet not driven by any theme setting; grep for `gtm_id`/`google_tag`/`analytics_id`/`measurement_id` in `settings_schema.json` returns nothing. The same raw snippet is duplicated into `layout/theme.pagefly.liquid:15-28`, so a future edit to one layout can leave the other out of sync.

**Recommendation:** Only if you decide GTM should be theme-managed: keep the snippet but (1) keep both layout files in sync, and (2) disable the GTM-GA4 app embed so there is one container. If instead the app embed is canonical, **remove** the hardcoded `GTM-WBWKK5KN` block from both layout files. Either way, end with exactly **one** GTM container site-wide.

### 8.3 PageFly injects its own gtag/GA4 on PageFly pages — correctly gated, but a third potential GA4 source — **severity: low** — owner: **APP_SETTING**

**Evidence:** `snippets/pagefly-main-js.liquid` (rendered by `pagefly-app-header.liquid:61` and `sections/pagefly-section.liquid:4`) loads `gtag/js?id={{ shop.metafields.pagefly.measurementId }}` and calls `gtag('config', ...)` — but **only** inside `{% if shop.metafields.pagefly.acceptTracking and shop.metafields.pagefly.measurementId %}`, using a separate gtag group `'pagefly'` with `send_to:'pagefly'`. A distinct, app-owned GA4 property.

**Recommendation:** No theme change. Be aware that if PageFly's `measurementId` points at the **same** GA4 property as the GTM setup, PageFly pages could double-count. In PageFly settings, leave its analytics off or point it at a separate property. Note `snippets/pagefly-settings.liquid` is an orphan duplicate that is never rendered (harmless dead code).

### 8.4 No conflicting hardcoded GA4, Meta Pixel or other pixels; checkout tracking is not broken by the theme — **severity: no_action** — owner: **THEME_CODE**

**Evidence:** Grep for `gtag`/`google-analytics`/`fbq`/`pixel`/web pixel finds only the GTM snippets (layout), the gated PageFly gtag (snippet), and Facebook entries that are merely social-share links/locale strings — **not** a Meta Pixel. EComposer's `ecom_header.liquid` contains no tracking. `component-modal.js:34-42` uses the legitimate `Shopify.customerPrivacy` consent API, not a tracker. No hardcoded GA4 `G-XXXX` and no second GTM container. Shopify checkout is sandboxed: the theme cannot and does not add checkout scripts, so nothing here breaks checkout/purchase tracking.

**Recommendation:** No theme action. Purchase/checkout conversion tracking must be done via GA4's GTM tag through Shopify's GA4 integration or a Shopify **Web Pixel (Customer Events)**, configured in admin — never via theme code. Confirm purchase events appear in GA4 Realtime after a test order.

### 8.5 AI-referral measurement: use GA4's native "AI Assistant" channel + a referral exploration (no theme change) — **severity: medium** — owner: **SHOPIFY_ADMIN**

**Evidence:** As of 13 May 2026 GA4 added a native "AI Assistant" entry to the Default Channel Group that auto-classifies traffic from ChatGPT, Gemini and Claude by referrer; Google's Aug-2025 guidance also named Microsoft Copilot and Perplexity. Traffic from these referrers is otherwise split between "Referral" and "Direct" (no-referrer cases — in-app browsers, copy-paste — land in Direct). Nothing in the theme affects this — pure GA4/Shopify reporting.

**Recommendation (in GA4):**

1. **Reports → Acquisition → Traffic acquisition**, set the primary dimension to "Session default channel group" and look for the **"AI Assistant"** channel.
2. Build a free-form **Exploration**: dimension "Session source" (or "Session source/medium"), metrics Sessions + Engaged sessions + Conversions, filtered to **Session source matches regex** (§8.7) to capture referrals the native channel may miss and isolate `shop.app` traffic.
3. Optionally create a **custom channel group** (Admin → Data display → Channel groups → Create) with an "AI Referral" rule using the same regex on Source (applies going forward / limited backfill).
4. In **Shopify Admin → Analytics → Reports**, use the Sessions-by-referrer report to cross-check the same domains at the Shopify level.

Because no-referrer AI clicks fall into Direct, treat these numbers as a **lower bound**; tag your own links with UTMs (§8.6) to recover them.

### 8.6 Adopt a UTM convention so future AI/referral links are measured exactly — **severity: medium** — owner: **SHOPIFY_ADMIN**

**Evidence:** AI assistants and in-app browsers frequently strip the referrer, sending clicks to GA4 "Direct" where they cannot be attributed. The only reliable fix for links you control (in `llms.txt`/`agents.md`, brand answers, chatbots, social bios) is explicit **UTM tagging**, which GA4 reads as Session source/medium/campaign regardless of referrer.

**Recommendation — standardise UTMs for any link Ganguram publishes on AI/referral surfaces:**

- `utm_source` = platform host: `chatgpt | perplexity | copilot | gemini | bing | shop_app | (partner host)`
- `utm_medium` = `ai_referral` (AI surfaces) | `referral` (partners) | `social`
- `utm_campaign` = a stable, lowercase label, e.g. `mithai_evergreen` or `2026_rosogolla_launch`
- `utm_content` (optional) = placement/link variant

Example: `https://ganguram.com/collections/sweets?utm_source=perplexity&utm_medium=ai_referral&utm_campaign=mithai_evergreen`

Keep values from a fixed list, always lowercase, no spaces. Then segment all AI traffic by `utm_medium=ai_referral`. **Do NOT** add UTMs to internal site links and **do NOT** append them to canonical/sitemap URLs — UTMs are only for outbound links you place on third-party/AI surfaces.

### 8.7 GA4 regex for an "AI Referral" custom channel / exploration filter (Session source)

```
chatgpt\.com|chat\.openai\.com|openai\.com|copilot\.microsoft\.com|bing\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|shop\.app
```

### 8.8 Where tracking lives (theme map)

| Mechanism | File / location | Gated? | Notes |
|---|---|---|---|
| GTM container `GTM-WBWKK5KN` (head + noscript) | `layout/theme.liquid` 11-24, 139-144 | No (hardcoded) | Hand-injected, no theme setting |
| GTM container `GTM-WBWKK5KN` (PageFly layout) | `layout/theme.pagefly.liquid` 15-28 | No (hardcoded) | Duplicate for PageFly pages |
| Google Tag Manager & GA4 app embed (gtm-embed) | `config/settings_data.json` 343-350 | `disabled:false` | APP — may load a 2nd container; verify in admin |
| GTM-GA4 app consent banner (consent-embed) | `config/settings_data.json` 351-376 | `disabled:false` | Consent Mode banner from same app |
| PageFly gtag/GA4 | `snippets/pagefly-main-js.liquid` (via `pagefly-app-header` line 61; `sections/pagefly-section.liquid` line 4) | YES: `acceptTracking` + `measurementId` | Separate property, `send_to:'pagefly'`, PageFly pages only |
| PageFly gtag (orphan) | `snippets/pagefly-settings.liquid` | n/a | Never rendered — dead code |
| EComposer header | `snippets/ecom_header.liquid` | n/a | Empty — no tracking |
| Consent API usage | `assets/component-modal.js` 34-42 | n/a | Legit `Shopify.customerPrivacy`, not a tracker |
| Meta Pixel / fbq / TikTok | (none) | — | Facebook hits are share links + locale strings only |

---

## 9. Prioritised action plan

Severity labels: **critical / high / medium / low**. Effort: **S** (≤1 hr), **M** (a few hrs), **L** (a day+ incl. data entry/migration).

| # | Item | Severity | Fix owner | Effort |
|---|---|---|---|---|
| 1 | Confirm/enable Shopify **Agentic Storefronts + Catalog + UCP + Universal Cart**; verify agent checkout honours PAN-India/pincode/pickup gating | high | SHOPIFY_ADMIN | M |
| 2 | **De-duplicate GTM** — pick one source of truth (hardcoded `GTM-WBWKK5KN` vs GTM-GA4 app embed); verify single GA4 fire | high | SHOPIFY_ADMIN / APP_SETTING | M |
| 3 | Fix **duplicate/inconsistent product metafield keys**; migrate to canonical set; retire duplicate `custom_liquid` block | high | SHOPIFY_ADMIN (+THEME_CODE follow-up) | L |
| 4 | Add **net-weight / piece-count / serves** metafields and populate | high | SHOPIFY_ADMIN | L |
| 5 | Add a **crawler-visible, tag-driven delivery-area line** on the PDP (read-only; mirrors tags; does not touch gating) | high | THEME_CODE | S |
| 6 | **Emit rich product metafields as guarded JSON-LD `additionalProperty`** (ingredients, allergens, shelf life, storage, food type, weight) | high | THEME_CODE | M |
| 7 | **Add `templates/agents.md.liquid`** (feeds `/agents.md`, `/llms.txt`, `/llms-full.txt`) — brand identity, collections, delivery reality, contact | medium | THEME_CODE | M |
| 8 | Set **homepage meta description** (admin) or add a `shop.description` fallback (theme) | medium | SHOPIFY_ADMIN / THEME_CODE | S |
| 9 | Add **default `og:image`** theme setting + fallback; upload branded 1200×630 image | medium | THEME_CODE + SHOPIFY_ADMIN | S |
| 10 | Add **Google merchant Offer fields** (`priceValidUntil` in theme; `shippingDetails`/`hasMerchantReturnPolicy` via admin/Merchant Center) | medium | THEME_CODE + SHOPIFY_ADMIN | M |
| 11 | **PDP gallery alt fallback** (`alt: product.title` in `product-media.liquid`) + descriptive admin alt text | medium | THEME_CODE + SHOPIFY_ADMIN | S |
| 12 | Assign **Standard Product Taxonomy category + product_type + real GTINs** for Catalog | medium | SHOPIFY_ADMIN | L |
| 13 | Set up **GA4 "AI Assistant" reporting** + AI-referral exploration/custom channel | medium | SHOPIFY_ADMIN | S |
| 14 | Adopt a **UTM convention** for outbound AI/referral links | medium | SHOPIFY_ADMIN | S |
| 15 | **Merge PR #98** (homepage H1 + hero alt + external-link rel) | no_action* | THEME_CODE | S |
| 16 | Enrich **theme Organization** schema (logo, phone, address, sameAs); disable duplicate Org schema in EComposer/Tapita | low | THEME_CODE + APP_SETTING | M |
| 17 | Fix **article BreadcrumbList** position-3 title bug (`article.title`, not `blog.title`) | low | THEME_CODE | S |
| 18 | Disable **EComposer/Tapita JSON-LD/SEO schema** features (single authoritative source) | low | APP_SETTING | S |
| 19 | Resolve **EComposer alt-layout** title/meta/OG duplication; audit **Tapita** title/robots overrides | low | APP_SETTING | M |
| 20 | **Slideshow H1 governance** — set blocks to h2/h3 / add editor guidance | low | THEME_CODE / SHOPIFY_ADMIN | S |
| 21 | Consolidate to **one short-summary key** (`custom.short_description`) and populate per product | low | SHOPIFY_ADMIN | M |
| 22 | (Optional) **CollectionPage/ItemList** schema; **collection level** in product breadcrumb | low | THEME_CODE | M |
| — | **Leave `robots.txt` and both sitemaps on default** (no_action) — only verify no legacy AI-blocking `robots.txt.liquid` once 403 clears | no_action | SHOPIFY_ADMIN | S |

\* PR #98 is already in flight — the action is simply to merge and verify, not to re-implement.

---

## 9A. Findings by fix-owner category (the five requested buckets)

**THEME_CODE** — editable in this repo; all additive/guarded (proposed, not yet applied — see `PROPOSED_THEME_CODE_CHANGES.md`):
- Add `templates/agents.md.liquid` *(medium)* · emit rich product metafields as guarded JSON-LD `additionalProperty` *(high)* · crawler-visible, tag-driven **delivery-area line** on the PDP *(high)* · homepage meta-description fallback *(medium)* · default `og:image` setting + fallback *(medium)* · PDP gallery `alt` fallback *(medium)* · Offer `priceValidUntil` *(medium)* · enrich Organization *(low)* · article BreadcrumbList pos-3 fix *(low)* · slideshow H1 governance *(low)* · optional CollectionPage/ItemList *(low)* · **conditional:** remove a legacy AI-blocking `robots.txt.liquid` only if one is found live.

**SHOPIFY_ADMIN**:
- Enable Agentic Storefronts + Catalog + UCP + Universal Cart, and **protect PAN-India/pincode/pickup gating in agent checkout** *(high)* · fix duplicate/inconsistent product metafield keys + add `net_weight`/`piece_count`/`serves` + populate canonical set *(high)* · Standard Product Taxonomy category + `product_type` + real GTINs *(medium)* · homepage SEO meta description + branded `og:image` upload *(medium)* · GA4 "AI Assistant" reporting + AI-referral exploration/custom channel + UTM convention *(medium)* · de-duplicate GTM (with APP_SETTING) *(high)* · create the 6 target pages/collections + Search & Discovery synonyms/boosts.

**APP_SETTING** — EComposer / Tapita / PageFly / review app:
- Disable duplicate JSON-LD/SEO schema in EComposer **and** Tapita so one source is authoritative *(low)* · resolve EComposer alt-layout title/meta/OG duplication + audit Tapita title/robots overrides *(low)* · disable the GTM-GA4 app embed **or** the hardcoded GTM (de-dup) *(high)* · review app: emit `aggregateRating` only with genuine visible reviews.

**LIVE_UNVERIFIED** — cannot confirm here (egress-blocked; verify via §2A):
- Live bodies of `robots.txt` / `agents.md` / `llms.txt` / `llms-full.txt` / `sitemap.xml` / `.well-known/ucp` · whether any legacy `robots.txt.liquid` blocks AI bots · whether EComposer/Tapita app embeds inject schema or override `<title>`/meta/canonical/robots at runtime · whether the GTM-GA4 app embed loads a 2nd container, whether GA4 receives data, and the PageFly `measurementId` target · exact PAN-India/Kolkata **tag strings** and exact current per-product metafield population.

**NO_ACTION** — correct as-is:
- `robots.txt` on Shopify default (already AI-open) — do **not** override · `sitemap.xml` / `sitemap_agentic_discovery.xml` (Shopify auto) · hreflang absence (single-locale, Shopify-managed) · theme `aggregateRating` guards (not fake) and multiple JSON-LD script blocks (valid) · no rogue GA4/Meta Pixel and the theme does not break checkout tracking.

---

## 10. 15-day action plan — improve organic ChatGPT discovery and redirects to ganguram.com

Goal: maximise the chance that AI assistants (ChatGPT, Google AI Mode/Gemini, Copilot, Perplexity) **find, correctly understand, and link to** ganguram.com — and that we can **measure** the resulting referrals. Every item respects the guardrails (no fake ratings/awards, no hidden text, no doorway pages, no change to delivery gating).

### Days 1–3 — Foundations & verification (mostly Admin; unblock the 403)

- **Day 1 — Verify the live surface (once 403 clears).** Fetch `/robots.txt`, `/agents.md`, `/llms.txt`, `/sitemap.xml`, `/.well-known/ucp`. Confirm `robots.txt` blocks **no** AI bot (GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended). If a legacy `robots.txt.liquid` is found blocking AI bots, plan to **remove** it (revert to default). View-source the homepage, a product and a collection to check for duplicate `<title>`/meta/canonical/`og:image` (Tapita/EComposer) and confirm exactly one of each.
- **Day 2 — Enable Agentic Storefronts & Catalog (Admin, item #1).** Opt the store into Shopify Catalog and confirm Agentic Storefronts integrations (ChatGPT/Copilot/Gemini). Confirm the UCP manifest resolves with correct currency (INR), India market and shipping zones. **Verify agent checkout cannot complete a PAN-India order for a Kolkata-only SKU** (shipping profiles restrict Kolkata-only products).
- **Day 3 — De-duplicate GTM (Admin/App, item #2)** and stand up **GA4 AI-referral reporting** (items #13–14): create the "AI Assistant" view, the AI-referral exploration/custom channel (regex from §8.7), and lock in the UTM convention so day-15 links are measurable from the start.

### Days 4–6 — The brand narrative AI agents read (`agents.md.liquid`)

- **Day 4 — Author `templates/agents.md.liquid` (item #7).** Use the §4.5 sample. State brand identity (heritage Kolkata Bengali mithai, est. 1885), link the priority collections (rasgulla, sandesh, rasmalai, gift boxes, festival/seasonal ranges), and — critically and accurately — describe the **PAN-India-vs-Kolkata-only** delivery reality. Include contact, returns and key policy links. **No fabricated awards or ratings.**
- **Day 5 — Review & publish.** Verify the rendered `/agents.md`, `/llms.txt`, `/llms-full.txt` (all fed by the one file). Confirm collection links resolve and the delivery wording mirrors the actual tag logic — never implying nationwide delivery of Kolkata-only items.
- **Day 6 — Curate the `agents-md` link list** in Admin (Navigation) so the policy/help links the template loops over (`linklists['agents-md']`) point to real returns, shipping and contact pages.

### Days 7–10 — Make products legible to agents (data + structured data)

- **Day 7 — Fix metafield key duplication (item #3).** Choose the canonical set (§6.8); migrate `shelf_life_storage → shelf_life`/`storage_instructions`, `allergen_note → allergen_information`, `key_features → ingredients`; plan removal of the dead second `custom_liquid` block.
- **Day 8 — Add and populate weight/pack data (item #4):** `custom.net_weight`, `custom.piece_count`, `custom.serves` on top SKUs first. Leave blank where unverified — **never guess grammage**.
- **Day 9 — Emit rich metafields as guarded JSON-LD (item #6)** and add the **crawler-visible delivery-area line (item #5)**. Both additive, both guarded by `!= blank` / tag presence, neither touching the pincode/checkout gating.
- **Day 10 — Standardise top-product copy** using the §6.9 British-English template (clear "What it is / Ingredients / Allergens / Shelf life / Delivery area" structure that AI snippet extraction favours). Add PDP gallery alt fallback + descriptive admin alt text (item #11).

### Days 11–13 — Discovery polish & social card

- **Day 11 — Homepage meta description + default `og:image` (items #8–9).** Set the homepage SEO description; upload a branded 1200×630 share image and wire the fallback. Merge **PR #98** (item #15) and confirm one homepage H1 + hero alt. Set slideshow blocks to h2/h3 (item #20).
- **Day 12 — Single authoritative schema (items #16–18).** Enrich the theme Organization (logo/phone/address/sameAs); disable EComposer and Tapita JSON-LD/SEO-schema features; fix the article breadcrumb position-3 bug (item #17). Add Google merchant Offer fields (item #10).
- **Day 13 — Taxonomy & GTINs (item #12).** Assign Standard Product Taxonomy categories, a consistent `product_type` ("Bengali Sweets"), and real barcodes/GTINs where they exist. This directly improves Catalog/agent categorisation.

### Days 14–15 — Validate, seed off-site signals, measure

- **Day 14 — Validate everything.** Google Rich Results Test + Search Console on a live product, collection and article: confirm exactly **one** Organization/WebSite/Product/BreadcrumbList per page and that `aggregateRating` appears only where genuine visible reviews exist. Confirm `agents.md`/`llms.txt` render the curated content. Confirm a single GA4 fire per page.
- **Day 15 — Seed and instrument off-site discovery.** AI assistants synthesise from the wider web, so strengthen **off-site brand presence**: ensure a complete, consistent Google Business Profile and accurate brand mentions; publish/refresh genuinely useful brand content (e.g. "What is authentic Bengali sandesh?", "How Ganguram has made rasgulla since 1885") that agents can cite — **factual, no keyword stuffing, no doorway pages**. **Tag every outbound link you control** (brand bios, partner sites, your own answers/FAQs surfaced to AI) with the §8.6 UTM convention so ChatGPT/Perplexity-driven clicks land as `utm_medium=ai_referral` in GA4 rather than untracked "Direct". Schedule a 2-week review of the GA4 AI-referral exploration to confirm the channel is populating.

---

## 11. Remaining risks & assumptions

### Live-fetch limitation (403)

- **All five live URLs (`robots.txt`, `agents.md`, `llms.txt`, `llms-full.txt`, `sitemap.xml`) returned HTTP 403** and **could not be retrieved** — confirmed via both the page fetcher and a browser-user-agent `curl`, which returned `Host not in allowlist: ganguram.com`. **The 403 is the sandbox's network egress allow-list, not Shopify or bot-protection** — so the files are LIVE_UNVERIFIED, not missing. Clear it by adding `ganguram.com` to the environment's egress settings (then re-run this audit) or by pasting the contents from a browser (§2A). Every statement about live response bodies is **UNVERIFIED**, reasoned from theme source (Glob), Shopify platform behaviour and WebSearch (June 2026). `shopify.dev` is likewise off the egress list, so cited docs are **UNVERIFIED via direct fetch** (links in "Sources" below).

### Key UNVERIFIED items (require live HTML or Admin/app inspection)

- Whether any **legacy `robots.txt.liquid`** is live and blocking AI bots — verify and, if found, **remove** it (revert to default).
- Whether the **EComposer and/or Tapita app embeds inject Organization/WebSite/Product/Article schema or override `<title>`/meta/canonical/robots at runtime** via `content_for_header` — the only theme-rendered JSON-LD is `microdata-schema.liquid`; cross-source duplication can only be confirmed by view-source on a live page (currently 403) or via the app dashboards.
- Whether the **GTM-GA4 app embed loads a second/duplicate GTM container or the same `GTM-WBWKK5KN`**, whether GA4 is actually receiving data, and which container feeds it — GTM contents are not in the theme; verify via Admin + GTM Preview.
- Whether **PageFly's `measurementId`** targets the same GA4 property as the main GTM (admin/metafield) — risk of double-count on PageFly pages.
- **Exact current metafield population per product**, and whether the **duplicate (second) `custom_liquid` block** is actually populated on live products — **confirm in admin before deleting it.**
- The **exact PAN-India / Kolkata tag strings** — confirm with the merchant before shipping the visible delivery-area line.
- Whether the **UCP manifest** at `/.well-known/ucp` reflects correct store config — verify once the 403 clears.

### Assumptions carried from the established facts (not re-derived)

- `robots.txt` is Shopify-default (no `templates/robots.txt.liquid`); `sitemap.xml` is Shopify-auto-generated and not theme-editable.
- The theme's and EComposer's `aggregateRating` are **guarded** (real review metafield / `!= "0"`), so they are **not** fake/empty; `tapita-seo-schema.liquid` emits no `aggregateRating` at all.
- **PR #98** (homepage H1 + hero alt + external-link rel) exists on a separate branch and is **pending merge** — those items are flagged as such, not re-reported as open.

### Guardrails honoured (constraints on every recommendation)

- **No fake ratings/reviews/awards, no hidden text, no doorway/keyword-stuffed pages.** All schema and copy recommendations are guarded by `!= blank` so empty fields emit nothing — nothing is fabricated.
- **No change to the delivery logic** (PAN-India tag gating, pincode logic, ShipZip/store-selector/pickup, checkout gating, availability/inventory). The recommended delivery-area line and any `areaServed` schema are **read-only echoes of existing tags** and never mark a Kolkata-only product as PAN-India deliverable.
- App-owned files are **not** to be deleted (`ecom_google_snippet.liquid`, `ecom_header.liquid`, `tapita-seo-schema.liquid`, `layout/ecom.liquid`) — disable their behaviour via **app settings** instead.

### Sources (WebSearch, June 2026; `shopify.dev` returned 403 to the fetcher — docs cited but UNVERIFIED via direct fetch)

- Shopify dev — customise `llms.txt`/`llms-full.txt`/`agents.md` changelog: `https://shopify.dev/changelog/customize-llmstxt-llms-fulltxt-and-agentsmd`
- Shopify dev — `agents.md.liquid`: `https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid`
- Shopify dev — `llms.txt.liquid`: `https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid`
- Shopify dev — `llms-full.txt.liquid`: `https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-full-txt-liquid`
- Shopify dev — `robots.txt.liquid`: `https://shopify.dev/docs/storefronts/themes/architecture/templates/robots-txt-liquid`
- Shopify Help — editing `robots.txt.liquid` (risks): `https://help.shopify.com/en/manual/promoting-marketing/seo/editing-robots-txt`
- Shopify dev — Agentic commerce: `https://shopify.dev/docs/agents`
- Shopify Help — Catalog & product discovery for agentic storefronts: `https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/products`
- Shopify news — agentic commerce / Spring '26: `https://www.shopify.com/news/ai-commerce-at-scale` and `https://www.shopify.com/news/spring-26-edition-merchant`
- Craftshift — native `llms.txt`/agentic discovery rollout (May 2026): `https://craftshift.com/shopify-native-llms-txt-agentic-discovery-rollout/`; don't block AI bots: `https://craftshift.com/dont-block-ai-bots-shopify-robots-txt/`
- honeybound — what gets auto-generated & how to override: `https://honeybound.co/blog/shopify-llms-txt-agents-md`
- No7 Software — `/llms.txt`, `/agents.md`, `/.well-known/ucp` engineering override guide: `https://no7software.co.uk/blog/shopify-llms-txt-agents-md-ucp-defaults-engineering-override`
- Ilana Davis — customise `llms.txt` natively in Shopify: `https://www.ilanadavis.com/blogs/articles/add-llms-txt-file-natively-with-shopify`
- Search Engine Journal — GA4 adds "AI Assistant" default channel group: `https://www.searchenginejournal.com/google-analytics-adds-ai-assistant-as-default-channel-group/574974/`
- Discovered Labs — track ChatGPT/Perplexity/AI Overviews traffic in GA4: `https://discoveredlabs.com/blog/how-to-track-chatgpt-perplexity-and-ai-overviews-traffic-in-ga4-without-guessing`
- Littledata — fix duplicate GA4 tracking on Shopify: `https://help.littledata.io/integrations/shopify-to-google-analytics/fix-duplicate-tracking-ga4`
- Google — Tag Manager / GA4 channel guidance: `https://support.google.com/tagmanager/answer/16424072?hl=en`
