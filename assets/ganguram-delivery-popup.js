/*
 * Ganguram — Mandatory delivery pincode popup + Add-to-Cart / Buy Now guard (Phase 2.1d)
 * ---------------------------------------------------------------------------
 * Uses window.GanguramZone ONLY. No ShipZip/SBZ/zipLogic. No checkout/MOV/date-slot/
 * shipping/product-availability/cart-removal/menu/search/collection/banner logic.
 * No jQuery/Bootstrap/FontAwesome. No direct localStorage writes. No redirects.
 *
 * Behaviour:
 *  - Auto-opens a pincode popup on first visit when no valid pincode is saved.
 *  - Saves the pincode via GanguramZone.setSelectedPincode (which validates +
 *    persists + fires the change event). Invalid pincodes are never stored.
 *  - Blocks Add to Cart (/cart/add form submit) and Buy Now (.shopify-payment-button)
 *    while no valid pincode exists, re-opening the popup with a message.
 *  - Fails OPEN: if GanguramZone is missing, nothing is blocked.
 *  - Skips the Shopify theme editor (design mode).
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramDeliveryPopupInit) { return; }
  window.__ganguramDeliveryPopupInit = true;

  var BLOCK_MSG = 'Please enter your delivery pincode to see available items.';
  var DEFAULT_MSG = 'We use your pincode only to show products available for your delivery area.';

  function zone() { return window.GanguramZone || null; }
  function inDesignMode() { return !!(window.Shopify && window.Shopify.designMode); }

  // Customer-facing label (city/name + pincode; never the internal zone label).
  // Uses the shared helper; falls back to a safe local rule if it isn't loaded.
  function displayLabel(loc) {
    if (window.GanguramDisplayLabel && typeof window.GanguramDisplayLabel.get === 'function') {
      return window.GanguramDisplayLabel.get(loc);
    }
    if (!loc || !loc.pincode) { return ''; }
    if (loc.city) { return loc.city + ' ' + loc.pincode; }
    if (loc.isKolkata || loc.zone === 'kolkata' || loc.zone === 'quick_commerce') { return 'Kolkata ' + loc.pincode; }
    return String(loc.pincode);
  }

  // -------------------------------------------------------------------------
  // public guard helpers
  // -------------------------------------------------------------------------
  function hasValidDeliveryLocation() {
    var z = zone();
    if (!z) { return false; }
    var loc = z.getSelectedDeliveryLocation();
    return !!(loc && loc.pincode && loc.isServiceable === true);
  }
  // Only guard when the resolver exists AND there is no valid location.
  // If the resolver is missing, FAIL OPEN (never block the store's cart).
  function shouldGuard() { return !!zone() && !hasValidDeliveryLocation(); }

  // -------------------------------------------------------------------------
  // popup element helpers
  // -------------------------------------------------------------------------
  function root() { return document.getElementById('ganguram-delivery-popup'); }
  function q(sel) { var r = root(); return r ? r.querySelector(sel) : null; }
  var lastFocus = null;
  var suppressAutoClose = false;
  var successTimer = null;

  function setMessage(msg) { var m = q('[data-gdp-message]'); if (m) { m.textContent = msg || DEFAULT_MSG; } }
  function setStatus(msg, state) {
    var s = q('[data-gdp-status]'); if (!s) { return; }
    s.textContent = msg || '';
    if (state) { s.setAttribute('data-gdp-state', state); } else { s.removeAttribute('data-gdp-state'); }
  }
  function setTitle(txt) { var t = q('[data-gdp-title]'); if (t && txt) { t.textContent = txt; } }
  function currentLoc() { var z = zone(); return z ? z.getSelectedDeliveryLocation() : null; }
  function setCurrent() {
    var el = q('[data-gdp-current]'); if (!el) { return; }
    var loc = currentLoc();
    var val = q('[data-gdp-current-value]');
    if (loc && loc.pincode && loc.isServiceable === true) {
      if (val) { val.textContent = displayLabel(loc); }
      el.hidden = false;
    } else {
      if (val) { val.textContent = ''; }
      el.hidden = true;
    }
  }
  function isOpen() { var r = root(); return !!(r && !r.hidden); }

  function openDeliveryLocationPopup(message) {
    var r = root(); if (!r) { return; }
    setMessage(message);
    setStatus('', '');
    setTitle('Choose delivery location');
    setCurrent();
    // Phase 1: NON-BLOCKING popup — the close (✕) button is ALWAYS available so a customer
    // can dismiss it and browse without first entering a pincode.
    var closeBtn = q('[data-gdp-close]');
    if (closeBtn) { closeBtn.hidden = false; }
    lastFocus = document.activeElement;
    r.classList.remove('is-closing');
    r.hidden = false;
    document.documentElement.classList.add('gdp-open');
    void r.offsetWidth; // reflow so the entrance transition runs from its start state
    r.classList.add('is-open');
    var input = q('[data-gdp-input]');
    if (input) {
      var pin = (zone() && zone().getSelectedPincode()) || '';
      input.value = pin;
      try { input.focus(); input.select(); } catch (e) {}
    }
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function closeDeliveryLocationPopup(force) {
    var r = root(); if (!r) { return; }
    // Phase 1: NON-BLOCKING — Escape, the ✕ and the backdrop ALWAYS close so the customer can
    // browse without a pincode. Buying still requires one: the add-to-cart / buy-now guards
    // re-open this popup, and the buttons are visually gated (see syncBuyGate). `force` is kept
    // for call-site compatibility but no longer prevents closing.
    if (r.hidden) { return; }
    r.classList.remove('is-open');
    r.classList.add('is-closing'); // CSS plays the exit transition
    var finish = function () {
      r.hidden = true;
      r.classList.remove('is-closing');
      document.documentElement.classList.remove('gdp-open');
      suppressAutoClose = false;
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    };
    if (prefersReducedMotion()) { finish(); } else { window.setTimeout(finish, 200); }
  }

  function apply() {
    var z = zone();
    var input = q('[data-gdp-input]');
    var raw = input ? (input.value || '').trim() : '';
    if (!z) { setStatus('Delivery lookup is unavailable. Please reload and try again.', 'error'); return; }
    var test = z.classifyPincode(raw);
    if (!test || test.zone === 'unknown' || test.isServiceable !== true) {
      setStatus('Please enter a valid serviceable pincode.', 'error');
      if (input) { try { input.focus(); input.select(); } catch (e) {} } // keep focus in the input
      return; // invalid -> NOT stored
    }
    // Valid: persist (fires the change event so the product filter updates), then show a
    // brief success state and close smoothly. suppressAutoClose lets the success show
    // instead of onZoneChange closing instantly. No filtering logic is duplicated here.
    suppressAutoClose = true;
    var loc = z.setSelectedPincode(raw);
    setStatus('Products updated for ' + displayLabel(loc) + '.', 'ok');
    setTitle('Choose delivery location');
    setCurrent();
    clearTimeout(successTimer);
    var delay = prefersReducedMotion() ? 150 : 950;
    successTimer = window.setTimeout(function () { suppressAutoClose = false; closeDeliveryLocationPopup(true); }, delay);
  }

  function onZoneChange() {
    syncBuyGate();                      // pincode just changed -> update the buy-button gate
    if (suppressAutoClose) { return; } // the popup's own apply is showing its success; its timer will close it
    if (isOpen() && hasValidDeliveryLocation()) {
      setStatus('', '');
      closeDeliveryLocationPopup(true);
    }
  }

  // Phase 1: visually gate the buy buttons when no valid pincode is selected. Toggles a root
  // class; the CSS dims + disables Add to cart / Buy now on collection cards, product cards,
  // the product page, quick-add and recommendation sections. The capture-phase guards still
  // re-open this popup on a click, so a dimmed button is also the prompt to choose a pincode.
  function syncBuyGate() {
    try { document.documentElement.classList.toggle('ganguram-no-pincode', shouldGuard()); } catch (e) {}
  }

  // -------------------------------------------------------------------------
  // guards (capture phase, ahead of the theme handlers)
  // -------------------------------------------------------------------------
  function isCartAddForm(form) {
    return !!(form && form.tagName === 'FORM' && typeof form.action === 'string' && form.action.indexOf('/cart/add') !== -1);
  }
  function onSubmitCapture(e) {
    if (!shouldGuard()) { return; }
    if (isCartAddForm(e.target)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openDeliveryLocationPopup(BLOCK_MSG);
    }
  }
  function onClickCapture(e) {
    if (!shouldGuard()) { return; }
    var t = e.target;
    if (t && t.closest && t.closest('.shopify-payment-button, [data-shopify="payment-button"]')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openDeliveryLocationPopup(BLOCK_MSG);
    }
  }

  // -------------------------------------------------------------------------
  // wiring
  // -------------------------------------------------------------------------
  function wirePopup() {
    var r = root(); if (!r) { return; }
    var applyBtn = q('[data-gdp-apply]');
    var closeBtn = q('[data-gdp-close]');
    var input = q('[data-gdp-input]');
    var overlay = q('[data-gdp-overlay]');
    if (applyBtn) { applyBtn.addEventListener('click', apply); }
    if (closeBtn) { closeBtn.addEventListener('click', function () { closeDeliveryLocationPopup(true); }); }
    if (overlay) { overlay.addEventListener('click', function () { closeDeliveryLocationPopup(false); }); }
    if (input) {
      input.addEventListener('input', function () { input.value = input.value.replace(/\D/g, '').slice(0, 6); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
    }
    // Escape closes only when a pincode is already saved; it must NOT bypass the
    // mandatory first-visit gate while shopping is blocked. Reduced-motion honoured in close().
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) { closeDeliveryLocationPopup(false); } });
    window.addEventListener((zone() && zone().EVENT_NAME) || 'ganguram:delivery-location-changed', onZoneChange);
    // City enrichment finished later -> re-render the current-location card only (no close).
    window.addEventListener('ganguram:delivery-label-updated', setCurrent);
    // Any element marked [data-ganguram-open-pincode] opens this popup (header widget,
    // mobile-nav clone, empty-state button). Delegated so dynamically-cloned triggers work.
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('[data-ganguram-open-pincode]')) {
        e.preventDefault();
        openDeliveryLocationPopup();
      }
    });
  }

  function init() {
    wirePopup();
    syncBuyGate();                  // gate the buy buttons from the first paint
    if (inDesignMode()) { return; } // no auto-open and no guards inside the theme editor
    document.addEventListener('submit', onSubmitCapture, true);
    document.addEventListener('click', onClickCapture, true);
    // Phase 1: still PROMPT on first visit (helpful), but the popup is now dismissable so it
    // never forces a pincode before browsing.
    if (zone() && !hasValidDeliveryLocation()) { openDeliveryLocationPopup(DEFAULT_MSG); }
  }

  // ---- mobile diagnostics helpers ----
  function gdpIsMobileViewport() {
    try { if (window.matchMedia) { return window.matchMedia('(max-width: 1023px)').matches; } } catch (e) {}
    return (window.innerWidth || 0) > 0 && window.innerWidth <= 1023;
  }
  function gdpIsVisible(el) {
    if (!el || el.nodeType !== 1) { return false; }
    try {
      if (el.offsetParent !== null) { return true; }                 // not display:none and laid out
      var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      return !!(r && r.width > 0 && r.height > 0);
    } catch (e) { return false; }
  }

  // public API
  window.GanguramDelivery = {
    hasValidDeliveryLocation: hasValidDeliveryLocation,
    openDeliveryLocationPopup: openDeliveryLocationPopup,
    closeDeliveryLocationPopup: function () { closeDeliveryLocationPopup(true); },
    // DEV-ONLY diagnostics (console): confirms the popup is non-blocking + mobile entry points exist.
    debugState: function () {
      var r = root(), closeBtn = q('[data-gdp-close]'), loc = null;
      try { loc = zone() && zone().getSelectedDeliveryLocation(); } catch (e) {}
      // Pincode openers a customer can tap to open the popup (the mobile bar + every
      // [data-ganguram-open-pincode] trigger / gate CTA). "Visible" = actually rendered on the
      // current viewport — on mobile at least one (the mobile bar) MUST be visible.
      var entries = [].slice.call(document.querySelectorAll('[data-ganguram-mobile-pincode-bar], [data-ganguram-open-pincode]'));
      var visible = entries.filter(gdpIsVisible);
      return {
        isMobileViewport: gdpIsMobileViewport(),
        hasValidPincode: hasValidDeliveryLocation(),
        pincodeSelected: !!(loc && loc.pincode),
        selectedPincode: (loc && loc.pincode) || null,
        popupExists: !!r,
        popupMounted: !!r,
        popupOpen: !!(r && r.hidden === false),
        closeButtonVisible: !!(closeBtn && closeBtn.hidden === false),
        mobileEntryPointsFound: entries.length,
        mobileEntryPointsVisible: visible.length,
        mobilePincodeBarPresent: document.querySelectorAll('[data-ganguram-mobile-pincode-bar]').length,
        nonBlocking: true,                 // ESC / backdrop / x always close (Phase 1)
        buyGateActive: shouldGuard()
      };
    }
  };
  // Alias for the documented diagnostics name.
  window.GanguramPincodePopup = window.GanguramDelivery;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
