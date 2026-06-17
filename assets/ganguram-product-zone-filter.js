/*
 * Ganguram — Product visibility filtering by delivery zone (Phase 2.2)
 * ---------------------------------------------------------------------------
 * Shows/hides product CARDS based on the selected delivery zone from
 * window.GanguramZone. Replicates the 2.3.2 business outcome, cleanly:
 *   - Kolkata pincode        -> show products tagged "Kolkata"
 *   - Quick Commerce pincode -> show products tagged "Kolkata" (QC ⊆ Kolkata serviceable)
 *   - PAN India pincode      -> show products tagged "PAN India"
 *   - no valid pincode       -> show ALL (never permanently hide; the popup/cart
 *                               guard from 2.1d handle requiring a pincode)
 *   - a product with no zone tag -> always shown (the catalogue has none; safety)
 *
 * Uses GanguramZone only. No checkout/MOV/date-slot/shipping/cart-removal/payment
 * logic; no menu/search/collection filtering of the THEME; no ShipZip/SBZ/zipLogic.
 * No jQuery/Bootstrap/FontAwesome. No localStorage writes. No redirects.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramZoneFilterInit) { return; }
  window.__ganguramZoneFilterInit = true;

  var CARD = '[data-ganguram-product-card]';
  var HIDDEN = 'ganguram-zone-hidden';
  var EVENT = 'ganguram:delivery-location-changed';
  // Known Local product-grid containers (collection + featured-collection); other
  // surfaces fall back to the card's direct parent for empty-state grouping.
  var GRID_SEL = '#main-collection-product-grid, [id^="product-grid-"], [data-ganguram-product-grid]';

  function zone() { return window.GanguramZone || null; }

  // Returns the active zone name only when a valid serviceable pincode is selected,
  // otherwise null (which means: do not filter / show everything).
  function activeZone() {
    var z = zone(); if (!z) { return null; }
    var loc = z.getSelectedDeliveryLocation();
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }
    return loc.zone;
  }

  function cardAllowed(card, zoneName) {
    if (!zoneName) { return true; }
    var k = card.getAttribute('data-ganguram-kolkata') === 'true';
    var p = card.getAttribute('data-ganguram-pan-india') === 'true';
    var qc = card.getAttribute('data-ganguram-quick-commerce') === 'true';
    if (!k && !p && !qc) { return true; } // untagged -> always show
    if (zoneName === 'kolkata') { return k; }
    if (zoneName === 'quick_commerce') { return k || qc; }
    if (zoneName === 'pan_india') { return p; }
    return true;
  }

  function debounce(fn, wait) {
    var t;
    return function () { clearTimeout(t); var a = arguments, c = this; t = setTimeout(function () { fn.apply(c, a); }, wait); };
  }

  // ---- empty state -------------------------------------------------------
  function gridsWithCards() {
    var grids = [];
    document.querySelectorAll(CARD).forEach(function (card) {
      var g = card.closest(GRID_SEL) || card.parentElement;
      if (g && grids.indexOf(g) === -1) { grids.push(g); }
    });
    return grids;
  }
  function openPincodeUI() {
    if (window.GanguramDelivery && typeof window.GanguramDelivery.openDeliveryLocationPopup === 'function') {
      window.GanguramDelivery.openDeliveryLocationPopup('Enter a delivery pincode to see available products.');
    } else {
      var trigger = document.querySelector('[data-gdw-trigger]'); // fall back to the header widget
      if (trigger) { trigger.click(); }
    }
  }
  function makeEmptyState() {
    var box = document.createElement('div');
    box.className = 'ganguram-zone-empty';
    box.setAttribute('data-ganguram-zone-empty', '');
    var p = document.createElement('p');
    p.className = 'ganguram-zone-empty__text';
    p.textContent = 'No products available for this delivery pincode.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ganguram-zone-empty__button';
    btn.setAttribute('data-ganguram-change-pincode', '');
    btn.textContent = 'Change pincode';
    btn.addEventListener('click', openPincodeUI);
    box.appendChild(p);
    box.appendChild(btn);
    return box;
  }
  function updateEmptyStates() {
    gridsWithCards().forEach(function (grid) {
      var cards = grid.querySelectorAll(CARD);
      var anyVisible = Array.prototype.some.call(cards, function (c) { return !c.classList.contains(HIDDEN); });
      var existing = grid.querySelector('[data-ganguram-zone-empty]');
      if (cards.length && !anyVisible) {
        if (!existing) { grid.appendChild(makeEmptyState()); }
      } else if (existing) {
        existing.parentNode.removeChild(existing);
      }
    });
  }

  // ---- apply -------------------------------------------------------------
  function apply() {
    var zoneName = activeZone();
    var cards = document.querySelectorAll(CARD);
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle(HIDDEN, !cardAllowed(cards[i], zoneName));
    }
    updateEmptyStates();
  }
  var applyDebounced = debounce(apply, 120);

  function init() {
    apply();
    window.addEventListener(EVENT, apply);
    // Re-apply when product cards are added dynamically (facets AJAX, infinite
    // scroll, recommendations, quick view). Only reacts to product-card additions.
    if ('MutationObserver' in window && document.body) {
      var obs = new MutationObserver(function (mutations) {
        var relevant = mutations.some(function (m) {
          return Array.prototype.some.call(m.addedNodes, function (n) {
            return n.nodeType === 1 && ((n.matches && n.matches(CARD)) || (n.querySelector && n.querySelector(CARD)));
          });
        });
        if (relevant) { applyDebounced(); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
