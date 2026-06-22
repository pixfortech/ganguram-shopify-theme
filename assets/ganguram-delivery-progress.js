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
      itemsNotDeliverable: 'Some items in your cart can’t be delivered to __LABEL__. Please remove them or change your delivery pincode to continue.',
      // Phase 2.11J — compact cart-panel shipping estimate
      estimateStandard: 'Standard shipping estimate: __RANGE__',
      estimateFourHour: '4 Hours: __AMOUNT__',
      estimatePan: 'PAN India shipping estimate: __AMOUNT__',
      estimatePanFrom: 'PAN India shipping starts from __AMOUNT__ per __UNIT__',
      weightLabel: 'Total weight:',
      panRateLabel: 'Rate:',
      panRateValue: '__AMOUNT__ per __UNIT__',
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

  // Names of cart items that are NOT DELIVERABLE to the selected zone by ANY mode (2.11H).
  // Reuses the shared cart-level rule (window.GanguramZoneRules.isProductDeliverableToZone)
  // so the panel, the cart validator and the product display never disagree. Fail-open:
  // no rule / no serviceable zone -> returns [] (nothing flagged, panel behaves as before).
  function invalidCartItemNames(location) {
    var r = window.GanguramZoneRules;
    if (!r || typeof r.isProductDeliverableToZone !== 'function') { return []; }
    if (!location || location.isServiceable !== true || !location.zone) { return []; }
    var names = [], lines = document.querySelectorAll('[data-ganguram-cart-line]');
    for (var i = 0; i < lines.length; i++) {
      var el = lines[i];
      var tags = {
        kolkata: el.getAttribute('data-ganguram-kolkata') === 'true',
        panIndia: el.getAttribute('data-ganguram-pan-india') === 'true',
        quickCommerce: el.getAttribute('data-ganguram-quick-commerce') === 'true',
        localDelivery: el.getAttribute('data-ganguram-local-delivery') === 'true'
      };
      if (!r.isProductDeliverableToZone(tags, location.zone)) {
        var n = String(el.getAttribute('data-ganguram-product-title') || '').trim();
        if (names.indexOf(n || 'Item') === -1) { names.push(n || 'Item'); }
      }
    }
    return names;
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

  // Total Shopify cart weight in GRAMS (data-gdpr-cart-weight, from cart.total_weight).
  function cartWeightGrams() {
    var els = document.querySelectorAll('[data-gdpr-cart-weight]');
    for (var i = 0; i < els.length; i++) { var v = parseInt(els[i].getAttribute('data-gdpr-cart-weight'), 10); if (isFinite(v) && v >= 0) { return v; } }
    return null;
  }
  // Cart is PAN-India-eligible only if EVERY line carries the PAN India tag.
  function cartPanIndiaEligible() {
    var lines = document.querySelectorAll('[data-ganguram-cart-line]');
    if (!lines.length) { return true; }
    for (var i = 0; i < lines.length; i++) { if (String(lines[i].getAttribute('data-ganguram-pan-india')) !== 'true') { return false; } }
    return true;
  }
  // Resolve the ONE delivery state for the cart panel (Phase 2.12D) — the SAME distance-first
  // decision the popup uses, so the cart and popup can never disagree. local -> Standard slab
  // (+ "4 Hours: ₹10" only when within 10km + QC); PAN India -> ₹80/500g weight; never both.
  function computeCartEstimate(location) {
    var se = window.GanguramShippingEstimate;
    if (!se || typeof se.resolveDeliveryState !== 'function' || !location || location.isServiceable !== true) { return null; }
    var ga = window.GanguramAddress;
    var addr = (ga && typeof ga.getSelectedAddress === 'function') ? ga.getSelectedAddress() : null;
    var isAddress = !!(addr && addr.source === 'selected_address');
    var gd = window.GanguramDistance;
    var conf = (gd && typeof gd.getForPincode === 'function') ? gd.getForPincode(location.pincode) : { confirmed: false };
    var areaRange = (!isAddress && gd && typeof gd.getAreaRangeForPincode === 'function') ? gd.getAreaRangeForPincode(location.pincode) : null;
    var del = se.resolveDeliveryState({
      isAddress: isAddress,
      distanceKm: conf.confirmed ? conf.distanceKm : null,
      areaRange: areaRange,
      zone: location.zone,
      cartWeightGrams: cartWeightGrams(),
      fourHourEligibleCart: cartFourHourEligible(),
      panIndiaEligibleCart: cartPanIndiaEligible()
    });
    if (!isAddress && del.basis === 'zone' && gd && typeof gd.computeAreaRangeForPincode === 'function') { try { gd.computeAreaRangeForPincode(location.pincode); } catch (e) {} }

    var text = '';
    if (del.mode === 'pan_india' && del.panIndia) {
      var pi = del.panIndia;
      text = pi.available ? tmpl(copy('estimatePan'), { amount: se.money(pi.price) }) : tmpl(copy('estimatePanFrom'), { amount: se.money(pi.fromPrice), unit: pi.perWeightG + 'g' });
    } else if (del.mode === 'local' && del.standard) {
      text = tmpl(copy('estimateStandard'), { range: se.formatRange(del.standard.minPrice, del.standard.maxPrice) + (del.standard.beyond ? '+' : '') });
      if (del.fourHour && del.fourHour.state === 'yes' && fourHourTimeOk()) { text += ' · ' + tmpl(copy('estimateFourHour'), { amount: se.money(del.fourHour.price) }); }
    } else {
      return null; // pending / block / prompt -> no estimate line (other panel states handle it)
    }
    return { type: del.mode, delivery: del, text: text };
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
  // 4-hour AREA eligibility = the quick-commerce zone (the resolver's quick_commerce
  // pincode list). This is the source ShipZip + the cart-attribute handoff use, so the
  // cart's "4 Hours available" never contradicts checkout (Phase 2.11F.3).
  function fourHourAreaEligible(loc) {
    return !!(loc && (loc.isQuickCommerce === true || loc.zone === 'quick_commerce'));
  }
  // Phase 2: the 4HR TIME-WINDOW gate (enabled + within window + radius + all-QC + MOV) from the
  // shared evaluator, so the cart panel never advertises "4 Hours" outside the configured hours.
  // Fail-open when the evaluator is absent (legacy behaviour). Display only — no rate/checkout change.
  function fourHourTimeOk() {
    if (window.GanguramFourHour && typeof window.GanguramFourHour.isAvailableNow === 'function') {
      try { return window.GanguramFourHour.isAvailableNow(); } catch (e) { return true; }
    }
    return true;
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

    // 2.11H — if the cart holds item(s) not deliverable to this serviceable zone (e.g. a
    // local-only sweet with a PAN India pincode), surface THAT and block checkout. We must
    // not present a "Standard / Pan India delivery available" state for a cart that cannot
    // actually be delivered. Resolving happens via the cart-eligibility modal (remove /
    // change pincode). Fail-open: helper returns [] when no rule is loaded.
    var invalidNames = hasItems ? invalidCartItemNames(location) : [];
    if (invalidNames.length) {
      return {
        location: location, displayLabel: displayLabelFor(location), zoneFriendly: zoneFriendly(location),
        hasInvalid: true, invalidItems: invalidNames,
        blocked: true, serviceOptions: [], fourHourBlockedItems: []
      };
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
    var movRemaining = data.movRemaining;
    var movSource = (mov != null) ? 'rule' : 'none';
    // The soft checkout guard is tied to the RULE's real MOV only (never the display fallback).
    var ruleMovBlocks = (data.mov != null && data.movMet !== true);
    // MOV-bar fix: optional DISPLAY-ONLY fallback so the progress bar still renders when the
    // resolved metaobject rule omits a minimum order value. OFF by default (fallbackMov unset =
    // no change). It NEVER blocks checkout and NEVER changes the MOV/rate formula — it only lets
    // the bar + "x / y minimum order" summary appear. Set a real MOV on the rule to also guard.
    if (mov == null) {
      var fb = parseInt(cfg().fallbackMov, 10);
      if (isFinite(fb) && fb > 0) {
        mov = fb;
        movMet = subtotal >= fb;
        movRemaining = movMet ? 0 : (fb - subtotal);
        movSource = 'fallback';
      }
    }
    var movDisplayOnly = (movSource === 'fallback');

    var eligible = cartFourHourEligible();
    var svcOpts = { fourHourEligibleCart: eligible };
    if (confirmed) { svcOpts.distanceKm = dist.distanceKm; }
    var svc = dr.getServiceOptions(location, svcOpts);
    var serviceOptions = (svc && svc.options) || [];

    // 4-hour AVAILABILITY comes from the ZONE resolver (quick_commerce pincodes) +
    // cart quick-commerce eligibility — the SAME basis ShipZip uses and that the cart
    // attribute handoff sends (ganguram_delivery_mode_candidates). It is NOT tied to a
    // metaobject four_hour RULE resolving (a rule only supplies the charge). This keeps
    // the cart IN SYNC with checkout: an all-QC cart in a quick-commerce pincode shows
    // "4 Hours available" even when no four_hour rule exists, because ShipZip offers it.
    // Would 4-hour apply for an all-QC cart HERE? True when the pincode is a quick-
    // commerce zone (ShipZip's basis) OR a metaobject four_hour rule would resolve.
    var fourHourArea = fourHourAreaEligible(location);
    var fourHourRuleApplies = false;
    if (!fourHourArea) {
      var potOpts = { fourHourEligibleCart: true };
      if (confirmed) { potOpts.distanceKm = dist.distanceKm; }
      var pot = dr.getServiceOptions(location, potOpts), po = (pot && pot.options) || [];
      for (var k = 0; k < po.length; k++) { if (po[k].serviceType === 'four_hour') { fourHourRuleApplies = true; break; } }
    }
    var fourHourPossible = fourHourArea || fourHourRuleApplies;
    var fourHourAvailable = eligible && fourHourPossible && fourHourTimeOk(); // -> "4 Hours available" (Phase 2: + time window)

    // DEFINITE negative only: a MIXED cart where 4-hour WOULD apply (some items aren't
    // quick-commerce). NEVER assert "not available" just because a metaobject four_hour
    // rule is missing — the theme can't see ShipZip, so it must not contradict it (req B).
    var blockedItems = [];
    var fourHourReason = '';
    if (!eligible && fourHourPossible) {
      blockedItems = nonQuickCommerceItemNames();
      if (blockedItems.length) { fourHourReason = 'mixed'; }
    }

    var result = {
      location: location, pincode: location.pincode, subtotal: subtotal, data: data,
      displayLabel: displayLabelFor(location), zoneFriendly: zoneFriendly(location),
      mov: mov, movMet: movMet, movRemaining: movRemaining, movSource: movSource, movDisplayOnly: movDisplayOnly,
      deliveryCharge: data.deliveryCharge,
      freeDeliveryThreshold: data.freeDeliveryThreshold,
      freeDeliveryMet: data.freeDeliveryMet,
      freeDeliveryRemaining: data.freeDeliveryRemaining,
      blocked: ruleMovBlocks,   // display fallback never blocks checkout
      serviceOptions: serviceOptions,
      confirmed: confirmed,
      distanceKm: confirmed ? dist.distanceKm : null,
      fourHourAvailable: fourHourAvailable,
      fourHourBlockedItems: blockedItems,
      fourHourReason: fourHourReason,
      estimate: computeCartEstimate(location)   // Part C (2.11J) — resolved delivery state (2.12D)
    };
    dbg('state', {
      pincode: location.pincode, confirmed: confirmed, distanceKmPassed: distOpts.distanceKm,
      reason: data.reason, mov: mov, movMet: movMet, subtotal: subtotal,
      services: serviceOptions.map(function (o) { return o.serviceType; }),
      fourHourArea: fourHourArea, fourHourAvailable: fourHourAvailable, fourHourReason: fourHourReason
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
    var hasData = (st.mov != null) || opts.length || (st.deliveryCharge != null) || st.estimate;
    if (!body || !hasData) { hide(det); return; }
    if (titleEl) { setText(titleEl, copy('breakdownTitle')); }
    body.textContent = '';
    body.appendChild(bdRow(copy('cartValueLabel'), fmtMoney(st.subtotal)));
    // Phase 2.11J/2.12D — estimate detail from the resolved delivery state.
    if (st.estimate && st.estimate.delivery && window.GanguramShippingEstimate) {
      var se2 = window.GanguramShippingEstimate, del2 = st.estimate.delivery;
      if (del2.mode === 'pan_india' && del2.panIndia) {
        if (del2.panIndia.grams != null) { body.appendChild(bdRow(copy('weightLabel'), del2.panIndia.grams + ' g')); }
        body.appendChild(bdRow(copy('panRateLabel'), tmpl(copy('panRateValue'), { amount: se2.money(del2.panIndia.fromPrice), unit: del2.panIndia.perWeightG + 'g' })));
      } else if (del2.mode === 'local' && del2.standard) {
        body.appendChild(bdRow(copy('standardLabel'), se2.formatRange(del2.standard.minPrice, del2.standard.maxPrice) + (del2.standard.beyond ? '+' : '')));
      }
    }
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
    var i, chips = [];
    var del = st.estimate && st.estimate.delivery;
    if (del && del.mode === 'local') {
      // Mode chips come from the RESOLVED state (2.12D): 4 Hours ONLY when within 10km + QC;
      // Standard always for a local address. The estimate line carries the price. Phase 2 also
      // gates 4 Hours on the time window, so the chip disappears outside the configured hours.
      var hasFour = !!(del.fourHour && del.fourHour.state === 'yes') && fourHourTimeOk();
      if (hasFour) { chips.push({ text: copy('chipFourHour'), accent: true }); }
      chips.push({ text: hasFour ? copy('chipStandardAlso') : copy('chipStandard'), accent: false });
    } else if (del && del.mode === 'pan_india') {
      // PAN India: no local-mode chips at all (no "4 Hours" / "Standard" — the PAN India
      // estimate line is the only delivery display, so the modes can never look mixed).
    } else {
      // No resolved estimate (no rule / fail-open) -> legacy zone chips + a charge chip.
      var hasFourLegacy = !!st.fourHourAvailable;
      if (hasFourLegacy) { chips.push({ text: copy('chipFourHour'), accent: true }); }
      chips.push({ text: hasFourLegacy ? copy('chipStandardAlso') : copy('chipStandard'), accent: false });
      var ch = st.deliveryCharge;
      if (st.freeDeliveryMet || ch === 0) { chips.push({ text: copy('chipFree'), accent: false }); }
      else if (ch == null) { chips.push({ text: copy('chipChargeAtCheckout'), accent: false }); }
      else { chips.push({ text: tmpl(copy('chipDelivery'), { amount: fmtMoney(ch) }), accent: false }); }
    }
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
      var estEl = panel.querySelector('[data-gdpr-estimate]');
      var modesEl = panel.querySelector('[data-gdpr-modes]');
      var movSumEl = panel.querySelector('[data-gdpr-mov-summary]');
      var barEl = panel.querySelector('[data-gdpr-bar]');
      var fillEl = panel.querySelector('[data-gdpr-bar-fill]');
      var msgEl = panel.querySelector('[data-gdpr-message]');
      var fhEl = panel.querySelector('[data-gdpr-fourhour-notice]');
      var detEl = panel.querySelector('[data-gdpr-breakdown]');

      // ---- prompt state: no pincode / not serviceable (never blocks checkout) ----
      if (st.promptCode) {
        hide(statusEl); hide(estEl); hide(modesEl); hide(movSumEl); hide(barEl); hide(msgEl); hide(fhEl); if (detEl) { hide(detEl); }
        var pText = msg(st.promptCode) || (st.promptCode === 'NOT_SERVICEABLE'
          ? 'Sorry, we currently do not deliver to this pincode.'
          : 'Please enter your delivery pincode to check delivery availability.');
        if (promptEl) { setText(promptEl, pText); show(promptEl); }
        panel.setAttribute('data-gdpr-state', 'prompt');
        panel.removeAttribute('data-gdpr-confirmed');
        show(panel);
        return;
      }

      // ---- not-deliverable state: cart holds item(s) invalid for this zone (2.11H) ----
      // Show a clear message instead of any delivery-mode / charge info; checkout is blocked.
      if (st.hasInvalid) {
        hide(statusEl); hide(estEl); hide(modesEl); hide(movSumEl); hide(barEl); hide(msgEl); hide(fhEl); if (detEl) { hide(detEl); }
        var iText = msg('ITEMS_NOT_DELIVERABLE', { label: st.displayLabel }) ||
          tmpl(copy('itemsNotDeliverable'), { label: st.displayLabel || 'the selected pincode' });
        if (promptEl) { setText(promptEl, iText); show(promptEl); }
        panel.setAttribute('data-gdpr-state', 'invalid');
        panel.removeAttribute('data-gdpr-confirmed');
        show(panel);
        return;
      }
      if (promptEl) { setText(promptEl, ''); hide(promptEl); }

      // ---- status (de-emphasised; the pincode/zone live in the accordion) ----
      if (statusEl) { setText(statusEl, copy('statusAvailable')); show(statusEl); }

      // ---- compact shipping ESTIMATE line (Part C, 2.11J): Standard slab (+ 4 Hours)
      //      for local, or the PAN India weight estimate. Charge detail in the accordion. ----
      if (estEl) {
        if (st.estimate && st.estimate.text) { setText(estEl, st.estimate.text); show(estEl); }
        else { setText(estEl, ''); hide(estEl); }
      }

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
        // The blocking "add __REMAINING__ more to continue" line is for a REAL rule MOV only;
        // a display-only fallback shows the bar + summary but no blocking call to action.
        var action = (st.movMet || st.movDisplayOnly) ? '' : tmpl(copy('addMore'), { remaining: fmtMoney(st.movRemaining) });
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
      // The MOV notice is for the below-minimum block only. The not-deliverable block
      // (2.11H) is explained by the panel + the cart-eligibility modal, not here.
      if (st && st.blocked && !st.hasInvalid) {
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
  // When blocked, reveal the MOV notice AND — if blocked because the cart holds
  // not-deliverable items (2.11H) — open the cart-eligibility review modal so the
  // customer can remove them or change the pincode. Both are cart-side advisory only.
  function handleBlocked() {
    var st = revealNotices();
    if (st && st.hasInvalid && window.GanguramCartEligibility && typeof window.GanguramCartEligibility.reviewNow === 'function') {
      try { window.GanguramCartEligibility.reviewNow(); } catch (e) {}
    }
    return st;
  }
  function onCheckoutClick(e) {
    var t = e.target;
    if (!t || !t.closest) { return; }
    var hit = t.closest('#CheckOut, [name="checkout"], .shopify-payment-button, [data-shopify="payment-button"], .additional-checkout-buttons, [data-ganguram-checkout]');
    if (!hit) { return; }
    if (isBlocked()) { e.preventDefault(); e.stopPropagation(); handleBlocked(); }
  }
  function onCartSubmit(e) {
    var f = e.target;
    if (f && f.id === 'cart' && isBlocked()) { e.preventDefault(); e.stopPropagation(); handleBlocked(); }
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
    window.addEventListener('ganguram:four-hour-window-changed', renderAll);  // Phase 2: 4HR opens/closes
    document.addEventListener('click', onCheckoutClick, true);
    document.addEventListener('submit', onCartSubmit, true);
  }

  function hasInvalidItems() { var st = computeState(); return !!(st && st.hasInvalid); }
  // DEV-ONLY diagnostics (console) — why the MOV bar / panel does or doesn't show. The MOV
  // value itself comes from the metaobject delivery rule (unchanged); this only reports it.
  function debugState() {
    var loc = null; try { loc = zone() && zone().getSelectedDeliveryLocation(); } catch (e) {}
    var panels2 = panels();
    var barEls = document.querySelectorAll('[data-gdpr-bar]');
    var st = computeState();
    if (!st) {
      return { panelVisible: false, reason: 'no metaobject delivery rule resolved / no serviceable pincode / empty cart',
        selectedPincode: (loc && loc.pincode) || null, panelsOnPage: panels2.length, movBarElementsOnPage: barEls.length, movBarVisible: false };
    }
    if (st.promptCode) { return { panelVisible: true, state: 'prompt', promptCode: st.promptCode, movBarVisible: false, panelsOnPage: panels2.length }; }
    if (st.hasInvalid) { return { panelVisible: true, state: 'invalid', invalidItems: st.invalidItems, movBarVisible: false, panelsOnPage: panels2.length }; }
    var fhEval = (window.GanguramFourHour && typeof window.GanguramFourHour.evaluate === 'function') ? window.GanguramFourHour.evaluate() : null;
    return {
      panelVisible: true, state: st.blocked ? 'blocked' : 'ok',
      selectedPincode: st.pincode || null,
      subtotal: st.subtotal,
      mov: (st.mov != null) ? st.mov : null,
      movMet: !!st.movMet,
      movRemaining: (st.movRemaining != null) ? st.movRemaining : null,
      ruleReason: (st.data && st.data.reason) || 'none',
      // movSource explains WHY the bar is / isn't there: 'rule' = MOV from the metaobject rule;
      // 'fallback' = the display-only fallbackMov; 'none' = no MOV anywhere -> bar hidden. If you
      // expect a bar but see 'none', set a Minimum order value on the matching delivery rule (or
      // set GanguramDeliveryProgressConfig.fallbackMov for a display-only bar).
      movSource: st.movSource || 'none',
      movDisplayOnly: !!st.movDisplayOnly,
      movBarVisible: st.mov != null,            // the bar renders whenever a MOV applies
      panelsOnPage: panels2.length,
      movBarElementsOnPage: barEls.length,
      estimate: st.estimate ? st.estimate.text : null,
      // Phase 2 — 4HR time-window state (so the cart panel + the evaluator agree)
      fourHourAvailable: !!st.fourHourAvailable,
      fourHour: fhEval ? {
        finalFourHourVisible: fhEval.visible, hiddenReason: fhEval.hiddenReason || '(visible)',
        currentKolkataTime: fhEval.currentKolkataTime, isWithinFourHourTimeWindow: fhEval.withinTime
      } : '(no evaluator)'
    };
  }
  window.GanguramDeliveryProgress = { render: renderAll, isCheckoutBlocked: isBlocked, hasInvalidItems: hasInvalidItems, debugState: debugState };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
