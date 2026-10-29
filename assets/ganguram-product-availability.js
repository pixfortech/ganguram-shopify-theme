/*
 * Ganguram — Product page pincode availability (Phase 2.7C hotfix, Issue 3)
 * ---------------------------------------------------------------------------
 * On a PRODUCT page, if the product is not eligible for the selected delivery
 * pincode/zone, disable Add to Cart + Buy Now, show a clear message and a
 * single shared delivery location control in the header.
 *
 * REUSES the shared eligibility rule (window.GanguramZoneRules
 * .isProductVisibleForContext) and the pincode state (GanguramZone +
 * 'ganguram:delivery-location-changed'); it does NOT re-implement product tag
 * rules or pincode classification. Tags are read from Liquid-stamped attributes on
 * the product element ([data-ganguram-product-availability]).
 *
 * Never blocks when no/invalid/unserviceable pincode is selected (the mandatory
 * pincode popup / cart guard own that). No checkout/MOV/shipping/ShipZip/SBZ/
 * zipLogic logic. No pincode lists, no Google API.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramProductAvailabilityInit) { return; }
  window.__ganguramProductAvailabilityInit = true;

  var EVENT = 'ganguram:delivery-location-changed';
  var ROOT_SEL = '[data-ganguram-product-availability]';
  var UNAVAIL = 'ganguram-pa-unavailable';      // per-product flag (guard reads this)
  var BODY_UNAVAIL = 'ganguram-product-unavailable'; // body flag (CSS disables buttons)
  var MSG_ATTR = 'data-ganguram-pa-msg';

  function cfg() { return window.GanguramProductAvailabilityConfig || {}; }
  function msgText(pincode) {
    var t = cfg().message || 'This product is not available for delivery to the selected pincode: {pincode}.';
    return t.replace('{pincode}', pincode);
  }
  function isProductPage() { return !!(document.body && document.body.classList.contains('template-product')); }
  function activeLoc() {
    var z = window.GanguramZone;
    if (!z || typeof z.getSelectedDeliveryLocation !== 'function') { return null; }
    var loc = z.getSelectedDeliveryLocation();
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }
    return loc;
  }
  function deliveryContext() {
    var c = window.GanguramDeliveryContext;
    if (typeof c === 'function') { try { c = c(); } catch (e) { c = null; } }
    return (c === 'quick' || c === '4-hour' || c === '4-hour-delivery') ? 'quick' : 'normal';
  }
  function rule() {
    return (window.GanguramZoneRules && typeof window.GanguramZoneRules.isProductVisibleForContext === 'function')
      ? window.GanguramZoneRules.isProductVisibleForContext : null;
  }

  function roots() { return document.querySelectorAll(ROOT_SEL); }
  function tagsOf(root) {
    return {
      kolkata: root.getAttribute('data-ganguram-kolkata') === 'true',
      panIndia: root.getAttribute('data-ganguram-pan-india') === 'true',
      quickCommerce: root.getAttribute('data-ganguram-quick-commerce') === 'true',
      localDelivery: root.getAttribute('data-ganguram-local-delivery') === 'true'
    };
  }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) { e.className = cls; } return e; }
  function formEl(root) { return root.querySelector('form'); }
  function anchorEl(root) { return root.querySelector('product-form') || root.querySelector('[data-js-product-form]') || formEl(root); }

  // Block submit (Enter key / programmatic) while the product is unavailable.
  function guardForm(root) {
    var f = formEl(root);
    if (!f || f.__gpaGuard) { return; }
    f.__gpaGuard = function (e) { if (root.classList.contains(UNAVAIL)) { e.preventDefault(); e.stopPropagation(); } };
    f.addEventListener('submit', f.__gpaGuard, true); // capture
  }
  function ensureMsg(root, pincode) {
    var existing = root.querySelector('[' + MSG_ATTR + ']');
    if (existing) { existing._text.textContent = msgText(pincode); return; }
    var anchor = anchorEl(root);
    if (!anchor || !anchor.parentNode) { return; }
    var box = el('div', 'ganguram-pa');
    box.setAttribute(MSG_ATTR, '');
    box.setAttribute('role', 'alert');
    var p = el('p', 'ganguram-pa__text');
    p.textContent = msgText(pincode);
    box.appendChild(p);
    box._text = p;
    anchor.parentNode.insertBefore(box, anchor); // just above the buy buttons
  }
  function removeMsg(root) {
    var e = root.querySelector('[' + MSG_ATTR + ']');
    if (e && e.parentNode) { e.parentNode.removeChild(e); }
  }

  function apply() {
    if (!isProductPage()) { return; }
    var fn = rule(); if (!fn) { return; }
    var loc = activeLoc();
    var ctx = deliveryContext();
    var rs = roots();
    var anyUnavail = false;
    for (var i = 0; i < rs.length; i++) {
      var root = rs[i];
      guardForm(root);
      var eligible = !loc ? true : fn(tagsOf(root), loc.zone, ctx); // no pincode -> never block here
      if (eligible) {
        root.classList.remove(UNAVAIL);
        removeMsg(root);
      } else {
        root.classList.add(UNAVAIL);
        ensureMsg(root, loc.pincode);
        anyUnavail = true;
      }
    }
    if (document.body) { document.body.classList.toggle(BODY_UNAVAIL, anyUnavail); }
    // Keep the product and eligibility explanation visible. Location changes live in the header.
  }

  function init() {
    if (!isProductPage()) { return; }
    apply();
    window.addEventListener(EVENT, apply);
    // Capture on document also covers forms replaced by variant/section rendering.
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.matches('form[action*="/cart/add"]')) return;
      apply();
      if (document.body.classList.contains(BODY_UNAVAIL)) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }, true);
    if ('MutationObserver' in window) {
      new MutationObserver(function (records) {
        if (records.some(function (r) { return Array.prototype.some.call(r.addedNodes, function (n) {
          return n.nodeType === 1 && (n.matches('form, product-form, ' + ROOT_SEL) || n.querySelector('form, product-form, ' + ROOT_SEL));
        }); })) apply();
      }).observe(document.body, {childList:true, subtree:true});
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
