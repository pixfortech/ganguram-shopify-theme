# Clean-device pincode & address hydration (PAN India)

Fixes the "works on one device only" report: a fresh device / private window / logged-out customer
could set a pincode but the **delivery method never persisted** to checkout — most visibly for PAN
India. **No change** to ShipZip rates, the `4HR`/`STD` service codes, distance slabs, MOV slab logic
(beyond where address distance already feeds it), product-visibility rules, the Custom Box Builder,
custom discounts, or metafields/metaobjects.

## Root cause
`ganguram-delivery-method-choice` was **disabled by default** (the 2.12K hotfix, to isolate a past
prefill regression). With it off, `ganguram_preferred_delivery_method` / `Delivery Method` were
**never written** — so on a clean device the cart had the pincode (written by the always-on
cart-attributes module) but **no method**: PAN India never became `PAN_INDIA` at checkout.

The pincode/address path itself was already clean-device-safe (PR #85): the popup commits via
`GanguramZone.setSelectedPincode`, cart-attributes mirrors the pincode/address to `/cart.js` with **no
distance/latLng/cart gate**, and the prefill hydrates from cart attributes. PAN India needs no
distance, so nothing there waits for it.

## The fix
1. **Re-enabled `ganguram-delivery-method-choice`** (`enabled: true`). It is now safe because: (a)
   the cart-attributes module — not this one — owns the pincode/address (so it can't clobber them; it
   only writes the method/label/`Delivery Method` + clears the date keys for 4HR/PAN); and (b) the
   `hasCartItems` guard means it never writes on a no-cart surface, so it can't touch the no-cart
   pincode/address auto-fetch. PAN India derives `PAN_INDIA` immediately (zone-based, no distance).
2. **Data-source priority confirmed** (unchanged, already correct): in-memory validated selection →
   cart attributes from `/cart.js` → localStorage only as a same-session cache (empty on a clean
   device, never the only source).

### Clean-device PAN India flow (verified)
Empty localStorage → enter a PAN India pincode on a PAN India cart → pincode written to cart
attributes (`cartAttributesWriteStatus: ok`) → method written as `PAN_INDIA` / `PAN India Shipping`,
Standard date cleared → checkout prefill builds a **pincode-only** URL (country + zip, no
address1/latLng) → no Standard date picker, no 4HR.

## Diagnostics (all console-callable)
```js
GanguramAddressSearch.debugState();          // NEW: googlePlacesLoaded, addressAutocompleteReady,
                                             // apiKeyConfigured, loadError, note  ← why Google Places
                                             // fails on some devices/browsers (key referrer / API not enabled)
GanguramCheckoutPrefill.debugState();        // localStorageSelectedPincode, cartAttributePincode,
                                             // selectedPincode, selectedAddress, addressLatLng,
                                             // cartAttributesHydrated, panIndiaEligible,
                                             // finalDeliveryMethod, mode, reason
GanguramDeliveryMethodChoice.debugState();   // preferredMethod (= finalDeliveryMethod), panIndiaEligible,
                                             // enabled, writesPincodeOrAddress (false)
GanguramCartAttributes.debugState();         // NEW: cartAttributesWriteStatus ('idle'|'writing'|'ok'|
                                             // 'in_sync'|'error'), lastWriteError, selectedPincode
GanguramPincodePopup.debugState();           // selectedPincode, pincodeSelected, popupMounted (Phase-2 mobile)
```
If autocomplete fails only on some devices, `GanguramAddressSearch.debugState().googlePlacesLoaded:
false` + `loadError` show it (almost always an **API key HTTP-referrer restriction** or **Places API
(New) not enabled** for that domain — a Google Cloud Console setting the theme can't change). PAN
India still works on the pincode alone, with no address autocomplete.

## Reset test
Before testing on each device: `localStorage.clear(); sessionStorage.clear();` then reload. Add a PAN
India product, open the pincode popup, enter a PAN India pincode, and check:
`GanguramCartAttributes.debugState().cartAttributesWriteStatus === 'ok'`,
`GanguramDeliveryMethodChoice.debugState().preferredMethod === 'PAN_INDIA'`,
`GanguramCheckoutPrefill.debugState().mode === 'pincode_only'` and `finalDeliveryMethod === 'PAN_INDIA'`.

## Tests (DOM-shim)
- **`test-clean-device-pan` (23)** — empty localStorage → PAN India pincode → pincode + `PAN_INDIA`
  method persisted to cart attributes (no Standard date) → prefill sends country + zip only →
  diagnostics (`localStorageSelectedPincode: null`, `cartAttributePincode`, `panIndiaEligible`,
  `finalDeliveryMethod`, `cartAttributesWriteStatus: ok`).
- `test-clean-session-prefill` (20), `test-prefill-address` (40), `test-checkout-prefill` (21),
  `test-handoff-regression` (20), `test-method-choice` (36), `test-method-choice-disabled` (8) all
  pass — proving the prefill and the (now-enabled) method-choice **coexist**. The battery's 15
  pre-existing failures are unchanged.

> ⚠️ **Re-enabling method-choice** is the impactful change (it was off for a past prefill regression).
> The DOM-shim tests prove coexistence, but please **verify on a real clean device**: clear storage,
> reload, set a pincode, and confirm the address/pincode prefill STILL works AND the method now
> persists. If a prefill regression resurfaces, set `enabled: false` in
> `ganguram-delivery-method-choice-config.liquid` to roll back. Google Places key restrictions are a
> Cloud Console setting — surfaced by the diagnostics but not fixable in the theme.
