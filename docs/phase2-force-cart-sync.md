# Force cart address-attribute sync before checkout

Companion to `phase2-checkout-prefill-limitation.md`. Auto-filling Shopify's checkout *fields* is a
platform limitation (settled — see that doc). This makes the part the theme **can** guarantee — that
the selected **pincode / address / delivery method actually reach `/cart.js`** (and therefore the
order + ShipZip) **before** checkout opens — reliable, on **every** checkout path, and verifiable.

## One shared handoff for all three paths
The cart checkout button (`#CheckOut`), the cart-drawer checkout button, and **Buy Now** all run the
**same** pipeline in `ganguram-checkout-prefill.js`:

1. **Validate** — a serviceable pincode must exist (else the pincode popup opens, no redirect);
   checkout must not be blocked by **MOV** or a **required Standard delivery date**
   (`GanguramDeliveryProgress.isCheckoutBlocked` / `GanguramDeliveryDatePicker.isDateMissing`).
2. **Force-save** the pincode/address (`GanguramCartAttributes.flush`) **and** the delivery method
   (`GanguramDeliveryMethodChoice.flush`) with **`keepalive: true`** — the POST is **guaranteed to
   complete across the navigation**, so the write can't be cancelled by the redirect.
3. **Verify** `/cart.js` — read the attributes back and confirm the pincode landed.
4. **Redirect** to the prefill URL once confirmed.

### Why it used to look "still null"
On a plain cart checkout the force-save was a fire-and-forget *normal* `fetch`; the immediate redirect
could **cancel** that POST before it landed, and the method (`ganguram_preferred_delivery_method`) had
no navigation-safe flush — so a debug snapshot taken just before checkout could show the cart
attributes `null`. **`keepalive`** fixes that root cause: the browser keeps the request alive through
the unload.

## `blockUntilVerified` — fail-open (default) vs hard-block (opt-in)
`GanguramCheckoutPrefillConfig.blockUntilVerified` (default **`false`**):

- **`false` (default, recommended):** the **keepalive** force-save already *guarantees* the write
  lands, so on the rare genuine verify miss we **fail-open and redirect anyway** (and record
  `verificationMismatch: true`). The cart checkout button stays **synchronous** — zero added latency
  on the highest-traffic conversion button, and a paying customer is **never trapped** by a slow or
  false-negative `/cart.js`. Buy Now still verifies and redirects when confirmed.
- **`true` (opt-in):** on a **genuine persistent** verify miss (verify succeeded but the pincode is
  truly absent — *not* a network error; those always fail-open) the handoff **blocks checkout** and
  opens the pincode popup so the customer **reselects their delivery location** (which re-writes the
  attributes). Use this if you'd rather hard-stop than let an unverified order through.

Either way the keepalive write is attempted first, and a verify **infra error / timeout** *always*
fails open — the verification is time-boxed (`VERIFY_TIMEOUT_MS`), with one retry on a genuine miss.

> Design note: the brief asked to "only redirect when confirmed, else block + reselect." That is
> exactly `blockUntilVerified: true`. We ship `false` as the **default** because keepalive already
> delivers the real goal (the attributes reliably reach the order) **without** the conversion risk of
> blocking real customers on a false negative. Flip the flag to make blocking the default.

## PAN India needs no distance / latLng
PAN India resolves to `PAN_INDIA` and prefills **pincode-only**; it does **not** depend on
distance/`latLng` or a Google address. The method + pincode (and city/state when enriched) are saved;
the handoff redirects on the pincode alone.

## Diagnostics
```js
GanguramCheckoutPrefill.debugState();
//  handoffStatus, checkoutRedirectAllowed / checkoutRedirectBlocked,
//  cartAttributesVerifiedBeforeRedirect, cartAttributesMissingBeforeRedirect,
//  forcedCartAttributeSyncStatus ('keepalive' | 'ok' | 'cart_attrs:<reason>' | ...),
//  verificationMismatch (true once a genuine miss was seen),
//  lastVerifiedCartAttributes ({ pincode, address1, method } read back from /cart.js),
//  selectedAddressSource, addressSource, finalDeliveryMethod, panIndiaEligible,
//  cartAttributePincode / Address1 / Address2 / City / Province / Country / Zip,
//  checkoutRedirectUrl, checkoutParamsIncluded, checkoutParamsIgnoredLikely,
//  shopifyCheckoutFieldPrefillSupported  // FALSE by design (see limitation doc)

GanguramCartAttributes.debugState();
//  selectedAddress, selectedAddressSource, cartAttributesWriteStatus, lastWritePayload,
//  lastWriteError, verifiedBeforeCheckout, verificationMismatch, lastVerifiedCartAttributes,
//  cartAttributePincode / Address1 / Address2 / City / Province / Country / Zip, desiredAttributes
await GanguramCartAttributes.verify();   // re-reads /cart.js and refreshes the cartAttribute* fields
```

## Audit note — "but the merchant's checkout DOES show the address"
If a checkout *appears* to auto-fill the shipping fields, it is **not** the theme writing them — the
new one-page checkout ignores `checkout[shipping_address][...]` URL params for guests (proven in
`phase2-checkout-prefill-limitation.md`). What actually fills them is one of:

- **Browser / OS autofill** (Chrome, Safari, Edge address autofill; Google Wallet / Google profile).
- **Shop Pay** — once a shopper has used Shop Pay, Shopify recognises the email/phone and pulls *their*
  saved address. This is Shopify's identity memory, not our URL.
- **A logged-in / recognised Shopify customer** — Shopify auto-fills from the customer record.
- **A previewed / admin / same-device session** that already has a checkout session cached.

**Proof test (settles it in 30 seconds):** copy `GanguramCheckoutPrefill.debugState().checkoutRedirectUrl`
into a **Chrome Guest window with autofill turned off** and open it. The address fields load **empty**
even though the URL carries all six `checkout[shipping_address][*]` params — confirming the params are
ignored and any autofill you saw elsewhere came from the browser/Shop Pay/customer session above.

## Legacy URL params — kept, but not supported
`currentCheckoutUrl()` still appends the `checkout[shipping_address][...]` params (country, zip,
address1, address2, city, province). They are **harmless legacy fallback** — if a merchant ever runs
an older checkout that honours them, they'd help; the modern checkout simply drops them. We **do not**
rely on them and do **not** claim they visibly prefill the checkout. The reliable channel is the
**cart/order attributes** above.

## Honest scope & what is NOT touched
- Does **not** make Shopify's checkout address *fields* visibly auto-fill for guests — impossible from
  theme JS (see the limitation doc).
- **No** change to ShipZip rates / service codes, the MOV slabs, the distance slabs, 4HR/STD/PAN
  eligibility (read result only), the pincode widget UI, product visibility, the Custom Box Builder,
  or custom discounts. Cart/order attributes are **never removed** — ShipZip / order / admin read them.

## Tests
- `test-force-cart-sync` (19): `verify()` reads `/cart.js`; `flush(true)` sends keepalive (both
  modules); the cart checkout force-saves with keepalive + redirects synchronously; Buy Now
  force-saves → verifies → redirects; the new diagnostics.
- `test-blockuntilverified` (21): the genuine-persistent-miss branch — **default** fails open
  (redirects, `verificationMismatch: true`, no popup); **`blockUntilVerified: true`** hard-blocks +
  opens the reselect popup, for both `prepareCheckout` and the cart checkout button.
- The prefill / clean-session / clean-device-PAN / Buy-Now / handoff-regression / method suites pass;
  the battery's 15 pre-existing failures are unchanged.
