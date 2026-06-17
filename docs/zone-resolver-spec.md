# Phase 2.1a — Delivery Zone Resolver (spec + foundation)

Clean, dependency-free pincode → zone resolution layer for Local 4.0, built
**before** the "Delivering to…" widget. Foundation only: it classifies, stores,
and announces a delivery location. **No UI, and no cart / checkout / MOV /
date-slot / shipping / zipLogic / product-visibility / menu / search / banner /
collection-filtering logic** — those stay with the SBZ + zipLogic apps and later
phases (2.1b widget, 2.2 saved-address popup, 2.3 resolver-driven filtering,
2.5 cart attributes/messages).

## 1. Where it lives (decision)

| Concern | Decision |
|---|---|
| Logic + data | **One asset file:** `assets/ganguram-zone-resolver.js` (pure function, storage, events, helpers, and the single copy of the pincode lists). Cached by the browser; not re-sent per page. |
| Load point | **One loader snippet:** `snippets/zone-resolver.liquid` → `<script … defer>`. |
| Wiring | Rendered **once** in `layout/theme.liquid` immediately before `</body>` (a single `{% render 'zone-resolver' %}` line). |
| Theme settings/schema | **Not needed.** ~225 pincodes are unsuitable for editor text fields; an override seam (below) covers future config without schema. |

## 2. File structure

```
assets/ganguram-zone-resolver.js   # the resolver (single source of truth)
snippets/zone-resolver.liquid      # 1-line loader (defer)
layout/theme.liquid                # +1 render line before </body>
docs/zone-resolver-spec.md         # this spec
```

## 3. Migrating the 2.3.2 lists without duplication

- 2.3.2 hardcoded the Kolkata (~180) and Quick-Commerce (~75) lists **twice**
  (`layout/theme.liquid` **and** `sections/header.liquid`).
- Here they are migrated into **exactly one place** — `DEFAULT_CONFIG` at the top
  of `ganguram-zone-resolver.js` (153 Kolkata + 72 Quick-Commerce codes, copied
  verbatim from `v2.3.2-pre4x`; Quick-Commerce is a confirmed subset of Kolkata).
- **Override seam (still single-source):** define `window.GanguramZoneConfig =
  { kolkata, quickCommerce, labels }` *before* the script to feed lists from
  Liquid or `shop.metafields` later. If it is absent, the JS default is used.
  There is never a second copy — the seam replaces the source, it doesn't clone it.

## 4. How future UI reads the resolver

Global API: **`window.GanguramZone`**

| Member | Type | Purpose |
|---|---|---|
| `classifyPincode(pin[, cfg])` | pure | `pin → result` (no side effects, never throws) |
| `getSelectedPincode()` | read | current pincode string (`''` if none) |
| `getSelectedDeliveryLocation()` | read | current `result` object |
| `setSelectedPincode(pin)` | write | classify, persist, dispatch event, return `result` |
| `clearSelectedDeliveryLocation()` | write | clear storage, dispatch, return unknown `result` |
| `EVENT_NAME` | const | `"ganguram:delivery-location-changed"` |
| `getConfig()` | read | resolved config (for tests) |

**Result object**
```js
{ pincode, zone, label, isKolkata, isPanIndia, isQuickCommerce, isServiceable }
// zone ∈ "kolkata" | "quick_commerce" | "pan_india" | "not_serviceable" | "unknown"
```

**Event** — every set/clear dispatches on `window`:
```js
window.addEventListener('ganguram:delivery-location-changed', e => {
  const loc = e.detail;            // the result object
  // 2.1b widget updates "Delivering to <loc.pincode> · <loc.label>"
});
```
The 2.1b widget therefore only needs to: read `getSelectedDeliveryLocation()` on
load, call `setSelectedPincode()` on change, and listen for the event. No other
phase needs to know how zones are computed.

`zone` notes: `quick_commerce` implies `isKolkata` (express within Kolkata).
`not_serviceable` is reserved for a future config rule and is **not** emitted by
the default classifier (parity with 2.3.2, where every valid pincode is at least
Pan-India).

## 5. SBZ compatibility

- `setSelectedPincode()` writes the raw pincode to **`localStorage["Zipcode"]`** —
  the exact key the SBZ ShippingApp reads — plus a richer namespaced snapshot
  `localStorage["ganguram.deliveryLocation"]`.
- `getSelectedPincode()` prefers the namespaced snapshot and **falls back to the
  legacy `Zipcode` key**, so a value set by SBZ/old code is still understood.
- The key name is treated as a contract and **must not be renamed**. This layer
  does not call, gate, or modify SBZ behaviour — it only keeps the key in sync.
- `sessionStorage["ZipAdd"]` (the old transient key) is **not** used as a source
  of truth here.

## 6. Test matrix (verified)

Run against the built resolver (Node shim); all pass:

| Input | zone | isKolkata | isPanIndia | isQuickCommerce | isServiceable |
|---|---|:--:|:--:|:--:|:--:|
| `700008` (Kolkata) | `kolkata` | ✓ | – | – | ✓ |
| `700001` (Quick Commerce) | `quick_commerce` | ✓ | – | ✓ | ✓ |
| `110001` (Delhi) | `pan_india` | – | ✓ | – | ✓ |
| `560001` (Bengaluru) | `pan_india` | – | ✓ | – | ✓ |
| `000000` (invalid) | `unknown` | – | – | – | – |
| `abc12` (invalid) | `unknown` | – | – | – | – |
| `1234` (too short) | `unknown` | – | – | – | – |
| `` (empty) | `unknown` | – | – | – | – |
| `" 700008 "` (messy) | `kolkata` | ✓ | – | – | ✓ |

Storage/SBZ checks (verified): `setSelectedPincode("700008")` →
`localStorage["Zipcode"] == "700008"` + namespaced snapshot written;
`getSelectedPincode()` round-trips; event fires with `detail.zone`; legacy-key
fallback resolves `Zipcode="700001"` → `quick_commerce`; `clear` removes both
keys.

**Browser console harness** (on the draft, any page):
```js
GanguramZone.classifyPincode('700008');   // kolkata
GanguramZone.classifyPincode('110001');   // pan_india
GanguramZone.setSelectedPincode('700001');// writes Zipcode + snapshot, fires event
GanguramZone.getSelectedDeliveryLocation();
GanguramZone.clearSelectedDeliveryLocation();
```

## 7. Guarantees / non-goals

- Vanilla JS, **no jQuery / Bootstrap / FontAwesome / external libs**.
- **Inert on load** — defines `window.GanguramZone` and nothing else; no DOM work,
  no event, no storage until a caller acts.
- Degrades gracefully when `localStorage` is unavailable (private mode).
- Does **not** reimplement any app logic, does **not** add a second pincode store,
  does **not** duplicate the lists.

## 8. Next phases (unchanged scope)

- **2.1b** "Delivering to…" header widget (UI) — reads this resolver only.
- **2.2** saved-address popup (Shopify `customer.addresses` + guest localStorage).
- **2.3** resolver-driven product/menu/search/banner filtering (ported cleanly).
- **2.5** cart attributes / messages.
