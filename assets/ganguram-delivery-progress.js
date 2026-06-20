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
      // 2.11E: pincode/zone is accurate, not an estimate — these legacy keys are unused.
      movLabelEstimated: 'Minimum order:',
      estimatedNote: '',
      confirmedNote: '',
      deliveringTo: 'Delivering to __LABEL__',
      statusAvailable: 'Delivery available',
      chipStandard: 'Standard shipping',
      chipStandardAlso: 'Standard also available',
      chipFourHour: '4 Hours available',
      chipChargeAtCheckout: 'Charge at checkout',
      chipFree: 'Free delivery',
      chipDelivery: 'Delivery __AMOUNT__',
      movSummary: '__SUBTOTAL__ / __MOV__ minimum order',
      fourHourShortMixed: '4 Hours not available for this cart',
      fourHourShortPincode: '4 Hours not available for this area',
      chargeAtCheckout: 'Final delivery charge will be confirmed at checkout.',
      breakdownTitle: 'Delivery details',
      breakdownNote: 'Final delivery charge may be confirmed at checkout if the complete address changes.',
      bdZoneLabel: 'Delivery zone:',
      bdMethodLabel: 'Delivery method:',
      bdChargeLabel: 'Delivery charge:',
      fourHourIneligible: '4-hour delivery is not available because the following item(s) are not eligible for quick delivery: __ITEMS__',
      cartValueLabel: 'Cart value:',
      addMore: 'Add __REMAINING__ more to continue',
      minReached: 'Minimum order reached',
      checkoutNotice: 'Minimum order value for your area is __MOV__. Please add __REMAINING__ more to continue.',
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

  // Catalog message (Phase 2.11E) with a graceful fallback to local copy().
  function msg(code, vars) {
    var m = window.GanguramDeliveryMessages;
    if (m && typeof m.get === 'function') { var t = m.get(code, vars); if (t) { return t; } }
    return '';
  }
  function cartHasItems() { return document.querySelectorAll('[data-ganguram-cart-line]').length > 0; }
  function isLocalZone(loc) {
    return !!(loc && (loc.zone === 'kolkata' || loc.zone === 'quick_commerce' || loc.isKolkata === true || loc.isQuickCommerce === true));
  }
  // Customer-facing "city + pincode" label (never the internal zone names). Reuses
  // the shared display-label helper; falls back to a safe local rule.
  function displayLabelFor(loc) {
    if (window.GanguramDisplayLabel && typeof window.GanguramDisplayLabel.get === 'function') {
      try { var l = window.GanguramDisplayLabel.get(loc); if (l) { return l; } } catch (e) {}
    }
    if (!loc || !loc.pincode) { return ''; }
    if (loc.city) { return loc.city + ' ' + loc.pincode; }
    if (isLocalZone(loc)) { return 'Kolkata ' + loc.pincode; }
    return String(loc.pincode);
  }
  // Friendly zone wording for customers (never "quick_commerce"/"pan_india").
  function zoneFriendly(loc) {
    if (!loc) { return ''; }
    if (isLocalZone(loc)) { return 'Kolkata'; }
    if (loc.zone === 'pan_india' || loc.isPanIndia === true) { return 'Pan India'; }
    return '';
  }

  function computeState() {
    if (!enabled()) { return null; }
    var dr = rules(), z = zone();
    if (!dr || !z) { return null; }
    var location;
    try { location = z.getSelectedDeliveryLocation(); } catch (e) { return null; }

    var hasItems = cartHasItems();
    // No pincode / not serviceable yet -> show an accurate PROMPT (never blocks
    // checkout; the MOV guard is the only block). Only meaningful with items.
    if (!location || !location.pincode) {
      return hasItems ? { promptCode: 'NO_PINCODE', blocked: false, serviceOptions: [], fourHourBlockedItems: [] } : null;
    }
    if (location.isServiceable !== true) {
      return hasItems ? { promptCode: 'NOT_SERVICEABLE', location: location, blocked: false, serviceOptions: [], fourHourBlockedItems: [] } : null;
    }
    var subtotal = readSubtotal();

    // Pincode/zone is the PRIMARY source of truth and is treated as ACCURATE for
    // cart-level info (MOV, zone, modes). A full address only REFINES the distance
    // slab (supporting, not a different business rule).
    var gd = window.GanguramDistance;
    var dist = (gd && typeof gd.getForPincode === 'function') ? gd.getForPincode(location.pincode) : { distanceKm: null, confirmed: false };
    var confirmed = !!(dist && dist.confirmed && dist.distanceKm != null);
    var distOpts = confirmed ? { distanceKm: dist.distanceKm } : {};

    var data = dr.getProgressData(subtotal, location, distOpts);
    if (!data || data.reason === 'none' || !data.rule) { return null; } // no rule -> fail open (panel hidden)
    var mov = data.mov;
    var movMet = (mov == null) ? true : (data.movMet === true);

    var eligible = cartFourHourEligible();
    var svcOpts = { fourHourEligibleCart: eligible };
    if (confirmed) { svcOpts.distanceKm = dist.distanceKm; }
    var svc = dr.getServiceOptions(location, svcOpts);
    var serviceOptions = (svc && svc.options) || [];

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

    // Reason the 4-hour mode isn't offered: 'mixed' (some items not QC) or
    // 'pincode' (cart is all-QC + local zone, but no 4-hour rule for this pincode).
    var hasFourOption = false;
    for (var s = 0; s < serviceOptions.length; s++) { if (serviceOptions[s].serviceType === 'four_hour') { hasFourOption = true; break; } }
    var fourHourReason = '';
    if (!hasFourOption) {
      if (blockedItems.length) { fourHourReason = 'mixed'; }
      else if (eligible && isLocalZone(location)) { fourHourReason = 'pincode'; }
    }

    var result = {
      location: location, pincode: location.pincode, subtotal: subtotal, data: data,
      displayLabel: displayLabelFor(location), zoneFriendly: zoneFriendly(location),
      mov: mov, movMet: movMet, movRemaining: data.movRemaining,
      deliveryCharge: data.deliveryCharge,
      freeDeliveryThreshold: data.freeDeliveryThreshold,
      freeDeliveryMet: data.freeDeliveryMet,
      freeDeliveryRemaining: data.freeDeliveryRemaining,
      blocked: (mov != null && !movMet),
      serviceOptions: serviceOptions,
      confirmed: confirmed,
      distanceKm: confirmed ? dist.distanceKm : null,
      fourHourBlockedItems: blockedItems,
      fourHourReason: fourHourReason
    };
    dbg('state', {
      pincode: location.pincode, confirmed: confirmed, distanceKmPassed: distOpts.distanceKm,
      reason: data.reason, mov: mov, movMet: movMet, subtotal: subtotal,
      services: serviceOptions.map(function (o) { return o.serviceType; }),
      fourHourReason: fourHourReason, fourHourBlocked: blockedItems
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

  // ---- shipping-charge breakdown accordion (Requirement A) ------------------
  // Shows ONLY what the theme actually knows from the pincode/zone rules (cart
  // value, zone + pincode, MOV, and the per-mode delivery charge). It NEVER invents
  // a weight slab / distance charge / express surcharge — those live in ShipZip; any
  // part the theme can't break down is left to the "confirmed at checkout" note.
  function bdRow(label, value) {
    var row = document.createElement('div');
    row.className = 'ganguram-delivery-progress__bd-row';
    var l = document.createElement('span'); l.className = 'ganguram-delivery-progress__bd-label'; l.textContent = label;
    var v = document.createElement('span'); v.className = 'ganguram-delivery-progress__bd-value'; v.textContent = (value == null ? '' : value);
    row.appendChild(l); row.appendChild(v);
    return row;
  }
  function renderBreakdown(panel, st) {
    var det = panel.querySelector('[data-gdpr-breakdown]');
    if (!det) { return; }
    var body = panel.querySelector('[data-gdpr-breakdown-body]');
    var titleEl = panel.querySelector('[data-gdpr-breakdown-title]');
    var opts = st.serviceOptions || [];
    var hasData = (st.mov != null) || opts.length || (st.deliveryCharge != null);
    if (!body || !hasData) { hide(det); return; }
    if (titleEl) { setText(titleEl, copy('breakdownTitle')); }
    body.textContent = '';
    body.appendChild(bdRow(copy('cartValueLabel'), fmtMoney(st.subtotal)));
    if (st.displayLabel) {
      body.appendChild(bdRow(copy('bdZoneLabel'), st.displayLabel + (st.zoneFriendly ? ' (' + st.zoneFriendly + ')' : '')));
    }
    if (st.mov != null) { body.appendChild(bdRow(copy('movLabel'), fmtMoney(st.mov))); }
    if (opts.length) {
      for (var i = 0; i < opts.length; i++) {
        var o = opts[i];
        var label = o.serviceLabel || (o.serviceType === 'four_hour' ? copy('fourHourLabel') : copy('standardLabel'));
        var charge = (o.deliveryCharge == null) ? copy('chargeAtCheckout') : (o.deliveryCharge === 0 ? copy('freeDelivery') : fmtMoney(o.deliveryCharge));
        body.appendChild(bdRow(label, charge));
      }
    } else if (st.deliveryCharge != null) {
      body.appendChild(bdRow(copy('bdChargeLabel'), st.deliveryCharge === 0 ? copy('freeDelivery') : fmtMoney(st.deliveryCharge)));
    }
    // the long "why 4-hour is unavailable" detail (named items) lives here, once
    if (st.fourHourReason === 'mixed' && st.fourHourBlockedItems && st.fourHourBlockedItems.length) {
      var mi = document.createElement('p');
      mi.className = 'ganguram-delivery-progress__bd-note';
      mi.textContent = msg('MIXED_CART_ITEMS', { items: st.fourHourBlockedItems.join(', ') }) || tmpl(copy('fourHourIneligible'), { items: st.fourHourBlockedItems.join(', ') });
      body.appendChild(mi);
    }
    var note = document.createElement('p');
    note.className = 'ganguram-delivery-progress__bd-note';
    note.textContent = copy('breakdownNote');
    body.appendChild(note);
    show(det);
  }

  // Compact delivery-mode chips for the MAIN cart view (Phase 2.11F). Detailed
  // per-mode charges live in the "Delivery details" accordion, not here.
  function renderModes(panel, st) {
    var modesEl = panel.querySelector('[data-gdpr-modes]');
    if (!modesEl) { return; }
    modesEl.textContent = '';
    var opts = st.serviceOptions || [];
    var hasFour = false, hasStd = false, i;
    for (i = 0; i < opts.length; i++) {
      if (opts[i].serviceType === 'four_hour') { hasFour = true; }
      else if (opts[i].serviceType === 'standard') { hasStd = true; }
    }
    var chips = [];
    if (hasFour) { chips.push({ text: copy('chipFourHour'), accent: true }); }
    if (hasStd) { chips.push({ text: hasFour ? copy('chipStandardAlso') : copy('chipStandard'), accent: false }); }
    var ch = st.deliveryCharge; // one concise charge chip, only if useful
    if (st.freeDeliveryMet || ch === 0) { chips.push({ text: copy('chipFree'), accent: false }); }
    else if (ch == null) { chips.push({ text: copy('chipChargeAtCheckout'), accent: false }); }
    else { chips.push({ text: tmpl(copy('chipDelivery'), { amount: fmtMoney(ch) }), accent: false }); }
    if (!chips.length) { hide(modesEl); return; }
    for (i = 0; i < chips.length; i++) {
      var c = document.createElement('span');
      c.className = 'ganguram-delivery-progress__chip' + (chips[i].accent ? ' ganguram-delivery-progress__chip--accent' : '');
      c.textContent = chips[i].text;
      modesEl.appendChild(c);
    }
    show(modesEl);
  }

  function renderPanel(panel, st) {
    if (!st) { hide(panel); return; }
    try {
      var promptEl = panel.querySelector('[data-gdpr-prompt]');
      var statusEl = panel.querySelector('[data-gdpr-status]');
      var modesEl = panel.querySelector('[data-gdpr-modes]');
      var movSumEl = panel.querySelector('[data-gdpr-mov-summary]');
      var barEl = panel.querySelector('[data-gdpr-bar]');
      var fillEl = panel.querySelector('[data-gdpr-bar-fill]');
      var msgEl = panel.querySelector('[data-gdpr-message]');
      var fhEl = panel.querySelector('[data-gdpr-fourhour-notice]');
      var detEl = panel.querySelector('[data-gdpr-breakdown]');

      // ---- prompt state: no pincode / not serviceable (never blocks checkout) ----
      if (st.promptCode) {
        hide(statusEl); hide(modesEl); hide(movSumEl); hide(barEl); hide(msgEl); hide(fhEl); if (detEl) { hide(detEl); }
        var pText = msg(st.promptCode) || (st.promptCode === 'NOT_SERVICEABLE'
          ? 'Sorry, we currently do not deliver to this pincode.'
          : 'Please enter your delivery pincode to check delivery availability.');
        if (promptEl) { setText(promptEl, pText); show(promptEl); }
        panel.setAttribute('data-gdpr-state', 'prompt');
        panel.removeAttribute('data-gdpr-confirmed');
        show(panel);
        return;
      }
      if (promptEl) { setText(promptEl, ''); hide(promptEl); }

      // ---- status (de-emphasised; the pincode/zone live in the accordion) ----
      if (statusEl) { setText(statusEl, copy('statusAvailable')); show(statusEl); }

      // ---- compact delivery-mode chips ----
      renderModes(panel, st);

      // ---- MOV summary + theme-coloured progress bar + short action ----
      if (st.mov != null) {
        var sumText = st.movMet ? copy('minReached') : tmpl(copy('movSummary'), { subtotal: fmtMoney(st.subtotal), mov: fmtMoney(st.mov) });
        if (movSumEl) { setText(movSumEl, sumText); show(movSumEl); }
        if (barEl && fillEl) {
          var pct = (st.mov > 0) ? Math.max(0, Math.min(100, Math.round(st.subtotal / st.mov * 100))) : 100;
          fillEl.style.width = pct + '%';
          barEl.setAttribute('aria-valuenow', String(pct));
          show(barEl);
        }
        var action = st.movMet ? '' : tmpl(copy('addMore'), { remaining: fmtMoney(st.movRemaining) });
        if (msgEl) { setText(msgEl, action); if (action) { show(msgEl); } else { hide(msgEl); } }
      } else {
        if (movSumEl) { hide(movSumEl); }
        if (barEl) { hide(barEl); }
        if (msgEl) { hide(msgEl); }
      }

      // ---- short 4-hour reason (the detailed item list lives in the accordion) ----
      if (fhEl) {
        var fhText = '';
        if (st.fourHourReason === 'mixed') { fhText = copy('fourHourShortMixed'); }
        else if (st.fourHourReason === 'pincode') { fhText = copy('fourHourShortPincode'); }
        setText(fhEl, fhText); if (fhText) { show(fhEl); } else { hide(fhEl); }
      }

      // ---- "Delivery details" accordion (collapsed) — all the detail, once ----
      renderBreakdown(panel, st);

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
