/*
 * Ganguram — Cart delivery progress + MOV checkout guard (Phase 2.11C / 2.11C.1)
 * ---------------------------------------------------------------------------
 * ADVISORY, CART-SIDE ONLY. Consumes window.GanguramDeliveryRules:
 *   - getProgressData(cartSubtotal, location)  -> MOV / delivery-charge data
 *   - getServiceOptions(location, options)     -> standard / 4-hour service options
 * and, for the SAME computed state, updates three surfaces consistently:
 *   1. the cart PANEL (drawer + page): minimum-order / cart-value lines, a status
 *      message, a horizontal progress line, the delivery charge, and the available
 *      delivery service options;
 *   2. a NOTICE near the checkout button explaining the true reason when the cart
 *      is below the minimum order value (so customers see "Add ₹X more to meet the
 *      minimum order" BEFORE checkout — not Shopify's generic "Shipping not
 *      available" message);
 *   3. a soft CHECKOUT GUARD: when below MOV it marks the checkout button blocked
 *      and intercepts checkout clicks / cart-form submit (preventDefault), showing
 *      the notice. When MOV is met, checkout proceeds normally.
 *
 * It NEVER changes Shopify checkout, the final shipping charge, ShipZip / SBZ /
 * zipLogic, the pincode resolver, Google code, or settings_data.json, and never
 * mutates the cart. The guard is a cart-side advisory block only (bypassable like
 * any client gate). Fully FAIL-OPEN: no rules / no selection / no MOV / any error
 * -> nothing is blocked and the panel/notice hide.
 *
 * Money is PAISE (matching cart.total_price). Liquid-safe copy tokens __MOV__ /
 * __SUBTOTAL__ / __REMAINING__ / __AMOUNT__ / __DATE__ are replaced here in JS.
 * No jQuery / Bootstrap / FontAwesome.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramDeliveryProgressInit) { return; }
  window.__ganguramDeliveryProgressInit = true;

  function cfg() { return window.GanguramDeliveryProgressConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function copy(key) {
    var c = cfg().copy || {};
    var d = {
      movLabel: 'Minimum order:',
      movLabelEstimated: 'Estimated minimum order:',
      estimatedNote: 'Delivery and minimum order are estimated from your pincode. For accurate delivery options, please enter your complete address.',
      confirmedNote: 'Delivery options confirmed for your address.',
      fourHourIneligible: '4-hour delivery is not available because the following item(s) are not eligible for quick delivery: __ITEMS__',
      cartValueLabel: 'Cart value:',
      addMore: 'Add __REMAINING__ more to continue',
      minReached: 'Minimum order reached. You can continue to checkout.',
      checkoutNotice: 'Minimum order for this delivery area is __MOV__. Add __REMAINING__ more to continue.',
      freeDeliveryHint: 'add __AMOUNT__ for free delivery',
      freeDelivery: 'Free delivery',
      deliveryChargeFrom: 'Delivery from __AMOUNT__',
      datePickerNote: 'Choose a delivery date',
      earliestNote: 'earliest __DATE__',
      standardLabel: 'Standard delivery',
      fourHourLabel: '4-hour delivery'
    };
    return (c[key] != null) ? String(c[key]) : d[key];
  }
  // Replace Liquid-safe tokens __TOKEN__ (the form used in the snippet — single-brace
  // {token} breaks Shopify's Liquid parser) with values; legacy {token} still works.
  function tmpl(s, vars) {
    s = String(s == null ? '' : s);
    vars = vars || {};
    return s
      .replace(/__([A-Z0-9]+)__/g, function (_, k) { var kk = k.toLowerCase(); return (vars[kk] != null) ? vars[kk] : ''; })
      .replace(/\{(\w+)\}/g, function (_, k) { return (vars[k] != null) ? vars[k] : ''; });
  }

  function rules() { return window.GanguramDeliveryRules || null; }
  function zone() { return window.GanguramZone || null; }
  function fmtMoney(paise) { var dr = rules(); return (dr && typeof dr.formatMoney === 'function') ? dr.formatMoney(paise) : ''; }

  // DEV-ONLY debug tracing (never customer-facing). Enable with ?ganguram_debug=1,
  // localStorage['ganguram.debug']='1', or window.GanguramDeliveryProgressConfig.debug.
  function isDebug() {
    try {
      if (cfg().debug === true) { return true; }
      if (window.localStorage && window.localStorage.getItem('ganguram.debug') === '1') { return true; }
      if (typeof location !== 'undefined' && /[?&]ganguram_debug=1\b/.test(location.search || '')) { return true; }
    } catch (e) {}
    return false;
  }
  function dbg() { if (isDebug()) { try { console.log.apply(console, ['[GanguramDeliveryProgress]'].concat([].slice.call(arguments))); } catch (e) {} } }

  function panels() { return document.querySelectorAll('[data-ganguram-delivery-progress]'); }
  function notices() { return document.querySelectorAll('[data-ganguram-mov-notice]'); }
  function checkoutButtons() { return document.querySelectorAll('#CheckOut, [name="checkout"]'); }
  function show(el) { if (el) { el.removeAttribute('hidden'); } }
  function hide(el) { if (el) { el.setAttribute('hidden', 'hidden'); } }
  function setText(el, t) { if (el) { el.textContent = (t == null ? '' : t); } }

  function readSubtotal() {
    var els = document.querySelectorAll('[data-gdpr-cart-total]');
    for (var i = 0; i < els.length; i++) {
      var v = parseInt(els[i].getAttribute('data-gdpr-cart-total'), 10);
      if (isFinite(v) && v >= 0) { return v; }
    }
    return 0;
  }

  // Cart is 4-hour eligible only if it has items and EVERY line is Quick Commerce.
  function cartFourHourEligible() {
    var lines = document.querySelectorAll('[data-ganguram-cart-line]');
    if (!lines.length) { return false; }
    for (var i = 0; i < lines.length; i++) {
      if (String(lines[i].getAttribute('data-ganguram-quick-commerce')) !== 'true') { return false; }
    }
    return true;
  }

  function earliestDate(offsetDays) {
    try {
      var d = new Date();
      var n = parseInt(offsetDays, 10); if (!isFinite(n)) { n = 0; }
      d.setDate(d.getDate() + n);
      try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(d); }
      catch (e) { return d.toDateString(); }
    } catch (e) { return ''; }
  }

  // Names of cart items that are NOT quick-commerce eligible (block 4-hour).
  function nonQuickCommerceItemNames() {
    var names = [];
    var lines = document.querySelectorAll('[data-ganguram-cart-line]');
    for (var i = 0; i < lines.length; i++) {
      if (String(lines[i].getAttribute('data-ganguram-quick-commerce')) !== 'true') {
        var n = String(lines[i].getAttribute('data-ganguram-product-title') || '').trim();
        if (n && names.indexOf(n) === -1) { names.push(n); }
      }
    }
    return names;
  }

  // ---- one shared computation (so panel + notice + guard never disagree) ----
  function computeState() {
    if (!enabled()) { return null; }
    var dr = rules(), z = zone();
    if (!dr || !z) { return null; }
    var location;
    try { location = z.getSelectedDeliveryLocation(); } catch (e) { return null; }
    if (!location || !location.pincode || location.isServiceable !== true) { return null; }
    var subtotal = readSubtotal();

    // Pincode-only = ESTIMATED (no distanceKm -> zone/pincode rules). A full
    // address yields a CONFIRMED driving distanceKm -> distance-slab rules.
    var gd = window.GanguramDistance;
    var dist = (gd && typeof gd.getForPincode === 'function') ? gd.getForPincode(location.pincode) : { distanceKm: null, confirmed: false };
    var confirmed = !!(dist && dist.confirmed && dist.distanceKm != null);
    var distOpts = confirmed ? { distanceKm: dist.distanceKm } : {};

    var data = dr.getProgressData(subtotal, location, distOpts);
    if (!data || data.reason === 'none' || !data.rule) { return null; } // no rules -> fail open
    var mov = data.mov;
    var movMet = (mov == null) ? true : (data.movMet === true);

    var eligible = cartFourHourEligible();
    var svcOpts = { fourHourEligibleCart: eligible };
    if (confirmed) { svcOpts.distanceKm = dist.distanceKm; }
    var svc = dr.getServiceOptions(location, svcOpts);

    // 4-hour blocked items: only when a 4-hour option WOULD apply (cart eligible)
    // but the cart has non-quick-commerce items.
    var blockedItems = [];
    if (!eligible) {
      var potOpts = { fourHourEligibleCart: true };
      if (confirmed) { potOpts.distanceKm = dist.distanceKm; }
      var pot = dr.getServiceOptions(location, potOpts);
      var hasFour = false, po = (pot && pot.options) || [];
      for (var k = 0; k < po.length; k++) { if (po[k].serviceType === 'four_hour') { hasFour = true; break; } }
      if (hasFour) { blockedItems = nonQuickCommerceItemNames(); }
    }

    var result = {
      location: location, subtotal: subtotal, data: data,
      mov: mov, movMet: movMet, movRemaining: data.movRemaining,
      deliveryCharge: data.deliveryCharge,
      freeDeliveryThreshold: data.freeDeliveryThreshold,
      freeDeliveryMet: data.freeDeliveryMet,
      freeDeliveryRemaining: data.freeDeliveryRemaining,
      blocked: (mov != null && !movMet),
      serviceOptions: (svc && svc.options) || [],
      confirmed: confirmed,
      distanceKm: confirmed ? dist.distanceKm : null,
      fourHourBlockedItems: blockedItems
    };
    dbg('state', {
      pincode: location.pincode, confirmed: confirmed, distanceKmPassed: distOpts.distanceKm,
      reason: data.reason, mov: mov, movMet: movMet, subtotal: subtotal,
      services: result.serviceOptions.map(function (o) { return o.serviceType; }),
      fourHourBlocked: blockedItems
    });
    return result;
  }

  function buildServiceLi(o) {
    var li = document.createElement('li');
    li.className = 'ganguram-delivery-progress__service';
    li.setAttribute('data-gdpr-service', o.serviceType || '');
    var name = document.createElement('span');
    name.className = 'ganguram-delivery-progress__service-name';
    name.textContent = o.serviceLabel || (o.serviceType === 'four_hour' ? copy('fourHourLabel') : copy('standardLabel'));
    li.appendChild(name);
    if (o.deliveryCharge != null) {
      var ch = document.createElement('span');
      ch.className = 'ganguram-delivery-progress__service-charge';
      ch.textContent = (o.deliveryCharge === 0) ? copy('freeDelivery') : fmtMoney(o.deliveryCharge);
      li.appendChild(ch);
    }
    var notes = [];
    if (o.datePickerRequired) {
      var note = copy('datePickerNote');
      if (o.defaultDateOffsetDays != null) { var d = earliestDate(o.defaultDateOffsetDays); if (d) { note += ' · ' + tmpl(copy('earliestNote'), { date: d }); } }
      notes.push(note);
    }
    if (o.customerMessageForDeliveryDate) { notes.push(o.customerMessageForDeliveryDate); }
    if (o.customerMessageForCartValue) { notes.push(o.customerMessageForCartValue); }
    if (notes.length) {
      var noteEl = document.createElement('span');
      noteEl.className = 'ganguram-delivery-progress__service-note';
      noteEl.textContent = notes.join(' · ');
      li.appendChild(noteEl);
    }
    return li;
  }

  function renderPanel(panel, st) {
    if (!st) { hide(panel); return; }
    try {
      // minimum-order + cart-value lines — shown in BOTH drawer and page (2.11D.1).
      // Cart value always shows when the panel shows; the minimum-order line shows
      // whenever the resolved rule has an MOV (estimated label for pincode-only,
      // confirmed label for a full address).
      var movLine = panel.querySelector('[data-gdpr-mov-line]');
      var subLine = panel.querySelector('[data-gdpr-subtotal-line]');
      var linesWrap = panel.querySelector('[data-gdpr-lines]');
      setText(panel.querySelector('[data-gdpr-subtotal-label]'), copy('cartValueLabel'));
      setText(panel.querySelector('[data-gdpr-subtotal]'), fmtMoney(st.subtotal));
      show(subLine);
      if (st.mov != null) {
        setText(panel.querySelector('[data-gdpr-mov-label]'), st.confirmed ? copy('movLabel') : copy('movLabelEstimated'));
        setText(panel.querySelector('[data-gdpr-mov]'), fmtMoney(st.mov));
        show(movLine);
      } else { hide(movLine); }
      show(linesWrap);

      // estimated (pincode) vs confirmed (full address) note
      var estEl = panel.querySelector('[data-gdpr-estimate]');
      if (estEl) {
        var estText = st.confirmed ? copy('confirmedNote') : copy('estimatedNote');
        setText(estEl, estText); if (estText) { show(estEl); } else { hide(estEl); }
      }

      // status message
      var msgEl = panel.querySelector('[data-gdpr-message]');
      var message = '';
      if (st.mov != null && !st.movMet) { message = tmpl(copy('addMore'), { remaining: fmtMoney(st.movRemaining) }); }
      else if (st.mov != null) { message = copy('minReached'); }
      setText(msgEl, message); if (message) { show(msgEl); } else { hide(msgEl); }

      // progress bar (toward MOV)
      var barEl = panel.querySelector('[data-gdpr-bar]');
      var fillEl = panel.querySelector('[data-gdpr-bar-fill]');
      if (st.mov != null && barEl && fillEl) {
        var pct = (st.mov > 0) ? Math.max(0, Math.min(100, Math.round(st.subtotal / st.mov * 100))) : 100;
        fillEl.style.width = pct + '%';
        barEl.setAttribute('aria-valuenow', String(pct));
        show(barEl);
      } else { hide(barEl); }

      // delivery charge (display only) + optional free-delivery hint
      var chargeEl = panel.querySelector('[data-gdpr-charge]');
      if (chargeEl) {
        var chargeText = '';
        if (st.freeDeliveryMet) { chargeText = copy('freeDelivery'); }
        else if (st.deliveryCharge != null) {
          chargeText = (st.deliveryCharge === 0) ? copy('freeDelivery') : tmpl(copy('deliveryChargeFrom'), { amount: fmtMoney(st.deliveryCharge) });
          if (st.freeDeliveryThreshold != null && st.freeDeliveryRemaining != null && st.freeDeliveryRemaining > 0) {
            chargeText += ' · ' + tmpl(copy('freeDeliveryHint'), { amount: fmtMoney(st.freeDeliveryRemaining) });
          }
        }
        setText(chargeEl, chargeText); if (chargeText) { show(chargeEl); } else { hide(chargeEl); }
      }

      // service options — shown when checkout is allowed (MOV met / no MOV)
      var svcEl = panel.querySelector('[data-gdpr-services]');
      if (svcEl) {
        svcEl.textContent = '';
        if (!st.blocked && st.serviceOptions.length) {
          for (var i = 0; i < st.serviceOptions.length; i++) { svcEl.appendChild(buildServiceLi(st.serviceOptions[i])); }
          show(svcEl);
        } else { hide(svcEl); }
      }

      // 4-hour not available because some items aren't quick-commerce eligible
      var fhEl = panel.querySelector('[data-gdpr-fourhour-notice]');
      if (fhEl) {
        if (st.fourHourBlockedItems && st.fourHourBlockedItems.length) {
          setText(fhEl, tmpl(copy('fourHourIneligible'), { items: st.fourHourBlockedItems.join(', ') }));
          show(fhEl);
        } else { setText(fhEl, ''); hide(fhEl); }
      }

      panel.setAttribute('data-gdpr-state', st.blocked ? 'blocked' : 'ok');
      panel.setAttribute('data-gdpr-confirmed', st.confirmed ? 'true' : 'false');
      show(panel);
    } catch (e) { hide(panel); }
  }

  function renderNotice(notice, st) {
    try {
      if (st && st.blocked) {
        setText(notice, tmpl(copy('checkoutNotice'), { mov: fmtMoney(st.mov), remaining: fmtMoney(st.movRemaining) }));
        show(notice);
      } else { setText(notice, ''); hide(notice); }
    } catch (e) { hide(notice); }
  }

  function guardButtons(st) {
    var blocked = !!(st && st.blocked);
    var btns = checkoutButtons();
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (blocked) { b.classList.add('ganguram-mov-blocked'); b.setAttribute('aria-disabled', 'true'); }
      else { b.classList.remove('ganguram-mov-blocked'); b.removeAttribute('aria-disabled'); }
    }
  }

  function renderAll() {
    var st = computeState();
    var ps = panels(); for (var i = 0; i < ps.length; i++) { renderPanel(ps[i], st); }
    var ns = notices(); for (var j = 0; j < ns.length; j++) { renderNotice(ns[j], st); }
    guardButtons(st);
    return st;
  }

  // ---- soft checkout guard (cart-side advisory; never changes checkout) -----
  function isBlocked() { var st = computeState(); return !!(st && st.blocked); }
  function revealNotices() {
    var st = renderAll();
    var ns = notices();
    for (var i = 0; i < ns.length; i++) {
      if (!ns[i].hasAttribute('hidden') && ns[i].scrollIntoView) { try { ns[i].scrollIntoView({ block: 'center' }); } catch (e) {} break; }
    }
    return st;
  }
  function onCheckoutClick(e) {
    var t = e.target;
    if (!t || !t.closest) { return; }
    var hit = t.closest('#CheckOut, [name="checkout"], .shopify-payment-button, [data-shopify="payment-button"], .additional-checkout-buttons, [data-ganguram-checkout]');
    if (!hit) { return; }
    if (isBlocked()) { e.preventDefault(); e.stopPropagation(); revealNotices(); }
  }
  function onCartSubmit(e) {
    var f = e.target;
    if (f && f.id === 'cart' && isBlocked()) { e.preventDefault(); e.stopPropagation(); revealNotices(); }
  }

  // Re-paint after cart re-renders (qty change / refreshCart replace the markup).
  function observeCartForms() {
    if (!('MutationObserver' in window)) { return; }
    var forms = document.querySelectorAll('cart-form');
    if (!forms.length) { return; }
    var pending = false;
    var schedule = function () {
      if (pending) { return; }
      pending = true;
      var run = function () { pending = false; renderAll(); };
      if (window.requestAnimationFrame) { window.requestAnimationFrame(run); } else { setTimeout(run, 0); }
    };
    var obs = new MutationObserver(schedule);
    for (var i = 0; i < forms.length; i++) { try { obs.observe(forms[i], { childList: true }); } catch (e) {} }
  }

  function init() {
    renderAll();
    observeCartForms();
    window.addEventListener('ganguram:delivery-location-changed', renderAll);
    window.addEventListener('ganguram:delivery-label-updated', renderAll);
    window.addEventListener('ganguram:delivery-distance-updated', renderAll);
    document.addEventListener('click', onCheckoutClick, true);
    document.addEventListener('submit', onCartSubmit, true);
  }

  window.GanguramDeliveryProgress = { render: renderAll, isCheckoutBlocked: isBlocked };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
