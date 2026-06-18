# Phase 2.9A — Google Places / Full‑Address Search: Feasibility & Implementation Audit

**Status: docs‑only audit. No Google Maps/Places code, no `<script>` tags, no API
key, no UI change, and no theme behaviour was added. No change to `GanguramZone`,
pincode classification, product/menu/search filtering, cart removal/undo, checkout,
MOV, date‑slot, shipping, SBZ/ShipZip/zipLogic or payment.** This document only
defines *whether* and *how* to add Amazon/checkout‑style address autocomplete to the
existing "Delivering to…" popup in a later phase (2.9B).

**Goal under audit:** let a customer **search a full address** (typeahead) to
quickly **find their pincode**, then drive the existing pincode/zone system with it.

---

## 0. Feasibility summary

- **Feasible and low‑risk** — *if* address search is treated as a **pincode‑finder
  only**, never as the delivery authority. The architecture proposed by the task is
  the correct one and is endorsed here:
  1. **Pincode stays the single business source of truth.** (`GanguramZone`.)
  2. Google address search **only helps find/extract the pincode**.
  3. On address selection → **`GanguramZone.setSelectedPincode(extractedPincode)`**
     (the *same* path the manual input, recent chips and saved addresses already use).
  4. Store only a **lightweight address summary** for display, **separate** from and
     subordinate to the resolved pincode/zone.
  5. **Product filtering and cart behaviour keep depending only on the resolved
     pincode/zone** — unchanged.
- It is **purely additive and must fail open**: if Google doesn't load / the key is
  blocked / no postal_code is returned, the existing pincode input + recent + saved
  flows keep working untouched.
- **Two hard external dependencies** the merchant must accept before 2.9B:
  a **billing‑enabled Google Cloud project** with a **referrer‑restricted browser
  key**, and the post‑March‑2025 **per‑SKU pricing** (no more $200 credit).

---

## 1. Required Google APIs

| Need | API / component | Notes |
|---|---|---|
| **Address typeahead UI** | **`PlaceAutocompleteElement`** (Maps JavaScript API → Places library, the new web component) | **Mandatory for new projects:** the legacy `google.maps.places.Autocomplete` widget is **not available to new customers as of 1 Mar 2025**. The new element returns a `Place` object, manages **session tokens** itself, and has better mobile/keyboard/screen‑reader support. *(Google — "Migrate to the new Place Autocomplete".)* |
| **Place details (fields)** | `place.fetchFields([...])` on the returned `Place` — **Essentials** field set only (`addressComponents`, `location`, `formattedAddress`, `id`) | Requesting only Essentials fields keeps it on the cheapest SKU. Do **not** request Pro/Enterprise fields (reviews, opening hours, etc.) — we don't need them. |
| **Bootstrap** | Maps JavaScript API loader (`Places` library) | A `<script>` loader is required for the element; **no map is rendered** (autocomplete only). Lazy‑load it **only when the popup opens** (cost + performance). |
| Optional later | Geocoding / reverse‑geocode | Only if we ever want to recover a pincode from lat/lng when Google omits `postal_code`. **Deferred** — adds cost and is still not guaranteed. |
| **Out of scope** | Routes API / Distance Matrix (Phase 2.6A), full Maps render | Distance pricing is a separate, **server‑side** concern (see `docs/distance-based-delivery-architecture.md`). |

**Restrictions to bake in:** restrict suggestions to **India** (`includedRegionCodes: ['in']` / `componentRestrictions: { country: 'in' }`) and to **address** result types.

---

## 2. Required Shopify / theme changes later (Phase 2.9B)

All confined to the **delivery‑location widget**, additive and reversible:

1. `snippets/delivery-location-popup.liquid` — add an **optional** "Search address"
   field above the pincode input (an empty mount point for the element); a small
   config `<script>` for the (referrer‑restricted) key + flags.
2. New `assets/ganguram-address-search.js` — lazy‑loads the Maps JS API **on popup
   open**, mounts `PlaceAutocompleteElement`, extracts + validates the pincode,
   then calls **`GanguramZone.setSelectedPincode(pin)`**. Fail‑open if the API is
   absent/blocked.
3. New `assets/ganguram-address-search.css` — scoped `.ganguram-*` styling so the
   element matches the redesigned popup.
4. `config/settings_schema.json` — a small "Ganguram — Address search" section
   (enable toggle **default off**, public key field, country restriction).
5. `layout/theme.liquid` — load the config snippet (the loader self‑gates on the
   enable flag + presence of a key).

**No** change to `GanguramZone`, the pincode lists, product/menu/search filtering,
cart logic, checkout, or any app. The element only *calls the existing resolver setter*.

---

## 3. Data‑flow diagram (text)

```
 customer types in the OPTIONAL "Search address" field (popup)
        │   (PlaceAutocompleteElement, India-restricted, session-tokened)
        ▼
 customer picks a suggestion ──► place.fetchFields(['addressComponents','location','formattedAddress','id'])  (Essentials)
        │
        ▼
 EXTRACT from addressComponents:  postal_code (PIN) · locality/city · admin_area_1 (state) · country
        │
        ├── country !== 'IN'            ─► reject: "We deliver within India only" — do NOT commit
        ├── no postal_code              ─► ask customer to type/confirm the 6-digit pincode (fall back to the existing input)
        ▼
 VALIDATE via existing resolver:  GanguramZone.classifyPincode(pin)
        │
        ├── not 6-digit / unknown / not serviceable ─► show the existing "not serviceable, try another" message — do NOT commit
        ▼
 COMMIT (same path as manual/recent/saved):  GanguramZone.setSelectedPincode(pin)
        │   └─ persists localStorage["Zipcode"] + ganguram.deliveryLocation, fires 'ganguram:delivery-location-changed'
        ▼
 EXISTING downstream (unchanged): product filter · menu/empty-collection · cart eligibility · header widget · recent list
        ▼
 STORE (display only, subordinate): a lightweight summary on the recent entry (e.g. short label) — NEVER the delivery authority
```

**The pincode is the only value that crosses into business logic.** Everything from
Google other than `postal_code` is display/record only.

---

## 4. Address‑component mapping

From `place.addressComponents` (each has `types[]` + `longText`/`shortText`):

| Business field | Google component `type` | Use | Required? |
|---|---|---|---|
| **Pincode** | **`postal_code`** | → validate → `setSelectedPincode` | **YES — the only critical field** |
| City | `locality` (fallback `postal_town`, `sublocality`) | display label only | no |
| State | `administrative_area_level_1` | display label only | no |
| Country | `country` (shortText = ISO `IN`) | **guard:** must be `IN` | yes (guard) |
| Formatted address | `place.formattedAddress` | lightweight summary display only | no |
| Lat / Lng | `place.location` | **not used now** (future distance only) | no |
| Place ID | `place.id` | optional de‑dup / future re‑lookup | no |

---

## 5. Privacy / storage plan

| Audience | Store | Do **NOT** store |
|---|---|---|
| **Guest** | reuse `ganguram.recentLocations` (pincode + zone + label + ts); optionally a **short** display label (e.g. "Beadon Street, Kolkata") | full street address, `address2`, lat/lng, `place_id`, name, phone |
| **Logged‑in** | same as guest (client‑side recent only). Shopify `customer.addresses` remains the saved‑address source — **the theme does not create/modify customer addresses** here | same as guest; **no writes to the customer account / checkout** |

Principles: **client‑side only**, cleared by the existing Clear/remove; **no precise
geolocation persisted**; address text is sent **only to Google** for the lookup (must
be covered by the store privacy policy + Google Maps Platform ToS); **never autofill
checkout**; minimise retention. The pincode — already stored as the SBZ `Zipcode`
contract — is the only durable item that matters.

---

## 6. API‑key restriction checklist (before 2.9B ships)

- [ ] A **dedicated** Google Cloud key **only** for storefront Places autocomplete
      (do **not** reuse any server‑side Routes/distance key).
- [ ] **Application restriction = HTTP referrers**: the store's live domain(s) +
      `*.myshopify.com` (for preview) — nothing else.
- [ ] **API restriction**: enable **Maps JavaScript API** + **Places API (New)** only.
- [ ] **Quota / daily caps** set per SKU; **billing budget + alerts** configured.
- [ ] **Session tokens** used for every autocomplete session (the new element does
      this automatically) — verify in network calls.
- [ ] **Essentials** Place Details field set only (`addressComponents`, `location`,
      `formattedAddress`, `id`).
- [ ] Key is injected from a **theme setting**, never hard‑coded in committed JS.
- [ ] The key is **public by necessity** (browser) — referrer + API restriction +
      quotas are the protection, not secrecy.

---

## 7. Billing / quota risks

- **Post‑1 Mar 2025**: the recurring **$200/month credit ended**; replaced by
  **per‑SKU free monthly caps** (≈ Essentials 10,000 / Pro 5,000 / Enterprise 1,000
  events). Plan for real (if usually small) cost. *(Google — Maps Platform pricing.)*
- **Autocomplete (New) session pricing**: a session links typed requests to one Place
  Details call. For sessions ending in a **Place Details Essentials** request, the
  first ~12 autocomplete requests bill on the Autocomplete Requests SKU and later
  ones fall under Autocomplete Session Usage (no extra charge). *(Google — Autocomplete
  (New) and session pricing.)*
- **Top risks → mitigations**: not using session tokens → the element handles them;
  requesting Pro/Enterprise fields → restrict to Essentials; public‑key abuse →
  referrer + API restrictions + quotas + budget alerts; loading the API on every page
  → **lazy‑load only on popup open**.

---

## 8. Failure / fallback plan

The address search is **strictly additive and fail‑open**:

| Failure | Behaviour |
|---|---|
| Maps JS API fails to load / key blocked / offline | Render **only** the existing pincode input + recent + saved (current behaviour). Never block pincode entry. |
| Suggestion returns **no `postal_code`** | Prompt: "Couldn't read a pincode — please enter your 6‑digit pincode." (focus the existing input). |
| Country `!== IN` | "We currently deliver within India only." — do not commit. |
| Pincode **invalid / not serviceable** | Reuse the existing resolver message ("That pincode is not serviceable. Please try another."). |
| `GanguramZone` missing | Do nothing (the resolver owns persistence); pincode input still works. |

There is **always** a working manual path; Google is a convenience layer only.

---

## 9. Recommended Phase 2.9B implementation plan

1. **Settings + key** (admin): add the "Address search" section — enable toggle
   (**default OFF**), public Places key, country restriction (`in`). Ship disabled.
2. **Module** `assets/ganguram-address-search.js`:
   - self‑gates on `enabled && key`; on **popup open**, lazy‑load the Maps JS API
     (Places library) once;
   - mount `PlaceAutocompleteElement` into the popup's optional search slot, India +
     address restricted;
   - on `gmp-select`/place selection → `fetchFields(Essentials)` → extract → guard
     country → **validate via `GanguramZone.classifyPincode`** → on success
     **`GanguramZone.setSelectedPincode(pin)`** (which fires the existing event);
   - record the lightweight summary alongside the existing recent entry; fail‑open
     on every error path.
3. **Markup** `snippets/delivery-location-popup.liquid`: add the optional search slot
   **above** the pincode input, clearly labelled "Search address (optional)"; pincode
   input remains primary + the fallback.
4. **CSS** `assets/ganguram-address-search.css`: scoped styling so the element matches
   the redesigned popup (desktop dropdown; mobile within the bottom sheet, no overflow).
5. **Validate**: DOM‑shim test of the extract→validate→commit logic (mock the Place
   object), plus the fail‑open paths; confirm product/cart behaviour unchanged
   (still driven only by the resolved pincode).
6. **Out of scope for 2.9B** (explicit): no checkout autofill, no writing Shopify
   customer addresses, no distance/Routes calls, no lat/lng business use.

---

## 10. GO / NO‑GO

- ✅ **GO (conditional)** to build Phase 2.9B as a **pincode‑finder**: an optional,
  fail‑open `PlaceAutocompleteElement` in the existing popup that extracts +
  validates a pincode and commits via the existing `GanguramZone.setSelectedPincode`.
  **Gated on**: merchant provides a billing‑enabled project + **referrer/API‑restricted**
  public key and accepts the post‑2025 per‑SKU pricing; lazy‑load on popup open;
  Essentials fields only; privacy‑minimal storage; pincode stays source of truth.
- ⛔ **NO‑GO** on anything that makes Google the **delivery authority**, **autofills
  checkout**, **writes Shopify customer addresses from the theme**, stores **full
  address / lat‑lng / place_id for guests**, changes the **`GanguramZone` API or
  pincode lists**, or loads the Maps API on **every page**.

---

### Sources (Google platform facts verified for this audit)

- Google — Migrate to the new Place Autocomplete (legacy `Autocomplete` unavailable to new customers since 1 Mar 2025; use `PlaceAutocompleteElement`): https://developers.google.com/maps/documentation/javascript/legacy/places-migration-autocomplete
- Google — Places API usage & billing (per‑SKU free caps; Essentials/Pro/Enterprise): https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- Google — Autocomplete (New) and session pricing (session tokens; per‑session billing): https://developers.google.com/maps/documentation/places/web-service/session-pricing
- Google — Maps Platform core services pricing: https://developers.google.com/maps/billing-and-pricing/pricing

*Audit only — no code changed. Google platform facts verified via official
documentation (June 2026); theme integration grounded in the existing `GanguramZone`
resolver + the delivery‑location popup. Address search is recommended only as a
pincode‑finder; the pincode/zone remains the single source of truth for all
product/cart behaviour.*
