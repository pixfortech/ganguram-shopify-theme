# Phase 2.6A — Distance-based Kolkata Delivery Charge: Feasibility & Architecture Audit

**Status: docs-only feasibility audit. No theme behaviour, Liquid, JS, CSS, app
config, API key, Google Maps script, saved-address, checkout, MOV, date-slot,
shipping or pincode/product-filtering logic was added or changed.** This document
only defines *what is possible* and *what we would build*, so the merchant can
choose a direction before any implementation phase is scoped.

**Goal under audit:** for **Kolkata / local delivery only**, let the customer
enter/select a full address; compute road distance from a Ganguram dispatch
origin to that address; and charge a **distance-slab** delivery fee **at
checkout**, where the final charged price comes from a *trusted* rate source —
not a frontend estimate. PAN India keeps its existing shipping logic;
`4-hour-delivery` stays strictly Quick Commerce / Kolkata-only and separate.

> **Terminology.** The merchant's term **"ShipZip"** maps, in this theme, to the
> **SBZ ShippingApp** (`sbz.cirkleinc.com`, `csShippingAppV3.js`) — the
> checkout-side app that owned **delivery date/slot, checkout gating and MOV** in
> 2.3.2. The separate **zipLogic** app owned **product/collection availability**.
> The exact app name/identity ("ShipZip" vs "SBZ" vs another shipping app) and its
> distance-pricing capability are **merchant/vendor confirmation items** (see §7) —
> they cannot be determined from theme code.

---

## 0. TL;DR / decision

- **Shopify's hosted checkout will only charge a shipping price that comes from
  one of two trusted sources: (a) a *static* rate configured in Settings →
  Shipping, or (b) a *real-time* rate returned by a backend via the
  CarrierService API.** Nothing in the theme — localStorage, cart attributes, a
  frontend Google Distance call — can set or override the charged price.
- **Therefore true distance-based checkout pricing is only possible through a
  CarrierService callback** (provided either by an app that natively supports
  distance slabs, or by a small custom backend) that **re-computes distance
  server-side from the checkout destination address**.
- **Delivery Customization (Shopify Functions) cannot price by distance** — it can
  only hide / rename / reorder rates that already exist.
- **Recommended:** **confirm first** whether ShipZip/SBZ (or any installed
  shipping app) natively supports distance slabs via a CarrierService.
  - If **yes** → **Option A** (configure it in the app; the theme only adds an
    optional, clearly-labelled *preview*). Least custom work, fully trusted.
  - If **no** → **Option B** (a small custom CarrierService backend) is required
    for trusted distance pricing, optionally paired with **Option C** (theme
    preview) and **Option D** (tidy checkout options). 
  - In **either** case, distance is computed **server-side** (Google **Routes API
    `computeRouteMatrix`** + Geocoding), the Google key is **server-side only**,
    and the theme's lat/lng/distance/slab live in **cart attributes for
    preview + order record only — never trusted for price**.
- **Plan gate:** real-time/carrier rates require the **Advanced Shopify plan or
  higher**, or the paid **Carrier-Calculated Shipping** add-on on the Shopify
  plan. This eligibility must be confirmed before Option A or B is viable.

---

## 1. Current ShipZip / SBZ / zipLogic audit

Verified against `local-4x-migration` (theme code) and the prior Phase 2.0 / 2.1c
audits (`docs/pincode-architecture-audit.md`, `docs/shipzip-popup-audit.md`,
sourced from the live `v2.3.2-pre4x` tag).

| App / layer | What it owns | Where the data lives | Distance pricing? |
|---|---|---|---|
| **zipLogic** | Product/collection **availability** by pincode (PDP "Deliver to" checker) | Cookies (`zipCodeVal`, `zipIs`, `availProds*`), app proxy `/a/zipLogic`, `shop.metafields.zipLogic.*` | **No.** Availability only, not shipping charges. |
| **SBZ ShippingApp ("ShipZip")** | **Checkout gating, delivery date/slot, MOV (₹300 hyperlocal)** | Reads `localStorage["Zipcode"]`; external JS from `sbz.cirkleinc.com` | **Unknown from theme** — see note below. |
| **Our clean 4.0 layer** (`GanguramZone` + display filters) | Pincode resolution + **display-only** product/menu/search visibility by zone | `localStorage["Zipcode"]` (SBZ contract key) + `window.GanguramZone` | **No.** Display only; never touches checkout/price. |
| **Theme built-in** `component-shipping-calculator.js` | Cart-page rate **estimator** | Calls Shopify `/cart/shipping_rates.json` (returns the **real** configured rates for a destination) | Shows whatever rate source exists; no distance logic of its own. |

**Theme-verifiable facts:**

1. In **4.0 today**, neither zipLogic nor SBZ is embedded (0 app blocks; no
   `cirkleinc`/`/a/zipLogic` references). The only pincode logic present is our
   **display-only** `GanguramZone` resolver + product/menu/search filters. **None
   of it influences checkout shipping price.**
2. In **2.3.2**, SBZ enforced **checkout gating + date/slot + MOV** keyed off
   `localStorage["Zipcode"]`, and pulled `sbz.cirkleinc.com/...csShippingAppV3.js`.
   The theme code shows SBZ **gating** checkout and injecting a date/slot picker —
   it does **not** reveal whether SBZ sets the **shipping *price*** (static vs
   carrier-calculated), and it shows **no distance computation** anywhere.
3. The Kolkata / QC / PAN classification in 2.3.2 was **pincode-list based**, not
   distance based. There is **no existing distance-based delivery mechanism** to
   reuse — this would be **net-new** capability.

**Not determinable from theme code (→ §7 merchant/vendor questions):** whether
SBZ/ShipZip (or any other installed app) (a) natively supports **distance-based
slabs**, (b) can **compute distance from the checkout address**, (c) can read
**cart attributes** (pincode / lat-lng / distance / slab), (d) can **expose
rate rules** based on local distance, or (e) injects rates via a **CarrierService**
at all (vs. relying on static Shopify rates + only gating/date-slot on top).

---

## 2. Shopify checkout-rate limitation summary

This is the spine of the whole decision. Shopify's **hosted checkout** displays a
shipping price from **exactly one of**:

1. **Static rates** — flat / weight-based / price-based rates configured in
   **Settings → Shipping**. No distance, no address-math.
2. **Real-time (carrier-calculated) rates** — returned by a backend endpoint
   registered via the **CarrierService API**. **This is the only way to inject a
   computed / distance-based price into checkout.**
   - **Plan requirement:** the store must be on the **Advanced Shopify plan or
     higher**, **or** add the paid **Carrier-Calculated Shipping (CCS)** feature
     (≈ US$20/mo on the Shopify plan; often included annually). Without this, a
     CarrierService cannot be created. *(Shopify Help Center — third-party
     carrier-calculated shipping.)*
   - **What the callback receives:** a `rate` object with **`origin`**,
     **`destination`** (full address: country, postal_code, province, city,
     address1/2…) and **`items`** (incl. line-item `properties`). Shopify
     **server-side caches** results for 15 minutes. *(shopify.dev — CarrierService.)*
   - **What it does *not* receive:** cart-level **note / attributes** are **not**
     part of the documented rate payload. ⇒ the backend must **re-derive distance
     from the `destination` address at rate time**; it cannot rely on a
     theme-written "distance" cart attribute for the trusted price.

**What the theme/storefront *cannot* do:**

- There is **no `checkout.liquid`** to customise without **Shopify Plus /
  Checkout Extensibility**; the theme cannot set or override the charged price.
- **Delivery Customization API (Shopify Functions)** can **hide, rename and
  reorder** delivery options that Shopify already calculated — it **cannot change
  prices or create distance-priced rates** ("Delivery Customization is for hiding,
  renaming, and reordering options; shipping discounts belong in the Discounts
  API"). *(shopify.dev — Delivery Customization Function API.)*
- `/cart/shipping_rates.json` (used by the theme's shipping calculator) returns
  the **real** rates for a destination — but only whatever the trusted source
  (static or carrier) already produces. It is an honest **preview**, not a pricing
  engine.

**Conclusion:** distance-based Kolkata pricing ⇒ a **CarrierService** (from an app
or a custom backend), gated by plan eligibility. Everything else is preview/UX.

---

## 3. Architecture options

### Option A — ShipZip native distance slabs *(if supported)*

The SBZ/ShipZip app (or another installed shipping app) provides distance-based
slabs through **its own CarrierService**. The merchant configures origin + km
bands + fees in the app admin; the theme does **nothing** pricing-related.

- ✅ Least custom code; no backend to build/host; vendor maintains it; fully
  trusted (price comes from the app's carrier callback).
- ✅ Cleanly Kolkata-scoped if the app supports zone/pincode-gated distance rules.
- ⚠️ **Entirely conditional on the app actually supporting distance slabs** — the
  theme cannot confirm this (the 2.3.2 integration only shows gating/date-slot/MOV,
  which suggests it may *not*). **Must be confirmed with the vendor/merchant (§7).**
- ⚠️ Still requires carrier-rate **plan eligibility** (Advanced+ / CCS add-on).

### Option B — Custom backend / carrier-rate provider

A small server app exposes a **CarrierService callback**. On each checkout rate
request it: **geocodes** the `destination` (Geocoding API) → computes **road
distance** from the configured origin (**Routes API `computeRouteMatrix`**) → maps
to the merchant's **Kolkata distance slabs** → returns the rate. PAN India and
`4-hour-delivery` are untouched (it returns Kolkata distance rates only for
Kolkata-serviceable destinations; other zones fall through to existing rates).

- ✅ True distance pricing, fully controlled, trusted (server-side, recomputed at
  checkout — tamper-proof against localStorage/cart-attribute edits).
- ✅ Uses the current Google API (Routes), server-side key, field-masked for cost.
- ⚠️ Requires a **hosted backend** (build + run + monitor), **plan eligibility**,
  a **server-side Google key + billing**, and ongoing maintenance.
- ⚠️ Must coexist with SBZ's gating/date-slot/MOV — coordinate so two apps don't
  both try to own the Kolkata rate.

### Option C — Theme preview only + ShipZip/checkout final rate

The theme shows a **distance-based *estimate*** on PDP/cart (a clearly-labelled
"Estimated delivery from <origin>: ~X km · ₹Y"), while the **charged** price comes
from the trusted source (Option A's app **or** Option B's backend). The preview
can use either a server-proxied Routes call or the real `/cart/shipping_rates.json`
rates.

- ✅ Transparency/UX win; sets customer expectation before checkout.
- ✅ Safe by construction — it's **display only**, never the charged price.
- ❌ **Not a pricing solution on its own.** It is a layer **on top of A or B**; it
  does not create a trusted rate. Used alone, it would mislead (estimate ≠ charge).

### Option D — Delivery Customization only (hide / rename / reorder)

A Shopify Function tidies the checkout option list — e.g. hide PAN/courier rates
for a Kolkata-serviceable address, rename a slab to "Kolkata local delivery
(0–5 km)", or order options cheapest-first.

- ✅ Useful **complement** to keep checkout clean and zone-appropriate.
- ❌ **Cannot compute or set a distance price** (no pricing capability). Never a
  standalone answer to this requirement.

**Summary:**

| Option | Creates trusted distance price? | Custom backend? | Plan-gated? | Role |
|---|---|---|---|---|
| A — App native slabs | ✅ (if app supports it) | No | Yes | **Primary, if available** |
| B — Custom CarrierService | ✅ | **Yes** | Yes | **Primary, if A unavailable** |
| C — Theme preview | ❌ (preview only) | No (proxy optional) | No | Optional UX layer on A/B |
| D — Delivery Customization | ❌ (hide/rename/reorder) | No (Function) | No | Optional checkout tidy-up |

---

## 4. Recommended final approach

A **confirm-first, layered** approach (no build until §7 is answered):

1. **Gate / confirm (no code):** Establish (a) the store's **carrier-rate
   eligibility** (Advanced+ or CCS add-on), and (b) whether **ShipZip/SBZ or
   another installed shipping app supports distance-based slabs via a
   CarrierService**.
2. **If the app supports it → Option A** as the pricing engine: configure
   origin + slabs in the app; add **Option C** as an optional theme **preview**;
   add **Option D** only if checkout options need tidying. *Minimal custom code.*
3. **If the app does not support it → Option B**: a small **custom CarrierService
   backend** computes distance server-side and returns the Kolkata rate; pair with
   **Option C** (preview) and optionally **Option D**.
4. **Invariants in both paths:**
   - **Kolkata / local only.** PAN India keeps its existing shipping logic;
     `4-hour-delivery` stays QC/Kolkata-only and **separate** from this slab logic.
   - **Distance is computed server-side** from the **checkout destination address**
     using **Google Routes API `computeRouteMatrix`** (+ Geocoding); the **legacy
     Distance Matrix API is *not* used for new work** (moved to Legacy status,
     1 Mar 2025).
   - **The theme never sets price.** lat/lng / distance / slab / estimate live in
     **cart attributes for preview + order record only**; the charged price is
     recomputed by the trusted callback.
   - **No change** to product/pincode filtering, MOV, date/slot, or
     ShipZip/SBZ/zipLogic internals from the theme side.

**Why not the others as primary:** Option C alone never produces a trusted price;
Option D cannot price at all. Both are *supporting* layers, not the engine.

---

## 5. Data flow

```
                 ┌──────────────────────────── PREVIEW / UX (untrusted) ───────────────────────────┐
 customer enters/selects full Kolkata address
        │  (optional client-side Places Autocomplete — separate, referrer-restricted Places-only key)
        ▼
 GEOCODE  ── address → lat/lng + place_id ──────────► (preferably server-proxied; client key only for typeahead)
        │
        ▼
 DISTANCE ── Routes API computeRouteMatrix ────────►  origin → destination road distance (km)
        │     (server-side, field-masked; key server-side only)
        ▼
 SLAB     ── km → merchant slab band → estimated fee
        │
        ▼
 CART ATTRIBUTES (note attributes, for PREVIEW + ORDER RECORD only — never trusted for price):
        pincode · formatted_address · lat,lng · place_id · distance_km · slab_id/label · estimated_fee
        └──────────────────────────────────────────────────────────────────────────────────────────┘

                 ┌──────────────────────────── CHARGED PRICE (trusted) ───────────────────────────┐
 CHECKOUT  ── Shopify sends rate request (destination address + items) to the CarrierService callback
        │       (App's carrier service [Option A]  OR  custom backend [Option B])
        ▼
 The callback RE-DERIVES distance server-side from the checkout destination address
 (Geocode + Routes API), maps to the slab, and RETURNS the authoritative Kolkata rate.
        │   (It does NOT read the cart-attribute "distance"/"fee" — those are untrusted.)
        ▼
 Shopify displays/charges that rate (PAN India & 4-hour-delivery handled by their own existing sources)
        └──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Key subtlety:** because the CarrierService payload carries the **destination
address but not cart attributes**, the trusted price is **independently
recomputed** at rate time. The cart-attribute distance/fee is only for **showing
the customer an estimate** and **stamping the order** for ops/record — tampering
with it (devtools, localStorage) **cannot** change what is charged.

---

## 6. Security notes

- **Google API key is server-side only.** Live in a backend **environment
  variable / secret manager** — never in Liquid, theme JS, CSS, or a committed
  config. Restrict by IP/service. Field-mask Routes requests to limit data + cost.
  - If client-side **Places Autocomplete** is used purely for address typeahead
    UX, use a **separate, tightly HTTP-referrer-restricted, Places-only** key, and
    **still recompute geocode + distance server-side** for anything that influences
    price. A browser-exposed key must never be the one used for pricing.
- **No trusted pricing from localStorage or cart attributes.** These are
  user-editable; treat them as **preview/record only**. The charged price is always
  **recomputed server-side** by the CarrierService callback from the checkout
  address.
- **Frontend estimate is preview only** — always labelled "estimated", visually
  distinct, and never written back as the charged amount or used to gate checkout.
- **Privacy/PII:** the delivery address is sent to Google for geocoding/distance —
  ensure this is covered by the store privacy policy and Google Maps Platform ToS,
  minimise retention, and don't log full addresses unnecessarily.
- **No new client deps:** no Google Maps JS embed in the theme for pricing, no
  jQuery/Bootstrap/FontAwesome, no saved-address store, no hard redirects — all
  out of scope and explicitly excluded here.

---

## 7. Merchant / admin questions (must answer before any build)

1. **Dispatch origin** — which model and exact location(s)?
   - factory / central kitchen, **Beadon Street** flagship, **nearest branch**
     (multi-origin), a **fixed central origin**, or a **configurable origin**?
   - *Recommendation:* start with a **single configurable origin** (default = the
     primary dispatch point); treat **nearest-branch / multi-origin** as a later
     enhancement (needs branch list, hours, inventory). Provide the precise
     address / lat-lng of the chosen origin(s).
2. **Distance slabs** — the exact **km bands and fees** (e.g. 0–3 km ₹X, 3–6 km ₹Y,
   6–10 km ₹Z, >10 km …), any **free-delivery threshold**, and how slabs interact
   with the existing **MOV (₹300)** and any order-value rules.
3. **App identity & capability** — is **"ShipZip" = the SBZ ShippingApp
   (cirkleinc)**, or a different/renamed app? Does it (or any installed shipping
   app) support **distance-based slabs via a CarrierService**? Can it **read cart
   attributes** and **expose distance-based rate rules**? *(Determines A vs B.)*
4. **Shopify plan / carrier-rate eligibility** — is the store on **Advanced
   Shopify or higher**, or does it have the **Carrier-Calculated Shipping** add-on
   enabled? *(Hard prerequisite for any real-time/distance rate.)*
5. **Who generates checkout rates today** — SBZ/ShipZip, another shipping app, or
   **static Shopify rates**? Does SBZ currently inject **prices** via a
   CarrierService, or only **gate checkout + date/slot + MOV** on top of static
   rates? *(Confirms whether Option A is even possible and how B must coexist.)*
6. **Scope confirmation** — confirm distance pricing applies to **Kolkata/local
   only**, that **PAN India** keeps its current shipping unchanged, and that
   **`4-hour-delivery`** remains a **separate QC/Kolkata-only** flow not governed by
   these slabs.

---

## Strict-rules compliance (this PR)

Docs-only. **No** theme behaviour, **no** Liquid/JS/CSS, **no** API key, **no**
Google Maps script, **no** saved addresses, **no** checkout / MOV / date-slot /
shipping / app-logic changes, and **no** change to pincode or product filtering.
The only artifact is this file: `docs/distance-based-delivery-architecture.md`.

---

### Sources (platform facts verified during this audit)

- Shopify — CarrierService (rate request payload incl. `origin`/`destination`/`items`, 15-min cache): https://shopify.dev/docs/api/admin-rest/latest/resources/carrierservice
- Shopify Help Center — Third-party carrier-calculated shipping (Advanced plan / CCS add-on requirement): https://help.shopify.com/en/manual/fulfillment/setup/shipping-rates/third-party-carrier-calculated-shipping
- Shopify — Delivery Customization Function API (hide/rename/reorder only; no pricing): https://shopify.dev/docs/api/functions/latest/delivery-customization
- Google — Why migrate to Routes API (legacy Distance Matrix → Legacy status, use Routes API for new work): https://developers.google.com/maps/documentation/routes/migrate-routes-why
- Google — Compute a Route Matrix (`computeRouteMatrix`): https://developers.google.com/maps/documentation/routes/compute_route_matrix

*Audit only — no code changed. Theme/app facts verified on `local-4x-migration`
and prior Phase 2.0 / 2.1c audits; Shopify and Google platform facts verified via
their official documentation (June 2026). App-internal capabilities (SBZ/ShipZip
distance slabs, cart-attribute access) are flagged as merchant/vendor confirmation
items — they are not determinable from theme code.*
