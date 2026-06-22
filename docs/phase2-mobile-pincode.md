# Mobile pincode widget visibility fix

## The bug
The delivery pincode widget / entry point was **invisible on mobile**, so mobile customers could
not enter or change a delivery pincode — and with no pincode the storefront gate keeps Add to cart /
Buy now hidden, blocking mobile testing entirely.

**Root cause (the theme's own comments confirm it):** the delivery widget is rendered only inside
`header__bottom` (the desktop nav row), which is `portable-hide` (hidden on mobile). The widget CSS
also has a *"HOTFIX"* that hides the mobile-drawer clone (`.ganguram-delivery-widget-menu-slot`)
under ≤1023px — "mobile pincode is handled by the popup". So there was **no persistent mobile entry
point**: mobile relied entirely on the popup auto-opening, which leaves no way to re-open it.

## The fix — a persistent mobile pincode bar
`sections/header.liquid` now renders a **mobile-only pincode bar** as the first child of
`<main-header>` (so it sticks with the sticky header and shows on every page — homepage, product,
collection, cart drawer, cart page):

```liquid
<div class="ganguram-mobile-pincode-bar" data-ganguram-mobile-pincode-bar>
  {%- render 'delivery-location-widget', class: 'ganguram-delivery-widget--mobilebar' -%}
</div>
```

- It uses a **new class** (`.ganguram-mobile-pincode-bar`) so the existing menu-slot mobile-hide rule
  never catches it.
- `ganguram-delivery-widget.css`: `display: none` by default, `display: flex` under `@media
  (max-width: 1023px)` — a full-width tap target. The inline dropdown is suppressed on the bar; the
  **trigger opens the popup** (the widget JS already routes the tap to `GanguramDelivery.openDeliveryLocationPopup()`).
- The widget snippet is explicitly multi-render-safe (no IDs; instances sync via
  `ganguram:delivery-location-changed`), so the desktop widget and this mobile bar stay in sync.

### States (per the spec)
- **No valid pincode** → the bar shows the CTA **"Enter delivery pin code"** (the empty-state text
  was changed from "Select pincode" in the widget JS + snippet, so it's a clear call to action on
  desktop and mobile). Tapping it opens the popup. Add to cart / Buy now stay gated (storefront gate).
- **Valid pincode** → the bar shows the selected pincode; tapping it re-opens the popup to change it;
  the storefront gate lifts and the purchase buttons return for sellable products.

### Popup on mobile (already correct, re-verified)
`ganguram-delivery-popup.css`: `position: fixed; inset: 0; z-index: 9999` (above the sticky header 999
and the cart drawer 1001), `max-height: 88vh` + `overflow-y: auto` on mobile, the close ✕ is always
shown, ESC/backdrop close, and `html.gdp-open { overflow: hidden }` body-scroll-lock is released on
close. The mobile bar sits **inside** the header, so the popup is never behind it.

## Diagnostics (point 6)
```js
GanguramPincodePopup.debugState();
//  isMobileViewport, popupMounted, popupOpen, closeButtonVisible,
//  mobileEntryPointsFound, mobileEntryPointsVisible, mobilePincodeBarPresent,
//  pincodeSelected, selectedPincode, buyGateActive
GanguramStorefrontGate.debugState();
//  isMobileViewport, gateActive, gatedButtons, ctaButtons,
//  mobileEntryPointsFound, mobileEntryPointsVisible, mobilePincodeBarPresent,
//  pincodeSelected, selectedPincode
```
On a mobile viewport, `mobileEntryPointsVisible` must be ≥ 1 (the bar). If it's 0, the entry point is
still hidden by CSS — check the `--ganguram` mobile bar rule loaded.

## Guardrails
No change to ShipZip rates, the `4HR`/`STD` service codes, distance slabs, MOV slab logic, checkout
address prefill, product-visibility rules, the Custom Box Builder, custom discounts, or
metafields/metaobjects. UI only; the widget reads/writes the delivery location exclusively through
`window.GanguramZone`. No **new** hardcoded colours (the mobile bar uses theme variables).

## Tests
- **`test-mobile-pincode` (25)** — a mobile entry point exists and reads "Enter delivery pin code";
  tapping it opens the popup; selecting a pincode updates the bar + diagnostics; `isMobileViewport`
  flips desktop↔mobile; CSS shows the bar only on mobile and suppresses the inline panel; the header
  renders the bar (new class) and the snippet CTA text is updated.
- `test-storefront-gate` (29), `test-pincode-gate` (11), `test-modal-ui` (33) still pass.

> Real show/hide + viewport layout is CSS — **not claimed "done" from unit tests.** Please verify on a
> real device / responsive mode (iPhone Safari + Android Chrome), on homepage / collection / product /
> cart drawer / cart page: the bar is visible, tapping it opens the popup within the viewport (not
> behind the header/drawer), a pincode saves, buttons return, and there's no desktop regression. Run
> the two `debugState()` calls and confirm `mobileEntryPointsVisible ≥ 1` on mobile.
