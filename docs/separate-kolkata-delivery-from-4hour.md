# Hotfix — Separate normal Kolkata distance delivery from "4 Hours Delivery"

**Status: docs-only audit + admin checklist. No theme behaviour, Liquid, JS, CSS,
cart-attribute, checkout, MOV, date-slot, shipping, pincode/product-filtering or
mobile-pincode logic was added or changed. No Google API, no saved addresses, no
hard-coded 4-hour timing.**

**P0 symptom:** for a Kolkata address inside the **0–5 km** slab, checkout shows
the shipping option **"4 Hours Delivery"** (at ₹50) instead of a normal
**"Delivery"** option. The *price* is correct; the shipping option's *name /
identity* is wrong.

**Verdict:** the issue is **admin / ShipZip-side, not theme-side.** No theme code
produces, names, or selects a checkout shipping method, so there is nothing to fix
in the theme. The normal **Order Distance** distance-slab rate is currently
named/grouped as **"4 Hours Delivery"** inside ShipZip — rename it. The
implementation work is the **ShipZip admin checklist** in §3.

---

## 1. Audit — where does the "4 Hours Delivery" checkout label come from?

The checkout shipping option name comes from the **rate source** (the app/Shopify
that returns the rate), never from the storefront theme. Exhaustive search of
`local-4x-migration` confirms the theme is not the source.

### 1.1 What was searched

`4 hours` · `4-hour` · `4-hour-delivery` · `Quick Commerce` / `quick_commerce` ·
`note_attributes` / `cart.attributes` / `attributes[` / `/cart/update` ·
`shipping_method` / `shipping_rate` / `presentment_name` / `rate.name` /
`delivery_method` · `local delivery` / `kolkata delivery` ·
`carrier_service` / `sbz` / `cirkle` / `shipzip`, plus `config/settings_data.json`
app blocks/embeds. (Locale bundles excluded as noise.)

### 1.2 What was found — every "4-hour" / "Quick Commerce" hit is display-only

| Reference | File(s) | What it is | Touches checkout rate? |
|---|---|---|---|
| `window.GanguramQuickCommerceHandles = ['4-hour-delivery']` | `snippets/ganguram-zone-visibility-config.liquid` | **Collection handle** for the product-display filter | **No** — controls which *products* show in a grid |
| `4-hour-delivery` / "4 Hours Delivery" mentions | `assets/ganguram-product-zone-filter.js`, `assets/ganguram-zone-visibility.js`, `snippets/collection-panel.liquid` | Product/menu **display visibility** by zone | **No** |
| `Quick Commerce` product tag, `quick_commerce` zone | `snippets/product-item.liquid`, `sections/helper-predictive-search.liquid`, `assets/ganguram-zone-resolver.js` | Product **tag stamping** + pincode **zone label** ("Quick Commerce 700001") | **No** |
| `open-24-hours` | `snippets/icon-pack.liquid`, `sections/header.liquid` etc. | An unrelated **store-hours icon** | **No** |
| "4 Hours Delivery" prose | `docs/*.md` | **Documentation** | **No** |

### 1.3 What was found — the theme writes NO checkout-affecting data

| Channel a theme *could* use to influence checkout | Result in this theme |
|---|---|
| **Cart attributes / note_attributes** (`/cart/update?attributes…`) | **None written.** The only `note` usage is the standard customer **order-note** textarea (`name="note"`, `cart.note`) — unrelated to shipping selection. |
| **Shipping method / rate names** | **None set.** `component-shipping-calculator.js` only **reads** `/cart/shipping_rates.json` (`presentment_name`) to *display* an estimate; `customers-order.liquid` only **reads** `order.shipping_methods.title` for order history. |
| **App embeds / shipping config** | `config/settings_data.json` → **0 app blocks**; contains none of `4 hour`, `shipzip`, `sbz`, `cirkle`, `carrier`, `shipping_rate`, `shopify://apps`. |
| **SBZ/ShipZip interaction from theme** | Only `ganguram-zone-resolver.js` mirrors the **pincode** to `localStorage["Zipcode"]` (the SBZ contract key). That is the *pincode*, **not** a shipping method, rate, or "4-hour" flag. |

### 1.4 Existing docs reviewed

- `docs/distance-based-delivery-architecture.md` — confirms ShipZip (`Order
  Distance` tier) is the **trusted rate source**; the theme is preview/UX only.
- `docs/pincode-architecture-audit.md`, `docs/shipzip-popup-audit.md` — confirm the
  4.0 theme carries **no** ShipZip/SBZ/zipLogic code and **no** checkout-rate logic;
  SBZ owns checkout gating/date-slot/MOV; the theme only reads/sets the pincode.

### 1.5 Source of the label

| Candidate source | Verdict |
|---|---|
| **Theme code** | ❌ Ruled out — no rate names, no cart attributes, no app embeds. |
| **Cart attributes** | ❌ Theme writes none that relate to shipping. |
| **ShipZip settings** | ✅ **This is the source** — the `Order Distance` distance-slab rate is named/grouped as "4 Hours Delivery". |
| **SBZ/cirkleinc app** | ✅ Same app family (ShipZip = SBZ ShippingApp). The rate name lives in its admin. |
| **Shopify shipping profile/rate name** | ➖ Possible secondary location if the rate's display name is set at the Shopify shipping-zone level — verify alongside ShipZip (see §3). |

**Conclusion:** normal distance-based delivery and 4-Hours delivery are **conflated
in ShipZip rate configuration**, not in the theme. The distance slab (correct: ₹50
for 0–5 km) is just wearing the wrong name ("4 Hours Delivery").

---

## 2. Target model — two independent things

1. **Normal Kolkata delivery = distance-based.** A single local-delivery method
   whose price comes from the **Order Distance** slabs. It should be named
   **"Delivery"** (or "Local Delivery" / "Kolkata Delivery"). **Distance alone must
   never rename this into "4 Hours Delivery".**
2. **4 Hours Delivery = a separate, time-/service-based option.** A distinct
   rate/service that is available only when its **own** conditions are met
   (eligible Quick-Commerce products + eligible Kolkata pincode + an
   admin-enabled time window). It is **not** a function of distance and is **not**
   offered to PAN India.

| | Normal Kolkata Delivery | 4 Hours Delivery |
|---|---|---|
| Driver | **Distance** (Order Distance slabs) | **Time window + product/zone eligibility** |
| Name at checkout | **Delivery** / Local Delivery / Kolkata Delivery | 4 Hours Delivery |
| 0–5 km address | **₹50 "Delivery"** ✅ | must **not** auto-attach here ❌ |
| PAN India | existing PAN India shipping (unchanged) | **never offered** |
| Controlled by | ShipZip Order Distance rate | ShipZip time/eligibility settings (admin) — **not theme** |

Confirmed normal-delivery slabs (unchanged): **0–5 km ₹50 · 5.01–10 km ₹70 ·
10.01–15 km ₹100 · 15.01–20 km ₹150**. Confirmed 4-hour **collection** handle
(product display only): `4-hour-delivery`.

---

## 3. ShipZip admin checklist (the actual fix — admin task, no theme change)

Do all of this in the **ShipZip app admin** (and the Shopify **Settings →
Shipping** zone where the rate name surfaces):

1. **Rename the normal distance rate.** Find the **Order Distance** rate that
   carries the 0–5/5–10/10–15/15–20 km slabs and **rename the method from
   "4 Hours Delivery" to "Delivery"** (or "Local Delivery" / "Kolkata Delivery").
   This is the single change that fixes the P0 symptom.
2. **Keep the Order Distance slabs under that normal local-delivery method**,
   unchanged: 0–5 km ₹50 · 5.01–10 km ₹70 · 10.01–15 km ₹100 · 15.01–20 km ₹150.
3. **Make "4 Hours Delivery" a separate rate/service** — only **if** ShipZip
   supports time-based / admin-controlled availability. It must be its **own**
   method, independent of the distance slabs.
4. **Detach "4 Hours Delivery" from the 0–5 km (and every) distance slab.** A
   short-distance address must surface **"Delivery ₹50"**, never "4 Hours
   Delivery" by virtue of being nearby.
5. **Hide "4 Hours Delivery" for PAN India** — restrict it to the Kolkata/QC
   serviceable area so non-Kolkata addresses never see it.
6. **Gate "4 Hours Delivery" to Quick-Commerce / eligible products + admin-enabled
   time windows** — it should appear only when the cart qualifies (eligible
   products), the pincode is an eligible Kolkata/QC pincode, and the current time
   is inside the configured express window.

> If the distance rate's **display name** is actually set at the Shopify
> shipping-zone level (Settings → Shipping → the rate's name), rename it there too —
> verify both ShipZip and the Shopify zone so the checkout label is consistent.

---

## 4. Admin-control requirement — where should 4-Hours availability live?

"4 Hours Delivery" must be **admin/backend-controlled, never hard-coded in the
theme.** Audit of where that control should live:

| Control location | Can it gate 4-Hours by **product**? | By **pincode/zone**? | By **time window**? | Recommendation |
|---|---|---|---|---|
| **ShipZip / SBZ (cirkleinc)** | Likely (eligibility rules) | Yes (it already gates by pincode) | **This app already owns delivery date/time-slot** | ✅ **Primary** — put the 4-Hours service + its time window + eligibility here. |
| **Shopify delivery profile / shipping zone** | Yes (separate profile per product set) | Yes (zones) | ❌ No native time-of-day rule | ➖ Use to keep 4-Hours a **distinct rate/zone**, but it can't do time windows alone. |
| **Future custom app / metafield + Shopify Function** | Yes (read eligible-product metafield) | Yes | Yes (Function reads a business-hours metafield to **hide/show** the option) | 🔮 **Only if ShipZip lacks time windows** — *document, don't build now.* A Delivery-Customization Function can hide/show (not price) the 4-Hours option based on an admin metafield. |
| **Theme** | — | — | — | ⛔ **Never.** No hard-coded 4-hour timing in theme (strict rule). The existing `4-hour-delivery` *collection* handle is **display-only** and stays. |

**Decision:** control the 4-Hours service in **ShipZip first** (separate rate +
its time-window/eligibility settings). **Only if** ShipZip cannot express a
time-of-day window, the **future** path is a Shopify **Delivery Customization
Function** reading an **admin metafield** (eligible products + business-hours
window) to hide/show the 4-Hours option — **documented here as future work, not
implemented**, and even then it would only hide/show (the price stays with
ShipZip/Shopify). **No custom time-window logic is added in this PR**, in theme or
elsewhere.

---

## 5. Validation

### 5.1 Checkout rate labels — admin verification (after the §3 rename)

These are **ShipZip/checkout admin checks** (the theme cannot set or test rate
names; verify on the store after the rename):

- [ ] Kolkata address **0–5 km** → checkout shows **"Delivery" ₹50** (not "4 Hours Delivery").
- [ ] Kolkata address **5.01–10 km** → **"Delivery" ₹70**.
- [ ] Kolkata address **10.01–15 km** → **"Delivery" ₹100**.
- [ ] Kolkata address **15.01–20 km** → **"Delivery" ₹150**.
- [ ] **PAN India** address → **no 4 Hours Delivery** and **no Kolkata distance slabs** (existing PAN India shipping only).

### 5.2 Theme-side behaviour — confirmed unchanged (no code touched)

Because **no theme files were modified**, the display/UX layers are intact. The
product-display matrix was re-run against the real asset files as evidence:

- ✅ **`4-hour-delivery` collection** — re-ran the visibility matrix (8 tag combos ×
  3 zones × 2 contexts + no-pincode) → **49 checks, 0 failures**: in the 4-Hours
  (quick) context only **Quick Commerce** products show; **PAN India** sees the
  4-Hours context fully hidden; Kolkata/QC see it. (Menu/tile link for the 4-Hours
  collection remains hidden for PAN India — covered by the prior hotfix.)
- ✅ **Cart guard + pincode popup** — untouched (`ganguram-delivery-popup.*`,
  `ganguram-delivery-widget.*` unchanged); still function as before.
- ✅ **No icon/widget styling regression** — no CSS/markup changed
  (`ganguram-delivery-widget.css` and friends untouched).

### 5.3 Distance slabs / PAN India / pincode classification — untouched

No change to the distance slabs, PAN India shipping, pincode classification, or the
product-filtering matrix (strict rules honoured).

---

## 6. Compliance

- **Fix location:** **admin / ShipZip-side** (rate rename + separation). **No
  theme-side fix was required or made.**
- **Files changed:** only this doc — `docs/separate-kolkata-delivery-from-4hour.md`.
  **No** Liquid/JS/CSS/config code changed.
- **No hard-coded 4-hour timing** was added anywhere (theme or otherwise); the
  4-Hours time window stays an **admin/app setting**.
- Strict rules honoured: product-filtering matrix untouched, pincode classification
  untouched, distance slabs untouched, PAN India shipping untouched, no Google API,
  no saved addresses, no mobile pincode placement, no checkout/MOV/date-slot/shipping
  code changed (audited references only).

*Audit verified on `local-4x-migration`; theme confirmed not to be the source of the
"4 Hours Delivery" checkout label. Remaining action is the §3 ShipZip admin rename +
the §5.1 checkout verification.*
