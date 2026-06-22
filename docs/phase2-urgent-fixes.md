# Phase 2 — urgent fixes after #89 (Standard date picker, MOV bar, 4HR checkout)

Fixes the live issues reported after #89. **No change** to ShipZip rate amounts, the `4HR`/`STD`
service codes, distance slabs, product visibility, checkout address prefill, the Custom Box
Builder, custom discounts, or metafields/metaobjects.

## A — Standard date picker now shows for a local Quick-Commerce cart
**Bug:** the cart resolved to Standard (₹ slab) but **no date picker appeared**, so no date could be
chosen. **Cause:** `ganguram-delivery-datepicker.js` only showed the picker when an item carried the
**'Local Delivery'** product tag (`cartHasLocalDelivery`). A Quick-Commerce cart in a local zone
that resolves to Standard (e.g. outside the 4HR window) has Quick-Commerce items that aren't
necessarily 'Local Delivery'-tagged → the picker stayed hidden.

**Fix:** the picker now shows for any **locally-deliverable** cart — an item tagged **Local Delivery
OR Quick Commerce OR Kolkata** — via the new `cartLocallyDeliverable()`. So:
- **active method STD → date picker visible, date required, soft-blocks checkout if missing** (unchanged guard);
- **4HR → date field hidden** (express; clears `Delivery-Date` / `Delivery Date` / `Delivery-Time`);
- **PAN India → picker hidden** (`localLocation()` returns null for PAN India) and the date attributes cleared by the method-choice module.

## C — Standard is persisted when 4HR is unavailable
Already wired in #89 and re-confirmed by tests: when 4HR is hidden (time/radius/QC/MOV),
`ganguram-delivery-method-choice.js` derives **STD** (the hidden 4HR toggle reads as Standard) and
writes `ganguram_preferred_delivery_method = STD`, `ganguram_preferred_delivery_label = Standard
Delivery`, `Delivery Method = Standard Delivery`. With STD active, the date picker (Task A) appears.

## B — Checkout 4HR mismatch (cannot be fixed in the theme)
The theme can hide 4HR in the cart but **cannot remove a ShipZip checkout rate** — that's a Shopify
platform boundary. See **`docs/phase2-checkout-4hr-sync.md`**: either give the ShipZip *4 hours
delivery* rate the same 09:00–18:00 Asia/Kolkata window, **or** add a **Shopify Delivery
Customization Function** that hides the 4HR option when
`cart.attributes["ganguram_preferred_delivery_method"] != "4HR"` (the theme already writes that
attribute). Do not rely on the theme to hide the checkout rate.

## D — MOV bar fallback is now a theme setting
The bar shows only when `st.mov != null`, which comes from a resolved `ganguram_delivery_rule`
metaobject's **Minimum order value** (`movSource: 'rule'`). New **Theme settings → "Ganguram — Cart
delivery & MOV bar"**:
- **Display minimum order value (₹, 0 = off)** → `GanguramDeliveryProgressConfig.fallbackMov` (paise).
  When set and the rule has no MOV, the bar + "x / y minimum order" summary render (`movSource:
  'fallback'`). **Display-only** — does not block checkout, does not change the MOV/rate formula.
- **Also block checkout below this amount** (default off) → `fallbackMovBlocks`. Tick it to make the
  fallback soft-block checkout below the amount (merchant opt-in), like a real rule MOV.

Both the cart **drawer and page** render the bar (both include the progress snippet).
**To make the bar appear:** set a Minimum order value on the matching delivery rule (best — also
drives the real below-minimum guard), **or** set the display amount above. Confirm with
`GanguramDeliveryProgress.debugState().movSource`.

## E — Diagnostics (all callable in the console)
```js
GanguramFourHour.debugState();              // currentKolkataTime, isWithinFourHourTimeWindow,
                                            // isWithinFourHourRadius, cartAllQuickCommerce,
                                            // finalFourHourVisible, hiddenReason
GanguramDeliveryMethodChoice.debugState();  // preferredMethod (active), attributesSent / lastWriteAttrs
                                            // (persisted handoff), fourHourVisibleNow, fourHourHiddenReason
GanguramDeliveryDatePicker.debugState();    // NEW: datePickerVisible, dateRequired, dateMissing,
                                            // activeMethod, cartLocallyDeliverable, cartHasLocalDeliveryTag
GanguramDeliveryProgress.debugState();      // mov, movSource, movBarVisible, ruleReason, selectedPincode,
                                            // fourHour {…}
GanguramCheckoutPrefill.debugState();       // selectedPincode, selectedAddress, checkout handoff attrs
```

## Tests (DOM-shim)
- **`test-datepicker-visibility` (17)** — QC cart (NOT 'Local Delivery'-tagged), outside the window →
  **date picker shows + date required + STD persisted**; `cartHasLocalDeliveryTag:false` but
  `cartLocallyDeliverable:true`; within window the toggle returns; PAN India / empty cart hide it;
  a Kolkata-only-tagged Standard cart shows it.
- **`test-mov-bar` (20)** — rule MOV / display-only fallback / blocks-toggle / `movSource` diagnostics.
- `test-four-hour-window` (41), `datepicker-test`, `test-method-choice`, `mov-test`,
  `test-cart-estimate`, `test-delivery-state`, `four-hour-test` all pass; the battery's 15
  pre-existing failures are unchanged.

> Not claimed "done" from unit tests — please deploy and verify: a Quick-Commerce cart outside the
> window shows the **Standard date picker** (date required); set a rule MOV or the display amount and
> confirm the **MOV bar** appears in both drawer and page; and wire the checkout-side 4HR rule per
> `docs/phase2-checkout-4hr-sync.md`.
