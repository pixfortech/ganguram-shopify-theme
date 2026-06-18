# Phase 2.6A — Distance-based Kolkata Delivery Charge: Feasibility & Architecture Audit

**Status: docs-only. No theme behaviour, Liquid, JS, CSS, app config, API key,
Google Maps script, saved-address, checkout, MOV, date-slot, shipping,
pincode/product-filtering or mobile-pincode-placement logic was added or
changed.** This document defines *what is possible* and *what we would configure /
build*. It now reflects **merchant confirmation** that ShipZip supports
distance-based slabs, so a preferred path is named — but **no implementation is
included in this PR**.

**Goal:** for **Kolkata / local delivery only**, the customer enters/selects a
full address; the road distance from the Ganguram dispatch origin to that address
determines a **distance-slab** delivery fee charged **at checkout**, where the
final charged price comes from a *trusted* rate source — not a frontend estimate.
PAN India keeps its existing shipping logic; `4-hour-delivery` stays strictly
Quick Commerce / Kolkata-only and separate (and is **not** offered to PAN India).

> **Terminology.** The merchant's term **"ShipZip"** is the shipping/checkout app
> identified in this theme as the **SBZ ShippingApp** (`sbz.cirkleinc.com`,
> `csShippingAppV3.js`) — the checkout-side app that owned **delivery date/slot,
> checkout gating and MOV** in 2.3.2. The separate **zipLogic** app owned
> **product/collection availability**.

---

## ✅ Merchant confirmation (2026-06-18)

| # | Confirmed | Detail |
|---|---|---|
| 1 | **ShipZip supports distance-based slabs** | Native capability — no custom backend needed for pricing. |
| 2 | **Rate Tier = `Order Distance`** | Confirmed by ShipZip admin screenshot; ShipZip computes order distance itself and returns the rate to checkout. |
| 3 | **Dispatch origin = Beadon Street** | The **Beadon Street Shopify location** is the origin for distance measurement. |
| 4 | **Distance slabs** | 0–5 km ₹50 · 5.01–10 km ₹70 · 10.01–15 km ₹100 · 15.01–20 km ₹150. |
| 5 | **`4-hour-delivery` stays separate** | Remains QC/Kolkata-only; **not** used for PAN India. |
| 6 | **PAN India shipping unchanged** | Continues existing PAN India shipping logic. |

This confirmation resolves the previously-open question of whether the app could
price by distance. **Option A (below) is therefore the preferred, confirmed
path.** Option B (custom backend) is retained **only as a fallback** if ShipZip
checkout rates ever fail to appear.

---

## 0. TL;DR / decision

- **Preferred, confirmed path = Option A — ShipZip native `Order Distance`
  slabs.** ShipZip already supports distance-based rate tiers; the merchant
  configures origin (Beadon Street) + the km slabs in the ShipZip admin, and
  ShipZip returns the distance rate to Shopify checkout.
- **The final checkout delivery charge must come from ShipZip.** It is the trusted
  rate source. Nothing in the theme — localStorage, cart attributes, a frontend
  Google call — sets or overrides the charged price.
- **A frontend Google distance calculation is NOT required for final checkout
  pricing.** Because ShipZip's `Order Distance` tier computes the distance itself
  (origin → checkout address), the theme needs **no Google API, no key, and no
  Maps script** for pricing. *(A theme-side distance/fee preview, if ever added
  later, is an **estimate only** and is the only place a Google call could appear —
  out of scope for this PR.)*
- **Option B (custom CarrierService backend) = fallback only** — build it **only
  if** ShipZip's checkout rates fail to appear or prove unworkable.
- **Delivery Customization (Shopify Functions) cannot price by distance** — it can
  only hide / rename / reorder rates that already exist (a possible later tidy-up,
  not a pricing engine).
- **Carrier-Calculated Shipping eligibility:** if ShipZip's distance rates already
  **appear at checkout**, the store's carrier-rate (CCS) eligibility is effectively
  **active/working**. If they do **not** appear, verify Shopify plan / CCS add-on
  eligibility with **Shopify and ShipZip** (see §2).
- **Scope guards (unchanged):** Kolkata/local only · PAN India keeps existing
  shipping · `4-hour-delivery` stays separate and is not offered to PAN India · no
  change to product/pincode filtering, MOV, date/slot, or ShipZip/SBZ/zipLogic
  internals from the theme side.

---

## 1. Current ShipZip / SBZ / zipLogic audit

Verified against `local-4x-migration` (theme code) and the prior Phase 2.0 / 2.1c
audits (`docs/pincode-architecture-audit.md`, `docs/shipzip-popup-audit.md`,
sourced from the live `v2.3.2-pre4x` tag), plus the **2026-06-18 merchant
confirmation** above.

| App / layer | What it owns | Where the data lives | Distance pricing? |
|---|---|---|---|
| **zipLogic** | Product/collection **availability** by pincode (PDP "Deliver to" checker) | Cookies (`zipCodeVal`, `zipIs`, `availProds*`), app proxy `/a/zipLogic`, `shop.metafields.zipLogic.*` | **No.** Availability only, not shipping charges. |
| **ShipZip / SBZ ShippingApp** | **Checkout gating, delivery date/slot, MOV (₹300 hyperlocal)** + **distance-slab shipping rates** | Reads `localStorage["Zipcode"]`; external JS from `sbz.cirkleinc.com`; rate config in ShipZip admin | **✅ Yes — confirmed.** Rate Tier = `Order Distance` (merchant-confirmed). |
| **Our clean 4.0 layer** (`GanguramZone` + display filters) | Pincode resolution + **display-only** product/menu/search visibility by zone | `localStorage["Zipcode"]` (SBZ contract key) + `window.GanguramZone` | **No.** Display only; never touches checkout/price. |
| **Theme built-in** `component-shipping-calculator.js` | Cart-page rate **estimator** | Calls Shopify `/cart/shipping_rates.json` (returns the **real** configured rates for a destination) | Shows whatever rate source exists (now incl. ShipZip's distance rate); no distance logic of its own. |

**Facts:**

1. In **4.0 today**, neither zipLogic nor ShipZip/SBZ is embedded in the theme
   (0 app blocks; no `cirkleinc`/`/a/zipLogic` references). The only pincode logic
   present is our **display-only** `GanguramZone` resolver + product/menu/search
   filters. **None of it influences checkout shipping price.** Re-embedding/enabling
   the ShipZip app on the store is an **admin task**, not theme code.
2. In **2.3.2**, ShipZip/SBZ enforced **checkout gating + date/slot + MOV** keyed
   off `localStorage["Zipcode"]`. The merchant has now confirmed ShipZip **also**
   provides **distance-slab rates** via its `Order Distance` rate tier.
3. The Kolkata/QC/PAN classification in 2.3.2 was **pincode-list based**; the new
   distance pricing is **ShipZip-side** and keyed off the Shopify **origin location
   → checkout address** distance — independent of the theme's pincode lists.

---

## 2. Shopify checkout-rate limitation summary

Why ShipZip is the trusted source — and why the theme cannot be. Shopify's
**hosted checkout** displays a shipping price from **exactly one of**:

1. **Static rates** — flat / weight-based / price-based rates configured in
   **Settings → Shipping**. No distance, no address-math.
2. **Real-time (carrier-calculated) rates** — returned via the **CarrierService
   API**. **This is the only way to inject a computed / distance-based price into
   checkout, and it is exactly how ShipZip's `Order Distance` tier works.**
   - **Plan requirement:** the store must be on the **Advanced Shopify plan or
     higher**, **or** have the paid **Carrier-Calculated Shipping (CCS)** feature
     (≈ US$20/mo on the Shopify plan; often included on annual billing).
     *(Shopify Help Center — third-party carrier-calculated shipping.)*
   - **CCS clarification (per merchant note):** **if ShipZip's distance rates
     already appear at checkout, CCS is effectively active/working** — a
     CarrierService only returns rates when the plan/CCS entitlement is in place.
     **If rates do not appear**, the store's **plan / CCS eligibility must be
     checked with Shopify and ShipZip support** before anything else.
   - **What the callback receives:** a `rate` object with **`origin`**,
     **`destination`** (full address: country, postal_code, province, city,
     address1/2…) and **`items`**. Shopify **server-side caches** results for
     15 minutes. The **origin** comes from the store's configured **location** —
     i.e. **Beadon Street** must have a correct full address for `Order Distance`
     to measure correctly. *(shopify.dev — CarrierService.)*
   - **What it does *not* receive:** cart-level **note / attributes** are **not**
     part of the documented rate payload. ⇒ a rate source must derive distance from
     the `destination` address — which ShipZip does — and a theme-written "distance"
     cart attribute can **never** be the trusted price.

**What the theme/storefront *cannot* do:**

- There is **no `checkout.liquid`** to customise without **Shopify Plus /
  Checkout Extensibility**; the theme cannot set or override the charged price.
- **Delivery Customization API (Shopify Functions)** can **hide, rename and
  reorder** delivery options that Shopify already calculated — it **cannot change
  prices or create distance-priced rates** ("Delivery Customization is for hiding,
  renaming, and reordering options; shipping discounts belong in the Discounts
  API"). *(shopify.dev — Delivery Customization Function API.)*
- `/cart/shipping_rates.json` (used by the theme's shipping calculator) returns the
  **real** rates for a destination — including ShipZip's once live — but it is an
  honest **preview**, not a pricing engine.

**Conclusion:** distance-based Kolkata pricing is delivered by **ShipZip's
`Order Distance` CarrierService rate**; the theme is preview/UX only.

---

## 3. Architecture options

### ✅ Option A — ShipZip native distance slabs *(preferred, confirmed)*

ShipZip provides distance-based slabs through its **`Order Distance` rate tier**
(its own CarrierService). The merchant configures the **origin (Beadon Street)**
and the **km slabs** in the ShipZip admin; **ShipZip computes the order distance
and returns the rate** to Shopify checkout. The theme does **nothing**
pricing-related.

- ✅ **Confirmed supported** (Rate Tier = `Order Distance`, merchant screenshot).
- ✅ Least work — **no backend, no Google API, no key, no Maps script**; ShipZip +
  Shopify own the distance math and the trusted price.
- ✅ Cleanly Kolkata-scoped via ShipZip's rate conditions; PAN India and
  `4-hour-delivery` remain on their own paths.
- ⚠️ Requires the ShipZip app to be **installed/enabled** on the store and the
  **Beadon Street location** to carry a correct full address (origin accuracy).
- ⚠️ Requires carrier-rate **eligibility** — but if ShipZip rates already show at
  checkout, that entitlement is effectively confirmed (see §2).

### Option B — Custom backend / carrier-rate provider *(fallback only)*

**Build only if ShipZip's checkout rates fail to appear or prove unworkable.** A
small server app exposes a **CarrierService callback**: it **geocodes** the
`destination` (Geocoding API) → computes **road distance** from Beadon Street
(**Routes API `computeRouteMatrix`**) → maps to the same slabs → returns the rate.

- ✅ Full control / trusted (server-side, recomputed at checkout).
- ❌ Only needed if Option A fails — adds a **hosted backend**, a **server-side
  Google key + billing**, and ongoing maintenance for no benefit while ShipZip
  works. **Not pursued unless ShipZip rates break.**

### Option C — Theme preview only + ShipZip final rate

Optional, later: the theme could show a **distance-based *estimate*** on PDP/cart
("Estimated delivery from Beadon Street: ~X km · ₹Y"), while the **charged** price
always comes from **ShipZip**. Preview could use a server-proxied Routes call or
the real `/cart/shipping_rates.json` rates.

- ✅ Transparency/UX; safe by construction (display only).
- ❌ **Not a pricing solution** — a layer on top of ShipZip. If added later it is
  an **estimate only**, clearly labelled, never the charged amount. (Out of scope
  for this PR.)

### Option D — Delivery Customization only (hide / rename / reorder)

Optional, later: a Shopify Function could hide non-Kolkata rates for a Kolkata
address, rename a slab ("Kolkata local delivery (0–5 km)"), or sort cheapest-first.

- ✅ Useful **complement** to keep checkout tidy.
- ❌ **Cannot compute or set a distance price.** Never a standalone answer.

**Summary:**

| Option | Creates trusted distance price? | Custom backend? | Google API? | Role |
|---|---|---|---|---|
| **A — ShipZip `Order Distance`** | **✅ confirmed** | No | **No** | **Preferred / confirmed** |
| B — Custom CarrierService | ✅ | **Yes** | Yes (server-side) | **Fallback only (if A fails)** |
| C — Theme preview | ❌ (estimate only) | No (proxy optional) | Optional, later | Optional UX layer on A |
| D — Delivery Customization | ❌ (hide/rename/reorder) | No (Function) | No | Optional checkout tidy-up |

---

## 4. Recommended final approach

**Adopt Option A — ShipZip `Order Distance` slabs — as the delivery-charge
engine.** No theme/build work is required for pricing; the remaining work is
**admin configuration + validation** (see the checklist below).

1. **Configure ShipZip:** Rate Tier = `Order Distance`, origin = **Beadon Street
   Shopify location**, slabs as confirmed.
2. **The final checkout delivery charge comes from ShipZip** (the trusted source).
3. **No frontend Google distance calculation is required** for final pricing.
4. **Keep Option B in reserve** — implement a custom CarrierService backend
   **only** if ShipZip's checkout rates fail.
5. **Defer Options C/D** — a theme-side estimate preview (estimate only) and/or a
   Delivery-Customization tidy-up are optional later enhancements, not part of this
   audit's pricing solution.
6. **Invariants:** Kolkata/local only · PAN India unchanged · `4-hour-delivery`
   separate and not offered to PAN India · no theme-side change to product/pincode
   filtering, MOV, date/slot, or ShipZip/SBZ/zipLogic internals.

### Confirmed configuration

**Origin:** **Beadon Street Shopify location** (distance measured from this
location's address; it must be a correct, complete address in Shopify).

**Distance slabs:**

| Distance band | Delivery charge |
|---|---|
| 0 – 5 km | ₹50 |
| 5.01 – 10 km | ₹70 |
| 10.01 – 15 km | ₹100 |
| 15.01 – 20 km | ₹150 |

*Open item to confirm with the merchant:* behaviour **beyond 20 km** within
Kolkata/local (e.g. not serviceable, a higher slab, or fall through to PAN
courier) — define this in ShipZip so addresses past the last slab are handled
predictably. MOV (₹300) interaction stays as ShipZip currently enforces it.

### Admin validation checklist

- [ ] **Beadon Street location** has the **correct full address** in Shopify
      (Settings → Locations: street, area, city, PIN).
- [ ] **ShipZip uses Beadon Street as the origin** for the `Order Distance` rates.
- [ ] **Same-country requirement satisfied** — the India shipping zone is
      configured and origin (Beadon Street) and destination are both in India, so
      Shopify requests the carrier rate and `Order Distance` can compute.
- [ ] **Rates appear at checkout for a Kolkata address** across the slab bands
      (spot-check e.g. ~3 km, ~8 km, ~13 km, ~18 km → ₹50 / ₹70 / ₹100 / ₹150).
- [ ] **PAN India remains unaffected** — a PAN India (non-Kolkata) address still
      gets the existing PAN India shipping, not the distance slabs.
- [ ] **`4-hour-delivery` is hidden / not available for PAN India** — confirm it is
      not offered to PAN India and stays QC/Kolkata-only.

---

## 5. Data flow

**Confirmed (Option A) — ShipZip owns the trusted price:**

```
 customer enters/selects full Kolkata delivery address at checkout
        ▼
 Shopify sends the CarrierService rate request (origin = Beadon Street location, destination address, items) to ShipZip
        ▼
 ShipZip `Order Distance` tier computes origin→destination distance and maps it to the slab
        (0–5 ₹50 · 5.01–10 ₹70 · 10.01–15 ₹100 · 15.01–20 ₹150)
        ▼
 Shopify displays / CHARGES that ShipZip rate   ← trusted, final
        ▼
 PAN India → existing PAN India shipping (unchanged) · 4-hour-delivery → its own QC/Kolkata-only flow (never PAN India)
```

No theme Google call, key, or cart-attribute is involved in pricing.

**Optional, later (Option C preview — estimate only, NOT in this PR):**

```
 address → geocode → Routes API computeRouteMatrix (server-proxied) → slab → "Estimated: ~X km · ₹Y"
 (display only; clearly labelled estimate; the CHARGED price still comes from ShipZip)
```

---

## 6. Security notes

- **No Google API key is required for the confirmed path.** Option A (ShipZip)
  needs **no** Google API, key, or Maps script in the theme — so there is no
  client-side key exposure to manage for pricing.
- **The following applies only IF Option C (theme preview) is added later:** the
  Google API key must be **server-side only** (backend env var / secret manager,
  IP/referrer-restricted, field-masked) — never in Liquid/JS/CSS. Any client-side
  Places Autocomplete must use a **separate, referrer-restricted, Places-only**
  key, and pricing must **never** depend on it.
- **No trusted pricing from localStorage or cart attributes.** Any theme-side
  pincode/distance/fee is **preview/record only** and user-editable; the charged
  price is always **ShipZip's**.
- **Frontend estimate (if ever added) is preview only** — labelled "estimated",
  visually distinct, never written back as the charged amount or used to gate
  checkout.
- **No new client deps / out of scope:** no Google Maps JS embed, no
  jQuery/Bootstrap/FontAwesome, no saved-address store, no hard redirects, no
  mobile-pincode-placement change.

---

## 7. Merchant / admin questions — status

| # | Question | Status |
|---|---|---|
| 1 | Distance-slab support in the app | ✅ **Confirmed** — ShipZip, Rate Tier `Order Distance`. |
| 2 | Dispatch origin | ✅ **Confirmed** — Beadon Street Shopify location. |
| 3 | Distance slabs & fees | ✅ **Confirmed** — 0–5 ₹50 / 5.01–10 ₹70 / 10.01–15 ₹100 / 15.01–20 ₹150. |
| 4 | `4-hour-delivery` scope | ✅ **Confirmed** — separate, QC/Kolkata-only, not for PAN India. |
| 5 | PAN India shipping | ✅ **Confirmed** — unchanged, existing logic. |
| 6 | Behaviour **beyond 20 km** (Kolkata/local) | ⬜ **Open** — define the >20 km outcome in ShipZip. |
| 7 | Carrier-rate / CCS eligibility | ⬜ **Verify via checkout** — if ShipZip rates show, it's active; else check plan/CCS with Shopify + ShipZip. |
| 8 | Beadon Street location address accuracy | ⬜ **Verify** — see admin validation checklist (§4). |

Remaining work is **admin configuration + validation** (§4 checklist), not theme
code.

---

## Strict-rules compliance (this PR)

Docs-only. **No** theme behaviour, **no** Liquid/JS/CSS, **no** Google API/key,
**no** Google Maps script, **no** backend, **no** checkout modification, **no**
saved addresses, **no** mobile pincode placement, and **no** change to
MOV/date-slot/shipping/app-logic or pincode/product filtering. The only artifact is
this file: `docs/distance-based-delivery-architecture.md`.

---

### Sources (platform facts verified during this audit)

- Shopify — CarrierService (rate request payload incl. `origin`/`destination`/`items`, 15-min cache): https://shopify.dev/docs/api/admin-rest/latest/resources/carrierservice
- Shopify Help Center — Third-party carrier-calculated shipping (Advanced plan / CCS add-on requirement): https://help.shopify.com/en/manual/fulfillment/setup/shipping-rates/third-party-carrier-calculated-shipping
- Shopify — Delivery Customization Function API (hide/rename/reorder only; no pricing): https://shopify.dev/docs/api/functions/latest/delivery-customization
- Google — Why migrate to Routes API (legacy Distance Matrix → Legacy status; only relevant to optional Option C): https://developers.google.com/maps/documentation/routes/migrate-routes-why
- Google — Compute a Route Matrix (`computeRouteMatrix`): https://developers.google.com/maps/documentation/routes/compute_route_matrix

*Audit only — no code changed. Theme/app facts verified on `local-4x-migration`
and prior Phase 2.0 / 2.1c audits; ShipZip distance-slab support, origin and slabs
confirmed by the merchant on 2026-06-18; Shopify and Google platform facts verified
via official documentation (June 2026).*
