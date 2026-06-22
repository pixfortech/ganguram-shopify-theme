# Checkout prefill & Buy Now handoff

Ensures the pincode/address/delivery-method handoff is **prepared and verified before any checkout
redirect**, including **Buy Now** (which bypasses the cart drawer/page). **No change** to ShipZip
rate amounts, the `4HR`/`STD` service codes, distance/MOV slabs (only reading their result), product
visibility, the Custom Box Builder, custom discounts, or metafields/metaobjects.

## Root cause
1. **Custom Buy Now** (product cards) added the item then redirected to a **bare `/checkout`** —
   without waiting for the (debounced, async) cart-attribute/method writes and without the prefill
   URL. So checkout could open before `ganguram_preferred_delivery_method` was saved.
2. **The native product-page dynamic-checkout button** (`{{ form | payment_button }}` → Shop Pay
   etc.) bypasses the cart entirely, so the delivery handoff never runs.

## The fix — one shared handoff
`GanguramCheckoutPrefill.prepareCheckout({ buyNow })` is the **single pipeline** used by Buy Now and
the cart checkout button:
1. **Validate pincode** — none → open the pincode popup, do **not** redirect.
2. **Validate MOV + required Standard date** (`guardBlocked()` = `isCheckoutBlocked` ‖ `isDateMissing`)
   — blocked → open the cart (so the date picker / MOV notice shows), do **not** redirect.
3. **Force-save** — `GanguramCartAttributes.flush()` (pincode/address) + `GanguramDeliveryMethodChoice.flush()`
   (method/label/`Delivery Method`, clears the date keys for 4HR/PAN). Both are **immediate** writes
   (no debounce) that resolve when the cart accepts them.
4. **Verify `/cart.js`** contains the pincode (+ method) — time-boxed (1.5 s) so a slow cart never
   traps the customer; the cart-attributes keepalive `flushSync` is the navigation-safe backup.
5. **Redirect to the prefill URL** (shipping address / pincode).

- **Buy Now** (`ganguram-product-card-buy.js`) calls `prepareCheckout({ buyNow: true })` after the
  AJAX add (it already awaits the add, so the async verify is free).
- **Cart checkout** (`#CheckOut`) force-saves (fire-and-forget; keepalive backs it up) and redirects
  **synchronously** to the prefill URL — unchanged latency, same pipeline (no async wait needed there).

### PAN India (clean device)
Resolves to `PAN_INDIA` with **no route distance / lat-lng**, clears the Standard date keys, and
prefills **pincode-only** (country + zip). Verified end-to-end on an empty-localStorage cart.

### Standard (STD)
The date picker’s requirement is enforced by `guardBlocked()`: Buy Now and checkout are **blocked
until a date is selected**, and the date is saved (by the date picker + the method flush) before the
redirect.

### 4HR
Only persisted when inside the time window + radius, all-QC, and (if MOV blocking is on and below
MOV) not at all — the method flush derives from `GanguramFourHour`, so an ineligible 4HR is never
persisted; Buy Now falls back to STD.

## Native dynamic-checkout button (Shop Pay)
The native `.shopify-payment-button` **cannot be reliably intercepted** (Shopify-controlled). So the
storefront gate **hides it on the product page** (`html.ganguram-hide-dynamic-checkout`, config
`GanguramStorefrontGateConfig.hideDynamicCheckout`, **default on**) — customers use **Add to cart**
or the custom **Buy now**, both of which run the handoff. Set `hideDynamicCheckout: false` (in
`layout/theme.liquid`) to re-enable Shop Pay express on the product page, **accepting that it skips
the cart-side delivery handoff**. (It is already hidden when no pincode is set, via the no-pincode gate.)

## Diagnostics
```js
GanguramCheckoutPrefill.debugState();  // isBuyNowFlow, buyNowIntercepted, buyNowBlockedReason,
                                       // checkoutRedirectBlocked, checkoutRedirectAllowed,
                                       // cartAttributesVerifiedBeforeRedirect, handoffStatus,
                                       // + (from #94) localStorageSelectedPincode, cartAttributePincode,
                                       // selectedPincode, selectedAddress, addressLatLng,
                                       // panIndiaEligible, finalDeliveryMethod, mode, reason
GanguramCartAttributes.debugState();   // cartAttributesWriteStatus ('ok'|'writing'|'in_sync'|'error')
GanguramDeliveryMethodChoice.debugState(); // finalDeliveryMethod, panIndiaEligible
GanguramStorefrontGate.debugState();   // dynamicCheckoutHidden, dynamicCheckoutButtons, gateActive
GanguramAddressSearch.debugState();    // googlePlacesLoaded, addressAutocompleteReady, loadError
GanguramPincodePopup.debugState();     // popupMounted, selectedPincode, mobileEntryPointsVisible
```

## Known Shopify limitation
Theme JS cannot set every Shopify checkout field. The prefill carries country + zip (pincode-only) or
the full structured shipping address (when a Google address was selected) via the checkout URL; all
data is **also** preserved in the cart/order attributes (`ganguram_selected_pincode`, the
`_ganguram_ship_*` fields, `ganguram_preferred_delivery_method`, `Delivery Method`, `Delivery-Date`
for STD). The native Shop Pay dynamic checkout can’t be intercepted — hence it’s gated.

## Tests
- **`test-buy-now-handoff` (28)** — PAN India Buy Now saves+verifies (method `PAN_INDIA`) then opens
  checkout with the pincode; no-pincode → popup + no redirect; STD-no-date → `date_required` block;
  below-MOV → `mov` block; **cart checkout uses the same pipeline**; `flush()` / `prepareCheckout`
  exposed; the dynamic-checkout CSS gate + Buy Now routing.
- `test-checkout-prefill` (21), `test-clean-session-prefill` (20), `test-clean-device-pan` (23),
  `test-handoff-regression` (20), `test-prefill-address` (40), `product-card-buy-test`,
  `test-method-choice` (36), `test-storefront-gate` (29) all pass; the battery’s 15 pre-existing
  failures are unchanged.

## Manual checklist (real device)
Incognito → `localStorage.clear(); sessionStorage.clear(); location.reload();` → open a **PAN India**
product → **Buy Now without a pincode** → popup opens, **no checkout** → enter a PAN India pincode →
**Buy Now** → `GanguramCheckoutPrefill.debugState()` shows `cartAttributesVerifiedBeforeRedirect: true`,
`finalDeliveryMethod: 'PAN_INDIA'` → checkout opens with the pincode. Repeat on **mobile Chrome +
Safari**, and with a **local Standard** product (confirm the date-picker requirement blocks Buy Now
until a date is chosen).
