/*
 * Ganguram — Storefront gate (Phase 1 hotfix): no-pincode purchase gate + out-of-stock hide.
 * ---------------------------------------------------------------------------
 * A. NO-PINCODE BUY GATE — when no valid serviceable pincode is selected, HIDE Add to cart /
 *    Buy now / dynamic-checkout on every product surface (collection cards, Best-Sellers /
 *    recommendation carousels, the product page, quick-add) and show ONE compact CTA in their
 *    place: "Enter delivery pin code to shop". The CTA opens the pincode popup (it carries the
 *    theme's [data-ganguram-open-pincode] hook). Hiding/showing is driven by the
 *    html.ganguram-no-pincode class (toggled here) + CSS (ganguram-phase1-ux.css). A valid
 *    pincode removes the gate; per-product eligibility / in-stock state then apply as normal.
 *
 * B. OUT-OF-STOCK HIDE — "Out of stock at <store>" is the theme's CLIENT-SIDE pickup widget
 *    (pickup-availability-compact), not product.available, so CSS on .product-item--sold-out
 *    can't catch it. After the widget resolves, if it shows the unavailable alert (.alert--note,
 *    not .alert--success), hide the whole product card. Globally sold-out products are filtered
 *    in Liquid (the grid loops) — this only handles the location/pickup case.
 *
 * DIAGNOSTICS: window.GanguramStorefrontGate.debugState(). Display only; never blocks the cart's
 * own checkout, never changes ShipZip / eligibility / MOV / prefill / settings_data. Fail-open
 * (no GanguramZone -> never gates). Theme variables / classes only; no jQuery.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramStorefrontGate) { return; }

  function cfg() { return window.GanguramStorefrontGateConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function ctaText() { return cfg().ctaText || 'Enter delivery pin code to shop'; }
  function hideOutOfStock() { return cfg().hideOutOfStock !== false; }   // default on

  function zone() { return window.GanguramZone || null; }
  // Fail-open: with no resolver we never gate. Otherwise gate when there is no serviceable pincode.
  function hasValidPincode() {
    var z = zone(); if (!z) { return true; }
    try { var l = z.getSelectedDeliveryLocation(); return !!(l && l.pincode && l.isServiceable === true); } catch (e) { return true; }
  }
  function gateActive() { return !!zone() && !hasValidPincode(); }

  var CTA_CLASS = 'ganguram-pincode-cta';

  // ---- A. no-pincode buy gate ----------------------------------------------
  // One CTA per buy-button group (inserted before the Add-to-cart button, in its own parent so
  // it lands exactly where the buttons were). Idempotent. CSS shows it ONLY under .ganguram-no-pincode.
  function makeCta(addBtn) {
    var cta = document.createElement('button');
    cta.type = 'button';
    // reuse the theme button classes from the real Add-to-cart button so it matches the design.
    var base = String(addBtn.className || '').replace(/button--loader/g, '').replace(/\s+/g, ' ').trim();
    cta.className = (base || 'button button--solid button--fullwidth') + ' ' + CTA_CLASS;
    cta.setAttribute('data-ganguram-open-pincode', '');
    cta.setAttribute('data-ganguram-pincode-cta', '');
    cta.textContent = ctaText();
    return cta;
  }
  function injectCtas() {
    var adds = document.querySelectorAll('[data-js-product-add-to-cart]');
    var n = 0;
    for (var i = 0; i < adds.length; i++) {
      var btn = adds[i], parent = btn.parentNode; if (!parent) { continue; }
      if (parent.querySelector('.' + CTA_CLASS)) { n++; continue; }
      try { parent.insertBefore(makeCta(btn), btn); n++; } catch (e) {}
    }
    return n;
  }

  // ---- B. out-of-stock (pickup) hide ---------------------------------------
  function isUnavailableWidget(w) {
    // resolved + showing the "unavailable" alert (.alert--note) and NOT the available one.
    if (w.querySelector('.alert--circle-loading')) { return false; } // still checking
    if (w.querySelector('.alert--success')) { return false; }        // in stock
    return !!w.querySelector('.alert--note');                         // out of stock at the store
  }
  function hideOutOfStockCards() {
    if (!hideOutOfStock()) { return 0; }
    var widgets = document.querySelectorAll('pickup-availability-compact'), hidden = 0;
    for (var i = 0; i < widgets.length; i++) {
      var w = widgets[i];
      var card = w.closest ? w.closest('[data-ganguram-product-card], .product-item') : null;
      if (!card) { continue; }
      if (isUnavailableWidget(w)) { card.setAttribute('data-ganguram-oos-hidden', ''); hidden++; }
      else if (!w.querySelector('.alert--circle-loading')) { card.removeAttribute('data-ganguram-oos-hidden'); }
    }
    return hidden;
  }

  // ---- sync + observe -------------------------------------------------------
  function sync() {
    if (!enabled()) { return; }
    try { document.documentElement.classList.toggle('ganguram-no-pincode', gateActive()); } catch (e) {}
    try { injectCtas(); } catch (e) {}
    try { hideOutOfStockCards(); } catch (e) {}
  }
  function observe() {
    if (!('MutationObserver' in window)) { return; }
    var pending = false;
    var schedule = function () {
      if (pending) { return; } pending = true;
      var run = function () { pending = false; try { injectCtas(); } catch (e) {} try { hideOutOfStockCards(); } catch (e) {} };
      if (window.requestAnimationFrame) { window.requestAnimationFrame(run); } else { setTimeout(run, 0); }
    };
    try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }

  function init() {
    sync();
    observe();
    window.addEventListener('ganguram:delivery-location-changed', sync);
    window.addEventListener('ganguram:delivery-label-updated', sync);
  }

  window.GanguramStorefrontGate = {
    sync: sync,
    // DEV-ONLY diagnostics (console). Confirms the CSS is loaded + the gate + out-of-stock state.
    debugState: function () {
      var sentinel = '';
      try { sentinel = (window.getComputedStyle(document.documentElement).getPropertyValue('--ganguram-phase1-loaded') || '').trim(); } catch (e) {}
      return {
        phase1CssLoaded: sentinel === '1',
        hasValidPincode: hasValidPincode(),
        gateActive: gateActive(),
        gatedButtons: document.querySelectorAll('[data-js-product-add-to-cart], [data-ganguram-buy-now], .shopify-payment-button').length,
        ctaButtons: document.querySelectorAll('.' + CTA_CLASS).length,
        gatedSelectors: ['[data-js-product-add-to-cart]', '[data-ganguram-buy-now]', '.shopify-payment-button'],
        pickupWidgets: document.querySelectorAll('pickup-availability-compact').length,
        outOfStockHidden: document.querySelectorAll('[data-ganguram-oos-hidden]').length
      };
    }
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
