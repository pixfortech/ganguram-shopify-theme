# Phase 1 — pincode UX & cart delivery cleanup

Customer-facing polish only. **No change** to ShipZip rates, the `4HR`/`STD` service codes, the distance slabs, product eligibility rules, the MOV formula, the unavailable-items core logic (only its modal UI/actions), the Custom Box Builder, discounts, or metafields/metaobjects.

## 1. Unavailable-items modal — 2 dynamic-pincode actions
`assets/ganguram-cart-eligibility.js`. The modal now has **two** buttons with live pincodes:
- **“Change pin code to {new}”** (primary) — accepts the new pincode **and** removes the unavailable items (the old “Remove unavailable items” action is bundled in here).
- **“Keep current {current}”** (secondary) — keeps the current pincode, cart unchanged.

The modal copy states that the unavailable items will be removed if the new pincode is accepted. The review variant (items already invalid for the active pincode) shows “Change pin code” + “Keep current {current}”; removal happens by changing to a deliverable pincode.

## 2. First pincode popup — non-blocking + buy-gate
`assets/ganguram-delivery-popup.js`. The popup still prompts on first visit but is **dismissable**: the **✕ is always shown** and **ESC / backdrop always close**, so customers can browse without a pincode. With **no valid pincode**, `html.ganguram-no-pincode` is toggled and the CSS (`ganguram-phase1-ux.css`) **dims/gates Add to cart & Buy now** across collection cards, product cards, the product page, quick-add, and recommendations; tapping a gated button re-opens the popup (the existing capture-phase guard). A valid pincode removes the gate.

## 3. Compact cart delivery card
`snippets/ganguram-delivery-progress.liquid` + `assets/ganguram-delivery-progress.css`. The **“Delivery details” disclosure is removed** — the card shows just the **Standard / 4 Hours estimate line + mode chips + the MOV bar**. Status de-emphasised, lighter weight, tighter spacing. (The JS that filled the disclosure no-ops when the element is absent — no logic change.)

## 4. MOV progress bar
`assets/ganguram-delivery-progress.css`. The bar (rendered by the panel JS whenever a MOV applies) gets a **visible bordered track + min-height** so it reliably reads as a progress bar even on themes whose border colour is near-white. The MOV **calculation is unchanged** (it comes from the metaobject delivery rule).

## 5. Hide out-of-stock products
`assets/ganguram-phase1-ux.css`: `.product-item--sold-out { display: none; }` — reuses the theme’s own sold-out class (added in `snippets/product-item.liquid` for any `product.available == false`), so out-of-stock cards are hidden from collection grids, the featured/Best-Sellers section, and recommendations. The product **page** main product is not a `product-item`, so a directly-opened product still works; sold-out cards already render a disabled “Sold out” button.

## 6. Sticky header (desktop + mobile)
`assets/ganguram-phase1-ux.css`: `.site-header:not(.site-header--absolute) { position: sticky; top: 0; }` — higher specificity than the theme rule (no `!important`). z-index 999 (the theme’s own header z-index) sits **below** the cart drawer (1001) and the delivery popups (9999+), so the sticky header never overlaps them. The hero-overlay variant (`.site-header--absolute`, used on homepage/collection heroes) is left untouched to preserve the transparent-over-hero look.

`ganguram-phase1-ux.css` is loaded in `layout/theme.liquid`’s `<head>` so the rules apply before first paint. Theme CSS variables / existing classes only — no hardcoded colours.

## Tests (DOM-shim)
`test-modal-ui` (33, the 2-button modal incl. accept-removes / keep-unchanged), `test-transactional` (32, the change-flow guard with dynamic labels), `test-dom` (26, panel + 2-button modal), `test-pincode-gate` (11, dismissable popup + buy-gate toggle + CSS presence). The battery’s pre-existing failures are unchanged.

---

## Hotfix (selectors + real DOM) — `ganguram-storefront-gate.js`

The first pass relied on CSS that didn't match the live DOM. Fixed against the **actual** markup:

- **No‑pincode gate now HIDES the buttons + shows a CTA** (not a dim). `assets/ganguram-storefront-gate.js` toggles `html.ganguram-no-pincode` and injects one **“Enter delivery pin code to shop”** button (carrying `data-ganguram-open-pincode`, so it opens the popup) into each buy group; the CSS hides `[data-js-product-add-to-cart]` / `[data-ganguram-buy-now]` / `.shopify-payment-button` and shows the CTA. A valid pincode reverses it. Re‑injects on dynamically added cards (MutationObserver).
- **Out‑of‑stock — correct signal (`product.available`), not pickup.** “Out of stock at <store>” is per‑LOCATION pickup status and must NOT decide card visibility, so the pickup widgets are simply **hidden** (`pickup-availability-compact` / `pickup-availability-widget` / `.product-item__local-availability`). Cards are hidden only when **`product.available == false`** — i.e. sold out in Shopify **and** no backorder/continue‑selling — via the theme’s own `.product-item--sold-out` class (CSS) and a Liquid `if product.available` filter in the Best‑Sellers (`collection-panel.liquid`) and recommendations (`product-recommendations.liquid`) loops. **Backorder / continue‑selling products are `product.available == true`, so they stay visible and purchasable.** On the product page, the theme already disables the button as “Unavailable” for unsellable products and the pickup text is hidden.
- **Date card** compacted (`ganguram-delivery-datepicker.css`): smaller padding/margins, thinner radius, lighter title.
- **CSS‑loaded sentinel:** `ganguram-phase1-ux.css` sets `:root { --ganguram-phase1-loaded: 1 }` so diagnostics can confirm it actually applied in the browser.

### Diagnostics (cart/any page console)
```js
GanguramStorefrontGate.debugState();   // phase1CssLoaded, hasValidPincode, gateActive, gatedButtons, ctaButtons, pickupTextElements, soldOutCardsHidden, gatedSelectors
GanguramPincodePopup.debugState();     // (= GanguramDelivery) hasValidPincode, popupOpen, closeButtonVisible, nonBlocking, buyGateActive
GanguramDeliveryProgress.debugState(); // panelVisible, mov, movMet, movRemaining, ruleReason, movBarVisible — shows WHY the MOV bar does/doesn't render
```
If `phase1CssLoaded` is `false`, the asset isn’t loading on the active theme (re‑import from GitHub / check `theme.liquid`). If `GanguramDeliveryProgress.debugState().mov` is `null` with `ruleReason: 'none'`, no metaobject delivery rule resolved for that pincode — that’s why the MOV bar is absent (the calculation is unchanged).
