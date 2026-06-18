/*
 * Ganguram — Menu visibility by delivery zone (Phase 2.5)
 * ---------------------------------------------------------------------------
 * Hides clearly Kolkata-only category MENU links for PAN-India customers,
 * reversibly. Replicates the 2.3.2 business outcome (Kolkata-only category links
 * hidden for non-Kolkata pincodes) cleanly and data-drivenly:
 *
 *   window.GanguramZoneKolkataOnly is built in Liquid from each collection's
 *   all_tags — a collection with NO 'PAN India' product is "Kolkata-only".
 *   No hardcoded category list, no pincode list duplicated.
 *
 * Rule:
 *   - pan_india pincode -> hide menu links pointing to Kolkata-only collections,
 *     AND to the "4 Hours Delivery" / Quick-Commerce collection
 *     (window.GanguramQuickCommerceHandles) — that service is Kolkata/QC only and
 *     must never be offered to PAN India, even if it happens to contain a
 *     PAN-tagged product.
 *   - kolkata / quick_commerce / no-pincode -> show all menu links
 *
 * Reuses window.GanguramZone + 'ganguram:delivery-location-changed'. Fail-open if
 * GanguramZone is missing. Reversible (toggles a class; never removes DOM).
 * Touches NO checkout/MOV/shipping/ShipZip/SBZ/zipLogic/cart logic and does NOT
 * change the Phase 2.2 product-card filter (search RESULT cards + predictive-search
 * items reuse that filter via their own data-ganguram-product-card attributes).
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramZoneVisibilityInit) { return; }
  window.__ganguramZoneVisibilityInit = true;

  var HIDDEN = 'ganguram-zone-link-hidden';
  var EVENT = 'ganguram:delivery-location-changed';
  // Menu links + homepage category tiles (.js-slider-item wraps text-columns-images tiles;
  // product cards link to /products/ so they never match this collection-link selector).
  var MENU_LINK = '.menu-link[href*="/collections/"], .js-slider-item a[href*="/collections/"]';

  function zone() { return window.GanguramZone || null; }

  // active zone name only when a valid serviceable pincode is selected, else null
  function activeZone() {
    var z = zone(); if (!z) { return null; }
    var loc = z.getSelectedDeliveryLocation();
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }
    return loc.zone;
  }

  function kolkataOnlySet() {
    return (window.GanguramZoneKolkataOnly && window.GanguramZoneKolkataOnly.length) ? window.GanguramZoneKolkataOnly : [];
  }
  function quickCommerceHandleSet() {
    return (window.GanguramQuickCommerceHandles && window.GanguramQuickCommerceHandles.length) ? window.GanguramQuickCommerceHandles : [];
  }
  function handleOf(href) {
    if (!href) { return null; }
    var m = href.match(/\/collections\/([^\/?#]+)/);
    return m ? m[1] : null;
  }

  function applyLink(a, hidePan) {
    var h = handleOf(a.getAttribute('href') || '');
    // Hidden for PAN India when the target is a Kolkata-only category OR the
    // 4-Hours-Delivery / Quick-Commerce collection.
    var hideForPan = !!(h && (kolkataOnlySet().indexOf(h) !== -1 || quickCommerceHandleSet().indexOf(h) !== -1));
    var li = a.closest('li, .js-slider-item') || a;
    if (hideForPan && hidePan) { li.classList.add(HIDDEN); }
    else { li.classList.remove(HIDDEN); }
  }

  function apply() {
    var hidePan = (activeZone() === 'pan_india'); // only PAN India hides Kolkata-only links
    var links = document.querySelectorAll(MENU_LINK);
    for (var i = 0; i < links.length; i++) { applyLink(links[i], hidePan); }
  }

  function debounce(fn, wait) {
    var t;
    return function () { clearTimeout(t); var a = arguments, c = this; t = setTimeout(function () { fn.apply(c, a); }, wait); };
  }
  var applyDebounced = debounce(apply, 120);

  function init() {
    apply();
    window.addEventListener(EVENT, apply);
    // Re-apply when menu DOM is (re)built — e.g. the mobile drawer / cloned nav.
    if ('MutationObserver' in window && document.body) {
      var obs = new MutationObserver(function (mutations) {
        var relevant = mutations.some(function (m) {
          return Array.prototype.some.call(m.addedNodes, function (n) {
            return n.nodeType === 1 && ((n.matches && n.matches(MENU_LINK)) || (n.querySelector && n.querySelector(MENU_LINK)));
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
