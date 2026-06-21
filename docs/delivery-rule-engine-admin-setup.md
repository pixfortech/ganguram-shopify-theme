# Delivery Rule Engine — Admin Setup (Phase 2.11B)

This guide explains how a store admin creates the **admin‑configurable delivery rules** that the theme reads. It accompanies the Phase 2.11B foundation:

- `snippets/ganguram-delivery-rules-config.liquid` — reads the rules and publishes `window.GanguramDeliveryRulesConfig`.
- `assets/ganguram-delivery-rules.js` — `window.GanguramDeliveryRules` (`getRules`, `resolve`, `getProgressData`, `formatMoney`).

> **Phase 2.11B is foundation only.** Creating these rules does **not** change anything customers see yet — there is **no progress bar, no MOV enforcement, and no checkout/charge change**. The UI that uses these rules is **Phase 2.11C**. Until the metaobject exists, the theme reads an empty rule set and everything **fails open** (no errors).
>
> **Source-of-truth decision:** Phase 2.11A chose **Shopify metaobjects**. The theme reads them **directly** via `shop.metaobjects.ganguram_delivery_rule.values` — **no shop metafield is required for the theme**. (The shop metafield `shop.metafields.ganguram.delivery_rules` is only needed later for a Shopify Function / app — see §3.)
>
> **Model update (state + distance/radius):** rules now also support a **default PAN India MOV**, **per‑state overrides**, and a **local‑delivery radius** (treat a Google address within *N* km of the outlet as local/Kolkata; beyond it, as PAN India even if the pincode is in West Bengal). See **§2a** for the resolution order, and **§2b** for how a distance is supplied.
>
> **Phase 2.11D update (pincode estimate vs full‑address distance):** the theme now **actually computes** the driving distance for a **selected full address** (Google Distance Matrix), so the radius/band tiers in §2a are **live** for address selections. A **pincode‑only** selection stays an **estimate** (no distance ⇒ zone/prefix rules) and the cart shows estimated MOV/delivery guidance; a **full address** is **confirmed** (driving distance ⇒ distance slabs). This needs one new setting (**outlet origin**) and the **Distance Matrix API** — see **§2d**. Customers are **never forced** to enter a full address before checkout.

---

## 1. Create the `ganguram_delivery_rule` metaobject definition

**Shopify admin → Settings → Custom data → Metaobjects → Add definition.**

1. **Name:** `Ganguram Delivery Rule`.
2. **Type:** confirm the generated type is exactly **`ganguram_delivery_rule`** (lowercase, underscores). The theme reads this exact type — if it differs, the theme will simply find no rules (fail‑open).
3. **Options → Storefront access:** **enable "Storefront" (web) access.** This is required for the theme/Liquid to read the entries.
4. Add the fields below (use these **exact field keys** — the theme reads them by key).

### Field definitions

| Field name (label) | **Key** (exact) | Type | Required | Notes |
|---|---|---|---|---|
| Name | `name` | Single line text | ✅ | Admin label, e.g. "Kolkata", "Quick Commerce", "PAN India", "Default". |
| Active | `active` | True/false (boolean) | ✅ | Uncheck to disable a rule without deleting it. (Missing ⇒ treated as active.) |
| Priority | `priority` | Integer | – | Tie‑breaker within a tier; **higher wins**. Default 0. |
| Zone key | `zone_key` | Single line text | – | One of `kolkata`, `quick_commerce`, `pan_india`, a future zone key, or blank/`default` for the catch‑all. |
| Exact pincode | `exact_pincode` | Single line text | – | One or more exact pincodes, **comma‑separated** (e.g. `700020, 700019`). |
| Pincode prefix | `pincode_prefix` | Single line text | – | One or more prefixes, comma‑separated (e.g. `7000, 711`). Longest match wins. |
| City | `city` | Single line text | – | Optional, display/reference only. |
| State | `state` | Single line text | – | A state name (e.g. `West Bengal`). Doubles as a **state match value** (case‑insensitive) and display. |
| State key | `state_key` | Single line text | – | State match by code(s), comma‑separated (e.g. `WB`). Case‑insensitive. |
| State name | `state_name` | Single line text | – | State match by full name(s), comma‑separated (e.g. `West Bengal, Bengal`). Case‑insensitive. |
| Local radius (km) | `local_radius_km` | Decimal | – | If a Google address is **within** this many km of the outlet, the rule is treated as **local/Kolkata**. Used only when a distance is available (smallest radius wins). |
| Distance min (km) | `distance_min_km` | Decimal | – | Distance **band** lower bound (km). Used only when a distance is available. |
| Distance max (km) | `distance_max_km` | Decimal | – | Distance **band** upper bound (km). Used only when a distance is available. |
| Minimum order value | `min_order_value` | Decimal | – | In **rupees** (e.g. `300`). The theme converts to paise. |
| Delivery charge | `delivery_charge` | Decimal | – | In **rupees** (display only in the theme). |
| Free delivery threshold | `free_delivery_threshold` | Decimal | – | In **rupees**; subtotal at/above which charge is waived. Optional. |
| 4‑hour eligible | `four_hour_eligible` | True/false (boolean) | – | Whether 4‑Hour delivery applies for this rule. |
| Customer message | `customer_message` | Single line text | – | Optional message the 2.11C UI may show. |
| **Service type** | `service_type` | Single line text | – | The delivery **service** this rule is for: `standard` or `four_hour` (blank ⇒ `standard`). Create **one rule per service** for a slab to offer both. |
| **Service label** | `service_label` | Single line text | – | Customer‑facing service name, e.g. `Standard delivery`, `4‑hour delivery`. |
| **Date picker required** | `date_picker_required` | True/false (boolean) | – | `standard` ⇒ **true** (customer picks a date); `four_hour` ⇒ **false**. |
| **Default date offset (days)** | `default_date_offset_days` | Integer | – | Default delivery date offset from today (e.g. `1` = tomorrow). `0` is kept (same‑day). |
| **Requires 4‑hour‑eligible cart** | `requires_four_hour_eligible_cart` | True/false (boolean) | – | Set **true** on `four_hour` rules. The option is shown only when the cart is 4‑hour‑eligible (see §2c). |
| **Cart‑value message** | `customer_message_for_cart_value` | Single line text | – | Optional message about the order value / MOV for this service. |
| **Delivery‑date message** | `customer_message_for_delivery_date` | Single line text | – | Optional message about the delivery date for this service. |

> **Money fields must be `Decimal` in rupees.** The theme reads them as numbers and multiplies by 100 to get paise. Do **not** use a `Money` field type — its Liquid value is an object and won't serialize here.

---

## 2. Create rule entries

**Settings → Custom data → Metaobjects → Ganguram Delivery Rule → Add entry**, one entry per rule. Fill the fields; leave anything not relevant **blank**.

### Example entries

*(Numbers below are **illustrative** — set your real MOV / charge / thresholds.)*

**A. Local delivery by radius** *(address‑based local/Kolkata — req #4/#5)*
- `name`: `Local (within 20 km)` · `active`: ✓ · `priority`: `0`
- `local_radius_km`: `20`  ·  `zone_key`: `kolkata` *(label only)*
- `min_order_value`: `300` · `delivery_charge`: `40` · `free_delivery_threshold`: `600` · `four_hour_eligible`: ✓
- *Applies when a Google address is within 20 km of the outlet. Add tighter rules (e.g. `local_radius_km: 5`) for nearer free/cheaper delivery — the **smallest** radius that still contains the address wins.*

**B. Kolkata pincodes (manual fallback)** *(pincode‑based local — req #3/#7)*
- `name`: `Kolkata pincodes` · `active`: ✓ · `priority`: `0`
- `pincode_prefix`: `700, 711`
- `min_order_value`: `300` · `delivery_charge`: `40` · `free_delivery_threshold`: `600`
- *Used when a customer types a **pincode only** (no address ⇒ no distance). For **address** selections, the radius rule (A) decides local vs PAN India instead.*

**B2. Kolkata ZONE FALLBACK** *(makes the cart panel show today — see §2a callout)*
- `name`: `Kolkata (zone fallback)` · `active`: ✓ · `priority`: `0`
- `zone_key`: `kolkata` · `city`: `Kolkata` · `service_type`: `standard`
- **no** `local_radius_km` / `distance_min_km` / `distance_max_km` / `exact_pincode` / `pincode_prefix`
- `min_order_value`: `300` · `delivery_charge`: `40` · `free_delivery_threshold`: `600` · `date_picker_required`: ✓ · `default_date_offset_days`: `1`
- *Matches **any** Kolkata pincode when no distance is available. Add a `four_hour` twin (same fields, `service_type: four_hour`, `requires_four_hour_eligible_cart: ✓`) to also offer 4‑hour in the fallback. Distance/radius rules (A) still win once a distance exists.*

**C. Per‑state override** *(req #2)*
- `name`: `West Bengal` · `active`: ✓ · `priority`: `0`
- `state_name`: `West Bengal`  *(or `state_key`: `WB`)*
- `min_order_value`: `500` · `delivery_charge`: `80`

**D. PAN India default** *(req #1)*
- `name`: `PAN India` · `active`: ✓ · `priority`: `0`
- `zone_key`: `pan_india`
- `min_order_value`: `750` · `delivery_charge`: `120` · `free_delivery_threshold`: `1500`

**E. Exact‑pincode override** *(highest — wins over everything for that pincode)*
- `name`: `Park Street free delivery` · `active`: ✓ · `priority`: `10`
- `exact_pincode`: `700016`
- `min_order_value`: `250` · `delivery_charge`: `0` · `free_delivery_threshold`: `400` · `four_hour_eligible`: ✓

**F. Extra distance band (optional)** *(finer address‑based bands)*
- `name`: `20–50 km` · `active`: ✓
- `distance_min_km`: `20` · `distance_max_km`: `50`
- `min_order_value`: `600` · `delivery_charge`: `150`

**G. Global default / fallback** *(matches when nothing else does)*
- `name`: `Default` · `active`: ✓ · `priority`: `-100`
- `zone_key`: *(blank — or `default`)*; **no** pincode/prefix/state/distance/radius
- `min_order_value`: `750` · `delivery_charge`: `120`

Once these exist (with Storefront access on), the theme picks them up automatically on the next page load — no theme deploy needed.

---

## 2a. Rule resolution order (what wins)

The resolver picks the **first** matching tier (most‑specific‑wins); within a tier, higher `priority` wins:

1. **`exact_pincode`** — explicit per‑pincode rule (always highest).
2. **Distance mode** *(a distance is available **and** at least one radius/band rule exists)*:
   1. **`distance`** — the address falls inside a `distance_min_km..distance_max_km` band.
   2. **`local_radius`** — the address is within a `local_radius_km` (smallest radius wins) ⇒ **local/Kolkata**.
   - **Beyond every band/radius ⇒ the address is *remote*: prefix rules are skipped** and it falls through to state / PAN India **even if the pincode is in West Bengal** (req #6).
   - *Otherwise (manual pincode, or no radius/band rules configured):* **`prefix`** — longest matching `pincode_prefix`.
3. **`state`** — `state` / `state_key` / `state_name` matches the location's state.
4. **`zone`** — **ZONE FALLBACK** (until a Distance Matrix integration exists): a rule whose **only** criterion is `zone_key` = the selected **local** zone (`kolkata` / `quick_commerce`), with **no** pincode / prefix / state / radius / band. Non‑distance‑mode only.
5. **`pan_india`** — the PAN India default (`zone_key: pan_india`).
6. **`default`** — the global catch‑all.
7. **`none`** — nothing matched and no default exists (fail‑open; no UI shown).

> ### ⚠️ Make the cart panel show today (zone fallback)
> The cart currently knows only the **pincode** (e.g. `Kolkata 700006`); a **distance is not available yet** (that needs the future Distance Matrix — §2b). A rule that matches **only** by `local_radius_km` / `distance_min_km` / `distance_max_km` therefore matches **nothing** without a distance, so the panel stays hidden.
>
> **Fix:** add a **zone fallback rule** per local zone (and per service). For Kolkata standard:
> - `name`: `Kolkata (zone fallback)` · `active`: ✓ · `zone_key`: `kolkata` · `city`: `Kolkata`
> - **no** `local_radius_km`, `distance_min_km`, `distance_max_km`, `exact_pincode`, `pincode_prefix`
> - `service_type`: `standard` · `min_order_value`, `delivery_charge`, `free_delivery_threshold` as desired
>
> Add a matching `four_hour` zone-fallback rule if you want the 4‑hour option in the no‑distance fallback. Once a Distance Matrix integration supplies `distanceKm`, the **radius/band rules take priority** (tier 2) and this fallback is **skipped in distance mode**, so a far address never becomes "local" (req #6). The fallback does **not** change distance-band behaviour.

> **Manual vs address (req #3, #6, #7):** a *manual pincode* has no coordinates, so it uses `exact → prefix → state → zone fallback → PAN India`. A *Google address* has coordinates, so **distance/radius is authoritative** — within the radius it's local, beyond it it's state/PAN India.

## 2b. Where the distance comes from (Google Distance Matrix — Phase 2.11D)

`resolve()` / `getProgressData()` / `getServiceOptions()` accept an optional **`{ distanceKm }`** (km from the outlet to the selected address). **Phase 2.11D supplies it for full addresses:** when a customer picks a **Google address** in the popup search, `assets/ganguram-distance.js` computes the **actual driving distance** (Distance Matrix) from the outlet origin and **confirms** it, so the radius/band tiers in §2a activate for that selection.

A **pincode‑only** selection (manual entry, a recent/saved pincode) has **no coordinates**, so `distanceKm` stays absent and it resolves like before (`exact → prefix → state → zone fallback → PAN India`) — an **estimate**. So:

| Selection | Distance | Resolution | Cart shows |
|---|---|---|---|
| Manual / recent **pincode** | none (estimate) | `exact → prefix → state → zone → PAN India` | **Estimated** MOV + "enter your complete address for accurate options" |
| Google **full address** | driving km (confirmed) | distance **band / radius** tiers (§2a) | **Confirmed** MOV for the matched slab |

Setup (outlet origin + Distance Matrix API) is in **§2d**. If the origin is blank or the API isn't enabled, everything **fails open** to the pincode estimate — nothing breaks.

## 2c. Delivery service options (standard + 4‑hour)

A single slab can offer **multiple delivery services** — create **one rule per service**, all sharing the slab's match criteria (e.g. the same `local_radius_km`). Example for the 0–5 km slab:

**Standard** — `name`: `Kolkata 0–5 km Standard` · `local_radius_km`: `5` · `service_type`: `standard` · `service_label`: `Standard delivery` · `date_picker_required`: ✓ · `default_date_offset_days`: `1` · `min_order_value`: `300` · `delivery_charge`: `40`

**4‑hour** — `name`: `Kolkata 0–5 km 4‑hour` · `local_radius_km`: `5` · `service_type`: `four_hour` · `service_label`: `4‑hour delivery` · `date_picker_required`: ✗ · `requires_four_hour_eligible_cart`: ✓ · `four_hour_eligible`: ✓ · `min_order_value`: `500` · `delivery_charge`: `80`

`getServiceOptions(location, options)` returns the **best rule per service** for the location, so 2.11C can show both:

```js
// options: { distanceKm, state, fourHourEligibleCart }  — all optional.
// fourHourEligibleCart is true / false / undefined(unknown), from the existing
// 4-hour engine; it decides whether the 4-hour option is offered (see below).
var svc = window.GanguramDeliveryRules.getServiceOptions(location, { distanceKm: 3 });

// svc = {
//   reason,            // the resolved slab's reason (exact_pincode|prefix|distance|local_radius|state|zone|pan_india|default|none)
//   primary,           // the 'standard' option (or first), for the base MOV/progress display
//   fourHourEligibleCartKnown,  fourHourEligibleCart,
//   options: [ {        // standard first, then four_hour
//     serviceType, serviceLabel, reason, name, priority,
//     mov, deliveryCharge, freeDeliveryThreshold,         // paise or null
//     fourHourEligible, datePickerRequired, defaultDateOffsetDays,
//     requiresFourHourEligibleCart,
//     customerMessageForCartValue, customerMessageForDeliveryDate, message,
//     eligible          // true | null(unknown — requires a 4-hour-eligible cart)
//   }, ... ]
// }
```

**4‑hour eligibility (req #5 / #6):** a rule with `requires_four_hour_eligible_cart: true` is only offered when the cart qualifies for 4‑hour delivery (the existing 4‑hour engine decides this).
- Pass **`fourHourEligibleCart: false`** ⇒ the 4‑hour option is **dropped**.
- Pass **`fourHourEligibleCart: true`** ⇒ included with `eligible: true`.
- **Omit it (unknown)** ⇒ included with `eligible: null` and `requiresFourHourEligibleCart: true`, so **2.11C can filter it safely** once the cart's eligibility is known.

**PAN India** has no `four_hour` rule, so `getServiceOptions` returns **standard only** there. Everything is **display/advisory** and **fails open** (no rules ⇒ `options: []`).

---

## 2d. Pincode estimate vs full‑address driving distance (Phase 2.11D)

Phase 2.11D wires the **actual driving distance** into the cart so a **full address** gives a precise result while a **pincode** stays a quick estimate. It **reuses the existing Phase 2.9B Google key** (no new key) and **does not force** a full address before checkout.

### One‑time setup

1. **Theme settings → "Ganguram - Address search" → "Outlet origin (lat,lng) for driving distance"** (`ganguram_outlet_origin`). Enter your outlet's coordinates as `lat,lng` (e.g. `22.5726,88.3639`). **Leave blank to keep pincode‑only estimates** (the distance feature stays off — fail‑open).
2. **Google Cloud:** enable the **Distance Matrix API** on the **same browser key** used for the address search (`ganguram_places_api_key`). Keep the key restricted by **HTTP referrer** (your store domain) and to the APIs you use (Maps JavaScript + Places (New) + Geocoding + Distance Matrix).
3. Create the **distance band / `local_radius_km` rules** in §2 so the confirmed distance has slabs to match (e.g. `0–5`, `5.01–10`, `10.01–15`, `15.01–20` km). Keep the **zone‑fallback** rules (§2a) so the **pincode estimate** still shows a panel.

### How it behaves

- **Pincode‑only (estimate):** the cart identifies the city/zone from the pincode and shows **"Estimated minimum order:"** plus the note *"Delivery and minimum order are estimated from your pincode. For accurate delivery options, please enter your complete address."* Standard delivery continues on the pincode/zone/product rules. **No accurate distance is claimed from a pincode alone.**
- **Full address (confirmed):** on selecting a Google address, the theme computes the **driving distance** from the outlet origin and matches the **distance slab** (§2a tier 2). The cart shows **"Minimum order:"** (confirmed) and *"Delivery options confirmed for your address."* The result is the accurate one.
- **Every location change first drops to the estimate**, then an address selection re‑confirms the distance asynchronously — the cart re‑renders when it arrives (`ganguram:delivery-distance-updated`).
- **MOV / progress (both drawer + page):** below MOV ⇒ *"Minimum order for this delivery area is ₹MOV. Add ₹REMAINING more to continue."* and a **soft checkout guard** (cart‑side). MOV met ⇒ checkout proceeds.

### 4‑hour (quick‑commerce) eligibility messaging

4‑hour delivery is offered only when **location/distance/time qualify AND every cart line is quick‑commerce eligible** (the existing 4‑hour engine + cart attributes decide this):

- If the cart is **mixed** (a 4‑hour option would otherwise apply for this area), the cart shows: *"4‑hour delivery is not available because the following item(s) are not eligible for quick delivery: ITEM_NAMES."* — naming the offending lines from their cart‑line product titles, and the 4‑hour option is dropped (Standard remains).
- If **all** items are eligible, 4‑hour is shown **only if** the area/distance/time also qualify.

### Privacy & safety

`ganguram-distance.js` stores **only** the resulting `distanceKm` + pincode in `localStorage` (`ganguram.deliveryDistance`) — **never** the address or coordinates. It **never** changes Shopify checkout, the final shipping charge, ShipZip/SBZ/zipLogic, the pincode resolver, or `settings_data.json`. If the Distance Matrix call fails, times out (8 s), or the API isn't enabled, it **fails open** to the pincode estimate.

### Diagnosing a full address that stays "estimated" (2.11D.1 — DEV ONLY)

If a full address keeps showing the *estimated* message, turn on **debug** (no customer‑facing text changes): add **`?ganguram_debug=1`** to the URL, or run `localStorage.setItem('ganguram.debug','1')` in the browser console, then reselect the address and watch the console. `window.GanguramDistance.debugState()` prints `{ enabled, origin, store, selectedPincode, lastReason }`. Common `lastReason` values: `disabled` (outlet origin blank), `bad-origin` (lat,lng unparseable), `no-service` (Distance Matrix API not enabled on the key), `status-REQUEST_DENIED` (key/referrer/API restriction), `no-dest-coords` (the place had no location). 2.11D.1 also **geocodes the selected full‑address string** when the place's `location` field is missing, so a missing coordinate no longer silently falls back to the estimate.

---

## 2e. Product‑card "Add to cart" + "Buy now" (Phase 2.11D.1)

On **single‑variant** product cards the card now shows two buttons — **Add to cart** (adds + opens the cart drawer) and **Buy now** (express). **Multi‑variant** products are unchanged (they keep the theme's "Choose options" flow). It is wired in `snippets/quick-buy.liquid` (gated by a `show_buy_now` flag passed **only** from `snippets/product-item.liquid`, so every other quick‑buy usage is untouched) and driven by `assets/ganguram-product-card-buy.js`.

**Buy now respects the guard.** It reuses the theme's existing AJAX add, then:

- proceeds to **/checkout** only when the cart‑side **MOV / checkout guard allows** it;
- if the cart is **below MOV** (blocked), it opens the **cart drawer** with the minimum‑order notice instead of going to checkout;
- if the guard isn't loaded (unknown), it **never auto‑checkouts** — it opens the cart drawer / cart page.

It **does not** change Shopify checkout, the final shipping charge, ShipZip/SBZ/zipLogic, product availability, or the pincode zone visibility. Fail‑open.

---

## 3. (Later) Connect entries to `shop.metafields.ganguram.delivery_rules`

**Not required for the theme.** This step is only for the **future hard‑enforcement track** (a Shopify **Cart/Checkout Validation Function**, which reads metafields — not theme settings).

1. Create a **shop metafield** with namespace **`ganguram`**, key **`delivery_rules`**, type **List of metaobject → Ganguram Delivery Rule** (`list.metaobject_reference`).
2. Set its value to the rule entries you created in §2.
3. The Function's input query then reads `shop.metafields.ganguram.delivery_rules`, using the **same** entries the theme reads — one source of truth, enforced once.

Shop metafields are typically set via the GraphQL Admin API or an app (the admin UI for shop‑level metafields varies). The theme does **not** need this — it reads the metaobject directly.

---

## 4. How the cart UI (Phase 2.11C / 2.11D) reads this

The cart UI consumes the helper — it does **not** re‑read the metaobject itself:

```js
// cart.total_price is in PAISE; pass it directly. location defaults to the
// current GanguramZone selection when omitted. The 3rd arg (options) is optional;
// Phase 2.11D passes { distanceKm } for a CONFIRMED full address (§2b/§2d) and
// omits it for a pincode‑only estimate (resolves like a manual pincode entry).
var data = window.GanguramDeliveryRules.getProgressData(cartTotalPaise /*, location, { distanceKm } */);

// data = {
//   rule, reason,                 // reason: exact_pincode | prefix | distance | local_radius | state | zone | pan_india | default | none
//   cartSubtotal,                 // paise
//   mov, deliveryCharge, freeDeliveryThreshold,   // paise or null
//   fourHourEligible, message,
//   movMet, movRemaining,         // movRemaining in paise (0 when met / no MOV)
//   freeDeliveryMet, freeDeliveryRemaining        // null when no threshold
// }

if (data.mov != null && !data.movMet) {
  // "Add <X> more to order" — display only
  var more = window.GanguramDeliveryRules.formatMoney(data.movRemaining);
}
```

- `resolve(location, options)` returns just the matched rule + its values + `reason`; `options` may include `{ distanceKm, state }`.
- `getProgressData(cartSubtotal, location, options)` adds the cart‑relative numbers (remaining amounts, met flags).
- Everything is **display/advisory** in 2.11C and **fails open** (no rules ⇒ `reason: "none"`, null values, no UI shown).

---

## 5. What stays with ShipZip/SBZ or Shopify Functions (hard enforcement)

The theme rule engine is the **advisory/UX** layer. **Guaranteed** behavior is **not** the theme's job (see `docs/checkout-feasibility-and-delivery-rules-audit.md`):

- **Hard MOV / "serviceable pincode required" at checkout** → a **Cart/Checkout Validation Function** (custom app) reading `shop.metafields.ganguram.delivery_rules`.
- **Actual delivery‑charge collection** → **ShipZip/SBZ** (re‑embedded) or a **Carrier Service / shipping app**. The theme never sets the real shipping price.
- **Distance computation** (pincode→km) → app/Function with geodata; the `distance_*` fields are forward‑compatible placeholders only.

Internal **eligibility/zone stays with `GanguramZone`** — these rules never decide serviceability; the `active`/`serviceable`‑style fields are display hints only.

### 5a. Showing "4 Hours Delivery" as a real checkout rate (ShipZip) — Phase 2.11D.2

**Why the cart shows the 4‑hour message but checkout shows only "Delivery ₹50":** the cart UI is **advisory** — it cannot create a Shopify **checkout shipping rate**. Checkout rates come from your **shipping‑rate app (ShipZip)** + Shopify shipping settings. **The 4‑hour rate must exist and qualify in ShipZip.** The theme’s job is only to **hand the eligibility signal to the app**, which it now does.

**What the theme writes to the cart (2.11D.2)** — readable by the app at checkout (localStorage/DOM are **not**):

| Cart attribute | Value | Meaning |
|---|---|---|
| `ganguram_all_quick_commerce` | `true` / `false` / *(blank if cart empty)* | `true` only when **every** cart line has the **`Quick Commerce`** tag. |
| `ganguram_delivery_mode_candidates` | `standard` or `standard,four_hour` | `four_hour` is added only when all‑QC **and** a local (Kolkata / quick_commerce) zone is selected. |
| `ganguram_selected_pincode` | e.g. `700055` | The selected delivery pincode. |
| `ganguram_delivery_zone` | `kolkata` / `quick_commerce` / `pan_india` | The selected zone. |

**Configure ShipZip (admin) to USE them:**

1. Create a shipping rate **"4 Hours Delivery"** (its own price; this is the real rate — the theme never sets it).
2. Add a condition so it shows **only** for the 4‑hour case. Prefer, in order of reliability:
   - **Cart‑attribute condition** (if your ShipZip plan supports it): show when `ganguram_all_quick_commerce = true` **and** `ganguram_delivery_mode_candidates` contains `four_hour`. This is the **only** clean way to enforce *"every item is Quick Commerce"*.
   - **Zipcode condition:** restrict the rate to your Kolkata quick‑commerce pincodes (use `ganguram_selected_pincode` / the destination pincode).
   - **Product‑tag condition (fallback):** match the `Quick Commerce` tag — but most apps match *"cart **contains** a tagged item"*, which would wrongly show 4‑hour for **mixed** carts. Only use this if ShipZip offers an *"**all** items must match"* option; otherwise rely on the cart‑attribute condition above.
3. Keep the standard rate as‑is for everything else (mixed carts, non‑QC, PAN India) so unrelated shipping is unchanged.
4. The **date / slot picker** for the 4‑hour method is configured in your date/SBZ app **per delivery method** — the theme’s `date_picker_required` is advisory only.

**Acceptance maps to ShipZip, not the theme:** all‑QC cart ⇒ both rates show *(ShipZip rule on `four_hour`)*; mixed / non‑QC / PAN India ⇒ only standard *(condition fails — `ganguram_all_quick_commerce=false` or no `four_hour` candidate)*. If ShipZip **cannot** read cart attributes on your plan, the 4‑hour rate must be gated by **zipcode + an “all items match” product‑tag rule**, or by a **separate shipping profile** for the Quick‑Commerce products — there is no theme‑only way to add the checkout rate.

---

## 6. Cart delivery intelligence + error ownership (Phase 2.11E)

### Who handles what

| Layer | Owns |
|---|---|
| **Theme (cart)** | The **advisory** cart panel: "Delivering to *city + pincode · zone*", **accurate** MOV + progress bar + remaining amount (pincode/zone is the **primary source of truth**), delivery‑charge slab (or "confirmed at checkout"), eligible **modes** (Standard always; 4‑hour when all‑QC + local), and the **reason** a mode is hidden. Plus the cart‑attribute handoff (§5a) and the customer **message wording** (catalog). **Never** sets a checkout rate. |
| **ShipZip** | The **real checkout shipping rates** — "4 Hours Delivery" and "Standard / Next Day", their prices, zipcode/cart‑attribute conditions, and whether each is offered (§5a). |
| **Date / slot app (SBZ / date picker)** | The **delivery date & time‑slot** UI and validation **per delivery method** at checkout — Standard gets its date flow, 4‑hour gets its express/slot flow. The theme's `date_picker_required` / `default_date_offset_days` are advisory hints only. |

### Pincode is treated as accurate (not an estimate)
Once a pincode is known the cart shows accurate delivery info from the **pincode/zone rules** — the old "estimated… please enter your complete address" text is **retired**. A full Google address is used only to **refine the distance slab** (supporting), never as a different business rule. Google pincode‑level distance is approximate and is never the final rule.

### Keep Standard Delivery visible beside 4 Hours Delivery
4‑hour is an **addition**, not a replacement. In ShipZip, the standard rate must stay offered for eligible carts (don't restrict it to "non‑QC only"). The cart mirrors this: it lists **Standard** for every resolved rule and **adds** 4‑hour when eligible — it never hides Standard because 4‑hour exists. The customer may want the same items tomorrow.

### Error messages — theme‑side vs checkout/app‑side
One catalog (`window.GanguramDeliveryMessages`, `snippets/ganguram-delivery-messages-config.liquid`) owns all wording so the theme and the apps speak with one voice. **THEME** = the cart can detect it and show it early; **APP** = only knowable at Shopify checkout / inside ShipZip / the date‑slot app (the theme **cannot enforce** these — mirror the wording there).

| # | Case | Code | Owner |
|---|---|---|---|
| 1 | No pincode entered | `NO_PINCODE` | THEME (cart prompt) |
| 2 | Invalid pincode format | `INVALID_PINCODE` | THEME (popup/resolver) |
| 3 | Pincode not serviceable | `NOT_SERVICEABLE` | THEME (cart prompt) |
| 4 | Address incomplete | `ADDRESS_INCOMPLETE` | THEME (Places, optional) |
| 5 | Pincode ↔ city/state mismatch | `PINCODE_CITY_MISMATCH` | THEME (Places) |
| 6 | MOV not reached | `MOV_NOT_REACHED` | THEME (cart + soft guard) |
| 7 | Delivery charge unavailable | `CHARGE_UNAVAILABLE` | APP (ShipZip/checkout) |
| 8 | Cart weight exceeds slab | `WEIGHT_EXCEEDED` | APP (ShipZip rate) |
| 9 | 4‑hour not available for pincode | `QC_NOT_AVAILABLE` | THEME (cart) |
| 10 | Mixed QC + non‑QC cart | `MIXED_CART` / `MIXED_CART_ITEMS` | THEME (cart, names items) |
| 11 | Product not available locally | `PRODUCT_NOT_LOCAL` | THEME (zone filter / availability) |
| 12 | Product not shippable PAN India | `PRODUCT_NOT_PAN_INDIA` | THEME (zone filter) |
| 13 | No standard rate returned | `NO_STANDARD_RATE` | APP (checkout) |
| 14 | No 4‑hour rate returned | `NO_FOUR_HOUR_RATE` | APP (checkout) |
| 15 | Delivery date not selected | `DATE_NOT_SELECTED` | APP (date/slot app) |
| 16 | Delivery slot not selected | `SLOT_NOT_SELECTED` | APP (date/slot app) |
| 17 | Slot expired / full | `SLOT_EXPIRED` | APP (date/slot app) |
| 18 | App / rate calculation failure | `APP_FAILURE` | APP (checkout) |

The theme shows the **THEME** rows in the cart **before** checkout, so customers rarely hit Shopify's generic *"This order cannot be shipped to the address you entered."* The **APP** rows can only fire at checkout / inside the apps — configure those messages in ShipZip and your date‑slot app to match the catalog wording. **Fail‑open is preserved:** a JavaScript error never blocks checkout; only a confirmed MOV shortfall does (the existing soft guard).

---

## 7. Shipping-charge breakdown + checkout pincode mismatch (Phase 2.11E A/B)

### A. "Shipping charge details" accordion
A collapsible breakdown renders in the cart panel wherever a delivery charge shows. It lists **only what the theme actually knows** from the pincode/zone rules — **cart value**, **delivery zone + pincode**, **minimum order**, and the **per‑mode delivery charge** — and ends with: *"Final delivery charge may be confirmed at checkout if the complete address changes."*

> **It never invents charges.** A **weight slab**, a **distance/zone split**, or an **express surcharge** are **ShipZip‑internal** — the metaobject rule carries a single `delivery_charge` per rule, so the accordion shows that as the mode's charge and leaves anything it can't break down to the checkout‑confirmed note. If you want a finer breakdown in the cart, expose those parts as additional metaobject fields (a future phase) — do **not** hardcode them in the theme.

### B. Checkout pincode mismatch warning
The cart warns when the **delivery‑checker pincode** (`ganguram_selected_pincode`, via `GanguramZone`) differs from the pincode Shopify will use at checkout.

**Shopify limitation (important):** a standard (non‑checkout‑extensibility) theme **cannot read the address typed on Shopify's hosted checkout**, nor render UI there. So the theme does the comparison it *can*:

- **Logged‑in customer:** it compares the checker pincode against the customer's **saved address pincodes** (`customer.addresses[].zip` — the address Shopify prefills) and shows the warning **in the cart, before checkout**. If the checker pincode matches none of them → warn.
- **Guest, or a brand‑new address typed at checkout:** the theme can't see it. The exact comparison requires a **Checkout UI Extension** (a small app/function). The cart attribute **`ganguram_selected_pincode`** (Phase 2.11D.2) is written precisely so such an extension can compare it to `checkout.shippingAddress.zip` and show the same wording (`CHECKOUT_PINCODE_MISMATCH`).

The warning **never blocks checkout** (only the MOV soft guard blocks). Wording lives in the catalog (`CHECKOUT_PINCODE_MISMATCH` / `_SHORT`). Fail‑open: no saved address / no checker pincode / disabled → no warning.

| Capability | Where it runs |
|---|---|
| Warn vs **saved** address pincode | **Theme** (cart, this PR) |
| Warn vs the **typed‑at‑checkout** pincode | **Checkout UI Extension** (app) reading `ganguram_selected_pincode` |

---

## 8. Cart delivery panel UX (Phase 2.11F)

The cart delivery panel is intentionally **compact, premium, mobile-first**:

- **Main view shows only:** a short **status** ("Delivery available"), compact **delivery‑mode chips** (e.g. "4 Hours available · Standard also available · Charge at checkout"), the **MOV summary** ("₹530 / ₹700 minimum order" → "Minimum order reached"), a **theme‑coloured progress bar**, and a one‑line action ("Add ₹170 more to continue"). A short 4‑hour reason appears only when useful.
- **The pincode is de‑emphasised** — it is **not** a repeated headline; it lives only inside the collapsed accordion.
- **One collapsed accordion, "Delivery details"** holds everything detailed (pincode, zone, cart value, MOV, per‑method charge, the long mixed‑cart item list) and the checkout‑confirmation note **exactly once** — never duplicated in the main view.
- **Pincode mismatch warning is separate** — it renders near the checkout button (§7), not inside the delivery card.

**Theme colours, never hardcoded.** The progress‑bar fill and the accent chip use **`--color-accent-main`** (the brand colour from the Shopify customiser); the track/borders/chips use `--color-borders-main`; muted text uses `--color-secondary-text-main`; text‑on‑accent uses `--color-foreground-accent-main`. Change the brand colour in the customiser and the panel + progress bar follow automatically — there are **no hex/rgb colours** in the cart CSS.

**Limits (unchanged):** the theme renders only in the **cart**, never inside Shopify's **hosted checkout**. A finer **per‑charge breakdown** (weight slab / distance / surcharge) or a checkout‑side breakdown would require exposing more metaobject fields and/or a **Checkout UI Extension** (app). **ShipZip remains the source of the actual shipping rates** (§5a). This phase is UI/UX only — no business rule (ShipZip, cart attributes, MOV, Quick‑Commerce eligibility, PAN India, mixed‑cart, product visibility, checkout rates, date/slot) changed.

### 8b. Full‑address selection, estimate basis & checkout prefill (Phase 2.11F.2)

**A full address is "selected" only via Google.** It counts as a selected address when the customer **picks a Places suggestion** (or a typed address resolves through the Geocoder). On selection the theme saves a **structured record** (`window.GanguramAddress`): `place_id, formatted_address, address1, address2, city, state, country, zip, lat, lng, source: "selected_address"`. A pincode‑only entry saves `source: "pincode"` (+ city/state/centroid coords when Google resolves them). If the customer **types but doesn't select**, the popup shows a hint — *"Select an address from the suggestions to calculate a more accurate delivery estimate."* — and stays in pincode mode.

**Estimate basis is driven by the selected‑address store, not by the distance** (the 2.11F.1 bug was that a selected address with a failed Distance Matrix call fell back to "pincode"):
- **Selected address** → *"Delivery estimate based on your selected address."*, distance *"N km from our dispatch location"* (exact, when available). **Never** "Approx."
- **Pincode only** → *"Delivery estimate based on your pincode."*, distance *"Approx. N km · based on your pincode"* (pincode centroid).
- **Per‑mode charges** show the rule charge when known (e.g. *Standard ₹50*, *4 Hours ₹80*) and *"Final charge at checkout"* only when the rule has no charge — never invented; ShipZip still sets the final charge.

**Checkout shipping prefill (conditional, Phase 2.12B).** On the **standard** checkout button, `assets/ganguram-checkout-prefill.js` appends the documented `checkout[shipping_address][...]` params in **two clear modes** (from `window.GanguramAddress`):
- **`pincode_only`** (a pincode was entered, no full address) → sends **only `country` + `zip`**. Address / city / province are **not** sent — Shopify infers/handles them and we never push a guessed or stale address.
- **`full_address`** (a Google address was selected for the active pincode) → sends `country` + `zip` + `address1` (+ `address2`) + `city` + `province`.

The mode comes from `GanguramAddress.getSelectedAddress()`, which is keyed to the active pincode and cleared on every location change — so selecting a full address and **then** entering only a pincode falls back to `pincode_only` (no stale `address1`/`city`/`province`/locality/formatted address is reused). It fills **only safely‑known** fields (never email/name/phone) and preserves the cart, cart attributes (incl. the saved delivery date), discounts and payment. **ON by default**; set `enabled:false` (or `defaultCountry`) in `ganguram-checkout-prefill-config.liquid`.

**Date safety.** The prefill does nothing while checkout is blocked — by the MOV / not‑deliverable guard **or** a **required delivery date being missing** (`GanguramDeliveryDatePicker.isDateMissing`). So the redirect can **never** bypass the cart‑page date requirement; when a date is required it must be chosen first (the date guard blocks), and when present it is already saved to cart attributes and reaches the order.

**Clean address1 (Phase 2.12C).** The prefilled `address1` is **one clean, geocodable component** — `street_number + route`, else `premise`, else the establishment name, else the first formatted segment — **never** a concatenation of route + area + city (a messy `address1` can make a checkout geocoder, e.g. ShipZip's distance lookup, resolve to the *wrong / closer point* and price the wrong slab). The area (sublocality/neighbourhood) goes to `address2`; `city`/`province`/`zip`/`country` map cleanly from the Google components (`addressLines` in `ganguram-places-address-search.js`).

**Diagnostics (dev‑only).** In the console (incl. the theme preview):
- `window.GanguramCheckoutPrefill.debugState()` → mode, the **exact** params being sent (`country`/`zip`/`address1`/`city`/`province`), the stored **lat/lng**, and the **theme's km + Standard rate** for the same address.
- `window.GanguramAddress.debugState()` → the raw stored structured address.

**If the theme says ₹70 but checkout says ₹50:** the theme distance/slab is correct (`debugState().themeEstimate` shows e.g. `km: 7, rate: ₹70`), so the discrepancy is **inside ShipZip** — check ShipZip's **origin coordinates, distance slabs, and how it geocodes the destination** (a POI/landmark `address1` can geocode differently from the precise selected place). The theme cannot and does not change the checkout rate.

**Limitation — dynamic checkout buttons.** Shop Pay / "Buy with …" / dynamic checkout buttons bypass the cart form, so they **cannot** be prefilled this way; the theme leaves them untouched (normal behaviour). For prefill there, use a **Checkout UI Extension** (app) reading the cart attributes. **ShipZip remains the source of the final checkout shipping rates** regardless of prefill. If the address pincode differs from the manually entered one, the popup updates the delivery pincode to the address and notes it.

### 8a. Cart vs popup split (Phase 2.11F.1)

- **The cart is a compact summary only.** The standalone "Delivering to: …" line is **removed** (it was the Phase 2.10A summary, redundant). The cart shows: delivery available/unavailable, mode chips, the MOV progress bar **only when an MOV rule exists**, and one **collapsed** "Delivery details" accordion. The pincode is **not** a headline — it lives only inside the accordion. No repeated checkout‑confirmation text, no long distance/zone explanation.
- **The delivery‑location popup owns the estimate/explanation.** After a pincode/address resolves, `assets/ganguram-delivery-estimate.js` renders a compact estimate card in the popup: status, city/pincode, **distance**, MOV, cart value + remaining, charge estimate, and modes.
- **Google distance is a supporting estimate only.** For a **pincode** it geocodes the **pincode centroid** and shows an **approximate** distance ("Approx. N km · Approx. distance based on pincode", basis "Delivery estimate based on your pincode."). For a **full address** it uses the confirmed coordinates ("N km", basis "Delivery estimate based on your selected address."). It **never** overrides ShipZip / pincode / zone serviceability or the checkout rate.
- **ShipZip still owns the actual checkout shipping rate**, and the **final delivery charge may still be determined by ShipZip** at checkout — the popup distance/charge is an estimate. Needs the outlet origin + Distance Matrix + Geocoding APIs (§2d); fail‑open without them.

### 8c. 4‑hour cart/checkout sync (Phase 2.11F.3)

**Root cause of "cart says 4 Hours not available but checkout offers it":** the cart used to decide 4‑hour availability from whether a metaobject **`four_hour` rule** resolved. A merchant can configure the 4‑hour rate in **ShipZip** without creating a metaobject `four_hour` rule, so the cart wrongly showed *"4 Hours not available for this area."*

**Fix (theme side):** the cart + popup now derive "4 Hours available" from the **quick‑commerce ZONE** (`isQuickCommerce` / the `quick_commerce` pincode list in the resolver) **+ all‑items‑Quick‑Commerce** — the **same basis ShipZip and the `ganguram_delivery_mode_candidates` attribute use**. So an all‑QC cart in a quick‑commerce pincode (e.g. **700006**) shows **"4 Hours available"** + **"Standard also available"**, even with no metaobject `four_hour` rule (a rule only supplies the displayed charge). The cart **never** asserts "not available" just because a rule is missing (req B); the **only** hard negative is a **mixed cart** (some items aren't Quick Commerce). A metaobject `four_hour` rule is **optional** — add one only if you want the 4‑hour charge shown in the cart/popup.

**ShipZip — required config (theme cannot create rates) (req D):**
- **4 Hours Delivery** available for **all‑QC eligible local carts** — gate on `ganguram_all_quick_commerce = true` + `ganguram_delivery_mode_candidates` contains `four_hour` (or the quick‑commerce zipcodes). See §5a.
- **Standard Delivery / Next Day Delivery must remain available for the SAME carts.** Do **not** restrict Standard to non‑QC carts, and do **not** let 4‑hour replace Standard — a customer may want the same Quick‑Commerce item tomorrow. Keep a Standard rate that matches the local pincodes regardless of `ganguram_all_quick_commerce`.

**Date/slot app — required config (req E):** both methods need their own slot flow — **4 Hours Delivery → express / 4‑hour slot**, **Standard / Next Day → normal date picker**. If the date app is per‑delivery‑method, ensure **Standard has its own date‑picker configuration** so it still works alongside the 4‑hour express flow.

### 8d. ShipZip date picker vs the theme (Phase 2.11F.4)

**The theme does NOT hide or block the ShipZip date picker.** Verified: no theme CSS targets app/ShipZip elements (only `.ganguram-*` / `[hidden]`); no theme JS removes app elements; the cart‑page app‑block container (`sections/main-cart.liquid` `@app`) is the untouched vendor base; the cart‑attribute sync writes **only** its own keys via a `/cart/update.js` **merge**, so it never overwrites ShipZip's `Delivery‑Date` / `Delivery‑Time` attributes.

**If the date picker isn't showing, it's app/editor placement (not theme code):**
- A ShipZip **date‑picker app block** must be **added to the cart page** in *Customize → Cart → Add block* (the theme's `templates/cart.json` ships with only the `cart-items` block — no app block placed), and/or its **app embed enabled** in *Customize → App embeds*.
- A cart‑PAGE app block does **not** render inside the AJAX **cart drawer**. If customers check out from the drawer they won't see a cart‑page picker — send them to the `/cart` page (Theme settings → Cart → open the cart page / "no overlay"), or add the picker as an app block to the drawer if ShipZip supports it.
- The picker's own conditions (Local Delivery tag, the `STD` rate) must match — that's ShipZip config.

**Theme safeguard (updated 2.12B):** the address checkout‑prefill is **ON** again, but it is now **safe for a cart‑page required date**: it does nothing while checkout is blocked, **including when a required delivery date is missing** (`GanguramDeliveryDatePicker.isDateMissing`), so the redirect can't bypass the cart‑page date step. When a date is required the customer must choose it first (the date guard blocks); when present it's saved to cart attributes and reaches the order. (The express **"Buy now"** product‑card button still goes straight to checkout — an opt‑in express path that bypasses a cart‑page date step; that's separate from this prefill.) **Service‑code → date‑flow mapping (`4HR` express / `STD` date picker) is ShipZip/date‑app config — the theme can't affect it.**

---

## 9. Theme‑native local‑delivery date picker (cart drawer + cart page)

ShipZip's date picker is a **cart‑page app block** (it does not render in the AJAX cart drawer), and a **hosted‑checkout** picker requires a **Checkout UI Extension** (an app — Checkout Extensibility), not a standard theme. So the theme ships a compact **date/time picker inside the cart drawer AND the `/cart` page** for local delivery (`snippets/ganguram-delivery-datepicker*.liquid` + `assets/ganguram-delivery-datepicker.js/.css`).

- **Checkout‑side date picker?** Not from a standard theme — it needs a **Checkout UI Extension** (app). This theme‑native cart picker is the in‑theme solution; it saves the choice as **cart attributes** so it reaches the order (and ShipZip / your date app, if the attribute names match).
- **When it shows:** the cart has **`Local Delivery`**‑tagged items **and** the selected pincode is **local/hyperlocal** (`isKolkata`/`isQuickCommerce`). **Never** for PAN‑India‑only carts. Renders in both the drawer and the cart page.
- **Standard vs 4‑hour:** Standard/Next‑Day → a date select (earliest = next day by default; `minOffsetDays` / `maxOffsetDays` / `disabledWeekdays`), date **required** before checkout (`requireDate`), optional time slots (`timeSlots` + `requireTime`). When the cart is also 4‑hour‑eligible a **type selector** appears: **4 Hours (Express)** → no date needed (kept separate from Standard).
- **Checkout guard:** soft‑blocks checkout with *"Please select a delivery date before checkout."* (or *"…date and time…"*) until the requirement is met; 4‑hour express is exempt.
- **Cart attributes written** (configurable — **match ShipZip's exact names**; defaults shown): **`Delivery-Date`**, **`Delivery-Time`**, **`Delivery Method`**. Written via a `/cart/update.js` **merge** (only these keys), so ShipZip's other attributes are never cleared; selecting a value **replaces** only that key. Verify the names in an order's cart attributes and set `attributeKeys` in `ganguram-delivery-datepicker-config.liquid` (and the matching `data-gdd-saved-*` in the snippet) if ShipZip uses different names.
- **No rate change:** never touches ShipZip rate logic, the `4HR`/`STD` service codes, the delivery‑mode cart‑attribute handoff, or pincode/MOV/product‑visibility logic. Theme variables only (no hardcoded colours). Fail‑open.
- **Field styling (2.11H.2):** the date `<select>` uses a **solid theme fill** (`--color-background-main`) + **theme text** (`--color-text-main`) with a `currentColor` chevron — fixing the earlier unreadable, patterned field that came from a transparent fill on an `appearance: none` select. Theme tokens only; works in the drawer and the cart page.

## 10. Product eligibility + collection rendering for pincode delivery (Phase 2.11H)

Fixes two related issues and makes the **product display filter**, the **cart eligibility validator**, and the **cart delivery panel** all read from **one shared rule** so they can never disagree.

### Tags drive everything (admin action)
Each product's delivery scope comes from its **tags**. Tag products deliberately:

| Tag | Meaning | Shows in normal grids | Shows in the 4‑Hours grid | Deliverable to… |
| --- | --- | --- | --- | --- |
| **`Kolkata`** | Local (standard) | ✅ | – | Kolkata / quick‑commerce pincodes |
| **`Local Delivery`** | Local (standard) | ✅ | – | Kolkata / quick‑commerce pincodes |
| **`Quick Commerce`** | 4‑hour eligible | – | ✅ | quick‑commerce pincodes (4‑hour) |
| **`PAN India`** | Ships nationwide | ✅ (PAN India pincodes) | – | **PAN India pincodes only** |

- **A product is PAN‑India‑deliverable ONLY if it carries the `PAN India` tag.** `Kolkata` / `Local Delivery` / `Quick Commerce` do **not** make a product deliverable nationwide. If a sweet should be available **both** locally **and** nationwide, give it **both** sets of tags (e.g. `Kolkata` + `PAN India`).
- **A local‑only sweet** (e.g. *Nolen Gurer Jalbhara Sandesh*, tagged `Kolkata`/`Quick Commerce` but **not** `PAN India`) is **correctly invalid** for a PAN India pincode such as Bengaluru `560001`.

### Bug 1 — collection showed only 1 product
Local grids previously showed only products tagged **`Kolkata`**, so a collection of **`Local Delivery`**‑tagged sweets collapsed to the one `Kolkata`‑tagged item. The display rule now treats **`Kolkata` OR `Local Delivery`** as visible in normal local grids, so all of them show. The **column count** (e.g. 4‑column) is a **layout** setting only — it never changes how many products are returned.

### Bug 2 — invalid item slipped through for a PAN India pincode
- The cart validator now reads a **`data-ganguram-local-delivery`** attribute on each product card / cart line (added in `product-item.liquid`, already present in the cart snippets) and uses a shared **"deliverable by ANY mode"** rule: an item is fine if it can arrive by **standard** (local grids) **or** **4‑hour** (quick‑commerce area). PAN India has no 4‑hour, so a local‑only item is flagged.
- The validator now surfaces invalid items **on cart load and on cart change** (not only on a pincode change): a review modal offers **"Remove unavailable items"** or **"Change pincode."** Closing it changes nothing (fail‑open); it does not re‑pop for the same cart until something changes.
- The **delivery panel** no longer shows a "Pan India / Standard" deliverable state for a cart that holds undeliverable items — it shows a clear *"Some items in your cart can't be delivered to …"* message instead.
- **Checkout is soft‑blocked** while invalid items remain; pressing checkout re‑opens the review modal so the customer can remove the items or change the pincode.

### Transactional pincode change (2.11H.2)
A pincode change that would strand cart items is now **transactional** — the new pincode is **not committed** until the customer confirms. `assets/ganguram-cart-eligibility.js` wraps `GanguramZone.setSelectedPincode` (so the **popup, header widget, saved locations, and address search** are all covered): it classifies the candidate, and if some current cart items can't be delivered to it, it holds the candidate as a **pending** pincode and shows the modal **without** writing `localStorage`, firing the change event, or updating cart attributes. The **active** pincode/zone (panel, product filter, widget, cart attributes) stays put. **Change pincode**, **Keep current pincode**, and ✕ / Esc / backdrop / ignoring the modal all discard the pending pincode and leave the active one and the cart untouched; only **Remove unavailable items** mutates — it removes only the affected lines and **then** commits the pending pincode. Fail‑open: no rule / empty cart / not serviceable → commit immediately as before.

### Modal design (2.11H.1)
The unavailable‑items / item‑removal modal matches the **Krown Local** theme: the actions use the theme's own **`.button`** classes (`.button--solid` for the recommended **Change pincode**, `.button--outline` for **Keep current pincode** and **Remove unavailable items**), and every colour is a **theme design token** — no hardcoded brand colours. Mobile‑first: the three actions **stack full‑width** in the order **Change pincode → Keep current pincode → Remove unavailable items** (destructive last), with a small helper line *"This will remove the listed items from your cart."* above the destructive action. The old ambiguous **"Continue with selected pincode"** label is gone — the button that removes items now says **"Remove unavailable items."** Each item card shows image, title, **Qty**, and one subtle reason (*"Not available for delivery to {pincode}"*). Accessibility: `role="dialog"`, `aria-modal`, `aria-labelledby`/`aria-describedby`, a labelled close button, **Esc** to close, and a **Tab focus trap**. The business logic (keep / change / remove → cart update, eligibility, visibility, ShipZip attributes) is unchanged — UI/copy only.

### Single source of truth
`window.GanguramZoneRules.isProductVisibleForContext(tags, zone, context)` (per‑grid **display**) and the new `window.GanguramZoneRules.isProductDeliverableToZone(tags, zone)` (cart **eligibility**) both live in `assets/ganguram-product-zone-filter.js`. The product filter, `assets/ganguram-cart-eligibility.js`, and `assets/ganguram-delivery-progress.js` all call them — change the matrix in **one** place.

### No rate change
This phase does **not** touch ShipZip rates, the `4HR`/`STD` service codes, the date‑picker attributes (§9), the delivery‑mode cart‑attribute handoff (§5a/§8c), MOV logic, the pincode resolver, or any checkout‑rate logic. Theme variables only (no hardcoded colours). Fail‑open: with no rule loaded / no pincode, nothing is hidden and nothing is blocked.

## 11. Pincode‑area shipping estimate (Phase 2.11I)

The delivery popup now shows a **useful charge ESTIMATE** instead of "Final charge at checkout". **ShipZip remains the source of the final checkout rate** — this is an estimate/UI improvement only.

### Distance API — Routes API (2.11I.1)
Distances use the Google **Routes API** (`computeRouteMatrix`, REST `https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`, one origin × many destinations in a single request) on the merchant browser key — **not** the legacy `DistanceMatrixService` (which the store key does not enable). Geocoding still uses the Maps JS Geocoder. The key is read from `settings.google_maps_api_key` (via `GanguramDistanceConfig.apiKey`).

### Calculation method
- **Pincode‑only:** geocode the pincode to its **area box** (Google bounds/viewport; centroid if no box), sample the **centre + 4 corners** (optionally + edge midpoints), ask the **Routes API** for all of them in **one** request, take the **min/max** driving distance, and map each to the local slab → a **range** (e.g. *Standard shipping estimate: ₹50–₹100*) or a single price when both ends fall in one slab.
- **Full address:** use the selected address's **confirmed** driving distance → a **single** slab price (*Standard shipping estimate: ₹70* · *Based on your selected address.*).
- **4 Hours:** flat **₹10** when within the radius. A pincode area that **straddles** the radius shows *"4 Hours may be available for some addresses in this pincode. Enter your full address to confirm."*; a full address **beyond** the radius does **not** show 4 Hours (conservative — never over‑promises vs checkout).

### Limitations of the pincode‑area estimate
A pincode covers an area, so the estimate is a **range** sampled from a few points — the exact charge depends on the precise address and is **confirmed at checkout by ShipZip**. The 4‑hour "maybe" wording is shown precisely because parts of a pincode can be inside and others outside the radius.

### Fallback (Routes API failure)
For a **known local pincode**, if the Routes API can't be reached (no key / HTTP error / any failure) the popup does **not** drop to a bare "Final charge at checkout" — it shows the **configured fallback slab span** (*Standard shipping estimate: ₹50–₹150*) with *"Final charge confirmed at checkout."* A later successful compute narrows it. PAN India (no local slabs) keeps the plain "final at checkout" wording.

### Config (easy to change — no JS edit)
`snippets/ganguram-shipping-estimate-config.liquid` publishes `window.GanguramEstimateConfig`:
```js
standardSlabs: [ {maxKm:5,price:50}, {maxKm:10,price:70}, {maxKm:15,price:100}, {maxKm:20,price:150} ],
fourHour: { maxDistanceKm: 10, flatPrice: 10 },
cacheVersion: 1, cacheTtlMs: 86400000, sampleEdgeMidpoints: false
```
The pure mapping (`assets/ganguram-shipping-estimate.js` → `window.GanguramShippingEstimate`) is the **only** place the slab table lives. The outlet origin is the existing `settings.ganguram_outlet_origin` (§2d).

### Caching
The pincode‑area distance range is cached in `localStorage` keyed by **pincode + origin + config version** with a TTL (default 24h), so Google is **not** called again for the same pincode in a session. Bump `cacheVersion` to invalidate.

### Confirmation — ShipZip stays the final rate
No change to **ShipZip rate logic, the `4HR`/`STD` service codes, checkout‑rate logic, pincode‑eligibility, product visibility, MOV, or the date‑picker attribute names.** Theme variables only (no hardcoded colours). `settings_data.json` untouched.

## 12. PAN India weight estimate + cart‑panel estimate (Phase 2.11J)

### PAN India weight‑based estimate (Part B)
For a **PAN India** pincode the popup + cart panel show a **weight‑based** estimate instead of "final at checkout":
`estimate = ceil(total_cart_weight_grams / 500) × 80` → **₹80 per 500 g** (e.g. 400 g → ₹80, 501 g → ₹160, 1200 g → ₹240). It uses **only the Shopify cart weight** (`cart.total_weight`, exposed as `data-gdpr-cart-weight`) — it never parses weight from a product title. With **no usable weight** it shows *"PAN India shipping starts from ₹80 per 500 g."* Copy: *"PAN India shipping estimate: ₹X"* · *"Based on cart weight. Final charge confirmed at checkout."* Config: `GanguramEstimateConfig.panIndia = { perWeightG: 500, pricePerUnit: 80 }` (pure mapping `GanguramShippingEstimate.panIndiaForWeight`).

### Cart delivery panel (Part C)
The cart panel stays compact and shows ONE **estimate line** (`[data-gdpr-estimate]`): **local** → *"Standard shipping estimate: ₹X[–₹Y]"* (+ *" · 4 Hours: ₹10"* when the zone + cart make it eligible); **PAN India** → *"PAN India shipping estimate: ₹X"*. When the estimate line is shown the redundant generic charge chip is hidden (no double charge), the mode‑availability chips stay, and the **detail** (distance/slab for local; total weight + ₹/unit for PAN India) lives in the existing "Delivery details" accordion. The panel reuses the SAME `GanguramShippingEstimate` + cached pincode‑area range as the popup, so the two never disagree.

### Local stabilisation (Part A)
Distances use the **Routes API** (§11/2.11I.1); a Routes failure for a known local pincode shows the configured **fallback slab span** (e.g. *₹50–₹150*), never a bare "final at checkout". A **failed/null** area lookup is **not cached**, so a later render re‑tries and can still succeed; **successful** ranges are cached by **pincode + origin + config version** (TTL).

### Diagnostics (Part D)
Dev‑only, never customer‑facing, no production console noise (all traces are behind the `?ganguram_debug=1` / `localStorage['ganguram.debug']='1'` gate). Inspect in the console: `window.GanguramDeliveryEstimate.debugState()` → pincode, estimate type (pincode area / selected address / PAN India weight), min/max km, slab range, 4‑hour state, PAN India weight, cache hit, and the distance module's last Routes reason. `window.GanguramDistance.debugState()` remains for the raw distance state.

### Confirmation — ShipZip stays the final rate (2.11J)
No change to **ShipZip rate logic, the `4HR`/`STD` service codes, checkout‑rate logic, product‑eligibility, pincode‑visibility, MOV, the date‑picker attributes, or the unavailable‑items modal logic.** ShipZip remains the final checkout rate. Theme variables only (no hardcoded colours). `settings_data.json` untouched.

## 13. Delivery mode classification — distance-first (Phase 2.12D)

**Root cause of the impossible mixed state** (e.g. Eco Park / 700161 showing *PAN India ₹320 + 4 Hours + Standard*): local‑vs‑PAN‑India was decided by the **pincode zone** (`isKolkata`). 700161 isn't in the Kolkata pincode list → classified `pan_india` → the popup/cart showed the PAN India weight estimate, even though the address is **15 km** away (well inside the 20 km local radius), while a stray 4‑hour chip made it inconsistent.

**Fix — one DISTANCE‑FIRST decision (`GanguramShippingEstimate.resolveDeliveryState`).** The route distance decides the mode, NOT the zone and NOT a product's PAN India tag. The popup **and** the cart both render from this single state, so they can never disagree. It returns exactly ONE consistent mode set:

**Both radii are admin‑configurable** (Phase 2.12E): `localStandardMaxDistanceKm` = the dearest standard slab's `maxKm` (currently **20**); `fourHourMaxDistanceKm` = `GanguramEstimateConfig.fourHour.maxDistanceKm` (currently **10**, change to e.g. **20**). 4 Hours is **not** hard‑coded to 10 km. There is also `fourHour.enabled` to turn 4 Hours off entirely.

| Input | Mode |
| --- | --- |
| Full address, **≤ `fourHourMaxDistanceKm`** | Local **Standard** (slab) · **4 Hours `flatPrice`** only if cart is QC‑eligible · no PAN India |
| Full address, **> `fourHourMaxDistanceKm` and ≤ `localStandardMaxDistanceKm`** | Local **Standard** (slab) · **no 4 Hours** · no PAN India |
| Full address, **> `localStandardMaxDistanceKm`** | **No** local / 4 Hours · **PAN India** (by weight) only if all items PAN India, else **blocked** |
| Pincode area within/overlapping `localStandardMaxDistanceKm` | Local Standard range · 4 Hours `yes`/`maybe`(*“enter full address to confirm”*)/`no` by the `fourHourMaxDistanceKm` crossing · no PAN India |
| Pincode area clearly > `localStandardMaxDistanceKm` | PAN India (by weight) only if all items PAN India |
| Full address selected, distance not computed yet | **pending** (no mode flash) |

**Local slabs (exact route km):** 0–5 ₹50 · 5.01–10 ₹70 · 10.01–15 ₹100 · 15.01–20 ₹150. 4 Hours: flat ₹10 within the **configured** radius.
- With `fourHourMaxDistanceKm = 10`: **Eco Park ≈ 15.2 km → Standard ₹150, no 4 Hours, no PAN India.**
- With `fourHourMaxDistanceKm = 20`: **Eco Park ≈ 15.2 km → Standard ₹150, 4 Hours ₹10 if all items Quick Commerce, no PAN India** (ShipZip + time‑window rules still gate the real checkout offer).

**Product tags vs zone (don't force PAN India).** A PAN India product to a **local** address still uses local Standard / 4 Hours by distance — the PAN India tag never forces PAN India mode. A local‑only product **outside** the local radius is blocked (no PAN India estimate). Eligibility (the unavailable‑items modal) is unchanged.

**Stale state.** The mode is recomputed from live inputs every render (no mode/PAN cache); the distance module clears its confirmed/approx distance on every location change; a selected full address uses its driving distance, never a leftover pincode‑only PAN India cache. The area‑distance cache key is pincode + origin + config version.

**Diagnostics.** `window.GanguramDeliveryEstimate.debugState()` → selected pincode, selected address + lat/lng, **selectedDistanceKm**, standard slab, **`localStandardMaxDistanceKm`**, **`fourHourMaxDistanceKm`**, **`fourHourEnabled`**, **`isWithinLocalStandardRadius`**, **`isWithinFourHourRadius`**, **`allItemsQuickCommerce`**, `panIndiaEligible`, **finalMode**, **reasonPanIndia**, **reasonFourHour**, and the cache key. No production console noise.

### Confirmation — no rate/ShipZip/eligibility change (2.12D)
This is a delivery‑state **calculation + rendering** correctness fix. No change to **ShipZip rates, the `4HR`/`STD` service codes, checkout‑rate logic, the date‑picker attributes, product visibility, MOV, or the unavailable‑items modal logic.** ShipZip remains the final checkout rate. Theme variables only. `settings_data.json` untouched.

## 14. Local slab accuracy (anti under‑estimate) + ShipZip diagnostic (Phase 2.12F)

**Symptom.** For an Eco Park‑area address (~15–16 km on the map) the cart/popup **Standard estimate showed ₹100** (the 10.01–15 km tier) instead of **₹150** (15.01–20 km), and at checkout **ShipZip Standard showed ₹50**.

### Part A — slab accuracy (theme estimate)
A full‑address driving distance is now biased **UP** by a small, configurable safety margin **before** the slab is chosen, so a distance the Routes API returns as e.g. **14.9 km** for an address that is really ~15 km is **never** under‑quoted into the cheaper tier. It is a **display estimate** bias only (ShipZip is the real rate), so it can only ever err toward *not* under‑quoting.

- **Config (no JS edit):** `GanguramEstimateConfig.slabSafetyMarginKm` (default **0.3** km). Set **0** for the exact route distance.
- **Radius decisions use the RAW distance** (local‑vs‑PAN and the 4‑hour radius are unchanged); **only the Standard price slab** uses the padded distance. The padded value is clamped to `localStandardMaxDistanceKm` so an in‑radius address never shows a “₹150+” (beyond) slab.
- Applies to a **single full address** only. The pincode‑**area** range is left exact — its `max` end already brackets the uncertainty.
- **Result:** 14.99 / 15.01 / 15.2 km → **Standard ₹150**; a genuine 7 km stays **₹70**.

**Exact slab diagnostic** — `window.GanguramDeliveryEstimate.debugState()` now reports, for the selected full address: `originLatLng`, `destLatLng`, `routeDistanceMeters` (raw metres from the Routes API), `routeDistanceRawKm`, `slabSafetyMarginKm`, `slabDistanceKm` (the padded value matched to a slab), `slabSelected` `{maxKm, price}`, and `standardEstimate` (the final ₹). `window.GanguramDistance.debugState()` adds `lastDistanceMeters` + `lastDestCoords`.

### Part B — ShipZip diagnostic (checkout ₹50 vs theme ₹150)
The checkout rate is produced by **ShipZip**, not the theme — **the theme cannot set or override the checkout shipping rate.** So if `debugState()` confirms the theme side is correct (distance ~15–16 km, **Standard estimate ₹150**) but checkout still shows **Standard ₹50**, the discrepancy is on the **ShipZip side**, not the theme:

- **ShipZip isn’t applying the distance tier** (it’s falling back to a base/flat price), **or**
- **ShipZip’s origin / geocoding is off** (it geocodes the destination to a different point and computes a shorter distance), **or**
- the ShipZip **rate table tiers** don’t match the theme slabs (0–5 ₹50 · 5.01–10 ₹70 · 10.01–15 ₹100 · 15.01–20 ₹150).

**Fix is in the ShipZip admin** (outlet origin coordinates, distance‑tier table, and that distance — not a flat base — drives the rate). The theme’s job is only to (a) show an accurate estimate and (b) hand ShipZip a clean, geocodable address (Part C).

#### ShipZip rate stuck at ₹50 — root‑cause decision table (Phase 2.12G)

For the reported case the ShipZip rate is **Standard Delivery**, **Base ₹100**, tiers 0–5 ₹50 / 5.01–10 ₹70 / 10.01–15 ₹100 / 15.01–20 ₹150, conditions *Distance ≤ 20 km · Total ≥ ₹300 · State West Bengal · ZipCode All*. The theme computes **15.2 km → ₹150** for Eco Park. Because **Base = ₹100 but checkout shows ₹50**, ₹50 is **not** the base fallback — it is exactly the **0–5 km tier**, i.e. ShipZip is computing a **≤ 5 km** distance.

| # | Test | Observed result | Conclusion | Exact setting to change |
|---|---|---|---|---|
| 1 | **Rename** the rate to `Standard Delivery TEST 123` | Checkout label **changes**, still ₹50 | This rate is winning and applying its 0–5 km tier | Go to test 2 / 3 |
| 1 | Rename the rate | Checkout label **does NOT change** | A **different / duplicate** rate is being returned | Find and delete/disable the duplicate ₹50 rate |
| 2 | **Tier‑bump**: 0–5=₹51, 5.01–10=₹71, 10.01–15=₹101, 15.01–20=₹151, **Base=₹999** | Checkout shows **₹51** | ShipZip thinks distance is **0–5 km** | Fix ShipZip **origin** (test 3) |
| 2 | Tier‑bump | **₹151** | ShipZip thinks **15–20 km** (correct) — the earlier ₹50 was a **duplicate** rate | Remove the duplicate (test 1) |
| 2 | Tier‑bump | **₹999** | **Base/fallback** — no tier matched (distance condition failing) | Check ShipZip can compute a distance at all (origin + geocoding) |
| 3 | **Origin source** in ShipZip (app default / Shopify fulfilment location / nearest branch / inventory location / store address / warehouse field) | Origin is **New Town / Misti Hub** (or “nearest location”) | Eco Park ≈ **0–5 km** from that wrong origin → ₹50 | Set ShipZip origin/warehouse to **Beadon Street `22.586852842169446, 88.37350202482604`** — the same origin the theme uses (`settings.ganguram_outlet_origin`) |
| 4 | **Destination geocoding** — compare checkout `address1/zip` with `GanguramCheckoutPrefill.debugState().sending` | Fields clean, zip 700161 | Theme is handing a clean address | If ShipZip still mis‑locates, the issue is ShipZip’s origin, not the address |
| 5 | **Theme vs ShipZip** — `GanguramDeliveryEstimate.debugState()` | Theme ₹150 @ 15.2 km, checkout ₹50 | The discrepancy is **entirely ShipZip‑side** | One of tests 1–3 above |

> **Most likely root cause:** the ShipZip **origin is not Beadon Street** (it is computing from a New Town / Misti Hub location, or “nearest fulfilment location”), so Eco Park resolves to ≤ 5 km and returns the ₹50 tier. Set the ShipZip rate origin to `22.586852842169446, 88.37350202482604`.

**Console helper (read‑only, run on the cart page):**
- `GanguramCheckoutPrefill.shipZipDiagnosis()` → theme origin, the selected pincode, the exact address fields being sent, the theme distance (km + metres), the theme’s expected Standard ₹, the slab tiers, and the observed‑rate interpretation map.
- `GanguramCheckoutPrefill.explainCheckoutRate(50)` → maps the ₹ you see at checkout to a conclusion + the exact setting to change (e.g. `₹50 → ShipZip 0–5 km tier → origin is not Beadon Street → set origin to 22.58…,88.37…`). It uses the theme’s **own** slab table, so it stays correct if the tiers change.

These are **diagnostics only** — they read theme state and print a conclusion; they do **not** touch ShipZip, the rate, service codes, or any business rule.

### Part C — checkout address prefill (clean, geocodable fields)
The Standard‑checkout prefill (Phase 2.12B/2.12C) sends Shopify’s `checkout[shipping_address][...]` fields **separately and clean**, never a concatenated blob, so ShipZip geocodes the right point:

- `address1` = **one clean** street / premise / POI component (not “name, area, city, …”), `address2` = locality/sublocality, `city`, `province` = `West Bengal`, `zip` = e.g. `700161`, `country`.
- **pincode‑only** mode sends **country + zip only** (no guessed street/city).

Verify with `window.GanguramCheckoutPrefill.debugState()` → `sending` (the exact params), `storedLatLng`, and `themeEstimate` (`km` raw, `slabKm` padded, `rate`) — which now uses the **same** slab‑safety padding as the popup/cart, so the three never disagree.

### Part D — guardrails (2.12F / 2.12G)
Estimate **calculation + read‑only diagnostics** only. No change to **ShipZip rates, the `4HR`/`STD` service codes, checkout‑rate logic, the date‑picker attributes, product eligibility/visibility, MOV, the unavailable‑items modal, metafields/metaobjects, or the Custom Box Builder.** ShipZip remains the final checkout rate; theme CSS variables only; `settings_data.json` untouched (the outlet origin is read from the existing `settings.ganguram_outlet_origin` setting, not modified).

---

### Related docs
- `docs/delivery-rule-source-of-truth-audit.md` — Phase 2.11A decision (why metaobjects).
- `docs/checkout-feasibility-and-delivery-rules-audit.md` — Phase 2.10B feasibility + GO/NO‑GO.
- `docs/zone-resolver-spec.md` — the `GanguramZone` contract the rules align to.

> **Scope reminder:** Phase 2.11B added a read path + resolver + this doc only. No customer‑facing UI, no checkout/cart/MOV/charge behavior, no ShipZip/SBZ/zipLogic/Google/resolver change, and no `settings_data.json` edit.
