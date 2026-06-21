/*
 * Ganguram — Delivery estimate card for the delivery-location popup (Phase 2.11F.1)
 * ---------------------------------------------------------------------------
 * Moves the delivery EXPLANATION out of the cart and into the popup. After a pincode
 * or full address is resolved, it renders a compact estimate into
 * [data-ganguram-delivery-estimate]: status, city/pincode, an APPROXIMATE distance
 * (pincode centroid via Google) or a confirmed one (full address), minimum order,
 * cart value + remaining (when a cart exists), the delivery-charge estimate, and the
 * available modes (Standard / 4 Hours).
 *
 * Source of truth: GanguramZone (location) + GanguramDeliveryRules (MOV/charge/modes).
 * Google distance is a SUPPORTING estimate only — labelled "approximate" for a
 * pincode — and NEVER overrides ShipZip / pincode / zone business rules or the
 * checkout shipping rate. Display only; fully fail-open (no rules / no Google / any
 * error -> the card just shows what it can, or hides). No checkout / ShipZip / SBZ /
 * zipLogic / resolver / settings_data change.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramDeliveryEstimateInit) { return; }
  window.__ganguramDeliveryEstimateInit = true;

  function cfg() { return window.GanguramDeliveryEstimateConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function copy(key) {
    var c = cfg().copy || {};
    var d = {
      title: 'Delivery estimate',
      statusAvailable: 'Delivery available',
      basedOnPincode: 'Delivery estimate based on your pincode.',
      basedOnAddress: 'Delivery estimate based on your selected address.',
      locationLabel: 'Location:',
      distanceLabel: 'Distance:',
      distanceFromDispatch: '__KM__ km from our dispatch location',
      distanceApproxLine: 'Approx. __KM__ km · based on your pincode',
      movLabel: 'Minimum order:',
      cartValueLabel: 'Cart value:',
      remainingLabel: 'Add to continue:',
      chargeLabel: 'Delivery charge:',
      chargeAtCheckout: 'Final charge at checkout',
      freeDelivery: 'Free delivery',
      modesLabel: 'Available:',
      standardLabel: 'Standard',
      fourHourLabel: '4 Hours',
      // Phase 2.11I — distance-based estimate copy
      standardEstimateLabel: 'Standard shipping estimate:',
      basedOnArea: 'Based on the delivery area for __PINCODE__. Final charge confirmed at checkout.',
      basedOnAddressEstimate: 'Based on your selected address. Final charge confirmed at checkout.',
      fourHourFlat: '4 Hours: __PRICE__',
      fourHourMaybe: '4 Hours may be available for some addresses in this pincode. Enter your full address to confirm.',
      fourHourNotForDistance: 'Not available for this distance',
      detailsTitle: 'Delivery details',
      pincodeLabel: 'Pincode:',
      estimateTypeLabel: 'Estimate type:',
      estimateTypeArea: 'Pincode area',
      estimateTypeAddress: 'Selected address',
      estimateTypePan: 'PAN India weight',
      distanceRangeLabel: 'Approx. distance:',
      slabRangeLabel: 'Standard slab:',
      fourHourDetailLabel: '4 Hours:',
      finalAtCheckout: 'Final charge confirmed at checkout.',
      calculating: 'Calculating delivery estimate…',
      notAvailableHere: 'Some items in your cart can’t be delivered to this address.',
      // Phase 2.11J — PAN India weight estimate
      panIndiaEstimateLabel: 'PAN India shipping estimate:',
      panIndiaFrom: 'PAN India shipping starts from __PRICE__ per __UNIT__.',
      panIndiaBasedOn: 'Based on cart weight. Final charge confirmed at checkout.',
      weightLabel: 'Total weight:',
      panIndiaRateLabel: 'Rate:',
      panIndiaRateValue: '__PRICE__ per __UNIT__'
    };
    return (c[key] != null) ? String(c[key]) : d[key];
  }
  function tmpl(s, vars) {
    s = String(s == null ? '' : s); vars = vars || {};
    return s.replace(/__([A-Z0-9]+)__/g, function (_, k) { var kk = k.toLowerCase(); return (vars[kk] != null) ? vars[kk] : ''; });
  }

  function rules() { return window.GanguramDeliveryRules || null; }
  function zone() { return window.GanguramZone || null; }
  function dist() { return window.GanguramDistance || null; }
  function fmtMoney(p) { var r = rules(); return (r && typeof r.formatMoney === 'function') ? r.formatMoney(p) : ''; }
  function displayLabel(loc) {
    var dl = window.GanguramDisplayLabel;
    if (dl && typeof dl.get === 'function') { try { var l = dl.get(loc); if (l) { return l; } } catch (e) {} }
    return (loc && loc.pincode) ? String(loc.pincode) : '';
  }
  function cards() { return document.querySelectorAll('[data-ganguram-delivery-estimate]'); }
  function show(el) { if (el) { el.removeAttribute('hidden'); } }
  function hide(el) { if (el) { el.setAttribute('hidden', 'hidden'); } }
  function setText(el, t) { if (el) { el.textContent = (t == null ? '' : t); } }

  function cartTotalPaise() {
    var els = document.querySelectorAll('[data-gdpr-cart-total]');
    for (var i = 0; i < els.length; i++) { var v = parseInt(els[i].getAttribute('data-gdpr-cart-total'), 10); if (isFinite(v) && v >= 0) { return v; } }
    return null;
  }
  // Total Shopify cart weight in GRAMS (data-gdpr-cart-weight, from cart.total_weight).
  // null when no cart surface is present (empty cart) -> PAN India "starts from" wording.
  function cartWeightGrams() {
    var els = document.querySelectorAll('[data-gdpr-cart-weight]');
    for (var i = 0; i < els.length; i++) { var v = parseInt(els[i].getAttribute('data-gdpr-cart-weight'), 10); if (isFinite(v) && v >= 0) { return v; } }
    return null;
  }
  // Cart four-hour eligibility from the cart-line DOM; with NO cart we show the
  // AREA capability (true) so the popup estimate reflects what the pincode supports.
  function cartFourHourEligible() {
    var lines = document.querySelectorAll('[data-ganguram-cart-line]');
    if (!lines.length) { return true; }
    for (var i = 0; i < lines.length; i++) { if (String(lines[i].getAttribute('data-ganguram-quick-commerce')) !== 'true') { return false; } }
    return true;
  }
  // Cart is PAN-India-eligible only if EVERY line carries the PAN India tag (else a
  // local-only item is in the cart). Empty cart -> true (capability).
  function cartPanIndiaEligible() {
    var lines = document.querySelectorAll('[data-ganguram-cart-line]');
    if (!lines.length) { return true; }
    for (var i = 0; i < lines.length; i++) { if (String(lines[i].getAttribute('data-ganguram-pan-india')) !== 'true') { return false; } }
    return true;
  }

  function compute() {
    if (!enabled()) { return null; }
    var z = zone(), dr = rules();
    var loc; try { loc = z && z.getSelectedDeliveryLocation(); } catch (e) { return null; }
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }

    // BASIS comes from the SELECTED-ADDRESS store (2.11F.2 root-cause fix), NOT from
    // whether a distance could be computed. A selected Google address -> address basis
    // even if the Distance Matrix call hasn't returned / failed.
    var ga = window.GanguramAddress;
    var addr = (ga && typeof ga.getSelectedAddress === 'function') ? ga.getSelectedAddress() : null;
    var isAddress = !!(addr && addr.source === 'selected_address');

    var d = dist();
    var conf = (d && typeof d.getForPincode === 'function') ? d.getForPincode(loc.pincode) : { distanceKm: null, confirmed: false };

    // MOV / cart value come from the metaobject rules (unchanged); only the slab is refined
    // by a confirmed distance. The delivery MODE comes from resolveDeliveryState below.
    var distOpts = conf.confirmed ? { distanceKm: conf.distanceKm } : {};
    var ct = cartTotalPaise();
    var data = dr ? dr.getProgressData(ct == null ? 0 : ct, loc, distOpts) : null;
    var hasRule = !!(data && data.reason !== 'none' && data.rule);

    // --- Phase 2.12D: ONE consistent, DISTANCE-FIRST delivery state -------------
    // local vs PAN India is decided by the route distance (full address) / sampled area
    // range (pincode), NOT by the pincode zone or a product's PAN India tag. The popup and
    // the cart both render from this, so they can never disagree. ESTIMATE / display only.
    var se = window.GanguramShippingEstimate;
    var areaRange = (!isAddress && d && typeof d.getAreaRangeForPincode === 'function') ? d.getAreaRangeForPincode(loc.pincode) : null;
    var delivery = (se && typeof se.resolveDeliveryState === 'function') ? se.resolveDeliveryState({
      isAddress: isAddress,
      distanceKm: conf.confirmed ? conf.distanceKm : null,
      areaRange: areaRange,
      zone: loc.zone,
      cartWeightGrams: cartWeightGrams(),
      fourHourEligibleCart: cartFourHourEligible(),
      panIndiaEligibleCart: cartPanIndiaEligible()
    }) : null;
    // Kick off the pincode-area sampling when we only have a zone fallback (so 'zone' -> 'area').
    if (!isAddress && delivery && delivery.basis === 'zone' && d && typeof d.computeAreaRangeForPincode === 'function') {
      try { d.computeAreaRangeForPincode(loc.pincode); } catch (e) {}
    }

    return {
      label: displayLabel(loc),
      pincode: loc.pincode,
      isAddress: isAddress,
      addressText: addr ? addr.formatted_address : null,
      latlng: addr ? { lat: addr.lat, lng: addr.lng } : null,
      delivery: delivery,
      mov: hasRule ? data.mov : null,
      movMet: hasRule ? (data.movMet === true) : true,
      movRemaining: hasRule ? data.movRemaining : 0,
      freeDeliveryMet: hasRule ? data.freeDeliveryMet : false,
      cartTotal: ct
    };
  }

  function row(label, value) {
    var r = document.createElement('div'); r.className = 'ganguram-delivery-estimate__row';
    var l = document.createElement('span'); l.className = 'ganguram-delivery-estimate__label'; l.textContent = label;
    var v = document.createElement('span'); v.className = 'ganguram-delivery-estimate__value'; v.textContent = (value == null ? '' : value);
    r.appendChild(l); r.appendChild(v); return r;
  }

  function fmtKmRange(minKm, maxKm) {
    var lo = Math.round(minKm * 10) / 10, hi = Math.round(maxKm * 10) / 10;
    return (lo === hi) ? (lo + ' km') : (lo + '–' + hi + ' km');
  }
  function strong(text) { var p = document.createElement('p'); p.className = 'ganguram-delivery-estimate__estimate'; p.textContent = text; return p; }
  function noteEl(text) { var p = document.createElement('p'); p.className = 'ganguram-delivery-estimate__note'; p.textContent = text; return p; }

  // Renders the ONE resolved delivery state (Phase 2.12D) — local Standard (+ 4 Hours) OR
  // PAN India weight, never both. Same state the cart panel uses, so they always agree.
  function renderCard(card, st) {
    var body = card.querySelector('[data-gde-body]');
    var titleEl = card.querySelector('[data-gde-title]');
    if (!st || !body) { hide(card); return; }
    if (titleEl) { setText(titleEl, copy('title')); }
    body.textContent = '';
    var se = window.GanguramShippingEstimate;
    var del = st.delivery, detailRows = [];

    var status = document.createElement('p'); status.className = 'ganguram-delivery-estimate__status'; status.textContent = copy('statusAvailable'); body.appendChild(status);
    if (st.label) { body.appendChild(row(copy('locationLabel'), st.label)); }

    if (!del || del.mode === 'prompt') { body.appendChild(noteEl(copy('finalAtCheckout'))); card.setAttribute('data-gde-basis', st.isAddress ? 'address' : 'pincode'); show(card); return; }
    if (del.mode === 'pending') { body.appendChild(noteEl(copy('calculating'))); card.setAttribute('data-gde-basis', 'address'); show(card); return; }
    if (del.mode === 'block') { body.appendChild(strong(copy('notAvailableHere'))); card.setAttribute('data-gde-basis', st.isAddress ? 'address' : 'pincode'); show(card); return; }

    if (del.mode === 'pan_india' && se && del.panIndia) {
      var pi = del.panIndia, unit = pi.perWeightG + 'g';
      if (pi.available) { body.appendChild(strong(copy('panIndiaEstimateLabel') + ' ' + se.money(pi.price))); body.appendChild(noteEl(copy('panIndiaBasedOn'))); }
      else { body.appendChild(strong(tmpl(copy('panIndiaFrom'), { price: se.money(pi.fromPrice), unit: unit }))); body.appendChild(noteEl(copy('finalAtCheckout'))); }
      detailRows.push([copy('estimateTypeLabel'), copy('estimateTypePan')]);
      if (pi.grams != null) { detailRows.push([copy('weightLabel'), pi.grams + ' g']); }
      detailRows.push([copy('panIndiaRateLabel'), tmpl(copy('panIndiaRateValue'), { price: se.money(pi.fromPrice), unit: unit })]);
    } else if (del.mode === 'local' && se) {
      if (del.standard) { body.appendChild(strong(copy('standardEstimateLabel') + ' ' + se.formatRange(del.standard.minPrice, del.standard.maxPrice) + (del.standard.beyond ? '+' : ''))); }
      if (del.fourHour) {
        if (del.fourHour.state === 'yes') { body.appendChild(strong(tmpl(copy('fourHourFlat'), { price: se.money(del.fourHour.price) }))); }
        else if (del.fourHour.state === 'maybe') { body.appendChild(noteEl(copy('fourHourMaybe'))); }
        // 'no' -> hidden (conservative; never over-promise 4 Hours)
      }
      body.appendChild(noteEl(del.basis === 'address' ? copy('basedOnAddressEstimate') : tmpl(copy('basedOnArea'), { pincode: st.pincode })));
      if (del.crossesLocal) { body.appendChild(noteEl(copy('fourHourMaybe'))); }
      detailRows.push([copy('estimateTypeLabel'), del.basis === 'address' ? copy('estimateTypeAddress') : copy('estimateTypeArea')]);
      if (del.distanceKm != null) { detailRows.push([copy('distanceRangeLabel'), fmtKmRange(del.distanceKm, del.distanceKm)]); }
      else if (del.range) { detailRows.push([copy('distanceRangeLabel'), fmtKmRange(del.range.minKm, del.range.maxKm)]); }
      if (del.standard) { detailRows.push([copy('slabRangeLabel'), se.formatRange(del.standard.minPrice, del.standard.maxPrice) + (del.standard.beyond ? '+' : '')]); }
      if (del.fourHour) { detailRows.push([copy('fourHourDetailLabel'), del.fourHour.state === 'yes' ? se.money(del.fourHour.price) : del.fourHour.state === 'maybe' ? copy('fourHourMaybe') : copy('fourHourNotForDistance')]); }
    }

    var det = document.createElement('details'); det.className = 'ganguram-delivery-estimate__details';
    var sum = document.createElement('summary'); sum.className = 'ganguram-delivery-estimate__details-summary'; sum.textContent = copy('detailsTitle'); det.appendChild(sum);
    var dbody = document.createElement('div'); dbody.className = 'ganguram-delivery-estimate__details-body'; det.appendChild(dbody);
    if (st.pincode) { dbody.appendChild(row(copy('pincodeLabel'), st.pincode)); }
    detailRows.forEach(function (r) { dbody.appendChild(row(r[0], r[1])); });
    if (st.mov != null) { dbody.appendChild(row(copy('movLabel'), fmtMoney(st.mov))); }
    if (st.cartTotal != null) { dbody.appendChild(row(copy('cartValueLabel'), fmtMoney(st.cartTotal))); }
    if (st.mov != null && !st.movMet && st.cartTotal != null) { dbody.appendChild(row(copy('remainingLabel'), fmtMoney(st.movRemaining))); }
    var fin = document.createElement('p'); fin.className = 'ganguram-delivery-estimate__details-note'; fin.textContent = copy('finalAtCheckout'); dbody.appendChild(fin);
    body.appendChild(det);

    card.setAttribute('data-gde-basis', del.mode === 'pan_india' ? 'pan' : (del.basis === 'address' ? 'address' : 'pincode'));
    show(card);
  }

  function render() {
    var st = compute();
    var list = cards();
    for (var i = 0; i < list.length; i++) { try { renderCard(list[i], st); } catch (e) { hide(list[i]); } }
  }

  function init() {
    render();
    window.addEventListener('ganguram:delivery-location-changed', render);
    window.addEventListener('ganguram:delivery-distance-updated', render);
    window.addEventListener('ganguram:delivery-label-updated', render);
  }

  // DEV-ONLY diagnostics (Phase 2.12D) — never rendered to customers, no console noise.
  // window.GanguramDeliveryEstimate.debugState() reports the selected pincode + address +
  // lat/lng, the route distance, the standard slab, the local/quick flags, PAN-India
  // eligibility, the FINAL mode shown, the reasons PAN India / 4 Hours are or aren't shown,
  // and the distance cache key — so an impossible/wrong state can be pinpointed.
  function debugState() {
    var st = compute();
    var gd = window.GanguramDistance, se = window.GanguramShippingEstimate;
    var dd = (gd && typeof gd.debugState === 'function') ? gd.debugState() : {};
    if (!st) { return { active: false, distance: dd }; }
    var del = st.delivery || {};
    var origin = dd.origin || null;
    var cacheKey = (se && typeof se.areaCacheKey === 'function' && origin) ? se.areaCacheKey(st.pincode, origin) : null;
    // ---- Part A: exact full-address slab math (origin/dest, raw metres+km, padded slab km) ----
    var rawKm = (del.distanceKm != null) ? del.distanceKm : null;
    var slabKm = (del.slabDistanceKm != null) ? del.slabDistanceKm : null;
    var slabSel = (se && slabKm != null && typeof se.slabForKm === 'function') ? se.slabForKm(slabKm) : null;
    var standardEstimate = (se && del.standard && typeof se.formatRange === 'function') ? (se.formatRange(del.standard.minPrice, del.standard.maxPrice) + (del.standard.beyond ? '+' : '')) : null;
    var routeMeters = (dd.lastDistanceMeters != null) ? dd.lastDistanceMeters : (rawKm != null ? Math.round(rawKm * 1000) : null);
    var marginKm = (se && typeof se.config === 'function') ? se.config().slabSafetyMarginKm : null;
    return {
      active: true,
      selectedPincode: st.pincode,
      selectedAddress: st.addressText || null,
      addressLatLng: st.latlng || null,
      // Part A — slab transparency: every value from coordinates to the final Standard estimate.
      originLatLng: origin,
      destLatLng: st.latlng || dd.lastDestCoords || null,
      routeDistanceMeters: routeMeters,
      routeDistanceRawKm: rawKm,
      slabSafetyMarginKm: (marginKm != null) ? marginKm : null,
      slabDistanceKm: slabKm,
      slabSelected: slabSel ? { maxKm: slabSel.maxKm, price: slabSel.price, beyond: slabSel.beyond } : null,
      standardEstimate: standardEstimate,
      localStandardMaxDistanceKm: (del.localStandardMaxDistanceKm != null) ? del.localStandardMaxDistanceKm : null,
      fourHourMaxDistanceKm: (del.fourHourMaxDistanceKm != null) ? del.fourHourMaxDistanceKm : null,
      fourHourEnabled: del.fourHourEnabled !== false,
      selectedDistanceKm: (del.distanceKm != null) ? del.distanceKm : null,
      routeDistanceKm: (del.distanceKm != null) ? del.distanceKm : (del.range || null),
      standardSlab: del.standard || null,
      fourHour: del.fourHour || null,
      panIndia: del.panIndia || null,
      isWithinLocalStandardRadius: !!del.isWithinLocalStandardRadius,
      isWithinFourHourRadius: !!del.isWithinFourHourRadius,
      allItemsQuickCommerce: !!del.allItemsQuickCommerce,
      panIndiaEligible: !!del.panIndiaEligible,
      finalMode: del.mode || 'none',
      basis: del.basis || 'none',
      reasonPanIndia: del.reasonPan || '',
      reasonFourHour: del.reasonFourHour || '',
      cacheKeyUsed: cacheKey,
      routesReason: dd.lastReason || null
    };
  }

  window.GanguramDeliveryEstimate = { render: render, compute: compute, debugState: debugState };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
