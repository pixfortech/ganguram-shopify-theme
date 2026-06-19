# Delivery Rule Engine — Admin Setup (Phase 2.11B)

This guide explains how a store admin creates the **admin‑configurable delivery rules** that the theme reads. It accompanies the Phase 2.11B foundation:

- `snippets/ganguram-delivery-rules-config.liquid` — reads the rules and publishes `window.GanguramDeliveryRulesConfig`.
- `assets/ganguram-delivery-rules.js` — `window.GanguramDeliveryRules` (`getRules`, `resolve`, `getProgressData`, `formatMoney`).

> **Phase 2.11B is foundation only.** Creating these rules does **not** change anything customers see yet — there is **no progress bar, no MOV enforcement, and no checkout/charge change**. The UI that uses these rules is **Phase 2.11C**. Until the metaobject exists, the theme reads an empty rule set and everything **fails open** (no errors).
>
> **Source-of-truth decision:** Phase 2.11A chose **Shopify metaobjects**. The theme reads them **directly** via `shop.metaobjects.ganguram_delivery_rule.values` — **no shop metafield is required for the theme**. (The shop metafield `shop.metafields.ganguram.delivery_rules` is only needed later for a Shopify Function / app — see §3.)
>
> **Model update (state + distance/radius):** rules now also support a **default PAN India MOV**, **per‑state overrides**, and a **local‑delivery radius** (treat a Google address within *N* km of the outlet as local/Kolkata; beyond it, as PAN India even if the pincode is in West Bengal). See **§2a** for the resolution order, and **§2b** for how a distance is supplied.

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
4. **`pan_india`** — the PAN India default (`zone_key: pan_india`).
5. **`default`** — the global catch‑all.
6. **`none`** — nothing matched and no default exists (fail‑open; no UI shown).

> **Manual vs address (req #3, #6, #7):** a *manual pincode* has no coordinates, so it uses `exact → prefix → state → PAN India` (set up **B**/**C**/**D** to cover it). A *Google address* has coordinates, so **distance/radius is authoritative** — within the radius it's local (A), beyond it it's state/PAN India. Because of this, **prefer the radius rule (A) over a broad prefix rule** for local coverage; reserve `pincode_prefix` for narrow, intentional overrides.

## 2b. Where the distance comes from (future Google Distance Matrix)

`resolve()` / `getProgressData()` / `getServiceOptions()` accept an optional **`{ distanceKm }`** (km from the outlet to the selected address). **Phase 2.11B does NOT compute it** — `distanceKm` is simply absent today, so address selections currently resolve like manual entries (`exact → prefix → state → PAN India`). A **future, separate** integration (Google **Distance Matrix**, an app, or a precomputed pincode→distance table) will supply `distanceKm`, at which point the radius/band tiers activate. **No Google code is added or changed by this phase.**

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
//   reason,            // the resolved slab's reason (exact_pincode|prefix|distance|local_radius|state|pan_india|default|none)
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

## 3. (Later) Connect entries to `shop.metafields.ganguram.delivery_rules`

**Not required for the theme.** This step is only for the **future hard‑enforcement track** (a Shopify **Cart/Checkout Validation Function**, which reads metafields — not theme settings).

1. Create a **shop metafield** with namespace **`ganguram`**, key **`delivery_rules`**, type **List of metaobject → Ganguram Delivery Rule** (`list.metaobject_reference`).
2. Set its value to the rule entries you created in §2.
3. The Function's input query then reads `shop.metafields.ganguram.delivery_rules`, using the **same** entries the theme reads — one source of truth, enforced once.

Shop metafields are typically set via the GraphQL Admin API or an app (the admin UI for shop‑level metafields varies). The theme does **not** need this — it reads the metaobject directly.

---

## 4. How Phase 2.11C (progress bar) will read this

The 2.11C UI consumes the helper — it does **not** re‑read the metaobject itself:

```js
// cart.total_price is in PAISE; pass it directly. location defaults to the
// current GanguramZone selection when omitted. The 3rd arg (options) is optional
// and may carry { distanceKm } once a Distance Matrix integration exists (§2b);
// today it is absent, so address selections resolve like manual pincode entries.
var data = window.GanguramDeliveryRules.getProgressData(cartTotalPaise /*, location, { distanceKm } */);

// data = {
//   rule, reason,                 // reason: exact_pincode | prefix | distance | local_radius | state | pan_india | default | none
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

---

### Related docs
- `docs/delivery-rule-source-of-truth-audit.md` — Phase 2.11A decision (why metaobjects).
- `docs/checkout-feasibility-and-delivery-rules-audit.md` — Phase 2.10B feasibility + GO/NO‑GO.
- `docs/zone-resolver-spec.md` — the `GanguramZone` contract the rules align to.

> **Scope reminder:** Phase 2.11B added a read path + resolver + this doc only. No customer‑facing UI, no checkout/cart/MOV/charge behavior, no ShipZip/SBZ/zipLogic/Google/resolver change, and no `settings_data.json` edit.
