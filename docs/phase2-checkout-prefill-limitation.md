# Audit — checkout address fields empty though /cart.js is fully populated

## What was tested
A cart on "another system" with **full** attributes already saved:
`ganguram_selected_pincode=700006`, `ganguram_preferred_delivery_method=4HR`, `Delivery Method=4 hours
delivery`, and `_ganguram_ship_address1=33 Karbala Tank Lane`, `_ganguram_ship_city=Kolkata`,
`_ganguram_ship_province=West Bengal`, `_ganguram_ship_zip=700006`, `_ganguram_ship_lat/lng`.

## What the theme builds (proven)
`ganguram-checkout-prefill.js` maps `_ganguram_ship_*` → checkout params (`shipKeys()`,
`cartAddress()`) and, when `address1`+`city` are present, redirects in **`full_address`** mode to:
```
/checkout?checkout[shipping_address][country]=India&checkout[shipping_address][zip]=700006
         &checkout[shipping_address][address1]=33%20Karbala%20Tank%20Lane
         &checkout[shipping_address][address2]=Manicktala%2C%20Goa%20Bagan
         &checkout[shipping_address][city]=Kolkata
         &checkout[shipping_address][province]=West%20Bengal
```
The **complete** address is in the URL. `GanguramCheckoutPrefill.debugState()` now exposes it:
`checkoutPrefillMode`, `checkoutRedirectUrl`, `checkoutPrefillPayload`, `cartAttributeAddress1/City/
Province/Zip`. So **R1 (no URL built) and R2 (only zip/country) are rejected** — it is not a theme
mapping bug, and it does not differ by method (4HR/STD/PAN) or by Buy Now vs cart checkout (both use
the same `currentCheckoutUrl()` / `prepareCheckout()` pipeline).

## Root cause — R3 / R7 (Shopify platform limitation)
**Shopify's current one-page checkout (Checkout Extensibility) ignores `checkout[shipping_address][...]`
URL parameters for guests** — the page loads with the fields **empty**. This is the legacy
prefill mechanism; it was dropped in the new checkout. Confirmed by Shopify community + the dev
changelog now pointing to the Storefront **Cart API `preferences`/`buyerIdentity`** instead. The
theme uses **only the AJAX cart (`/cart/update.js`)**, which **cannot** set `buyerIdentity`.

> **Section 8 — is visible checkout autofill technically possible here?** For a **guest** via
> theme-only code: **No.** No URL change fixes this.

## Is anything actually broken in the theme? No.
- The save pipeline works (this PR/earlier PRs proved `/cart.js` is fully populated).
- ShipZip reads `ganguram_selected_pincode` / `Delivery Pincode` for the **rate** — that works.
- The pincode/address/method are on the **order** (Additional details) for fulfilment — that works.
- Only the **visible auto-fill of the checkout address form** doesn't happen — and that is the
  Shopify limitation, not our code.

## The only routes to *visible* checkout prefill (none are theme-JS URL params)
1. **Logged-in customers** — Shopify auto-fills their saved address. Zero theme work. (Best ROI.)
2. **Checkout UI Extension** — checkout extensibility (works on all plans for some surfaces; richer on Plus).
3. **Storefront Cart API `cartBuyerIdentityUpdate`** (`preferences` / `deliveryAddressPreferences`) —
   needs a Storefront API token + GraphQL (not the AJAX cart). It reliably prefills the **delivery
   method**; community reports it still does **not** reliably prefill a **guest's shipping address**.

## What this PR changes (smallest safe fix — path D)
**No attempt to "make autofill work" (impossible).** It makes the limitation diagnosable and honest:
- `GanguramCheckoutPrefill.debugState()` adds **`shopifyCheckoutFieldPrefillSupported: false`** plus
  `checkoutRedirectUrl`, `checkoutPrefillPayload`, `checkoutPrefillMode`, and
  `cartAttributeAddress1/City/Province/Zip` — so anyone can see the theme *is* sending the full
  address and that Shopify, not the theme, drops it.
- This doc records the audit + the supported alternatives.
- The cart/order-attribute handoff (the part that actually works) is **unchanged**.

> No change to ShipZip rates, service codes, slabs, MOV, product visibility, the Custom Box Builder,
> discounts, or metaobjects. The `checkout[shipping_address]` redirect is **kept** (harmless; it
> would resume working if Shopify ever re-honours the params, and it's the documented cart-permalink
> format).

## Recommendation
Enable **customer accounts** (logged-in autofill) for the biggest real win, and decide whether the
**Storefront Cart API** delivery-method prefill is worth a follow-up (it would prefill the *method*,
not the guest address). PAN India must still be tested separately with an outside-local pincode —
the same conclusion applies (the URL carries zip/country, and the full address if a Google address
was selected; Shopify still ignores the address params).
