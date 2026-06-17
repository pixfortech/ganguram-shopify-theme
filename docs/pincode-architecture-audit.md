# Phase 2.0 — Pincode / Address / Zone Logic Audit (read-only)

**Status:** Audit only. No pincode/ShipZip/cart/checkout/visibility code was changed.
Purpose: understand the existing pincode/zone architecture before building the
Amazon-style "Delivering to…" widget, saved-address popup, or zone banners.

Sources compared: **4.0** = `local-4x-migration` (HEAD); **2.3.2** = tag
`v2.3.2-pre4x` (the live theme). Quantitative signal: a search for
`pincode|zipcode|postal|shipzip|sbz|serviceable|quick.?commerce|pan.?india`
returns **9 incidental matches in 4.0** vs **186 in 2.3.2**.

---

## 0. TL;DR + STOP/GO

- The Kolkata / PAN India / Quick Commerce **zone logic is custom theme code**, not the apps. It lives **entirely in 2.3.2** and is **completely absent from the clean 4.0 branch**.
- Two external apps sit underneath it: **zipLogic** (product/collection availability, cookies, app proxy) and **SBZ ShippingApp** (`sbz.cirkleinc.com` — checkout gating + delivery date/slot + MOV).
- The resolved pincode is persisted in **`localStorage["Zipcode"]`**; the zone is **recomputed from hardcoded pincode lists** every time (duplicated in `theme.liquid` and `header.liquid`). State is fragmented across **3 stores** (sessionStorage `ZipAdd`, localStorage `Zipcode`, cookies).
- **STOP/GO for the "Delivering to…" widget:** **GO to design/spec; STOP on implementation until a clean zone-resolution layer exists on 4.0.** The widget needs a resolved zone to read, and 4.0 currently has none. Build the resolution layer (Phase 2.1a) first, then the widget (Phase 2.1b). The widget must **only read/set** the pincode — it must **never** re-implement cart removal, checkout gating, or MOV (those stay with the apps).

---

## 1. Current pincode architecture (2.3.2)

Flow today:

1. **Entry** — Header has a pincode modal with input `#zipp_code` (6-digit, numeric-only) and an "Enter" button (`.code-click`). Source: `sections/header.liquid`.
2. **Validate + transient store** — `myFunction()` validates 6 digits and writes the raw pincode to **`sessionStorage["ZipAdd"]`**.
3. **Zone classification (theme code)** — the pincode is matched against two hardcoded strings:
   - `kolkata_pincode` (~180 Kolkata/Howrah codes: 700xxx, 711xxx, 712xxx)
   - `quick_commerce_pincode` (~75 codes, a subset)
   - Result → a tag array: `['Kolkata']`, `['Kolkata','Quick Commerce']`, or `['PAN India']` (anything not in either list). **These lists are duplicated verbatim in `layout/theme.liquid` (≈L356–371) and `sections/header.liquid` (≈L378–390).**
4. **Apply (theme JS)** — `assets/section-header.js` `zipcode()` fetches `/collections/all/products.json?limit=500` (or product/collection JSON), reads each product's `tags`, and toggles CSS classes `code-active` / `code-deactive` on `.product-item` elements to **show/hide products by zone**. It also:
   - shows/hides menu items via `.menu-link[href=…]` lists (`get_data_url`) → **menu hiding**;
   - hides search results (`.template-search .product-item[data-handle=…] { display:none }`) → **search hiding**;
   - updates `#CollectionProductCount` and `.pincode` display nodes;
   - **persists `localStorage["Zipcode"] = pincode`** (the durable resolved value);
   - in some branches performs a **hard redirect to `/`** when a viewed product is ineligible for the chosen zone.
5. **Zone banner** — `header.liquid` also drives a zone-specific announcement slider: it shows the `.code-base-slide` whose `.c-slide[data-tag]` equals the joined zone string (e.g. `Kolkata,Quick Commerce`). **A zone-banner mechanism already exists.**
6. **Mixed-cart enforcement (theme JS)** — `Get_pin()` in `section-header.js`: when the cart holds items not eligible for the chosen zone (`.cart-item.no_tag` in Kolkata, or `.cart-item.Kolkata` in PAN), it **auto-removes them** via synchronous `POST /cart/change.js {quantity:0}` (`async:false`), records them in a `remove_product` cookie, lists them in `.mss_product` ("Affected items:"), and re-renders the cart (`?section_id=helper-cart`).
7. **Checkout gating + date/slot + MOV (SBZ app)** — `snippets/SbzShippingAppCode.liquid` (loaded when `content_for_header contains 'sbzstag'`): reads `localStorage["Zipcode"]`, compares to `.custom-pincode-button[data-code-list]`; if serviceable it injects the date/slot picker after the cart subtotal and **disables `[name="checkout"]`** until satisfied. Loads `https://sbz.cirkleinc.com/assets/js/front/csShippingAppV3.js` + `sbz_jquery.js` + `sbz_datepicker.js`. MOV (₹300 hyperlocal) is enforced inside the external app (`p.order_must` hook).
8. **Product-page availability (zipLogic app)** — `snippets/zipLogic.liquid`: a separate "Deliver to <zip>" checker on product pages. Reads `shop.metafields.zipLogic.formSettings`/`appSettings`, fetches the zipcode dataset from app proxy **`/a/zipLogic?action=getZipCodes`**, and stores state in **cookies** (`zipCodeVal`, `zipIs` = `PB`/`CB`/`NA`/global, `availProds*`, `availColls*`). Pulls in jQuery 3.6.0, Bootstrap 4.5.2 and FontAwesome 5.15.3 from CDNs.

Liquid stamps the zone CSS classes that all the JS keys off. Every product/cart/search item is rendered with classes derived from its tags:
`pan_code` (PAN India), `Kolkata`, `no_tag` (PAN India), `all_pro` (both) — in
`snippets/product-item.liquid`, `snippets/cart-form.liquid`,
`sections/helper-predictive-search.liquid`.

---

## 2. Files & apps involved (2.3.2)

| File / app | Role |
|---|---|
| `sections/header.liquid` | Pincode modal + input, zone classification (hardcoded lists), zone banner slider |
| `layout/theme.liquid` | **Duplicate** copy of the pincode lists + classification |
| `assets/section-header.js` | Apply zone (show/hide products, menu, search), persist `localStorage["Zipcode"]`, **auto-remove ineligible cart items**, hard redirects |
| `snippets/product-item.liquid` | Stamps `pan_code`/`Kolkata`/`no_tag` classes on product cards; per-tag (`Quick Commerce`) markup |
| `snippets/cart-form.liquid` | Stamps `pan_code`/`Kolkata`/`no_tag`/`all_pro` on cart items |
| `sections/helper-predictive-search.liquid` | Stamps zone classes on search results |
| `assets/component-facets.js`, `assets/component-predictive-search.js` | Filter products by `product.tags == 'Kolkata'` |
| `snippets/zipLogic.liquid` + `sbz_*`/`config/settings_data.json` | **zipLogic app**: product-page availability, cookies, `/a/zipLogic` proxy, shop metafields |
| `snippets/SbzShippingAppCode.liquid`, `assets/sbz_*`, `assets/sbz_csShippingApp.css` | **SBZ ShippingApp** (cirkleinc.com): checkout gating, date/slot, MOV |
| `locales/bn.json` | Bengali strings for the pincode UI |

**External dependencies pulled in:** jQuery (googleapis), Bootstrap 4.5.2 (maxcdn),
FontAwesome 5.15.3 (cloudflare), `sbz.cirkleinc.com` app JS, `/a/zipLogic` app proxy.

---

## 3. Source of truth

- **Resolved pincode (durable):** `localStorage["Zipcode"]` — set throughout `section-header.js`, read by the SBZ app and on page load to re-apply. **This is the de-facto canonical store** and the value a widget should read.
- **Resolved pincode (transient, on input):** `sessionStorage["ZipAdd"]` — set by `header.liquid`. Redundant with the above.
- **Zone (Kolkata/QC/PAN):** **not stored** — recomputed on demand from the hardcoded pincode lists (and the `.custom-pincode-button[data-code-list]` serviceable list).
- **Product/collection availability (zipLogic):** cookies `zipCodeVal`, `zipIs`, `availProds*`, `availColls*`; dataset from `/a/zipLogic?action=getZipCodes`; config from `shop.metafields.zipLogic.*`.
- **Removed-items tracker:** cookie `remove_product`.

Net: the source of truth is **fragmented across 3 stores and several files**, with the zone derived (not stored) and the pincode lists duplicated.

---

## 4. 4.0 vs 2.3.2

| Capability | 2.3.2 (live) | 4.0 (`local-4x-migration`) |
|---|---|---|
| Pincode entry UI (`#zipp_code` modal) | ✅ `header.liquid` | ❌ absent |
| Hardcoded zone pincode lists | ✅ (duplicated ×2) | ❌ absent |
| Zone apply / show-hide / menu+search hide JS | ✅ `section-header.js` | ❌ absent |
| Zone CSS classes on items | ✅ product-item/cart/search | ❌ absent |
| Auto-remove ineligible cart items | ✅ `Get_pin()` | ❌ absent |
| Zone banner slider | ✅ `.code-base-slide` | ❌ absent |
| zipLogic app snippet | ✅ `zipLogic.liquid` | ❌ absent |
| SBZ ShippingApp snippet/assets | ✅ `SbzShippingAppCode.liquid` | ❌ absent |
| App embeds in `settings_data.json` | ✅ | ❌ absent |

**The clean 4.0 theme has no pincode system at all.** The 9 matches in 4.0 are
incidental (stock `customers-addresses.liquid` "postal" field, locale strings,
`component-shipping-calculator.css`, and the Phase 1.9E "by pincode" copy).

---

## 5. Risks

1. **Nothing to read on 4.0 yet** — a widget built now would have no resolved zone source. (Primary blocker.)
2. **Fragmented state (3 stores)** — sessionStorage `ZipAdd` + localStorage `Zipcode` + cookies. Easy to desync; must be consolidated to **one** source of truth.
3. **Duplicated pincode lists** — same ~180/~75 codes hardcoded in `theme.liquid` *and* `header.liquid`. Any change must be made twice today; porting should single-source them (snippet or shop metafield).
4. **Synchronous cart mutation** — `Get_pin()` removes items with `async:false` AJAX in a loop; blocks the main thread and is fragile. Business-critical (mixed-cart rule) — must be ported carefully, not casually rewritten.
5. **Hard redirects to `/`** — jarring UX on zone mismatch; should be reconsidered, but it is current behaviour.
6. **Heavy external deps** — jQuery, **Bootstrap 4.5.2**, **FontAwesome 5.15.3**, `cirkleinc.com`. 4.0 is jQuery-light/Bootstrap-free; re-introducing these would regress performance. The widget should be vanilla JS and **not** depend on them.
7. **App coupling** — checkout gating, date/slot and MOV live in the **SBZ external app**; zipLogic availability lives in the **zipLogic app**. These must be re-installed/embedded on the 4.0 store, not reimplemented.
8. **`localStorage["Zipcode"]` key is a contract** — the SBZ app reads exactly that key. Any new resolver must keep the **same key** or the app breaks.

---

## 6. What can be safely reused

- **The pincode data** — the Kolkata and Quick-Commerce code lists (treat as data; single-source them in a snippet or `shop.metafields`).
- **The classification rule** — `in kolkata→Kolkata (+Quick Commerce if in QC list); else PAN India`. Port as one clean function.
- **`localStorage["Zipcode"]`** — keep the same key (SBZ contract) as the widget's read/write target.
- **The zone-banner concept** — `.code-base-slide[data-tag]` already maps zone→banner; reusable for the new zone banners.
- **Shopify `customer.addresses`** — stock; usable for logged-in saved-address prefill. `sections/customers-addresses.liquid` already exists in 4.0.
- **Tag taxonomy** — products already carry `Kolkata` / `PAN India` / `Quick Commerce` tags (210 / 97 / 147). No tag work needed.

---

## 7. What must NOT be duplicated or rebuilt

- **ShipZip / SBZ checkout gating, delivery date/slot, MOV (₹300)** — external app. Re-embed; do not reimplement.
- **zipLogic product/collection availability** — external app. Re-embed; do not reimplement.
- **Mixed-cart auto-removal** — port the existing rule as-is if/when needed; do **not** invent a new cart-mutation flow in the widget.
- **A second pincode store** — do not add another key; converge on `localStorage["Zipcode"]`.
- **A second copy of the pincode lists** — single-source them this time.

---

## 8. Feasibility of the specific asks

| Ask | Verdict | Notes |
|---|---|---|
| **Q8 — header widget reads the resolved zone** | ✅ *once the resolver exists* | Read `localStorage["Zipcode"]`, classify via the shared function, render "Delivering to <pincode> · <zone>". Cannot read anything until the resolver is ported to 4.0. |
| **Q9 — saved addresses for logged-in customers** | ✅ feasible | Use Shopify `customer.addresses` (each has `zip`). Offer the customer's address zips in the change-pincode popup; default to `customer.default_address.zip`. |
| **Q10 — guest users via localStorage** | ✅ feasible | Exactly today's model (`localStorage["Zipcode"]`). Persist guest pincode there. |
| **Q11 — checkout autofill** | ⚠️ limited | Shopify's hosted checkout can't be reliably autofilled from theme JS (no `checkout.liquid` without Plus/Checkout Extensibility). Best we can do is pass the pincode as a **cart attribute** for visibility; the SBZ app already gates checkout. Do **not** promise address autofill into the hosted checkout. |

---

## 9. Recommended Phase 2.1 plan

**2.1a — Clean zone-resolution layer (prerequisite, no app/cart/checkout changes)**
1. Add one snippet, e.g. `snippets/zone-resolution.liquid` (+ a small vanilla JS), holding a **single** copy of the Kolkata + Quick-Commerce lists (or, better, read from `shop.metafields` to avoid hardcoding) and one `classifyPincode(pc) → { zone, serviceable }` function.
2. Store the pincode in **`localStorage["Zipcode"]`** (same key as SBZ) and optionally mirror to a **cart attribute** for server-side awareness. No third store.
3. Expose the resolved value on `window` for other components to read. **Do not** wire any show/hide, cart removal, menu/search hiding, or checkout gating in this step.

**2.1b — "Delivering to…" header widget (read/set only)**
4. Header block: "Delivering to <pincode> · <zone> ▸" reading the resolver; click opens a change-pincode popup (reuse the existing modal pattern, vanilla JS — **no Bootstrap/FontAwesome**).
5. Logged-in: list `customer.addresses` zips + default; guest: free-entry saved to `localStorage`.
6. Widget strictly **reads/sets pincode + shows zone**. It must not gate checkout, remove cart items, or enforce MOV.

**2.1c — Re-embed the apps on the 4.0 draft (verify, don't rebuild)**
7. Re-install/enable **zipLogic** and **SBZ ShippingApp** on the store so their snippets/embeds attach to 4.0; verify checkout gating, date/slot, MOV and product-page availability still work against `localStorage["Zipcode"]`.

**2.1d — Port mixed-cart + visibility rules last (separate, careful phases)**
8. Only after 2.1a–c, port the show/hide and mixed-cart-removal rules into clean 4.0 components — single-sourced, vanilla, debounced (no `async:false`), and as their own reviewed PRs.

Order: **2.1a → 2.1b (+ app re-embed 2.1c) → 2.1d**. The widget ships in 2.1b on top of 2.1a.

---

## 10. STOP/GO decision

**GO** to design and build the "Delivering to…" widget — **conditionally**:

- ✅ **GO now:** finalise the widget spec and build the **clean zone-resolution layer (2.1a)** — it is well understood, low-risk, and unblocks everything.
- ⛔ **STOP / do-not-yet:** building the widget UI against the current 4.0 branch *before* 2.1a exists. There is no resolved zone to read; 4.0 has no pincode system. Building the widget on nothing would force it to re-implement resolution (and tempt it into gating/removal) — exactly what must be avoided.
- ⛔ **Never (in the widget):** checkout gating, cart auto-removal, MOV, date/slot, or product/collection availability — those belong to the SBZ and zipLogic apps and must be re-embedded, not rebuilt.

**Recommendation:** proceed to **Phase 2.1a (zone-resolution layer)** as the next implementation step, then ship the widget in **2.1b**. Keep `localStorage["Zipcode"]` as the shared key, single-source the pincode lists, and treat the apps as the owners of gating/MOV/slots.

---

*Audit only — no code changed. All file/line references are from `v2.3.2-pre4x`;
4.0 status verified on `local-4x-migration` HEAD.*
