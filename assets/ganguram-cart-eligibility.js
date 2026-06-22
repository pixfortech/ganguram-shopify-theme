/*
 * Ganguram — Cart eligibility: TRANSACTIONAL confirm-before-remove (Phase 2.7A → 2.11H.2)
 * ---------------------------------------------------------------------------
 * When a pincode change would leave some cart lines undeliverable, the new pincode is
 * NOT committed. We classify the candidate, hold it as a PENDING pincode, and WARN —
 * without writing localStorage, firing the change event, or touching cart attributes. The
 * ACTIVE pincode (and the panel/widget/product filter) stay put until the customer makes
 * ONE explicit choice:
 *
 *   - "Change pincode"            -> discard the pending pincode, reopen the popup. The
 *                                    active pincode is unchanged; no removal.
 *   - "Keep current pincode"      -> discard the pending pincode, close. (Same as ✕ /
 *                                    backdrop / Esc / ignoring the modal.) No removal.
 *   - "Remove unavailable items"  -> the ONLY mutating path: remove only the affected
 *                                    lines, THEN commit the pending pincode, refresh, and
 *                                    show a final confirmation (with Undo).
 *
 * This is enforced by wrapping GanguramZone.setSelectedPincode (installPincodeGuard), so
 * EVERY entry point (popup, header widget, saved locations, address search) is
 * transactional. A second "review" flow surfaces items that are already invalid for the
 * ALREADY-active pincode (page load / cart change / checkout press) — there is no pending
 * pincode in that flow. Fail-open: no rule / no items / not serviceable -> commit normally.
 *
 * Eligibility REUSES the shared cart rule (window.GanguramZoneRules
 * .isProductDeliverableToZone). Tags + product url/image/handle are read from
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
  var pending = null;          // { zone, ctx, pincode } while a change warning is showing
  var pendingPincode = '';     // a CANDIDATE pincode awaiting confirmation (NOT committed)
  var realSet = null;          // the un-guarded GanguramZone.setSelectedPincode (real commit)

  function cfg() { return window.GanguramCartConfig || {}; }
  function updateUrl() {
    return cfg().updateUrl ||
      (window.KROWN && KROWN.settings && KROWN.settings.routes && KROWN.settings.routes.cart_update_url) ||
      '/cart/update.js';
  }
  function allProductsUrl() { return cfg().allProductsUrl || '/collections/all'; }
  function addUrl() {
    return cfg().addUrl ||
      (window.KROWN && KROWN.settings && KROWN.settings.routes && KROWN.settings.routes.cart_add_url) ||
      '/cart/add.js';
  }
  function cartJsUrl() { return cfg().cartUrl || '/cart.js'; }
  function undoEnabled() { return cfg().undoEnabled !== false; } // default on
  function undoSeconds() { var n = parseInt(cfg().undoSeconds, 10); return (n && n > 0) ? n : 10; }
  function undoMessage(n) {
    var t = cfg().undoMessage || 'Items removed. Undo available for {seconds} seconds.';
    return t.replace('{seconds}', String(n));
  }

  // Active location only for a VALID, serviceable, selected pincode — else null.
  function activeLoc() {
    var z = window.GanguramZone;
    if (!z || typeof z.getSelectedDeliveryLocation !== 'function') { return null; }
    var loc = z.getSelectedDeliveryLocation();
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }
    return loc;
  }
  function cartHasItems() { return cartLines().length > 0; }
  // The currently COMMITTED (active) pincode — the source of truth the panel/cart attrs use.
  function activePincode() {
    var z = window.GanguramZone;
    try { return (z && typeof z.getSelectedPincode === 'function') ? (z.getSelectedPincode() || '') : ''; }
    catch (e) { return ''; }
  }
  // Commit a pincode FOR REAL (un-guarded): writes localStorage + fires the change event,
  // which is what updates cart attributes, the product filter, the delivery panel + widget.
  function commit(pincode) {
    var z = window.GanguramZone;
    if (realSet) { return realSet.call(z, pincode); }
    return (z && typeof z.setSelectedPincode === 'function') ? z.setSelectedPincode(pincode) : null;
  }

  // 'normal' by default; 'quick' (4 Hours Delivery) only when explicitly signalled.
  function deliveryContext() {
    var c = window.GanguramDeliveryContext;
    if (typeof c === 'function') { try { c = c(); } catch (e) { c = null; } }
    return (c === 'quick' || c === '4-hour' || c === '4-hour-delivery') ? 'quick' : 'normal';
  }

  // Cart eligibility REUSES the shared cart-level predicate (2.11H): an item is fine if
  // it can be delivered by ANY available mode (standard OR 4-hour). This keeps the
  // validator in sync with the delivery panel and the product display rule. Falls back
  // to the per-context display rule if the newer helper is unavailable. Fail-safe: when
  // no rule is exposed, returns null and nothing is ever flagged (no removal).
  function rule() {
    var r = window.GanguramZoneRules;
    if (r && typeof r.isProductDeliverableToZone === 'function') {
      return function (tags, zone) { return r.isProductDeliverableToZone(tags, zone); };
    }
    if (r && typeof r.isProductVisibleForContext === 'function') {
      return function (tags, zone, ctx) { return r.isProductVisibleForContext(tags, zone, ctx); };
    }
    return null;
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
        variantId: el.getAttribute('data-ganguram-variant-id') || '',
        title: el.getAttribute('data-ganguram-product-title') || el.getAttribute('data-title') || 'Item',
        url: el.getAttribute('data-ganguram-product-url') || '',
        image: el.getAttribute('data-ganguram-product-image') || '',
        handle: el.getAttribute('data-ganguram-product-handle') || '',
        qty: parseInt(el.getAttribute('data-qty') || '1', 10) || 1,
        k: el.getAttribute('data-ganguram-kolkata') === 'true',
        p: el.getAttribute('data-ganguram-pan-india') === 'true',
        q: el.getAttribute('data-ganguram-quick-commerce') === 'true',
        ld: el.getAttribute('data-ganguram-local-delivery') === 'true'
      });
    }
    return out;
  }

  // Internal-only specific reason (kept for debugging on the card; NOT shown to the
  // customer — the customer-facing text is the simple pincode message below).
  function reasonDetail(line, zone, ctx) {
    if (!line.k && !line.p && !line.q && !line.ld) { return 'Delivery eligibility tag missing'; }
    // A line is only "affected" when not deliverable; under PAN India that means it lacks
    // the explicit PAN India tag (Kolkata / Local Delivery / Quick Commerce do not qualify).
    if (zone === 'pan_india') { return 'Available only for local delivery (not PAN India)'; }
    if (ctx === 'quick') {
      if (line.k && !line.q) { return 'Available only for Kolkata delivery'; }
      return 'Not eligible for the selected delivery mode';
    }
    if (line.q && !line.k) { return 'Available only for 4 Hours Delivery'; }
    return 'Not eligible for the selected delivery mode';
  }
  // Short, subtle per-item reason shown on each unavailable-item card.
  function customerReason(pincode) {
    return 'Not available for delivery to ' + pincode;
  }

  // Affected (ineligible) lines for a zone/context, each annotated with .detail.
  function computeAffected(zone, ctx) {
    var fn = rule();
    if (!fn) { return []; }                  // rules missing -> never affected (fail safe)
    var out = [];
    cartLines().forEach(function (l) {
      if (!fn({ kolkata: l.k, panIndia: l.p, quickCommerce: l.q, localDelivery: l.ld }, zone, ctx)) {
        l.detail = reasonDetail(l, zone, ctx);
        out.push(l);
      }
    });
    return out;
  }

  // ---- transactional pincode guard (Bug B) ----------------------------------
  // A pincode change is NOT committed while it would strand cart items. We classify the
  // CANDIDATE and, if some current cart items can't be delivered to it, stash it as a
  // PENDING pincode and show the confirmation modal — WITHOUT writing localStorage, firing
  // the change event, or touching cart attributes. The ACTIVE pincode stays put until the
  // customer confirms by removing the unavailable items. Keep / Change / ✕ / Esc / backdrop
  // all discard the pending pincode and leave the active one (and the cart) untouched.
  // Wraps GanguramZone.setSelectedPincode so EVERY entry point (popup, header widget, saved
  // locations, address search) is transactional. Fail-open: no rule / no items / not
  // serviceable / cart-eligibility off -> commit normally, exactly as before.
  function installPincodeGuard() {
    var z = window.GanguramZone;
    if (!z || typeof z.setSelectedPincode !== 'function' || z.__ganguramTxnGuard) { return; }
    realSet = z.setSelectedPincode;
    z.setSelectedPincode = guardedSet;
    z.__ganguramTxnGuard = true;
  }
  function guardedSet(pincode) {
    var z = window.GanguramZone, candidate = null;
    try { candidate = z.classifyPincode(pincode); } catch (e) {}
    // Intercept only a serviceable change that would strand items in the current cart.
    if (candidate && candidate.isServiceable === true && !busy && cartHasItems()) {
      var affected = computeAffected(candidate.zone, deliveryContext());
      if (affected.length) {
        pendingPincode = candidate.pincode;     // hold it — DO NOT persist or announce yet
        showWarning(affected, candidate.pincode);
        return candidate;                        // classified result, but the active pincode is unchanged
      }
    }
    pendingPincode = '';
    return commit(pincode);                      // empty cart / all-deliverable / clear -> apply now
  }
  function commitPending() {
    var pin = pendingPincode;
    pendingPincode = '';
    if (pin) { commit(pin); }                    // apply the confirmed pincode for real
  }

  // ---- state machine --------------------------------------------------------
  // The change event now only carries COMMITTED (already-applied) pincodes — the guard
  // intercepts stranding changes before they commit. Re-validate so the panel / review
  // stay correct; the transactional warning is shown by the guard, never from here.
  function onChange() {
    validateCurrent({ requireVisible: true });
  }

  // "Keep current pincode" — discard the pending pincode; the ACTIVE one never changed.
  function onKeepCurrent() {
    pendingPincode = '';
    pending = null;
    dismiss();
  }

  // "Change pincode" — discard the pending pincode and reopen the pincode popup.
  function onChangePincode() {
    pendingPincode = '';
    pending = null;
    dismiss();
    openPincode();
  }

  // ✕ / backdrop / Esc — during a change warning behaves like "Keep current pincode"
  // (discard pending, keep active); during a review it records the dismissed set, then
  // closes. Either way the active pincode and the cart are never mutated. Fail-open.
  function onClose() {
    if (modalMode === 'review') { if (currentReviewSig) { dismissedSig = currentReviewSig; } dismiss(); return; }
    if (modalMode === 'change') { onKeepCurrent(); return; }
    dismiss();
  }

  // "Remove unavailable items" (change mode) — remove ONLY the affected lines, THEN commit
  // the pending pincode, so localStorage / cart attributes / the panel update only after
  // the cart is actually deliverable. Nothing-to-remove -> just commit the pending pincode.
  function onConfirm() {
    if (busy) { return; }
    var entered = pendingPincode || activePincode();
    var candidate = null;
    try { candidate = window.GanguramZone.classifyPincode(entered); } catch (e) {}
    if (!candidate) { pendingPincode = ''; pending = null; dismiss(); return; }
    var affected = computeAffected(candidate.zone, deliveryContext());
    var previousPincode = activePincode();        // the still-active pincode (for Undo)
    pending = null;
    if (!affected.length) { commitPending(); dismiss(); return; }
    removeLines(affected, entered, previousPincode, pendingPincode ? entered : null);
  }

  // commitAfter (optional): a PENDING pincode to apply ONLY after the removal succeeds
  // (transactional change). null in review mode (the pincode is already active).
  function removeLines(remove, entered, previousPincode, commitAfter) {
    busy = true;
    var updates = {};
    remove.forEach(function (l) { updates[l.key] = 0; });
    var snapshot = {
      items: remove.map(function (l) { return { variantId: l.variantId, qty: l.qty, title: l.title, url: l.url, image: l.image }; }),
      previousPincode: previousPincode,
      pincode: entered
    };
    fetch(updateUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ updates: updates })
    })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var emptied = !!cart && cart.item_count === 0;
        dismissedSig = null;                        // cart changed -> allow a fresh review if needed
        if (commitAfter) { pendingPincode = ''; commit(commitAfter); } // NOW apply the confirmed pincode
        if (typeof window.refreshCart === 'function') { try { window.refreshCart(false); } catch (e) {} }
        dismiss();                                  // close the warning modal — no second modal
        showToast(remove.length, entered, snapshot);
      })
      .catch(function () { /* leave cart untouched on failure */ })
      .finally(function () { busy = false; });
  }

  // ---- modal UI -------------------------------------------------------------
  var modal = null;
  var modalMode = null;        // 'change' (pincode-change warning) | 'review' (load/cart/checkout) | null
  var currentReviewSig = null; // signature of the invalid set currently under review
  var dismissedSig = null;     // invalid-set signature the customer dismissed (don't auto re-pop)

  // Krown Local theme button tokens (2.11H.1 redesign). Primary = solid (fills to the
  // brand accent on hover); secondary + destructive = subtle outline. No hardcoded
  // colours — the theme has no red token, so the destructive intent is carried by the
  // copy + a helper line, not an aggressive red block. Mobile-first: all full-width.
  var BTN_BASE = 'button button--small button--fullwidth ganguram-cart-elig__btn';
  var BTN_PRIMARY = BTN_BASE + ' button--solid ganguram-cart-elig__btn--primary';
  var BTN_SECONDARY = BTN_BASE + ' button--outline button--outline-hover ganguram-cart-elig__btn--secondary';
  var BTN_DANGER = BTN_BASE + ' button--outline button--outline-hover ganguram-cart-elig__btn--danger';
  var REMOVE_HELPER = 'This will remove the listed items from your cart.';
  // One short, non-repetitive explanation shared by both the change warning and the review.
  function unavailableMessage(pincode) {
    return 'These items cannot be delivered to ' + pincode +
      '. You can keep your current pincode, choose another pincode, or remove the unavailable items and continue.';
  }

  function openPincode() {
    if (window.GanguramDelivery && typeof window.GanguramDelivery.openDeliveryLocationPopup === 'function') {
      window.GanguramDelivery.openDeliveryLocationPopup('Enter a delivery pincode to continue.');
      return;
    }
    var t = document.querySelector('[data-gdw-trigger]');
    if (t) { t.click(); }
  }
  function dismiss() { if (modal) { modal.setAttribute('hidden', ''); } modalMode = null; }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) { e.className = cls; } return e; }

  function buildModal() {
    var root = el('div', 'ganguram-cart-elig');
    root.setAttribute('data-ganguram-cart-eligibility-message', '');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'ganguram-cart-elig-heading');
    root.setAttribute('aria-describedby', 'ganguram-cart-elig-sub');
    root.setAttribute('hidden', '');

    var backdrop = el('div', 'ganguram-cart-elig__backdrop');
    backdrop.addEventListener('click', onClose);

    var panel = el('div', 'ganguram-cart-elig__panel');
    panel.setAttribute('tabindex', '-1');
    var close = el('button', 'ganguram-cart-elig__close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '&times;';
    close.addEventListener('click', onClose);

    var heading = el('p', 'ganguram-cart-elig__heading');
    heading.id = 'ganguram-cart-elig-heading';
    var sub = el('p', 'ganguram-cart-elig__sub');
    sub.id = 'ganguram-cart-elig-sub';
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
    // Esc closes; Tab is trapped within the dialog (focus stays inside while open).
    document.addEventListener('keydown', function (e) {
      if (!modal || modal.hasAttribute('hidden')) { return; }
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab') { trapTab(e); }
    });

    root._heading = heading; root._sub = sub; root._list = list; root._actions = actions; root._close = close; root._panel = panel;
    return root;
  }
  // Keep keyboard focus inside the open dialog (simple, dependency-free focus trap).
  function focusable() {
    if (!modal) { return []; }
    return Array.prototype.slice.call(modal.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'))
      .filter(function (n) { return !n.hasAttribute('disabled'); });
  }
  function trapTab(e) {
    var f = focusable(); if (f.length < 2) { return; }
    var first = f[0], last = f[f.length - 1], active = null;
    try { active = document.activeElement; } catch (err) {}
    if (e.shiftKey && active === first) { e.preventDefault(); try { last.focus(); } catch (err) {} }
    else if (!e.shiftKey && active === last) { e.preventDefault(); try { first.focus(); } catch (err) {} }
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
      if (b.note) {                                    // helper line above a destructive action
        var note = el('p', 'ganguram-cart-elig__helper');
        note.textContent = b.note;
        modal._actions.appendChild(note);
      }
      var node = b.href ? el('a', b.cls) : el('button', b.cls);
      if (b.href) { node.href = b.href; } else { node.type = 'button'; }
      node.textContent = b.label;
      if (b.onClick) { node.addEventListener('click', b.onClick); }
      modal._actions.appendChild(node);
    });
  }
  // Open and move focus to the recommended (safe) primary action; fall back to Close.
  function show() {
    modal.removeAttribute('hidden');
    var target = modal.querySelector('.ganguram-cart-elig__btn--primary') || modal._close;
    if (target && target.focus) { try { target.focus(); } catch (e) {} }
  }

  // Mobile-first action order (stacked): the PRIMARY accepts the new pincode AND removes the
  // unavailable items; the SECONDARY keeps the current pincode and leaves the cart unchanged.
  // (Phase 1: the standalone "Remove unavailable items" button is gone — removal is bundled into
  // "Change pin code to {new}". Labels carry the live new / current pincodes.)
  function showWarning(affected, pincode) {
    if (!modal) { modal = buildModal(); }
    modalMode = 'change';
    var current = activePincode();
    modal._heading.textContent = 'Some items are unavailable for this pincode';
    modal._sub.textContent = 'These items can’t be delivered to ' + pincode + '. Changing your pin code to ' +
      pincode + ' will remove them from your cart. Keep your current pin code ' + current + ' to leave the cart unchanged.';
    modal._sub.removeAttribute('hidden');
    fillList(affected, pincode);
    setActions([
      { label: 'Change pin code to ' + pincode, cls: BTN_PRIMARY, onClick: function () { onConfirm(); } },
      { label: 'Keep current ' + current, cls: BTN_SECONDARY, onClick: function () { onKeepCurrent(); } }
    ]);
    show();
  }

  // ---- proactive review (Phase 2.11H): surface items already in the cart that are not
  // deliverable to the ALREADY-accepted pincode (page load, cart change, checkout press).
  // Unlike showWarning (a pincode-CHANGE warning), this never restores a previous pincode
  // and never auto-removes — the customer chooses Remove or Change pincode. Fail-open.
  function invalidSignature(affected, pincode) {
    return String(pincode) + '|' + affected.map(function (l) { return l.key; }).sort().join(',');
  }
  // A cart line counts as "on screen" only when it has a layout box (offsetParent set).
  // In a CLOSED cart drawer the lines are display:none -> offsetParent null, so we do not
  // pop the modal on every background page load; the cart PAGE shows them, and the
  // checkout press (force) bypasses this gate. offsetParent undefined (non-DOM / test) -> shown.
  function anyCartLineVisible() {
    var els = document.querySelectorAll(LINE_SEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (typeof el.offsetParent === 'undefined') { return true; }
      if (el.offsetParent !== null) { return true; }
    }
    return false;
  }
  function showReview(affected, pincode) {
    if (!modal) { modal = buildModal(); }
    pending = null;                       // review is NOT a pincode-change warning
    modalMode = 'review';
    currentReviewSig = invalidSignature(affected, pincode);
    modal._heading.textContent = 'Some items are unavailable for this pincode';
    modal._sub.textContent = 'These items can’t be delivered to ' + pincode +
      '. Change your pin code to one that can deliver them — that will remove the unavailable items — or keep ' + pincode + '.';
    modal._sub.removeAttribute('hidden');
    fillList(affected, pincode);
    setActions([
      { label: 'Change pin code', cls: BTN_PRIMARY, onClick: function () { onReviewChangePincode(); } },
      { label: 'Keep current ' + pincode, cls: BTN_SECONDARY, onClick: function () { onReviewKeepCurrent(); } }
    ]);
    show();
  }
  function onReviewChangePincode() {
    if (currentReviewSig) { dismissedSig = currentReviewSig; }
    dismiss();
    openPincode();
  }
  // Review-mode "Keep current pincode": close without changing the cart (the pincode is
  // already accepted; nothing to restore). Remember the set so it does not re-pop.
  function onReviewKeepCurrent() {
    if (currentReviewSig) { dismissedSig = currentReviewSig; }
    dismiss();
  }
  // The mutating path for a review: remove the not-deliverable lines, keep the (already
  // active) pincode — no commit needed (nothing pending in review mode).
  function onRemoveUnavailable() {
    if (busy) { return; }
    var loc = activeLoc();
    if (!loc) { dismiss(); return; }
    var affected = computeAffected(loc.zone, deliveryContext());
    if (!affected.length) { dismiss(); return; }
    removeLines(affected, loc.pincode, loc.pincode, null);
  }
  // Re-check the current (accepted) pincode against the current cart. opts:
  //   force         -> always show (checkout press); ignores the visibility + dismissed gates
  //   requireVisible -> only auto-show when a cart line is actually on screen
  function validateCurrent(opts) {
    opts = opts || {};
    if (busy) { return; }
    var loc = activeLoc();
    if (!loc) { if (modalMode === 'review') { dismiss(); } return; }
    var affected = computeAffected(loc.zone, deliveryContext());
    if (!affected.length) {                         // all deliverable -> clear any stale review
      dismissedSig = null;
      if (modalMode === 'review') { dismiss(); }
      return;
    }
    var sig = invalidSignature(affected, loc.pincode);
    if (modalMode === 'review') { fillList(affected, loc.pincode); currentReviewSig = sig; return; } // open -> refresh
    if (pending) { return; }                        // a pincode-change warning owns the modal
    if (!opts.force) {
      if (opts.requireVisible && !anyCartLineVisible()) { return; }
      if (sig === dismissedSig) { return; }         // already dismissed this exact set
    }
    showReview(affected, loc.pincode);
  }
  function hasInvalidItems() {
    var loc = activeLoc();
    if (!loc) { return false; }
    return computeAffected(loc.zone, deliveryContext()).length > 0;
  }

  // ---- final confirmation toast (NOT a second modal) + Undo -----------------
  var toast = null;
  var toastTimer = null;
  function dismissToast() {
    if (toastTimer) { clearInterval(toastTimer); toastTimer = null; }
    if (toast && toast.parentNode) { toast.parentNode.removeChild(toast); }
    toast = null;
  }
  function showToast(n, pincode, snapshot) {
    dismissToast();
    toast = el('div', 'ganguram-cart-toast');
    toast.setAttribute('data-ganguram-cart-toast', '');
    toast.setAttribute('role', 'status');

    var close = el('button', 'ganguram-cart-toast__close');
    close.type = 'button'; close.setAttribute('aria-label', 'Close'); close.innerHTML = '&times;';
    close.addEventListener('click', dismissToast);              // closing never changes the cart

    var msg = el('p', 'ganguram-cart-toast__msg');
    msg.textContent = (n === 1
      ? '1 item was removed because delivery is not available for the selected pincode: ' + pincode + '.'
      : n + ' items were removed because delivery is not available for the selected pincode: ' + pincode + '.');

    var note = el('p', 'ganguram-cart-toast__note');
    var actions = el('div', 'ganguram-cart-toast__actions');

    var canUndo = undoEnabled() && snapshot.items.some(function (i) { return i.variantId; });
    if (canUndo) {
      var remaining = undoSeconds();
      note.textContent = undoMessage(remaining);
      var undoBtn = el('button', 'ganguram-cart-toast__btn ganguram-cart-toast__btn--undo');
      undoBtn.type = 'button';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', function () { onUndo(snapshot, undoBtn, note); });
      actions.appendChild(undoBtn);
      toast._undoBtn = undoBtn; toast._note = note;
      toastTimer = setInterval(function () {
        remaining -= 1;
        if (remaining <= 0) { dismissToast(); return; }        // buffer expired -> undo gone
        note.textContent = undoMessage(remaining);
      }, 1000);
    } else {
      note.setAttribute('hidden', '');
      toastTimer = setTimeout(dismissToast, 6000);             // plain acknowledgement auto-dismisses
    }

    var shop = el('a', 'ganguram-cart-toast__btn');
    shop.href = allProductsUrl();
    shop.textContent = 'Continue Shopping';
    actions.appendChild(shop);

    toast.appendChild(close);
    toast.appendChild(msg);
    toast.appendChild(note);
    toast.appendChild(actions);
    document.body.appendChild(toast);
  }

  // Restore a specific pincode (the previous one) for Undo. Uses the REAL (un-guarded)
  // commit so re-adding the items + restoring the old pincode can't re-trigger the modal.
  function restoreUndoPincode(pin) {
    if (!window.GanguramZone) { return; }
    try {
      if (pin) { commit(pin); }
      else if (typeof window.GanguramZone.clearSelectedDeliveryLocation === 'function') {
        window.GanguramZone.clearSelectedDeliveryLocation();
      }
    } catch (e) {}
  }

  function onUndo(snapshot, undoBtn, note) {
    if (busy) { return; }
    busy = true;
    if (undoBtn) { undoBtn.setAttribute('disabled', ''); }
    // Read the current cart first so we never create duplicate quantities.
    fetch(cartJsUrl(), { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var current = {};
        (cart && cart.items || []).forEach(function (it) { var id = String(it.id); current[id] = (current[id] || 0) + it.quantity; });
        var toAdd = [];
        snapshot.items.forEach(function (i) {
          if (!i.variantId) { return; }
          var have = current[String(i.variantId)] || 0;
          var need = i.qty - have;
          if (need > 0) { toAdd.push({ id: i.variantId, quantity: need }); }
        });
        if (!toAdd.length) { return { ok: true }; }            // already present -> nothing to add
        return fetch(addUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ items: toAdd })
        }).then(function (r) { if (!r.ok) { throw new Error('add failed'); } return r.json(); }).then(function () { return { ok: true }; });
      })
      .then(function () {
        restoreUndoPincode(snapshot.previousPincode);          // restore previous pincode (guarded)
        if (typeof window.refreshCart === 'function') { try { window.refreshCart(false); } catch (e) {} }
        dismissToast();
      })
      .catch(function () {
        if (note) { note.removeAttribute('hidden'); note.textContent = 'We could not restore all items. Please add them again.'; }
        if (undoBtn && undoBtn.parentNode) { undoBtn.parentNode.removeChild(undoBtn); }
        if (toastTimer) { clearInterval(toastTimer); toastTimer = null; }
      })
      .finally(function () { busy = false; });
  }

  // Re-validate when the cart markup re-renders (qty change / refreshCart / line removal).
  function observeCart() {
    if (!('MutationObserver' in window)) { return; }
    var forms = document.querySelectorAll('cart-form');
    if (!forms.length) { return; }
    var queued = false;
    var schedule = function () {
      if (queued) { return; }
      queued = true;
      var run = function () { queued = false; validateCurrent({ requireVisible: true }); };
      if (window.requestAnimationFrame) { window.requestAnimationFrame(run); } else { setTimeout(run, 0); }
    };
    var obs = new MutationObserver(schedule);
    for (var i = 0; i < forms.length; i++) { try { obs.observe(forms[i], { childList: true, subtree: true }); } catch (e) {} }
  }

  // ---- triggers -------------------------------------------------------------
  function init() {
    installPincodeGuard();                 // make pincode changes transactional (Bug B)
    window.addEventListener(EVENT, onChange);
    observeCart();
    // Surface an ALREADY-invalid cart (e.g. a PAN India pincode chosen earlier with a
    // local-only item still in the cart). Gated to a visible cart surface so it never
    // pops on a background page; the cart page shows it, the drawer shows it on open/
    // change, and the checkout press forces it. Fail-open if no rule / no pincode.
    validateCurrent({ requireVisible: true });
  }

  // Public API for the delivery panel's checkout guard (Phase 2.11H): force the review
  // modal when the customer presses checkout with not-deliverable items, and report state.
  window.GanguramCartEligibility = {
    reviewNow: function () { validateCurrent({ force: true }); },
    validate: function () { validateCurrent({ requireVisible: true }); },
    hasInvalidItems: hasInvalidItems
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
