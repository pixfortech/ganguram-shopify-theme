# Phase 2 — distance-based MOV slabs (cart progress bar)

Replaces the single flat fallback MOV (#90) with **distance-based minimum-order-value slabs**, so the
cart minimum scales with delivery distance — using the **same** route distance + slab boundaries +
safety margin as the Standard shipping estimate. **No change** to ShipZip rates, the Standard
shipping slabs, the `4HR`/`STD` service codes, checkout address prefill, pincode eligibility,
product visibility, the Custom Box Builder, or custom discounts.

## Single source of truth — `window.GanguramCartMov`
New `assets/ganguram-cart-mov.js`. `resolve(location, subtotal, ctx?)` returns the one MOV decision,
read by **both** the cart progress bar and the 4-Hour evaluator, so drawer, cart page, and the 4HR
gate never disagree. The distance comes from `GanguramShippingEstimate.slabInputKm()` /
`slabForKm()` (the confirmed full-address route distance biased up by the same `slabSafetyMarginKm`,
or the pincode-area upper bound), matched to the same boundaries (0–5 / 5.01–10 / 10.01–15 /
15.01–20 km).

**Resolution priority**
1. **rule** — the matched `ganguram_delivery_rule` metaobject's Minimum order value (already
   distance-resolved by the engine). Always honoured; it always blocks below it.
2. **distance_slab** — the theme distance MOV slab (local zones only; never beyond the radius).
3. **fallback** — a flat MOV, used only when no distance is available yet.
4. **none** — nothing applies → no bar.

PAN India never uses the local slabs (optional separate PAN India MOV).

## Theme settings → "Ganguram — Cart delivery & MOV bar"
| Setting | Default | Effect |
|---|---|---|
| Enable MOV bar | on | Turns the distance/fallback/PAN MOV on. (A rule MOV still applies when off.) |
| Block checkout below MOV | off | Off = display-only guidance. On = soft-blocks below the local MOV. (A rule MOV always blocks.) |
| MOV 0–5 km | ₹300 | slab 1 |
| MOV 5.01–10 km | ₹400 | slab 2 |
| MOV 10.01–15 km | ₹500 | slab 3 |
| MOV 15.01–20 km | ₹700 | slab 4 |
| PAN India MOV | ₹0 (hide) | optional; PAN India only |
| Fallback MOV | ₹0 (off) | only when no distance is available yet |

With the defaults, the bar appears (display-only) for a local cart once a pincode/address is entered.

## Behaviour
- After a pincode/address: the route distance is computed, the matching slab MOV is chosen, and the
  bar shows in the cart **drawer and page**.
- Below the MOV: **"Add ₹170 more to reach the minimum order value for your delivery area."**
- At/above the MOV: **"Minimum order value reached."**
- Checkout block: only when "Block checkout below MOV" is on (a rule MOV always blocks). Off = the
  bar is guidance only, checkout proceeds.
- PAN India: no local slabs; a separate PAN India MOV if configured, else the bar is hidden.
- 4HR respects the same local MOV (`GanguramFourHour` reads the same resolver). It is hidden below
  the MOV **only when the MOV actually blocks** — a rule MOV (always), or the theme MOV with "Block
  checkout below MOV" on. A **display-only** MOV (block off) is guidance and never hides 4HR.
  (`GanguramCartMov.resolve().blocking` carries this flag.)

## Diagnostics
```js
GanguramDeliveryProgress.debugState();
//  selectedPincode, selectedAddress, routeDistanceKm,
//  movSource: 'distance_slab' | 'rule' | 'fallback' | 'pan_india' | 'none',
//  matchedMovSlab (e.g. "10.01–15 km"), mov, cartSubtotal, amountRemaining,
//  movBarVisible, checkoutBlockedByMov
GanguramCartMov.debugState();   // the resolver's view of the same fields
```

## Tests (DOM-shim)
- **`test-cart-mov` (44)** — each slab (3/8/13/18 km → ₹300/400/500/700, with the safety margin),
  beyond-radius → none, pincode-area upper bound, amountRemaining, block on/off, PAN India,
  priority rule > distance > fallback, feature-disabled, drawer/page parity, debugState.
- **`test-mov-distance-integration` (17)** — the slab MOV rendered through the **real progress
  panel** (bar + delivery-area wording) in drawer + page, debugState `distance_slab` / `matchedMovSlab`
  / `routeDistanceKm`, slab changes with distance, block toggle.
- `test-mov-bar` (20, legacy fallback path), `test-four-hour-window` (41), `mov-test`,
  `cart-intelligence-test`, `datepicker-test`, `test-cart-estimate`, `test-delivery-state` all pass;
  the battery's 15 pre-existing failures are unchanged.

> Not claimed "done" from unit tests — deploy and verify: enter a near vs far address and confirm the
> MOV bar amount changes with distance in both drawer and page; check the wording; and run
> `GanguramDeliveryProgress.debugState()` to see `movSource: 'distance_slab'` + `matchedMovSlab`.
