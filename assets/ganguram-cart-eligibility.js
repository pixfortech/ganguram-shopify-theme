/*
 * Ganguram — Cart eligibility enforcement on pincode change (Phase 2.7A)
 * ---------------------------------------------------------------------------
 * When the customer selects/changes a VALID delivery pincode, any cart line that
 * is not eligible for the resulting delivery zone/context is removed (Shopify Ajax
 * cart API, by line-item key), the cart UI is refreshed, and a clear, non-silent
 * message lists what was removed and why.
 *
 * Eligibility REUSES the exact same rule as the product-zone display filter
 * (window.GanguramZoneRules.isProductVisibleForContext) — single source of truth.
 * Tags are read from Liquid-stamped cart-line attributes (Shopify /cart.js does NOT
 * include product tags), keyed by line item key.
 *
 * Removal happens ONLY after a valid serviceable pincode is selected (never while
 * typing / on invalid / unserviceable pincode, never with no pincode). No checkout,
 * MOV, date/slot, shipping-rate, payment, ShipZip/SBZ/zipLogic logic. No pincode
 * lists, no 4-hour timing, no Google API, no saved addresses. Fail-safe: if the
 * rules module or GanguramZone is missing, nothing is ever removed.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramCartEligibilityInit) { return; }
  window.__ganguramCartEligibilityInit = true;

  var EVENT = 'ganguram:delivery-location-changed';
  var LINE_SEL = '[data-ganguram-cart-line]';
  var EMPTY_MSG = 'Your cart is now empty because the selected delivery pincode is not compatible with the previous items.';
  var busy = false;

  function cfg() { return window.GanguramCartConfig || {}; }
  function updateUrl() {
    return cfg().updateUrl ||
      (window.KROWN && KROWN.settings && KROWN.settings.routes && KROWN.settings.routes.cart_update_url) ||
      '/cart/update.js';
  }
  function allProductsUrl() { return cfg().allProductsUrl || '/collections/all'; }

  // Active zone only for a VALID, serviceable, selected pincode — else null (no-op).
  function activeZone() {
    var z = window.GanguramZone;
    if (!z || typeof z.getSelectedDeliveryLocation !== 'function') { return null; }
    var loc = z.getSelectedDeliveryLocation();
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }
    return loc.zone;
  }

  // Cart delivery context: 'normal' by default; 'quick' (4 Hours Delivery) only when
  // explicitly signalled via window.GanguramDeliveryContext (no persisted 4-hour mode
  // exists yet, and we never hard-code 4-hour timing here).
  function deliveryContext() {
    var c = window.GanguramDeliveryContext;
    if (typeof c === 'function') { try { c = c(); } catch (e) { c = null; } }
    return (c === 'quick' || c === '4-hour' || c === '4-hour-delivery') ? 'quick' : 'normal';
  }

  // The shared eligibility rule (same as the product display filter). Null if absent.
  function rule() {
    return (window.GanguramZoneRules && typeof window.GanguramZoneRules.isProductVisibleForContext === 'function')
      ? window.GanguramZoneRules.isProductVisibleForContext : null;
  }
  function eligible(line, zone, ctx, fn) {
    return fn({ kolkata: line.k, panIndia: line.p, quickCommerce: line.q }, zone, ctx);
  }

  // Read cart lines from the Liquid-stamped DOM (drawer + page), de-duped by key.
  function cartLines() {
    var seen = {}, out = [];
    var els = document.querySelectorAll(LINE_SEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-ganguram-line-key');
      if (!key || seen[key]) { continue; }
      seen[key] = true;
      out.push({
        key: key,
        title: el.getAttribute('data-ganguram-product-title') || el.getAttribute('data-title') || 'Item',
        qty: parseInt(el.getAttribute('data-qty') || '1', 10) || 1,
        k: el.getAttribute('data-ganguram-kolkata') === 'true',
        p: el.getAttribute('data-ganguram-pan-india') === 'true',
        q: el.getAttribute('data-ganguram-quick-commerce') === 'true'
      });
    }
    return out;
  }

  // Customer-facing reason for an INELIGIBLE (about-to-be-removed) line.
  function reasonFor(line, zone, ctx) {
    if (!line.k && !line.p && !line.q) { return 'Delivery eligibility tag missing'; }
    if (zone === 'pan_india') {
      if (line.k && !line.p) { return 'Available only for Kolkata delivery'; }
      if (line.q && !line.p && !line.k) { return 'Available only for 4 Hours Delivery'; }
      return 'Not available for PAN India delivery';
    }
    // kolkata / quick_commerce zone
    if (ctx === 'quick') {
      if (line.k && !line.q) { return 'Available only for Kolkata delivery'; }
      return 'Not eligible for current delivery mode';
    }
    // normal Kolkata
    if (line.q && !line.k) { return 'Available only for 4 Hours Delivery'; }
    return 'Not eligible for current delivery mode';
  }

  // ---- enforce --------------------------------------------------------------
  function apply() {
    if (busy) { return; }
    var zone = activeZone();
    if (!zone) { return; }              // no valid pincode -> never remove
    var fn = rule();
    if (!fn) { return; }                // rules missing -> fail safe, never remove
    var ctx = deliveryContext();
    var lines = cartLines();
    if (!lines.length) { return; }
    var remove = [];
    for (var i = 0; i < lines.length; i++) {
      if (!eligible(lines[i], zone, ctx, fn)) {
        lines[i].reason = reasonFor(lines[i], zone, ctx);
        remove.push(lines[i]);
      }
    }
    if (!remove.length) { return; }     // cart already compatible
    removeLines(remove);
  }

  function removeLines(remove) {
    busy = true;
    var updates = {};
    remove.forEach(function (l) { updates[l.key] = 0; });
    fetch(updateUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ updates: updates })
    })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var emptied = !!cart && cart.item_count === 0;
        if (typeof window.refreshCart === 'function') { try { window.refreshCart(false); } catch (e) {} }
        showMessage(remove, emptied);
      })
      .catch(function () { /* leave cart untouched on failure; do not claim success */ })
      .finally(function () { busy = false; });
  }

  // ---- message UI (modal; non-silent) ---------------------------------------
  var modal = null;
  function openPincode() {
    if (window.GanguramDelivery && typeof window.GanguramDelivery.openDeliveryLocationPopup === 'function') {
      window.GanguramDelivery.openDeliveryLocationPopup('Choose a delivery pincode to continue.');
      return;
    }
    var t = document.querySelector('[data-gdw-trigger]');
    if (t) { t.click(); }
  }
  function dismiss() { if (modal) { modal.setAttribute('hidden', ''); } }
  function buildModal() {
    var root = document.createElement('div');
    root.className = 'ganguram-cart-elig';
    root.setAttribute('data-ganguram-cart-eligibility-message', '');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'ganguram-cart-elig-heading');
    root.setAttribute('hidden', '');

    var backdrop = document.createElement('div');
    backdrop.className = 'ganguram-cart-elig__backdrop';
    backdrop.addEventListener('click', dismiss);

    var panel = document.createElement('div');
    panel.className = 'ganguram-cart-elig__panel';

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ganguram-cart-elig__close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '&times;';
    close.addEventListener('click', dismiss);

    var heading = document.createElement('p');
    heading.className = 'ganguram-cart-elig__heading';
    heading.id = 'ganguram-cart-elig-heading';

    var list = document.createElement('ul');
    list.className = 'ganguram-cart-elig__list';

    var actions = document.createElement('div');
    actions.className = 'ganguram-cart-elig__actions';
    var shop = document.createElement('a');
    shop.className = 'ganguram-cart-elig__btn';
    shop.href = allProductsUrl();
    shop.textContent = 'Continue Shopping';
    var change = document.createElement('button');
    change.type = 'button';
    change.className = 'ganguram-cart-elig__btn ganguram-cart-elig__btn--primary';
    change.textContent = 'Change Pincode';
    change.addEventListener('click', function () { dismiss(); openPincode(); });
    actions.appendChild(shop);
    actions.appendChild(change);

    panel.appendChild(close);
    panel.appendChild(heading);
    panel.appendChild(list);
    panel.appendChild(actions);
    root.appendChild(backdrop);
    root.appendChild(panel);
    document.body.appendChild(root);

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { dismiss(); } });
    root._heading = heading; root._list = list; root._close = close;
    return root;
  }
  function showMessage(removed, emptied) {
    if (!modal) { modal = buildModal(); }
    var n = removed.length;
    modal._heading.textContent = emptied
      ? EMPTY_MSG
      : (n === 1 ? '1 item has been affected in your cart.' : n + ' items have been affected in your cart.');
    modal._list.textContent = '';
    removed.forEach(function (l) {
      var li = document.createElement('li');
      li.className = 'ganguram-cart-elig__item';
      var qtyText = (l.qty && l.qty > 1) ? ' (×' + l.qty + ')' : '';
      li.textContent = l.title + ' removed' + qtyText + ' — ' + (l.reason || 'Not eligible for current delivery mode');
      modal._list.appendChild(li);
    });
    modal.removeAttribute('hidden');
    if (modal._close && typeof modal._close.focus === 'function') { modal._close.focus(); }
  }

  // ---- triggers -------------------------------------------------------------
  function init() {
    if (activeZone()) { apply(); }       // page load with a valid pincode already selected
    window.addEventListener(EVENT, apply);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
