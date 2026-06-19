# Phase 2.10B — Checkout Feasibility & Delivery-Rules Audit

**Status:** Documentation / audit only. **No theme code, settings, checkout, or Google changes are made by this phase.**
**Repository:** `pixfortech/ganguram-shopify-theme` · **Base:** `local-4x-migration`
**Purpose:** Decide what is realistically possible *before* building any distance / pincode / zone delivery-rule engine, MOV enforcement, delivery-charge logic, or cart progress bar (planned for Phase 2.11).

> **One-line answer:** Display, advisory MOV/progress-bar UI, and admin/order *visibility* are safely doable in the theme today. **Hard** checkout enforcement (block checkout, dynamic delivery charge, address autofill) is **not** a theme capability and must live in a Shopify Function / shipping app / custom app, reading from a **shared admin-editable rule source (Shopify metaobjects recommended)**.

---

## 1. Executive summary

The delivery-location system built across Phases 2.1–2.10A is solid and self-contained: a single resolver (`window.GanguramZone`), customer-facing city/pincode labels, recent locations, Google Places pincode-finder, and **cart attributes** that already carry the selected pincode/zone to the order/admin. This gives us a strong, *advisory* foundation.

The new business requirement (MOV / delivery charge / free-delivery threshold by distance, zone, or pincode, plus a cart progress bar) splits cleanly into **two tiers**:

- **Tier A — Advisory (theme/cart, GO):** a pincode-aware **cart progress bar**, **MOV warning**, **free-delivery threshold** display, and a **soft** checkout-button gate. All bypassable by design, all driven by the already-selected pincode/zone + cart subtotal, all stored as cart attributes for admin visibility. The theme already ships a near-identical pattern (`<shipping-notice>` free-shipping bar), so this is low-risk.
- **Tier B — Enforcement (NOT theme, NO-GO for theme JS):** *guaranteeing* a minimum order, charging delivery by pincode/distance, blocking checkout, or auto-filling the checkout address. These cannot be done reliably or securely from theme JavaScript on standard Shopify. They require **Shopify Functions** (cart/checkout validation; delivery/payment customization), a **shipping app** (the old **SBZ** did exactly this), and/or a **custom app** — and some pieces require **Shopify Plus**. They must read rules from a source a Function/app can see (theme settings are *not* readable by Functions).

**Critical platform facts confirmed in this repo:**
- There is **no `layout/checkout.liquid`** → this store is **not on a checkout.liquid (legacy Plus) setup**; checkout is the hosted Shopify checkout. The theme cannot inject into it.
- **SBZ (ShippingApp)** and **zipLogic** — which historically provided MOV (₹300), checkout gating, delivery date/slot, and product availability — are **NOT currently embedded** in the 4.0 theme (confirmed by `docs/shipzip-popup-audit.md` and the absence of their snippets/embeds). Re-embedding SBZ is an **admin prerequisite** for any app-based checkout/charge enforcement.
- Cart attributes already work end-to-end and **do** appear on the order/admin.

**Bottom line:** **Decide the rule source of truth first** (Phase **2.11A** audit → **Shopify metaobjects** recommended), then build the **admin-configurable rule engine** that reads it (Phase **2.11B**), and **only then** build the **advisory cart progress bar + MOV UI in the theme** (Phase **2.11C**) on top of that decided source. Keep **hard enforcement and delivery charges** in a **Shopify Function and/or the SBZ shipping app** (a separate enforcement track that reads the same rules). Do **not** attempt checkout autofill, hard checkout blocking, or dynamic shipping price from theme JS.

---

## 2. Current delivery-location architecture (as built, 2.1–2.10A)

**Single source of truth:** `assets/ganguram-zone-resolver.js` → `window.GanguramZone`.

| Concern | Where | Notes |
|---|---|---|
| Pincode → zone classification | `ganguram-zone-resolver.js` (`classifyPincode`) | Pure, dependency-free. Zones: `kolkata`, `quick_commerce`, `pan_india` (+ reserved `not_serviceable`, `unknown`). |
| Selected location read/write | `getSelectedDeliveryLocation()`, `setSelectedPincode()`, `clearSelectedDeliveryLocation()` | Returns `{pincode, zone, label, isKolkata, isPanIndia, isQuickCommerce, isServiceable}`. |
| Persistence | `localStorage` | `Zipcode` (SBZ-compat raw pincode), `ganguram.deliveryLocation` (namespaced snapshot), `ganguram.recentLocations` (≤5), `ganguram.pincodeCityCache` (≤50). |
| Change signal | `ganguram:delivery-location-changed` | Drives product filter, menu visibility, 4-hour display, cart eligibility, cart attributes, enrichment. |
| Display-only refresh | `ganguram:delivery-label-updated` | Fired after city enrichment; surfaces re-render label only (no business logic, no loop). |
| Customer-facing label | `ganguram-display-label.js` | One helper; shows `City Pincode` / `Kolkata <pin>`; never exposes `Quick Commerce`/`PAN India`. |
| City enrichment | `ganguram-pincode-enrich.js` + `ganguram-places-address-search.js` | Google Geocoding, fail-open, display only, cached. **Never used for eligibility.** |
| Cart handoff | `ganguram-cart-attributes.js` + `…-config.liquid` | Writes 5 cart attributes (see §4) via `/cart/update.js`. Debounced, idempotent, fail-open, pre-checkout flush. |
| Cart eligibility (remove ineligible lines) | `ganguram-cart-eligibility.js` | Warn-first; Keep/Change/Continue + undo. Theme-owned. |

**Checkout button:** `snippets/cart-subtotal.liquid` →
`<button id="CheckOut" type="submit" name="checkout" form="cart">`. It can be observed and *soft*-disabled, but its submit goes to Shopify's hosted checkout.

**Existing free-shipping bar (important precedent):** `<shipping-notice data-free-shipping=… data-cart-total-amount=…>` + `component-shipping-notice.js`, gated by `settings.cart_free_shipping` / `settings.cart_free_shipping_amount`. This is exactly the *display-only progress-bar* pattern Phase 2.11C would mirror for pincode-aware MOV/free-delivery.

**Not present (admin prerequisites for enforcement):** `SBZ ShippingApp` (MOV/date-slot/checkout gate, ex-`sbz.cirkleinc.com`), `zipLogic` (product availability, ex-`/a/zipLogic` + `shop.metafields.zipLogic.*`), `layout/checkout.liquid`.

---

## 3. What is possible in theme / cart (GO, advisory)

Pure theme + cart UI, all driven by the already-available `GanguramZone` selection + `cart` object:

- ✅ **Cart progress bar** toward a MOV and/or a free-delivery threshold, parameterised by the selected **zone/pincode** and the live **cart subtotal** (`cart.total_price`). Same mechanism as the existing `<shipping-notice>`.
- ✅ **MOV warning / "add ₹X more to order"** message in cart + drawer.
- ✅ **Show an estimated delivery charge / free-delivery message** for the selected zone (display only — it does **not** set the real shipping rate).
- ✅ **Soft checkout gate:** disable/intercept `#CheckOut` and show "minimum order ₹X for <city>" until subtotal ≥ MOV. *(Advisory — see §15 on why this is not enforcement.)*
- ✅ **4-hour eligibility messaging** by zone/time (already exists via `ganguram-4hour-delivery.js`).
- ✅ Read rules from an admin source at render time (theme settings → Liquid, or metaobjects → Liquid).

**Constraints:** everything here is **client-side and bypassable**; it must be framed to the customer as guidance, and the *real* rule must also exist server-side (Function/app) if it must be guaranteed.

---

## 4. What is possible via cart attributes (GO, visibility)

The theme already writes these 5 attributes via `POST /cart/update.js { attributes: … }` (`ganguram-cart-attributes.js`):

| Attribute key | Example | Notes |
|---|---|---|
| `Delivery Pincode` | `700001` | raw pincode |
| `Delivery Zone` | `quick_commerce` | **internal** zone (business value) |
| `Delivery Zone Label` | `Quick Commerce` | internal label (business value) |
| `Delivery Location Source` | `manual` / `google_places` | coarse source |
| `Delivery Address Summary` | `Kolkata, West Bengal` | safe city/state only |

**Confirmed capabilities:**
- ✅ **Cart attributes flow to the order** and are visible in **Shopify admin** (order → *Additional details*), in the **Order Liquid/printable**, the **Orders API/GraphQL**, **Flow**, and **exports**. So pincode/zone/city already travel to admin/order today. *(Answers Q1: yes.)*
- ✅ We can add **advisory** attributes later (e.g. `MOV Met: yes/no`, `Delivery Charge (display): ₹40`) for admin visibility — but these are **informational**, not enforced.

**Limits:**
- ⚠️ Attributes are **not** a security boundary — a buyer can alter the cart; never treat an attribute as proof a rule was satisfied.
- ⚠️ **Express/dynamic checkout buttons** (`content_for_additional_checkout_buttons`: Shop Pay, PayPal, etc.) can **bypass the cart page**, so the pre-checkout attribute flush is best-effort for those.

---

## 5. What is possible in normal Shopify checkout (mostly NO from theme)

| Want | Standard Shopify, from theme? | Reality |
|---|---|---|
| Selected pincode/zone visible on order/admin | ✅ Yes | Via cart attributes (already done). |
| Auto-fill checkout shipping address from theme JS | ❌ No | Hosted checkout is isolated; the theme cannot script it. Cart permalinks (`/cart/…?checkout[shipping_address][zip]=`) are **unofficial, fragile, and ignored by one-page checkout** → do not rely on. *(Answers Q2: no.)* |
| Block checkout if pincode invalid | ❌ Not reliably | The theme can *soft*-block the button, but `/checkout` and express buttons bypass it. A **guaranteed** block needs a **Checkout Validation Function**. *(Answers Q3: only soft in theme; hard requires a Function/app.)* |
| Enforce MOV *before* checkout | 🟡 Advisory only | Theme progress bar + soft gate (bypassable). *(Answers Q4: advisory yes, guaranteed no.)* |
| Enforce MOV *inside* checkout | ❌ Not from theme | Needs a **Cart/Checkout Validation Function**. *(Answers Q5.)* |
| Change delivery **charge** by pincode/distance | ❌ Not from theme | Shipping price is set by shipping profiles / a shipping app / Carrier Service — never by theme JS. *(Answers Q6.)* |

---

## 6. What requires Shopify Plus / checkout extensibility / Functions / a custom app

*(Plan/entitlement details change over time — treat the "Plus?" column as "confirm with the merchant's plan & Shopify docs before building.")*

| Capability | Mechanism | Delivered via | Plus required? |
|---|---|---|---|
| **Hard MOV block at checkout** (and "pincode required/serviceable") | **Cart & Checkout Validation Function** | A **custom app** (Shopify CLI), deployed to the store | Generally **no** (validation functions are broadly available) — **confirm** |
| **Dynamic delivery charge by zone/pincode** | Shipping **app** providing rates (what **SBZ** did) **or** Carrier Service API **or** manual shipping profiles (coarse) | App / shipping profiles | Carrier-Calculated Shipping historically **Advanced/Plus or annual** — **confirm** |
| **Hide / rename / reorder delivery options** at checkout | **Delivery customization Function** | Custom app | Delivery & payment **customizations** historically **Plus** — **confirm** |
| **Custom checkout UI** (banners, fields in checkout) | **Checkout UI extensions** | Custom app | Some checkout extensibility is **Plus**-gated — **confirm** |
| **Editing `checkout.liquid`** | Legacy checkout | — | **Plus only** (and deprecated; not present here) |
| **True distance-from-outlet pricing** | Geocode pincode → distance → rate | App / Function + data | App territory regardless of plan |

*(Answers Q9: yes — validation functions handle MOV. Q10: yes — delivery customization functions can change/hide/rename shipping options, but cannot set an arbitrary price; pricing needs a rate app/Carrier Service. Q11 is this whole table.)*

---

## 7. ShipZip / SBZ feasibility questions

SBZ previously delivered **MOV (₹300), checkout gating, and delivery date/slot**, loaded from `sbz.cirkleinc.com` via an app embed + `SbzShippingAppCode.liquid` (now absent — see `docs/shipzip-popup-audit.md`). It is the **fastest path to checkout-side enforcement + delivery charges** *if* re-embedded and *if* its capabilities match. Open questions to answer with the SBZ vendor/admin **before** choosing it as the rule engine:

1. **Re-embed:** Will SBZ be re-installed/embedded on the 4.0 theme (admin task)? Without it, none of its rules apply.
2. **MOV granularity:** Single global MOV (₹300) only, or **per-zone / per-pincode / per-distance** MOV?
3. **Delivery charge:** Can it set **rate-by-pincode/zone** (and a **free-delivery threshold** per zone)? Does it support **distance-based** rates, or only zip lists?
4. **Checkout enforcement:** Does it **hard-block** checkout below MOV (server-side), or only show a cart-page message?
5. **Source of truth:** Is its config editable by the merchant in the SBZ dashboard, and can the theme **read** the same numbers (for the progress bar) — or is it a **separate silo** we'd have to duplicate?
6. **Pincode model:** Does SBZ use the **same pincode lists** as `GanguramZone`, or its own? (Divergence = two sources of truth = bugs.)
7. **Selected-pincode handoff:** Does SBZ read `localStorage["Zipcode"]` (we already mirror it) or its own widget? We deliberately kept the `Zipcode` key for compatibility.
8. **Date/slot + 4-hour:** Does SBZ own delivery date/slot, and does it respect our 4-hour eligibility window?

**zipLogic** (product availability) is a separate, also-absent app; out of scope for MOV/charge but noted because re-embedding it would re-introduce its own pincode source — coordinate to avoid conflicting with `GanguramZone`.

---

## 8. Distance / MOV / delivery-charge — rule-source recommendation

Required rule model fields (per the brief):

```
DeliveryRule {
  match:    selected pincode | pincode-range/prefix | internal zone (kolkata/quick_commerce/pan_india)
  context:  city/state (display), distance_from_outlet (optional, later)
  values:   min_order_value
            delivery_charge
            free_delivery_threshold (optional)
            four_hour_eligible (bool)
            serviceable (bool)         // eligibility STAYS from GanguramZone; this is a guard, not the source
  meta:     priority/specificity, default/fallback rule
}
```
Plus a **default/fallback** rule (e.g. PAN-India: higher MOV, flat/である charge, no 4-hour).

### Option comparison

| # | Source | Admin-editable | Readable by **theme (Liquid)** | Readable by **Functions/app** | settings_data.json churn | Structure / scale | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | **Theme settings — simple slab fields** | ✅ theme editor | ✅ | ❌ | ⚠️ writes to `settings_data.json` (syncs via GitHub) | Low (a few zones × few numbers) | **MVP only** for theme-advisory; dead-end for Function enforcement |
| 2 | **Theme setting — JSON rule table** (textarea) | ✅ (but error-prone) | ✅ (parse) | ❌ | ⚠️ same | Medium, **fragile** (merchant breaks JSON) | **Discouraged** |
| 3 | **Shopify metaobjects / metafields** | ✅ admin → Custom data | ✅ (`shop.metaobjects…`) | ✅ | ✅ none | High, structured, per-zone/per-pincode | **★ Recommended** — single source for theme **and** Function |
| 4 | **App / admin backend** | ✅ (custom UI) | via app proxy/API | ✅ | ✅ none | Highest (distance, big tables, dashboards) | **For distance + hard enforcement (enforcement track / app)** |
| 5 | **ShipZip / SBZ config** | ✅ (SBZ dashboard) | ❌ (separate silo) | n/a (own engine) | ✅ none | Vendor-defined | **Reuse for charges/checkout IF re-embedded & capable** (see §7) |
| 6 | **Shopify Functions / custom app** | depends on config store | — | ✅ | ✅ none | High | **Enforcement mechanism**, not a data store — pair with #3 |

**Recommendation:** **Metaobjects (#3) as the single rule source of truth.** They are admin-editable with no code, create **no `settings_data.json` churn**, and — uniquely — are readable by **both** the theme (for the advisory progress bar) **and** a Shopify Function (for hard enforcement). Start with a **small slab** of theme settings (#1) only if a same-day MVP is needed, but plan to migrate to metaobjects so the theme and the enforcement layer never diverge. **Distance** (#4/app) is deferred — start zone/pincode-slab based (see `docs/distance-based-delivery-architecture.md`).

---

## 9. Recommended architecture for Phase 2.11

**Sequencing principle:** decide the **source of truth → build the rule engine → build the UI**. The cart progress bar is built **last**, on top of an already-decided rule source, so the theme UI and any future Function never show different numbers.

### Phase 2.11A — Delivery rule **source-of-truth** audit & decision *(docs/decision only)*
- Confirm the rule model (§8) and **choose the source**: recommendation is **Shopify metaobjects** (admin-editable, no `settings_data.json` churn, readable by **both** theme Liquid **and** a future Function). Decide MVP vs target.
- Answer the **SBZ questions (§7)**: will SBZ be re-embedded, and can it own MOV/charge? This decides whether enforcement is **SBZ** vs a **Function**.
- **Output:** the `ganguram_delivery_rule` schema (fields per §8) + a GO source decision. **No code.**

### Phase 2.11B — Admin-configurable **rule engine** *(build the source + a read path; still no UI, no enforcement)*
- Create the chosen rule store (recommended: a `ganguram_delivery_rule` **metaobject** definition) + a **default/fallback** entry; seed Kolkata / Quick-Commerce / PAN-India rows.
- Expose the rules to the theme **read-only** via Liquid, and document the **same** definition so a Function/app can read it identically.
- Deliverable is the **editable rules + a clean read API** — no progress bar, no checkout change.

### Phase 2.11C — Cart **progress bar** + MOV advisory *(theme UI, built AFTER 2.11A/B)*
- New scoped module (mirrors the existing `<shipping-notice>` pattern) that reads the **selected zone/pincode** (`GanguramZone`) + **cart subtotal** + the **2.11B rules**, and renders: progress toward **MOV** and/or **free-delivery threshold**, an "add ₹X more" message, and the **zone's delivery charge (display only)**.
- **Soft** checkout-button gate below MOV with an honest "advisory" message ("Minimum order ₹X for <city>"). Never claims to be a hard block.
- Optionally write advisory cart attributes (`MOV Met`, `Delivery Charge (display)`) for admin visibility. Fail-open if rules are missing.
- **Boundaries:** display/advisory only; no real shipping price; no checkout injection; bypassable by design.

### (Parallel / later) **Enforcement track** — Function / SBZ *(NOT theme)*
- **Hard MOV + "serviceable pincode required"** → **Cart/Checkout Validation Function** in a **custom app**, reading the 2.11B rules.
- **Delivery charge by zone/pincode (and free-delivery threshold)** → **re-embed SBZ** (fastest, if §7 fits) **or** a Carrier Service / shipping app **or** coarse shipping profiles.
- **Distance-based** rules → app/Function with geocoded pincode→distance (later; see distance doc).
- Confirm plan entitlements (validation vs delivery-customization vs CCS) before building.

**Guiding principle:** the theme is the **advisory/UX layer**; the **metaobject is the shared truth**; the **Function/app is the enforcement layer**. Same numbers everywhere, enforced exactly once (server-side).

---

## 10. GO / NO-GO decisions

### ✅ GO (safe now / next)
- **GO** — Cart **progress bar** + **MOV advisory** + **free-delivery threshold** display in the theme (Phase 2.11C, after the source exists). *(Q12, Q13.)*
- **GO** — **Soft** checkout-button gate with an honest "advisory" message.
- **GO** — Store **advisory** delivery info as **cart attributes** for admin/order visibility (extends what already works). *(Q1, Q14.)*
- **GO** — **Admin-editable rule table via Shopify metaobjects** as the single source of truth (Phase 2.11B). *(Q16.)*
- **GO** — Keep **eligibility/zone** strictly from `GanguramZone` (Google city stays display-only).

### ⛔ NO-GO (not from theme; needs app / Functions / shipping app / Plus — confirm)
- **NO-GO (theme)** — **Checkout address autofill** from theme JS. *(Q2.)*
- **NO-GO (theme)** — **Hard checkout block** / guaranteed MOV at checkout → **Checkout Validation Function**. *(Q3, Q5, Q9.)*
- **NO-GO (theme)** — **Dynamic delivery charge** by pincode/distance → shipping app (SBZ) / Carrier Service / Function. *(Q6, Q7, Q8, Q10.)*
- **NO-GO (theme)** — **Distance computation for eligibility/pricing** → app/Function with geodata.

### 🚫 Do **NOT** attempt from theme JavaScript *(Q15)*
- Setting or overriding the **real shipping/delivery price**.
- Any code that **claims** to "block checkout" as a guarantee (it is bypassable).
- Writing into / scripting the **hosted checkout**, or relying on checkout-permalink address params.
- Using **Google** results (city/distance) to decide **eligibility, MOV, or charge** — those stay with `GanguramZone` / the rule source.
- Putting the **rule source only in theme settings** if checkout-side enforcement is intended (Functions can't read theme settings).

---

## Answers to the 16 audit questions (quick reference)

| # | Question | Answer |
|---|---|---|
| 1 | Pincode/city/zone in checkout/order/admin? | **Yes**, via cart attributes (already live). |
| 2 | Auto-fill checkout address from theme? | **No** (hosted checkout; permalinks unreliable). |
| 3 | Block checkout if pincode invalid? | **Soft** in theme (bypassable); **hard** = Validation Function. |
| 4 | Enforce MOV **before** checkout? | **Advisory** yes; guaranteed no. |
| 5 | Enforce MOV **inside** checkout? | **Validation Function** (app). Not theme. |
| 6 | Delivery charge dynamic by pincode/distance? | Not theme. Shipping app / Carrier Service / Function. |
| 7 | Distance MOV/charge via ShipZip/SBZ? | Possibly — **re-embed + confirm capabilities** (§7). |
| 8 | Distance MOV/charge via shipping profiles? | Only **coarse** (zone/price/weight tables); no true distance. |
| 9 | Functions for cart/checkout MOV validation? | **Yes** (Cart/Checkout Validation Function). |
| 10 | Functions for delivery-option changes? | **Yes** to hide/rename/reorder; **not** arbitrary pricing. |
| 11 | What needs Plus / extensibility / Functions / app? | §6 table (confirm entitlements). |
| 12 | What's safe in theme/cart only? | Progress bar, MOV advisory, soft gate, attributes (§3–4). |
| 13 | What stays warning/progress-bar only? | All theme MOV/charge UI (advisory). |
| 14 | What can be cart attributes for admin? | Pincode/zone/label/source/summary (+ advisory MOV/charge). |
| 15 | What must NOT be done from theme JS? | §10 "Do NOT attempt" list. |
| 16 | Safest architecture for 2.11? | Theme advisory + **metaobject truth** + Function/app enforcement (§9). |

---

## Final recommendation

The recommendation maps 1:1 to the questions asked:

1. **What can be done now in cart/theme safely:** a pincode-aware **cart progress bar**, **MOV "add ₹X more" warning**, **free-delivery threshold** display, **estimated delivery charge (display)**, and a **soft** checkout-button gate. All advisory, all bypassable, all fail-open. **GO** — but build it as **Phase 2.11C**, *after* the rule source exists.

2. **What can only be stored as cart/order attributes:** the selected **pincode, internal zone, zone label, source, and city/state summary** (already live), plus optional advisory **`MOV Met` / `Delivery Charge (display)`**. These give visibility but are **not** an enforcement boundary.

3. **What can appear in Shopify order/admin:** all of the above cart attributes — visible on the order's *Additional details*, in Order Liquid, the Orders/GraphQL API, Flow, and exports. **Confirmed GO** (working today).

4. **What cannot be enforced from theme JavaScript:** hard **MOV enforcement**, **blocking checkout**, **dynamic delivery charge**, **checkout address autofill**, and **distance-based pricing/eligibility**. Bypassable or impossible from the theme → **NO-GO (theme).**

5. **What ShipZip/SBZ must handle if possible:** **delivery charge by pincode/zone**, **checkout-side MOV / gating**, and **delivery date/slot** — **only if SBZ is re-embedded and its capabilities fit** (answer the §7 questions first). If SBZ cannot do per-zone / per-pincode / distance rules, that work moves to a **Shopify Function / custom app**.

6. **What requires Shopify Functions / custom app / Shopify Plus:** **hard MOV/serviceability** → **Cart/Checkout Validation Function** (custom app); **changing/hiding delivery options** → **Delivery customization Function** (likely **Plus** — confirm); **custom checkout UI** → **Checkout UI extensions** (some **Plus**-gated); **real-time rate-by-distance** → **Carrier Service / shipping app**. Confirm plan entitlements before building.

7. **Best admin-editable rule source (if SBZ can't own it):** **Shopify metaobjects — recommended.** Admin-editable with no code, **no `settings_data.json` churn**, and readable by **both** the theme (progress bar) **and** a Function (enforcement) — one source, enforced once. Ranking: **metaobjects ★ > custom app/backend** (only if you need true distance / very large pincode tables / dashboards) **> theme settings slab** (throwaway MVP only) **> theme JSON-in-a-textarea setting** (discouraged: fragile, not Function-readable). **ShipZip/SBZ config** is acceptable for SBZ's *own* enforcement silo but is **not** a shared source the theme can read.

8. **Should the cart progress bar be built in the theme — after the rule source is decided?** **YES.** Build it in the theme, but **only after** Phase 2.11A decides the source and Phase 2.11B stands it up, so the bar reads the same rules a future Function will enforce. Building the bar *before* the source is decided risks hardcoding numbers that later diverge from checkout.

### Recommended next phases
- **Phase 2.11A — Delivery rule source-of-truth audit & decision** *(docs/decision)*: pick **metaobjects**, define the `ganguram_delivery_rule` schema, and answer the SBZ §7 questions. **No code.**
- **Phase 2.11B — Admin-configurable rule engine** *(build)*: create + seed the metaobject rules and a read-only Liquid read path; document the same definition for a Function. **No UI, no enforcement.**
- **Phase 2.11C — Cart progress bar + MOV advisory** *(theme UI)*: build the advisory bar + soft gate on top of 2.11B. **Advisory only.**
- **(Parallel / later) Enforcement track**: Validation Function for hard MOV/serviceability; SBZ / Carrier Service for charges. **Not theme.**

---

### Related docs
- `docs/pincode-architecture-audit.md` — legacy vs 4.0; why the clean resolver came first.
- `docs/zone-resolver-spec.md` — the `GanguramZone` contract.
- `docs/shipzip-popup-audit.md` — SBZ/zipLogic not embedded; re-embed is an admin task.
- `docs/distance-based-delivery-architecture.md` — prior thinking on distance zones (feeds the enforcement track).
- `docs/separate-kolkata-delivery-from-4hour.md` — zone matrix & 4-hour split.
- `docs/google-places-address-search-audit.md` — Google usage boundaries (display-only).

> **Scope reminder:** This phase changed **no** theme code, settings, checkout, ShipZip/SBZ/zipLogic, Google code, pincode lists, or `settings_data.json`. It is an audit document only.
