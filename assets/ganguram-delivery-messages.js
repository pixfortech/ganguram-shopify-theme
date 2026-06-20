/*
 * Ganguram — Delivery message catalog (Phase 2.11E)
 * ---------------------------------------------------------------------------
 * ONE customer-facing source of truth for delivery / pincode / MOV / mode error
 * messages, so the cart, popup and any future surface speak with one voice instead
 * of ad-hoc strings. Defines window.GanguramDeliveryMessages.get(code, vars).
 *
 * Some codes are THEME-SIDE (the cart can detect and show them early — e.g. no
 * pincode, not serviceable, MOV not reached, mixed cart). Others are CHECKOUT /
 * APP-SIDE (they can only be known at Shopify checkout or inside ShipZip / the
 * date-slot app — e.g. no rate returned, slot expired, app failure); the theme
 * cannot enforce those, but it OWNS the wording so the merchant can mirror it in
 * the app. See docs/delivery-rule-engine-admin-setup.md §6 for the ownership table.
 *
 * Copy is overridable from window.GanguramDeliveryMessagesConfig.messages (set by
 * the config snippet from theme settings — nothing customer-facing is hard-coded as
 * the only option). Liquid-safe tokens (__MOV__ / __REMAINING__ / __PINCODE__ /
 * __ITEMS__) are replaced here in JS. Display only; never blocks anything.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramDeliveryMessages) { return; }

  // code -> { text, side } where side is 'theme' (cart-detectable) or 'app'
  // (checkout / ShipZip / date-slot app only). The numbering matches the spec.
  var DEFAULTS = {
    NO_PINCODE:            { text: 'Please enter your delivery pincode to check delivery availability.', side: 'theme' },
    INVALID_PINCODE:       { text: 'Please enter a valid 6-digit Indian pincode.', side: 'theme' },
    NOT_SERVICEABLE:       { text: 'Sorry, we currently do not deliver to this pincode.', side: 'theme' },
    ADDRESS_INCOMPLETE:    { text: 'Please enter your complete delivery address to calculate accurate delivery options.', side: 'theme' },
    PINCODE_CITY_MISMATCH: { text: 'The selected city/state does not match the entered pincode. Please check your address.', side: 'theme' },
    MOV_NOT_REACHED:       { text: 'Minimum order value for your area is __MOV__. Please add __REMAINING__ more to continue.', side: 'theme' },
    CHARGE_UNAVAILABLE:    { text: 'Delivery charge could not be calculated for this address. Please check your pincode or try again.', side: 'app' },
    WEIGHT_EXCEEDED:       { text: 'This order exceeds the available delivery weight limit for your area. Please reduce quantity or contact us.', side: 'app' },
    QC_NOT_AVAILABLE:      { text: '4 Hours Delivery is not available for this pincode. Standard delivery may still be available.', side: 'theme' },
    MIXED_CART:            { text: '4 Hours Delivery is available only when all items in the cart are Quick-Commerce eligible.', side: 'theme' },
    MIXED_CART_ITEMS:      { text: '4 Hours Delivery is not available because the following item(s) are not eligible for quick delivery: __ITEMS__', side: 'theme' },
    PRODUCT_NOT_LOCAL:     { text: 'One or more products in your cart are not available for delivery to this pincode.', side: 'theme' },
    PRODUCT_NOT_PAN_INDIA: { text: 'One or more fresh/local items in your cart cannot be shipped outside Kolkata.', side: 'theme' },
    NO_STANDARD_RATE:      { text: 'Standard delivery is currently unavailable for this cart/address. Please check your address or contact us.', side: 'app' },
    NO_FOUR_HOUR_RATE:     { text: '4 Hours Delivery is currently unavailable. Please choose Standard Delivery.', side: 'app' },
    DATE_NOT_SELECTED:     { text: 'Please select a delivery date before placing the order.', side: 'app' },
    SLOT_NOT_SELECTED:     { text: 'Please select a delivery time slot before placing the order.', side: 'app' },
    SLOT_EXPIRED:          { text: 'This delivery slot is no longer available. Please choose another slot.', side: 'app' },
    APP_FAILURE:           { text: 'We could not load delivery options at the moment. Please refresh and try again.', side: 'app' },
    // Requirement B — widget pincode vs the checkout/saved-address pincode. The cart can
    // compare against a logged-in customer's SAVED address (the prefill); comparing the
    // exact pincode TYPED at checkout needs a Checkout UI Extension (app) — see §7.
    CHECKOUT_PINCODE_MISMATCH:       { text: 'The delivery pincode entered at checkout is different from the pincode used to calculate your cart delivery options. Please recheck the pincode to ensure accurate availability, delivery charges, and delivery timing.', side: 'theme' },
    CHECKOUT_PINCODE_MISMATCH_SHORT: { text: 'Your checkout pincode is different from the pincode used in the delivery checker. Please recheck it to avoid incorrect delivery charges or delivery issues.', side: 'theme' }
  };

  function cfg() { return window.GanguramDeliveryMessagesConfig || {}; }

  // __TOKEN__ replacement (single-brace {token} breaks Shopify Liquid in a snippet,
  // so the canonical tokens are __MOV__ / __REMAINING__ / __PINCODE__ / __ITEMS__).
  function tmpl(s, vars) {
    s = String(s == null ? '' : s);
    vars = vars || {};
    return s
      .replace(/__([A-Z0-9]+)__/g, function (_, k) { var kk = k.toLowerCase(); return (vars[kk] != null) ? vars[kk] : ''; })
      .replace(/\{(\w+)\}/g, function (_, k) { return (vars[k] != null) ? vars[k] : ''; });
  }

  function raw(code) {
    var over = cfg().messages || {};
    if (over[code] != null) { return String(over[code]); }
    return DEFAULTS[code] ? DEFAULTS[code].text : '';
  }
  function get(code, vars) { return tmpl(raw(code), vars || {}); }
  function side(code) { return DEFAULTS[code] ? DEFAULTS[code].side : ''; }

  window.GanguramDeliveryMessages = {
    get: get,
    side: side,
    codes: (function () { var a = []; for (var k in DEFAULTS) { if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) { a.push(k); } } return a; })()
  };
})();
