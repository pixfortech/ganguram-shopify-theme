# Force cart address-attribute sync before checkout

Companion to `phase2-checkout-prefill-limitation.md`. The autofill of Shopify's checkout *fields* is
a platform limitation (settled). This makes the part the theme **can** guarantee — that the selected
pincode/address/method actually reach `/cart.js` (and therefore the order + ShipZip) **before**
checkout opens — reliable, for every checkout path.

## Why it was unreliable
On a plain cart checkout the force-save was a fire-and-forget normal `fetch`; the immediate redirect
could **cancel** that POST before it landed, and the method (`ganguram_preferred_delivery_method`)
had no navigation-safe flush — so a debug taken just before checkout could show the cart attributes
still `null`.

## The fix
- **Cart / cart-drawer checkout** (`#CheckOut`): force-save the pincode/address **and** method with
  **`keepalive: true`** so the POST is **guaranteed to complete across the redirect** (the robust,
  standard pattern), then redirect synchronously — no added latency on the critical button.
  `GanguramCartAttributes.flush(true)` and `GanguramDeliveryMethodChoice.flush(true)` now send
  keepalive; the prefill's `forceSave({ keepalive: true })` threads it through.
- **Buy Now**: unchanged from #95 — it `await`s the force-save, **verifies `/cart.js`**, and only then
  redirects (it already awaits the AJAX add, so the verify round-trip is free).
- **`GanguramCartAttributes.verify()`** (new): reads `/cart.js` back and records
  `verifiedBeforeCheckout` + the actual cart values.

## Diagnostics
```js
GanguramCartAttributes.debugState();
//  selectedPincode, selectedAddress, cartAttributesWriteStatus, lastWritePayload, lastWriteError,
//  verifiedBeforeCheckout, cartAttributePincode/Address1/City/Province/Zip   (after verify())
await GanguramCartAttributes.verify();   // refreshes the cartAttribute* fields from /cart.js

GanguramCheckoutPrefill.debugState();
//  cartAttributesMissingBeforeRedirect (was the cart missing pincode/address before the force-save?),
//  forcedCartAttributeSyncStatus ('keepalive' for cart checkout, 'ok' for a verified Buy Now),
//  cartAttributesVerifiedBeforeRedirect, handoffStatus  (+ the #94/#96 fields)
```

## Honest scope
This does **not** make Shopify's checkout address *fields* visibly auto-fill — that remains
impossible from theme JS (see `phase2-checkout-prefill-limitation.md`). It guarantees the data is on
the cart/order attributes that ShipZip and fulfilment use, and makes that verifiable. No change to
ShipZip rates, service codes, slabs, MOV, product visibility, the Box Builder, or discounts.

## Tests
`test-force-cart-sync` (19): `verify()` reads `/cart.js`; `flush(true)` sends keepalive (both
modules); the cart checkout force-saves with keepalive + redirects; Buy Now force-saves → verifies →
redirects; the new diagnostics. The prefill/clean-session/clean-device/handoff/method suites pass;
the battery's 15 pre-existing failures are unchanged.
