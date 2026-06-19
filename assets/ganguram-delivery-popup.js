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
    // Close button only when a valid pincode already exists (dismissible);
    // otherwise the popup is mandatory (no close button).
    var closeBtn = q('[data-gdp-close]');
    if (closeBtn) { closeBtn.hidden = !hasValidDeliveryLocation(); }
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
    // Mandatory mode: don't close unless forced (Escape / programmatic) or a valid
    // pincode already exists. The backdrop uses force=false, Escape uses force=true.
    if (!force && !hasValidDeliveryLocation()) { return; }
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
    if (suppressAutoClose) { return; } // the popup's own apply is showing its success; its timer will close it
    if (isOpen() && hasValidDeliveryLocation()) {
      setStatus('', '');
      closeDeliveryLocationPopup(true);
    }
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
    if (inDesignMode()) { return; } // no auto-open and no guards inside the theme editor
    document.addEventListener('submit', onSubmitCapture, true);
    document.addEventListener('click', onClickCapture, true);
    if (zone() && !hasValidDeliveryLocation()) { openDeliveryLocationPopup(DEFAULT_MSG); }
  }

  // public API
  window.GanguramDelivery = {
    hasValidDeliveryLocation: hasValidDeliveryLocation,
    openDeliveryLocationPopup: openDeliveryLocationPopup,
    closeDeliveryLocationPopup: function () { closeDeliveryLocationPopup(true); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
