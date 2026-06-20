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

### Related docs
- `docs/delivery-rule-source-of-truth-audit.md` — Phase 2.11A decision (why metaobjects).
- `docs/checkout-feasibility-and-delivery-rules-audit.md` — Phase 2.10B feasibility + GO/NO‑GO.
- `docs/zone-resolver-spec.md` — the `GanguramZone` contract the rules align to.

> **Scope reminder:** Phase 2.11B added a read path + resolver + this doc only. No customer‑facing UI, no checkout/cart/MOV/charge behavior, no ShipZip/SBZ/zipLogic/Google/resolver change, and no `settings_data.json` edit.
