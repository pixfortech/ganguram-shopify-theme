/*
 * Ganguram — Checkout pincode mismatch warning (Phase 2.11E — Requirement B)
 * ---------------------------------------------------------------------------
 * Warns the customer when the pincode used in the delivery checker
 * (ganguram_selected_pincode, via GanguramZone) differs from the pincode Shopify
 * will use at checkout. Defines window.GanguramPincodeMismatch.
 *
 * SHOPIFY LIMITATION: a standard theme CANNOT read the address typed on Shopify's
 * hosted checkout, nor render UI there. So the theme compares the widget pincode
 * against the LOGGED-IN customer's SAVED address pincode(s) — the address Shopify
 * prefills at checkout — and shows the warning IN THE CART (before checkout). For
 * a guest, or a brand-new address typed at checkout, the exact comparison needs a
 * Checkout UI Extension (app); the cart attribute ganguram_selected_pincode
 * (Phase 2.11D.2) is provided so such an extension can do it. See docs §7.
 *
 * Warning ONLY — it never blocks checkout (the MOV soft guard is the only block).
 * Fully FAIL-OPEN: no config / no saved address / guest / any error -> no warning.
 * Never changes checkout, shipping, ShipZip/SBZ/zipLogic, the resolver, the cart,
 * or settings_data.json. No localStorage writes.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramPincodeMismatch) { return; }

  var EVENT = 'ganguram:delivery-location-changed';

  function cfg() { return window.GanguramPincodeMismatchConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function norm(p) { return String(p == null ? '' : p).replace(/\D/g, '').slice(0, 6); }

  function savedPincodes() {
    var arr = cfg().savedPincodes;
    if (!Array.isArray(arr)) { return []; }
    var out = [];
    for (var i = 0; i < arr.length; i++) { var p = norm(arr[i]); if (p.length === 6 && out.indexOf(p) === -1) { out.push(p); } }
    return out;
  }

  function widgetPincode() {
    var z = window.GanguramZone;
    if (z && typeof z.getSelectedDeliveryLocation === 'function') {
      try { var loc = z.getSelectedDeliveryLocation(); return loc ? norm(loc.pincode) : ''; } catch (e) {}
    }
    return '';
  }

  function message() {
    var m = window.GanguramDeliveryMessages;
    if (m && typeof m.get === 'function') {
      var t = m.get(cfg().useLong ? 'CHECKOUT_PINCODE_MISMATCH' : 'CHECKOUT_PINCODE_MISMATCH_SHORT');
      if (t) { return t; }
    }
    return cfg().message || 'Your checkout pincode is different from the pincode used in the delivery checker. Please recheck it to avoid incorrect delivery charges or delivery issues.';
  }

  // Mismatch only when we have BOTH a widget pincode AND saved address pincode(s),
  // and the widget pincode matches NONE of the saved ones (so shipping to any of the
  // customer's own addresses never false-warns).
  function isMismatch() {
    if (!enabled()) { return false; }
    var w = widgetPincode();
    var saved = savedPincodes();
    if (!w || !saved.length) { return false; }
    return saved.indexOf(w) === -1;
  }

  function els() { return document.querySelectorAll('[data-ganguram-pincode-mismatch]'); }
  function render() {
    var warn = isMismatch();
    var text = warn ? message() : '';
    var list = els();
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      try {
        el.textContent = text;
        if (warn) { el.removeAttribute('hidden'); } else { el.setAttribute('hidden', 'hidden'); }
      } catch (e) {}
    }
  }

  function init() {
    render();
    window.addEventListener(EVENT, render);
    window.addEventListener('ganguram:delivery-label-updated', render);
  }

  window.GanguramPincodeMismatch = { render: render, isMismatch: isMismatch };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
