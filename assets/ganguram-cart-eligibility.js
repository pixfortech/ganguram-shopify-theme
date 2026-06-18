/*
 * Ganguram — Cart eligibility: confirm-before-remove (Phase 2.7A, no-removal-on-cancel)
 * ---------------------------------------------------------------------------
 * When the customer selects/changes a VALID serviceable pincode and some cart
 * lines are not deliverable to it, we WARN first and remove NOTHING until ONE
 * explicit positive action. The warning offers three clearly separated choices:
 *
 *   - "Keep current pincode"             -> SAFE. Restore the previous accepted
 *                                           pincode, close the warning, change
 *                                           nothing. (Same as ✕ / backdrop / Esc.)
 *   - "Change pincode"                   -> Restore the previous pincode and
 *                                           reopen the pincode popup. No removal.
 *   - "Continue with selected pincode"   -> the ONLY path that mutates the cart:
 *                                           accept the new pincode, remove only the
 *                                           affected lines, refresh, then show a
 *                                           final confirmation message.
 *
 * Removal is triggered from exactly ONE place (onConfirm -> removeLines). Every
 * cancel/close/keep/change path restores the previous pincode and never calls the
 * cart API. The self-induced restore re-dispatch is guarded (suppressNext) so it
 * cannot re-trigger a warning or a removal.
 *
 * Eligibility REUSES the product-display rule (window.GanguramZoneRules
 * .isProductVisibleForContext). Tags + product url/image/handle are read from
 * Liquid-stamped cart-line attributes (Shopify /cart.js has no product tags).
 * No checkout/MOV/date-slot/shipping/payment/ShipZip/SBZ/zipLogic. No pincode
 * lists, no 4-hour timing, no Google API.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramCartEligibilityInit) { return; }
  window.__ganguramCartEligibilityInit = true;

  var EVENT = 'ganguram:delivery-location-changed';
  var LINE_SEL = '[data-ganguram-cart-line]';
  var busy = false;            // during Ajax removal
  var suppressNext = false;    // ignore the next change event (self-induced restore)
  var lastAccepted = null;     // { pincode, zone } the customer has accepted
  var pending = null;          // { zone, ctx, pincode } while a warning is showing

  function cfg() { return window.GanguramCartConfig || {}; }
  function updateUrl() {
    return cfg().updateUrl ||
      (window.KROWN && KROWN.settings && KROWN.settings.routes && KROWN.settings.routes.cart_update_url) ||
      '/cart/update.js';
  }
  function allProductsUrl() { return cfg().allProductsUrl || '/collections/all'; }

  // Active location only for a VALID, serviceable, selected pincode — else null.
  function activeLoc() {
    var z = window.GanguramZone;
    if (!z || typeof z.getSelectedDeliveryLocation !== 'function') { return null; }
    var loc = z.getSelectedDeliveryLocation();
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }
    return loc;
  }

  // 'normal' by default; 'quick' (4 Hours Delivery) only when explicitly signalled.
  function deliveryContext() {
    var c = window.GanguramDeliveryContext;
    if (typeof c === 'function') { try { c = c(); } catch (e) { c = null; } }
    return (c === 'quick' || c === '4-hour' || c === '4-hour-delivery') ? 'quick' : 'normal';
  }

  function rule() {
    return (window.GanguramZoneRules && typeof window.GanguramZoneRules.isProductVisibleForContext === 'function')
      ? window.GanguramZoneRules.isProductVisibleForContext : null;
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
        url: el.getAttribute('data-ganguram-product-url') || '',
        image: el.getAttribute('data-ganguram-product-image') || '',
        handle: el.getAttribute('data-ganguram-product-handle') || '',
        qty: parseInt(el.getAttribute('data-qty') || '1', 10) || 1,
        k: el.getAttribute('data-ganguram-kolkata') === 'true',
        p: el.getAttribute('data-ganguram-pan-india') === 'true',
        q: el.getAttribute('data-ganguram-quick-commerce') === 'true'
      });
    }
    return out;
  }

  // Internal-only specific reason (kept for debugging on the card; NOT shown to the
  // customer — the customer-facing text is the simple pincode message below).
  function reasonDetail(line, zone, ctx) {
    if (!line.k && !line.p && !line.q) { return 'Delivery eligibility tag missing'; }
    if (zone === 'pan_india') {
      if (line.k && !line.p) { return 'Available only for Kolkata delivery'; }
      if (line.q && !line.p && !line.k) { return 'Available only for 4 Hours Delivery'; }
      return 'Not available for PAN India delivery';
    }
    if (ctx === 'quick') {
      if (line.k && !line.q) { return 'Available only for Kolkata delivery'; }
      return 'Not eligible for the selected delivery mode';
    }
    if (line.q && !line.k) { return 'Available only for 4 Hours Delivery'; }
    return 'Not eligible for the selected delivery mode';
  }
  // Simple, professional customer-facing reason for the entered pincode.
  function customerReason(pincode) {
    return 'Delivery is not available for the selected pincode: ' + pincode + '.';
  }

  // Affected (ineligible) lines for a zone/context, each annotated with .detail.
  function computeAffected(zone, ctx) {
    var fn = rule();
    if (!fn) { return []; }                  // rules missing -> never affected (fail safe)
    var out = [];
    cartLines().forEach(function (l) {
      if (!fn({ kolkata: l.k, panIndia: l.p, quickCommerce: l.q }, zone, ctx)) {
        l.detail = reasonDetail(l, zone, ctx);
        out.push(l);
      }
    });
    return out;
  }

  // ---- state machine --------------------------------------------------------
  // Restore the previously accepted pincode WITHOUT removing anything. The
  // re-dispatch is suppressed so it can never re-warn or re-remove.
  function restorePrevious() {
    if (!window.GanguramZone) { return; }
    suppressNext = true;
    try {
      if (lastAccepted && lastAccepted.pincode) {
        window.GanguramZone.setSelectedPincode(lastAccepted.pincode);
      } else if (typeof window.GanguramZone.clearSelectedDeliveryLocation === 'function') {
        window.GanguramZone.clearSelectedDeliveryLocation();
      } else {
        suppressNext = false;
      }
    } catch (e) { suppressNext = false; }
  }

  function onChange() {
    if (suppressNext) { suppressNext = false; return; } // ignore our own restore
    var loc = activeLoc();
    if (!loc) {                               // cleared / invalid / unserviceable -> nothing to do
      pending = null; dismiss(); lastAccepted = null; return;
    }
    var ctx = deliveryContext();
    var affected = computeAffected(loc.zone, ctx);
    if (!affected.length) {                   // all valid -> accept silently
      pending = null; dismiss(); lastAccepted = { pincode: loc.pincode, zone: loc.zone }; return;
    }
    pending = { zone: loc.zone, ctx: ctx, pincode: loc.pincode }; // some invalid -> WARN
    showWarning(affected, loc.pincode);
  }

  // SAFE cancel — restore previous pincode, close, no removal, no popup.
  function onKeepCurrent() {
    pending = null;
    dismiss();
    restorePrevious();
  }

  // Edit — restore previous pincode, close, reopen the pincode popup, no removal.
  function onChangePincode() {
    pending = null;
    dismiss();
    restorePrevious();
    openPincode();
  }

  // ✕ / backdrop / Esc — during a warning behaves like "Keep current pincode";
  // during the final confirmation it just closes.
  function onClose() {
    if (pending) { onKeepCurrent(); } else { dismiss(); }
  }

  // The ONLY mutating path: accept the new pincode and remove the affected lines.
  function onConfirm() {
    if (busy || !pending) { return; }
    var loc = activeLoc();
    if (!loc) { pending = null; dismiss(); return; }
    var entered = loc.pincode;
    var affected = computeAffected(loc.zone, deliveryContext()); // recompute from current cart
    lastAccepted = { pincode: loc.pincode, zone: loc.zone };     // accept the new pincode
    pending = null;
    if (!affected.length) { dismiss(); return; }
    removeLines(affected, entered);
  }

  function removeLines(remove, entered) {
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
        showConfirmation(remove, emptied, entered);
      })
      .catch(function () { /* leave cart untouched on failure */ })
      .finally(function () { busy = false; });
  }

  // ---- modal UI -------------------------------------------------------------
  var modal = null;
  function openPincode() {
    if (window.GanguramDelivery && typeof window.GanguramDelivery.openDeliveryLocationPopup === 'function') {
      window.GanguramDelivery.openDeliveryLocationPopup('Enter a delivery pincode to continue.');
      return;
    }
    var t = document.querySelector('[data-gdw-trigger]');
    if (t) { t.click(); }
  }
  function dismiss() { if (modal) { modal.setAttribute('hidden', ''); } }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) { e.className = cls; } return e; }

  function buildModal() {
    var root = el('div', 'ganguram-cart-elig');
    root.setAttribute('data-ganguram-cart-eligibility-message', '');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'ganguram-cart-elig-heading');
    root.setAttribute('hidden', '');

    var backdrop = el('div', 'ganguram-cart-elig__backdrop');
    backdrop.addEventListener('click', onClose);

    var panel = el('div', 'ganguram-cart-elig__panel');
    var close = el('button', 'ganguram-cart-elig__close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '&times;';
    close.addEventListener('click', onClose);

    var heading = el('p', 'ganguram-cart-elig__heading');
    heading.id = 'ganguram-cart-elig-heading';
    var sub = el('p', 'ganguram-cart-elig__sub');
    var list = el('ul', 'ganguram-cart-elig__list');
    var actions = el('div', 'ganguram-cart-elig__actions');

    panel.appendChild(close);
    panel.appendChild(heading);
    panel.appendChild(sub);
    panel.appendChild(list);
    panel.appendChild(actions);
    root.appendChild(backdrop);
    root.appendChild(panel);
    document.body.appendChild(root);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) { onClose(); } });

    root._heading = heading; root._sub = sub; root._list = list; root._actions = actions; root._close = close;
    return root;
  }
  function itemCard(l, pincode) {
    var li = el('li', 'ganguram-cart-elig__item');
    if (l.detail) { li.setAttribute('data-ganguram-reason-detail', l.detail); } // internal/debug only
    if (l.image) {
      var thumb = el('a', 'ganguram-cart-elig__thumb');
      thumb.href = l.url || '#';
      var img = document.createElement('img');
      img.src = l.image; img.alt = l.title; img.loading = 'lazy';
      thumb.appendChild(img);
      li.appendChild(thumb);
    }
    var info = el('div', 'ganguram-cart-elig__info');
    var name = el('a', 'ganguram-cart-elig__name');
    name.href = l.url || '#';
    name.textContent = l.title;
    var qty = el('span', 'ganguram-cart-elig__qty');
    qty.textContent = 'Qty: ' + (l.qty || 1);
    var reason = el('span', 'ganguram-cart-elig__reason');
    reason.textContent = customerReason(pincode);
    info.appendChild(name); info.appendChild(qty); info.appendChild(reason);
    li.appendChild(info);
    return li;
  }
  function fillList(items, pincode) {
    modal._list.textContent = '';
    items.forEach(function (l) { modal._list.appendChild(itemCard(l, pincode)); });
  }
  function setActions(buttons) {
    modal._actions.textContent = '';
    buttons.forEach(function (b) {
      var node = b.href ? el('a', b.cls) : el('button', b.cls);
      if (b.href) { node.href = b.href; } else { node.type = 'button'; }
      node.textContent = b.label;
      if (b.onClick) { node.addEventListener('click', b.onClick); }
      modal._actions.appendChild(node);
    });
  }
  function show() { modal.removeAttribute('hidden'); if (modal._close && modal._close.focus) { modal._close.focus(); } }

  function showWarning(affected, pincode) {
    if (!modal) { modal = buildModal(); }
    modal._heading.textContent = 'Some items are not deliverable to the selected pincode';
    modal._sub.textContent = 'The following items are not deliverable to ' + pincode +
      '. You can keep your current pincode, change the pincode, or continue with the selected pincode and remove these items from your cart.';
    modal._sub.removeAttribute('hidden');
    fillList(affected, pincode);
    setActions([
      { label: 'Keep current pincode', cls: 'ganguram-cart-elig__btn ganguram-cart-elig__btn--primary', onClick: function () { onKeepCurrent(); } },
      { label: 'Change pincode', cls: 'ganguram-cart-elig__btn', onClick: function () { onChangePincode(); } },
      { label: 'Continue with selected pincode', cls: 'ganguram-cart-elig__btn ganguram-cart-elig__btn--danger', onClick: function () { onConfirm(); } }
    ]);
    show();
  }
  function showConfirmation(removed, emptied, pincode) {
    if (!modal) { modal = buildModal(); }
    var n = removed.length;
    modal._heading.textContent = (n === 1
      ? '1 item was removed from your cart because delivery is not available for the selected pincode: ' + pincode + '.'
      : n + ' items were removed from your cart because delivery is not available for the selected pincode: ' + pincode + '.');
    if (emptied) {
      modal._sub.textContent = 'Your cart is now empty.';
      modal._sub.removeAttribute('hidden');
    } else {
      modal._sub.textContent = '';
      modal._sub.setAttribute('hidden', '');
    }
    fillList(removed, pincode);
    setActions([
      { label: 'Continue Shopping', cls: 'ganguram-cart-elig__btn ganguram-cart-elig__btn--primary', href: allProductsUrl() },
      { label: 'Close', cls: 'ganguram-cart-elig__btn', onClick: function () { dismiss(); } }
    ]);
    show();
  }

  // ---- triggers -------------------------------------------------------------
  function init() {
    var loc = activeLoc();
    lastAccepted = loc ? { pincode: loc.pincode, zone: loc.zone } : null; // adopt current as accepted; never warn on load
    window.addEventListener(EVENT, onChange);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
