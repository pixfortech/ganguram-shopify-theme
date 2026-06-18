/*
 * Ganguram — Cart eligibility: confirm-before-remove (Phase 2.7A + warning hotfix)
 * ---------------------------------------------------------------------------
 * When the customer selects/changes a VALID serviceable pincode and some cart
 * lines are not deliverable to the new zone/context, we do NOT remove anything
 * immediately. Instead we WARN first and let the customer decide:
 *
 *   - "Change Pincode"            -> cart unchanged; the PREVIOUS pincode is
 *                                    restored; the pincode popup reopens.
 *   - "Continue with selected …"  -> the new pincode is accepted; ONLY the
 *                                    affected lines are removed (Ajax cart API);
 *                                    the cart refreshes; a final confirmation shows.
 *
 * If all lines are valid, the new pincode is accepted silently (no warning).
 *
 * Eligibility REUSES the product-display rule (window.GanguramZoneRules
 * .isProductVisibleForContext) — single source of truth. Tags + product url/image/
 * handle are read from Liquid-stamped cart-line attributes (Shopify /cart.js does
 * NOT include product tags), keyed by line item key.
 *
 * Never removes silently or before confirmation; never acts on no/invalid/
 * unserviceable pincode. No checkout, MOV, date/slot, shipping-rate, payment,
 * ShipZip/SBZ/zipLogic. No pincode lists, no 4-hour timing, no Google API.
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
  var pending = null;          // { zone, ctx } awaiting confirm while a warning shows

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

  // Specific customer-facing reason for an ineligible line.
  function reasonFor(line, zone, ctx) {
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
    // normal Kolkata
    if (line.q && !line.k) { return 'Available only for 4 Hours Delivery'; }
    return 'Not eligible for the selected delivery mode';
  }

  // Affected (ineligible) lines for a zone/context, each annotated with .reason.
  function computeAffected(zone, ctx) {
    var fn = rule();
    if (!fn) { return []; }                  // rules missing -> never affected (fail safe)
    var out = [];
    cartLines().forEach(function (l) {
      if (!fn({ kolkata: l.k, panIndia: l.p, quickCommerce: l.q }, zone, ctx)) {
        l.reason = reasonFor(l, zone, ctx);
        out.push(l);
      }
    });
    return out;
  }

  // ---- flow -----------------------------------------------------------------
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
    pending = { zone: loc.zone, ctx: ctx };   // some invalid -> WARN (do not remove)
    showWarning(affected);
  }

  function onCancel() {                        // "Change Pincode"
    pending = null; dismiss();
    suppressNext = true;                       // the restore below re-dispatches the event
    try {
      if (lastAccepted && lastAccepted.pincode && window.GanguramZone) {
        window.GanguramZone.setSelectedPincode(lastAccepted.pincode);
      } else if (window.GanguramZone && typeof window.GanguramZone.clearSelectedDeliveryLocation === 'function') {
        window.GanguramZone.clearSelectedDeliveryLocation();
      }
    } catch (e) { suppressNext = false; }
    openPincode();                             // let them enter another pincode
  }

  function onConfirm() {                        // "Continue with selected pincode"
    if (busy) { return; }
    var loc = activeLoc();
    if (!loc) { dismiss(); pending = null; return; }
    var affected = computeAffected(loc.zone, deliveryContext()); // recompute from current cart
    lastAccepted = { pincode: loc.pincode, zone: loc.zone };
    pending = null;
    if (!affected.length) { dismiss(); return; }
    removeLines(affected);
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
        showConfirmation(remove, emptied);
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
    backdrop.addEventListener('click', dismiss);

    var panel = el('div', 'ganguram-cart-elig__panel');
    var close = el('button', 'ganguram-cart-elig__close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '&times;';
    close.addEventListener('click', dismiss);

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
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { dismiss(); } });

    root._heading = heading; root._sub = sub; root._list = list; root._actions = actions; root._close = close;
    return root;
  }
  function itemCard(l) {
    var li = el('li', 'ganguram-cart-elig__item');
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
    reason.textContent = l.reason || 'Not eligible for the selected delivery mode';
    info.appendChild(name); info.appendChild(qty); info.appendChild(reason);
    li.appendChild(info);
    return li;
  }
  function fillList(items) {
    modal._list.textContent = '';
    items.forEach(function (l) { modal._list.appendChild(itemCard(l)); });
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

  function showWarning(affected) {
    if (!modal) { modal = buildModal(); }
    var n = affected.length;
    modal._heading.textContent = (n === 1 ? '1 item may be affected by this pincode change.' : n + ' items may be affected by this pincode change.');
    modal._sub.textContent = 'The following items are not deliverable to the selected pincode.';
    modal._sub.removeAttribute('hidden');
    fillList(affected);
    setActions([
      { label: 'Change Pincode', cls: 'ganguram-cart-elig__btn', onClick: function () { onCancel(); } },
      { label: 'Continue with selected pincode', cls: 'ganguram-cart-elig__btn ganguram-cart-elig__btn--primary', onClick: function () { onConfirm(); } }
    ]);
    show();
  }
  function showConfirmation(removed, emptied) {
    if (!modal) { modal = buildModal(); }
    var n = removed.length;
    modal._heading.textContent = (n === 1
      ? '1 item was removed from your cart because it is not deliverable to the selected pincode.'
      : n + ' items were removed from your cart because they are not deliverable to the selected pincode.');
    if (emptied) {
      modal._sub.textContent = 'Your cart is now empty.';
      modal._sub.removeAttribute('hidden');
    } else {
      modal._sub.textContent = '';
      modal._sub.setAttribute('hidden', '');
    }
    fillList(removed);
    setActions([
      { label: 'Continue Shopping', cls: 'ganguram-cart-elig__btn ganguram-cart-elig__btn--primary', href: allProductsUrl() },
      { label: 'Close', cls: 'ganguram-cart-elig__btn', onClick: function () { dismiss(); } }
    ]);
    show();
  }

  // ---- triggers -------------------------------------------------------------
  function init() {
    var loc = activeLoc();
    lastAccepted = loc ? { pincode: loc.pincode, zone: loc.zone } : null; // adopt current as accepted; do not warn on load
    window.addEventListener(EVENT, onChange);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
