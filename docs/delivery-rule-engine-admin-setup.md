# Delivery Rule Engine — Admin Setup (Phase 2.11B)

This guide explains how a store admin creates the **admin‑configurable delivery rules** that the theme reads. It accompanies the Phase 2.11B foundation:

- `snippets/ganguram-delivery-rules-config.liquid` — reads the rules and publishes `window.GanguramDeliveryRulesConfig`.
- `assets/ganguram-delivery-rules.js` — `window.GanguramDeliveryRules` (`getRules`, `resolve`, `getProgressData`, `formatMoney`).

> **Phase 2.11B is foundation only.** Creating these rules does **not** change anything customers see yet — there is **no progress bar, no MOV enforcement, and no checkout/charge change**. The UI that uses these rules is **Phase 2.11C**. Until the metaobject exists, the theme reads an empty rule set and everything **fails open** (no errors).
>
> **Source-of-truth decision:** Phase 2.11A chose **Shopify metaobjects**. The theme reads them **directly** via `shop.metaobjects.ganguram_delivery_rule.values` — **no shop metafield is required for the theme**. (The shop metafield `shop.metafields.ganguram.delivery_rules` is only needed later for a Shopify Function / app — see §3.)

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
| State | `state` | Single line text | – | Optional, display/reference only. |
| Distance min (km) | `distance_min_km` | Decimal | – | **Future** — distance band lower bound. Leave blank for now. |
| Distance max (km) | `distance_max_km` | Decimal | – | **Future** — distance band upper bound. Leave blank for now. |
| Minimum order value | `min_order_value` | Decimal | – | In **rupees** (e.g. `300`). The theme converts to paise. |
| Delivery charge | `delivery_charge` | Decimal | – | In **rupees** (display only in the theme). |
| Free delivery threshold | `free_delivery_threshold` | Decimal | – | In **rupees**; subtotal at/above which charge is waived. Optional. |
| 4‑hour eligible | `four_hour_eligible` | True/false (boolean) | – | Whether 4‑Hour delivery applies for this rule. |
| Customer message | `customer_message` | Single line text | – | Optional message the 2.11C UI may show. |

> **Money fields must be `Decimal` in rupees.** The theme reads them as numbers and multiplies by 100 to get paise. Do **not** use a `Money` field type — its Liquid value is an object and won't serialize here.

---

## 2. Create rule entries

**Settings → Custom data → Metaobjects → Ganguram Delivery Rule → Add entry**, one entry per rule. Fill the fields; leave anything not relevant **blank**.

### Example entries

*(Numbers below are **illustrative** — set your real MOV / charge / thresholds.)*

**A. Kolkata (zone default)**
- `name`: `Kolkata` · `active`: ✓ · `priority`: `0`
- `zone_key`: `kolkata`
- `min_order_value`: `300` · `delivery_charge`: `40` · `free_delivery_threshold`: `600`
- `four_hour_eligible`: ✗

**B. Quick Commerce (zone)**
- `name`: `Quick Commerce` · `active`: ✓ · `priority`: `0`
- `zone_key`: `quick_commerce`
- `min_order_value`: `400` · `delivery_charge`: `60` · `free_delivery_threshold`: `800`
- `four_hour_eligible`: ✓

**C. PAN India (zone default)**
- `name`: `PAN India` · `active`: ✓ · `priority`: `0`
- `zone_key`: `pan_india`
- `min_order_value`: `750` · `delivery_charge`: `120` · `free_delivery_threshold`: `1500`
- `four_hour_eligible`: ✗

**D. Exact‑pincode override** *(beats zone rules for that pincode)*
- `name`: `Park Street free delivery` · `active`: ✓ · `priority`: `10`
- `exact_pincode`: `700016`
- `min_order_value`: `250` · `delivery_charge`: `0` · `free_delivery_threshold`: `400`
- `four_hour_eligible`: ✓

**E. Pincode‑prefix rule** *(beats zone, loses to exact)*
- `name`: `Howrah belt` · `active`: ✓ · `priority`: `0`
- `pincode_prefix`: `711`
- `min_order_value`: `350` · `delivery_charge`: `50`

**F. Future distance band** *(inert until distance is supplied — Phase 2.11C+/app)*
- `name`: `0–5 km` · `active`: ✓
- `distance_min_km`: `0` · `distance_max_km`: `5`
- `min_order_value`: `200` · `delivery_charge`: `30`

**G. Default / fallback** *(matches when nothing else does)*
- `name`: `Default` · `active`: ✓ · `priority`: `-100`
- `zone_key`: *(blank — or `default`)*; **no** pincode/prefix/distance
- `min_order_value`: `750` · `delivery_charge`: `120`

Once these exist (with Storefront access on), the theme picks them up automatically on the next page load — no theme deploy needed.

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
// current GanguramZone selection when omitted.
var data = window.GanguramDeliveryRules.getProgressData(cartTotalPaise);

// data = {
//   rule, reason,                 // reason: exact_pincode | prefix | distance | zone | default | none
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

- `resolve(location, options)` returns just the matched rule + its values + `reason`.
- `getProgressData(cartSubtotal, location)` adds the cart‑relative numbers (remaining amounts, met flags).
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
