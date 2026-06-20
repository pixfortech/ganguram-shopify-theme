/*
 * Ganguram — Product visibility filtering by delivery zone (Phase 2.2 + hotfix)
 * ---------------------------------------------------------------------------
 * Shows/hides product CARDS based on the selected delivery zone from
 * window.GanguramZone AND the surface context (normal grid vs the
 * "4 Hours Delivery" / Quick-Commerce collection). Business rules:
 *
 *   - no valid pincode            -> show ALL (never permanently hide; the popup /
 *                                    cart guard from 2.1d handle requiring a pincode)
 *   - product carries no zone tag -> hidden once a pincode is set (zone unknown)
 *
 *   - PAN India pincode           -> show ONLY products tagged "PAN India".
 *                                    The 4-Hours-Delivery context is NEVER shown to
 *                                    PAN India (that collection's link is hidden too).
 *   - Kolkata / Quick Commerce    -> normal grids: show ONLY products tagged "Kolkata"
 *                                    (Quick-Commerce-only products stay out of normal
 *                                    browsing; QC ⊆ Kolkata serviceable area).
 *                                    4-Hours-Delivery grid: show ONLY products tagged
 *                                    "Quick Commerce".
 *
 * "4 Hours Delivery" context is detected per grid: a card whose closest
 * [data-ganguram-collection] grid handle is in window.GanguramQuickCommerceHandles
 * gets the "quick" context. Everything else (regular collections, featured blocks,
 * search, predictive search, recommendations) is "normal".
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

  // Handle(s) of the "4 Hours Delivery" / Quick-Commerce collection (set in the
  // zone-visibility config snippet). Read live so config order never matters.
  function quickCommerceHandles() {
    return (window.GanguramQuickCommerceHandles && window.GanguramQuickCommerceHandles.length) ? window.GanguramQuickCommerceHandles : [];
  }

  // Per-card surface context: 'quick' when the card sits inside a product grid
  // marked for the 4-Hours-Delivery / Quick-Commerce collection, else 'normal'.
  function contextOf(card) {
    var grid = card.closest('[data-ganguram-collection]');
    if (!grid) { return 'normal'; }
    var handle = grid.getAttribute('data-ganguram-collection');
    return (handle && quickCommerceHandles().indexOf(handle) !== -1) ? 'quick' : 'normal';
  }

  // Single source of truth for product visibility. Pure function of the three zone
  // tags, the active zone name, and the surface context ('normal' | 'quick').
  function isProductVisibleForContext(tags, zone, context) {
    if (!zone) { return true; }                       // no pincode -> show everything
    var k = tags.kolkata, p = tags.panIndia, q = tags.quickCommerce, ld = tags.localDelivery;
    if (!k && !p && !q && !ld) { return false; }      // no zone tag -> hidden after pincode
    if (zone === 'pan_india') {
      if (context === 'quick') { return false; }      // 4 Hours Delivery never shows for PAN India
      return p;                                        // PAN India: ONLY an explicit "PAN India" tag.
      //                                                  Local Delivery / Kolkata / Quick Commerce do
      //                                                  NOT make a product PAN-India-deliverable.
    }
    // kolkata or quick_commerce pincode (QC ⊆ Kolkata serviceable area):
    if (context === 'quick') { return q; }            // 4 Hours Delivery grid -> only Quick Commerce
    return k || ld;                                    // normal grids -> Kolkata OR Local Delivery
  }

  // Cart-level eligibility (Phase 2.11H): is a product DELIVERABLE to a zone by ANY
  // available mode? Standard (the "normal" surface) is always possible where a zone
  // resolves; 4 Hours Delivery (the "quick" surface) only in the quick-commerce area.
  // PAN India has no 4-hour. This is the predicate the CART uses (an item is fine if it
  // can arrive by standard OR 4-hour), so the cart never contradicts the delivery panel:
  //   - Kolkata / Local Delivery item in a local pincode -> deliverable (standard)
  //   - Quick-Commerce-only item in a quick-commerce pincode -> deliverable (4-hour)
  //   - local-only item (no PAN India tag) in a PAN India pincode -> NOT deliverable
  // The per-grid PRODUCT DISPLAY still uses isProductVisibleForContext(context) so the
  // 4-hour grid keeps showing only Quick-Commerce products. Pure, fail-open (no zone ->
  // deliverable). Does not change any rate / ShipZip / checkout logic.
  function isProductDeliverableToZone(tags, zone) {
    if (!zone) { return true; }                                  // no pincode -> never block
    if (isProductVisibleForContext(tags, zone, 'normal')) { return true; }
    if (zone === 'quick_commerce' && isProductVisibleForContext(tags, zone, 'quick')) { return true; }
    return false;
  }

  // Expose the rules so other modules (e.g. cart eligibility, Phase 2.7A; delivery
  // panel, 2.11H) reuse the EXACT same logic — single source of truth. Read-only.
  window.GanguramZoneRules = window.GanguramZoneRules || {};
  window.GanguramZoneRules.isProductVisibleForContext = isProductVisibleForContext;
  window.GanguramZoneRules.isProductDeliverableToZone = isProductDeliverableToZone;

  function cardAllowed(card, zoneName) {
    if (!zoneName) { return true; }
    var tags = {
      kolkata: card.getAttribute('data-ganguram-kolkata') === 'true',
      panIndia: card.getAttribute('data-ganguram-pan-india') === 'true',
      quickCommerce: card.getAttribute('data-ganguram-quick-commerce') === 'true',
      localDelivery: card.getAttribute('data-ganguram-local-delivery') === 'true'
    };
    return isProductVisibleForContext(tags, zoneName, contextOf(card));
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
      window.GanguramDelivery.openDeliveryLocationPopup('No products are available for this pincode. Try another delivery pincode.');
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
    p.textContent = 'No products are available for this pincode. Please change your delivery pincode.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ganguram-zone-empty__button';
    btn.setAttribute('data-ganguram-change-pincode', '');
    btn.textContent = 'Change pincode';
    btn.addEventListener('click', openPincodeUI);
    var inner = document.createElement('div');
    inner.className = 'ganguram-zone-empty__inner';
    inner.appendChild(p);
    inner.appendChild(btn);
    box.appendChild(inner);
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
