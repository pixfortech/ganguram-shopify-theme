/*
 * Ganguram — Storefront no-pincode purchase gate (Phase 1).
 * ---------------------------------------------------------------------------
 * When NO valid serviceable pincode is selected, HIDE Add to cart / Buy now / dynamic-checkout
 * on every product surface (collection cards, Best-Sellers / recommendation carousels, the
 * product page, quick-add) and show ONE compact CTA in their place: "Enter delivery pin code to
 * shop". The CTA opens the pincode popup (it carries the theme's [data-ganguram-open-pincode]
 * hook). Driven by the html.ganguram-no-pincode class (toggled here) + CSS (ganguram-phase1-ux.css).
 * A valid pincode removes the gate; per-product eligibility / in-stock state then apply as normal.
 *
 * It does NOT decide out-of-stock visibility. Global out-of-stock (Shopify `product.available`
 * false — i.e. sold out AND no backorder/continue-selling) is hidden in Liquid + via the theme's
 * own .product-item--sold-out class; backorder products (available) stay visible/purchasable; the
 * pickup/location line ("Out of stock at <store>") is just hidden, never used to hide a card.
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

  function zone() { return window.GanguramZone || null; }
  // Fail-open: with no resolver we never gate. Otherwise gate when there is no serviceable pincode.
  function hasValidPincode() {
    var z = zone(); if (!z) { return true; }
    try { var l = z.getSelectedDeliveryLocation(); return !!(l && l.pincode && l.isServiceable === true); } catch (e) { return true; }
  }
  function gateActive() { return !!zone() && !hasValidPincode(); }

  var CTA_CLASS = 'ganguram-pincode-cta';

  // One CTA per buy-button group (inserted before the Add-to-cart button, in its own parent so it
  // lands exactly where the buttons were). Idempotent. CSS shows it ONLY under .ganguram-no-pincode.
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
    var adds = document.querySelectorAll('[data-js-product-add-to-cart]'), n = 0;
    for (var i = 0; i < adds.length; i++) {
      var btn = adds[i], parent = btn.parentNode; if (!parent) { continue; }
      if (parent.querySelector('.' + CTA_CLASS)) { n++; continue; }
      try { parent.insertBefore(makeCta(btn), btn); n++; } catch (e) {}
    }
    return n;
  }

  function sync() {
    if (!enabled()) { return; }
    try { document.documentElement.classList.toggle('ganguram-no-pincode', gateActive()); } catch (e) {}
    try { injectCtas(); } catch (e) {}
  }
  function observe() {
    if (!('MutationObserver' in window)) { return; }
    var SEL = '[data-js-product-add-to-cart]';
    var obs, pending = false;
    var run = function () {
      pending = false;
      if (obs) { try { obs.disconnect(); } catch (e) {} }   // our own CTA insertion must not re-trigger us
      try { injectCtas(); } catch (e) {}
      if (obs) { try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {} }
    };
    var addsBuyButton = function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes || [];
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n && n.nodeType === 1 && ((n.matches && n.matches(SEL)) || (n.querySelector && n.querySelector(SEL)))) { return true; }
        }
      }
      return false;
    };
    var schedule = function (records) {
      // React ONLY when a new buy button appears (facets / infinite scroll / sliders). We ignore
      // the constant DOM churn from lazy-image loading + slider clones, so we never thrash layout
      // (or interfere with the theme's lazy-image / slider observers) while images are loading.
      if (pending || !addsBuyButton(records)) { return; }
      pending = true;
      if (window.requestAnimationFrame) { window.requestAnimationFrame(run); } else { setTimeout(run, 0); }
    };
    obs = new MutationObserver(schedule);
    try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  function init() {
    sync();
    observe();
    window.addEventListener('ganguram:delivery-location-changed', sync);
    window.addEventListener('ganguram:delivery-label-updated', sync);
  }

  window.GanguramStorefrontGate = {
    sync: sync,
    // DEV-ONLY diagnostics (console). Confirms the CSS is loaded + the no-pincode gate state +
    // that a mobile pincode entry point is actually visible (the mobile-visibility bug).
    debugState: function () {
      var sentinel = '';
      try { sentinel = (window.getComputedStyle(document.documentElement).getPropertyValue('--ganguram-phase1-loaded') || '').trim(); } catch (e) {}
      var loc = null; try { var z = zone(); loc = z && z.getSelectedDeliveryLocation && z.getSelectedDeliveryLocation(); } catch (e) {}
      var isMobile = false; try { isMobile = window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : (window.innerWidth <= 1023); } catch (e) {}
      var isVisible = function (el) { if (!el) { return false; } try { if (el.offsetParent !== null) { return true; } var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null; return !!(r && r.width > 0 && r.height > 0); } catch (e) { return false; } };
      var entries = [].slice.call(document.querySelectorAll('[data-ganguram-mobile-pincode-bar], [data-ganguram-open-pincode]'));
      return {
        phase1CssLoaded: sentinel === '1',
        isMobileViewport: isMobile,
        hasValidPincode: hasValidPincode(),
        pincodeSelected: !!(loc && loc.pincode && loc.isServiceable === true),
        selectedPincode: (loc && loc.pincode) || null,
        gateActive: gateActive(),
        gatedButtons: document.querySelectorAll('[data-js-product-add-to-cart], [data-ganguram-buy-now], .shopify-payment-button').length,
        ctaButtons: document.querySelectorAll('.' + CTA_CLASS).length,
        mobileEntryPointsFound: entries.length,
        mobileEntryPointsVisible: entries.filter(isVisible).length,
        mobilePincodeBarPresent: document.querySelectorAll('[data-ganguram-mobile-pincode-bar]').length,
        gatedSelectors: ['[data-js-product-add-to-cart]', '[data-ganguram-buy-now]', '.shopify-payment-button'],
        // out-of-stock is handled by Liquid (product.available) + CSS, NOT by this module.
        pickupTextElements: document.querySelectorAll('.product-item__local-availability, pickup-availability-compact').length,
        soldOutCardsHidden: document.querySelectorAll('.product-item--sold-out').length
      };
    }
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
