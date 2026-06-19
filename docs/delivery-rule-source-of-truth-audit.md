# Phase 2.11A — Delivery Rule Source-of-Truth Audit & Decision

**Status:** Audit / **decision** only. **No theme behavior, checkout, cart, settings, resolver, ShipZip/SBZ/zipLogic, or Google changes** are made by this phase.
**Repository:** `pixfortech/ganguram-shopify-theme` · **Base:** `local-4x-migration`
**Companion:** Phase 2.10B feasibility audit — `docs/checkout-feasibility-and-delivery-rules-audit.md` (landing via PR #48). This phase *decides* the §8 question that audit left open.

> ## ✅ Decision (TL;DR)
> **Source of truth = Shopify metaobjects** — a `ganguram_delivery_rule` metaobject definition, surfaced to both readers via a shop metafield `ganguram.delivery_rules` (`list.metaobject_reference`).
> It is the **only** option that is admin-editable with **no code and no `settings_data.json` churn**, is readable by **both** the theme (Liquid, for the 2.11C progress bar) **and** a Shopify Function (for future hard enforcement), and models MOV / delivery charge / free-delivery threshold / 4-hour eligibility per **zone and per pincode** with room for **future zones and distance bands** — all **additively**, without touching ShipZip / SBZ / zipLogic, the resolver, or the cart.

---

## 1. What this phase decides (and does not build)

**Decides:** which of the six candidate sources will hold the admin-editable delivery rules that Phase 2.11B builds and Phase 2.11C (progress bar) reads.

**Does NOT build (out of scope here):** the rule engine, the metaobject itself, the progress bar, MOV enforcement, delivery-charge logic, checkout logic, or any distance calculation/UI. This is a written decision + schema spec only.

---

## 2. Requirements this source must satisfy

| ID | Requirement |
|----|-------------|
| **R1** | Admin can set **minimum order value (MOV)** by **distance / pincode / zone**. |
| **R2** | Admin can set **delivery charge** by **distance / pincode / zone**. |
| **R3** | Supports **Kolkata, Quick Commerce, PAN India**, and **future zones**. |
| **R4** | Rules are **readable by the theme** so the **cart progress bar (2.11C)** can use them. |
| **R5** | Does **not break** existing **ShipZip / SBZ / zipLogic** behavior. |
| **R6** | Avoids **`settings_data.json` churn** (that file is git-synced; merchant edits there fight the repo). |
| **R7** *(derived)* | Same source is **also readable by a Shopify Function / app** so hard checkout enforcement (2.11C+ enforcement track) reads the **same** numbers — *one source, enforced once*. |

> **Note on "distance":** Shopify has no native pincode→distance. True distance needs geocoding (pincode→lat/lng) + a distance calc, which is **app/Function territory** plus a data source. The *rule model* below is distance-ready (a `distance_band` match dimension), but the **band assignment** for a pincode is deferred to the enforcement/app track. Phase 2.11B starts with **zone + pincode** matching, which covers Kolkata / Quick Commerce / PAN India today.

---

## 3. Candidate sources (recap)

1. **ShipZip / SBZ config** — the shipping app's own dashboard.
2. **Shopify metaobjects** (+ a shop metafield reference). ← recommended
3. **Theme settings** — simple slab fields in the theme editor.
4. **JSON setting** — a textarea holding a JSON rule table.
5. **Custom app / admin backend** — bespoke data store + UI.
6. **Shopify Functions / custom app** — an *enforcement mechanism*, not a data store (it must read a source).

---

## 4. Decision matrix (scored against the requirements)

`✅ strong · 🟡 partial/caveat · ❌ no`

| Requirement | 1. ShipZip/SBZ | **2. Metaobjects ★** | 3. Theme settings | 4. JSON setting | 5. Custom app/backend | 6. Functions (enforce) |
|---|---|---|---|---|---|---|
| **R1** MOV by zone/pincode (distance) | 🟡 zip-list, vendor-limited | ✅ zone+pincode · 🟡 distance (deferred) | 🟡 zone slabs only | 🟡 flexible but fragile | ✅ incl. distance | n/a (reads a source) |
| **R2** Charge by zone/pincode (distance) | 🟡 if SBZ rate-by-zip | ✅ admin-set values | 🟡 display only | 🟡 display only | ✅ | n/a |
| **R3** Zones incl. future | 🟡 its own model | ✅ add entries/zones freely | 🟡 fixed per-zone fields | ✅ but fragile | ✅ | n/a |
| **R4** Theme/progress-bar readable | ❌ separate silo | ✅ `shop.metaobjects` in Liquid | ✅ `settings.*` | ✅ parse JSON | 🟡 via app proxy/API | n/a |
| **R5** Doesn't break SBZ/zipLogic | ✅ (it *is* SBZ) | ✅ additive, read-only | ✅ | ✅ | ✅ | ✅ |
| **R6** No `settings_data.json` churn | ✅ | ✅ **none** | ❌ writes settings_data | ❌ writes settings_data | ✅ | ✅ |
| **R7** Also Function/app-readable | ❌ | ✅ (metafield reference) | ❌ Functions can't read theme settings | ❌ same | 🟡 | — |
| **Admin UX (no code)** | ✅ (vendor UI) | ✅ Settings → Custom data | ✅ theme editor | ❌ raw JSON | 🟡 build a UI | — |
| **Build cost** | low *(if re-embedded & capable)* | **low–medium** | low | low | high | medium |

**Only metaobjects score ✅ on R4 *and* R7 simultaneously** — the decisive criterion: the **theme progress bar** and a **checkout Function** must read the **same** rule, or the cart and checkout will show/enforce different numbers.

---

## 5. Decision & rationale

**Chosen: Shopify metaobjects, surfaced via a shop metafield `ganguram.delivery_rules` (`list.metaobject_reference`).**

Why it beats each alternative:

- **vs ShipZip/SBZ (1):** SBZ is a *separate silo* the theme **cannot read** (fails R4), so it can't drive the progress bar; it's also **not currently embedded** (see `docs/shipzip-popup-audit.md`). SBZ stays the **enforcement/charge** layer *if re-embedded* — but it is not the shared source of truth. (Open SBZ capability questions live in the 2.10B audit §7.)
- **vs theme settings (3) / JSON setting (4):** both live in **`settings_data.json`** → **R6 fail** (git-sync churn, merchant edits fight the repo) and **R7 fail** (Shopify **Functions cannot read theme settings**). The JSON setting is also fragile (a stray comma from an admin breaks every rule). Acceptable only as a throwaway same-day MVP.
- **vs custom app/backend (5):** the most powerful (needed eventually for **true distance** and large pincode tables) but **high build/host cost** and **not directly Liquid-readable** (R4 via proxy only). Over-kill for 2.11B; revisit when distance is required.
- **vs Functions/custom app (6):** that's the **enforcement mechanism**, *not a data store* — it must read a source. Pair it with metaobjects (it reads the metafield reference).

Metaobjects uniquely satisfy **R3–R7** together: admin-editable with no code, **zero `settings_data.json` churn**, **Liquid-readable** for the theme, **Function-readable** via the metafield reference, structured per zone/pincode, and trivially extended with new zones or a future `distance_band`.

---

## 6. The delivery-rule schema (what 2.11B will create)

**Metaobject definition** — type handle `ganguram_delivery_rule`, **Storefront access: enabled** (so Liquid can read it). One **entry per rule row**.

| Field key | Type | Required | Purpose |
|---|---|---|---|
| `name` | single line text | yes | Admin label (e.g. "Kolkata", "Quick Commerce", "PAN India", "Default"). |
| `match_type` | single line text *(one of: `zone` · `pincode` · `pincode_prefix` · `distance_band` · `default`)* | yes | How this rule is matched. |
| `match_value` | single line text | no | Zone key (`kolkata`/`quick_commerce`/`pan_india`), pincode(s), prefix(es) (comma-separated), or band id. Blank for `default`. |
| `priority` | integer | no | Tie-breaker; higher wins when two rules match. |
| `serviceable` | true / false | yes | **Guard/display only** — eligibility still comes from `GanguramZone`, never from this field. |
| `min_order_value` | decimal *(₹, shop currency)* | no | MOV for this match. |
| `delivery_charge` | decimal *(₹)* | no | Flat delivery charge (display in theme; **enforced** by SBZ/Function). |
| `free_delivery_threshold` | decimal *(₹)* | no | Subtotal at/above which the charge is waived. |
| `four_hour_eligible` | true / false | no | Whether 4-Hour delivery applies (aligns with the existing 4-hour engine). |
| `distance_band` | single line text | no | **Future** (e.g. `0-5km`); resolution deferred to the app/Function track. |
| `customer_message` | single line text | no | Optional override message for the progress bar / soft gate. |
| `active` | true / false | yes | Lets admins disable a row without deleting it. |

**Dual-read surface:** a shop metafield **`ganguram.delivery_rules`** of type **`list.metaobject_reference`** pointing at the active entries.
- **Theme (Liquid):** `shop.metaobjects.ganguram_delivery_rule.values` *(direct)* or `shop.metafields.ganguram.delivery_rules.value` *(the curated list)*.
- **Function/app:** the input GraphQL query reads `shop.metafields.ganguram.delivery_rules` → the same entries.

**Example entries** *(ILLUSTRATIVE placeholders to show the shape — real numbers are set by the admin, not by this doc):*

| name | match_type | match_value | serviceable | min_order_value | delivery_charge | free_delivery_threshold | four_hour_eligible |
|---|---|---|---|---|---|---|---|
| Kolkata | zone | `kolkata` | true | 300 | 40 | 600 | false |
| Quick Commerce | zone | `quick_commerce` | true | 400 | 60 | 800 | true |
| PAN India | zone | `pan_india` | true | 750 | 120 | 1500 | false |
| *(example pincode override)* | pincode | `700020` | true | 250 | 0 | 400 | true |
| Default | default | *(blank)* | true | 750 | 120 | 1500 | false |

> Amounts are shown in **rupees** to mirror the existing `settings.cart_free_shipping_amount` convention; the theme converts to paise (`× 100`) exactly like the current `<shipping-notice>`. A `money`-type field is an acceptable alternative if preferred.

---

## 7. Rule-resolution algorithm (define once in 2.11B; mirror in any Function)

Given the selected location (`GanguramZone.getSelectedDeliveryLocation()` → `{pincode, zone}`) and the cart subtotal, pick the rule by **most-specific-wins**, considering only `active: true` rows:

1. **Exact `pincode`** match (`match_type: pincode`, `match_value` contains the pincode).
2. **`pincode_prefix`** match (longest matching prefix).
3. **`distance_band`** match — *deferred* (only once a pincode→band map exists).
4. **`zone`** match (`match_value` == the selected internal zone).
5. **`default`** fallback.

Ties broken by higher `priority`, then first active entry. **Eligibility/zone never comes from the rule** — it stays with `GanguramZone`; `serviceable` here is only a display/guard hint.

> The theme (2.11C) and a future Function **must use the identical algorithm**, so it is specified once in 2.11B and reused verbatim.

---

## 8. Read paths — one source, two readers

| Reader | Phase | Reads | Uses it for |
|---|---|---|---|
| **Theme (Liquid → JS)** | **2.11C** | `shop.metaobjects.ganguram_delivery_rule.values` (rendered into a small config global, like the other `ganguram-*-config` snippets) | Cart **progress bar**, MOV "add ₹X more" message, free-delivery threshold, **display** delivery charge, soft checkout-button gate. **Advisory only.** |
| **Shopify Function / app** | enforcement track | `shop.metafields.ganguram.delivery_rules` via the Function input query | **Hard** MOV / serviceability validation at checkout (and charge enforcement via SBZ/Carrier Service). |

Both read the **same** metaobject entries → the cart and the checkout can never disagree.

---

## 9. Coexistence with ShipZip / SBZ / zipLogic (R5)

- Metaobjects are **additive and read-only** from the theme's side. They do **not** touch `localStorage["Zipcode"]`, the `GanguramZone` resolver, cart removal/undo, product filtering, or any app embed.
- If **SBZ is later re-embedded** for checkout enforcement + delivery charges, it remains the **enforcement layer**; ideally the admin keeps SBZ's numbers in sync with the metaobjects (or the Function replaces SBZ's MOV role). No conflict is introduced by *defining* the metaobjects now.
- **zipLogic** (product availability) is unrelated to MOV/charge and untouched.

---

## 10. Final decision — the six required answers

1. **Recommended source of truth for Phase 2.11B:** **Shopify metaobjects** (`ganguram_delivery_rule`) exposed via the shop metafield **`ganguram.delivery_rules`** (`list.metaobject_reference`).

2. **Why it's better than the others:** it is the **only** option that is admin-editable **without code**, produces **no `settings_data.json` churn** (R6), is readable by **both** the theme (R4) **and** a Shopify Function (R7), and structures rules per **zone/pincode with future-zone + distance headroom** (R1–R3) — all **without breaking** ShipZip/SBZ/zipLogic (R5). Theme settings/JSON fail R6+R7; SBZ fails R4; a custom backend is higher-cost and not directly Liquid-readable; Functions are enforcement, not a store.

3. **Fields each delivery rule needs:** `name`, `match_type` (zone/pincode/pincode_prefix/distance_band/default), `match_value`, `priority`, `serviceable`, `min_order_value`, `delivery_charge`, `free_delivery_threshold`, `four_hour_eligible`, `distance_band` *(future)*, `customer_message` *(optional)*, `active`. (Full table + example entries in §6.)

4. **What Phase 2.11B should build:** the `ganguram_delivery_rule` **metaobject definition** (storefront-access on) + the **`ganguram.delivery_rules`** shop metafield reference; **seed** Kolkata / Quick-Commerce / PAN-India + a **Default** entry (admin fills real numbers); the **read-only resolution helper** (algorithm in §7) and a **read path** (a `ganguram-delivery-rules-config` Liquid snippet that publishes the rules to JS). **No progress bar, no enforcement, no checkout change.**

5. **What the Phase 2.11C progress bar should read from:** the **metaobjects via Liquid** (the 2.11B config), combined with the live **`GanguramZone` selection** (pincode/zone) and **`cart.total_price`** — resolved through the §7 algorithm. Display/advisory only; fail-open if rules are missing.

6. **What must remain with ShipZip/SBZ or Shopify Functions:** **hard MOV enforcement / "serviceable pincode required" at checkout** → a **Cart/Checkout Validation Function** (custom app) reading `ganguram.delivery_rules`; **actual delivery-charge collection** → **SBZ (re-embedded)** or a **Carrier Service / shipping app**. The theme **never** sets the real shipping price or guarantees a block (see 2.10B §10).

---

### Related docs
- `docs/checkout-feasibility-and-delivery-rules-audit.md` — Phase 2.10B feasibility + GO/NO-GO (companion; via PR #48).
- `docs/shipzip-popup-audit.md` — SBZ/zipLogic not embedded; re-embed is an admin task.
- `docs/distance-based-delivery-architecture.md` — prior distance-zone thinking (feeds the future `distance_band`).
- `docs/zone-resolver-spec.md` — the `GanguramZone` contract the rules align to.
- `docs/separate-kolkata-delivery-from-4hour.md` — zone matrix + 4-hour split (`four_hour_eligible`).

> **Scope reminder:** This phase changed **no** theme code, settings, checkout, ShipZip/SBZ/zipLogic, Google code, pincode lists, or `settings_data.json`. It is an audit/decision document only.
