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
      distanceRangeLabel: 'Approx. distance:',
      slabRangeLabel: 'Standard slab:',
      fourHourDetailLabel: '4 Hours:',
      finalAtCheckout: 'Final charge confirmed at checkout.'
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
  // Cart four-hour eligibility from the cart-line DOM; with NO cart we show the
  // AREA capability (true) so the popup estimate reflects what the pincode supports.
  function cartFourHourEligible() {
    var lines = document.querySelectorAll('[data-ganguram-cart-line]');
    if (!lines.length) { return true; }
    for (var i = 0; i < lines.length; i++) { if (String(lines[i].getAttribute('data-ganguram-quick-commerce')) !== 'true') { return false; } }
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
    var approx = (d && typeof d.getApproxForPincode === 'function') ? d.getApproxForPincode(loc.pincode) : null;

    // Distance: a selected address uses the CONFIRMED driving distance (exact); a
    // pincode uses the approximate centroid distance. Kick off whichever is missing.
    var distanceKm = null, distanceApprox = false;
    if (isAddress) {
      if (conf.confirmed) { distanceKm = conf.distanceKm; distanceApprox = false; }
      // the confirmed compute is triggered by the places module on selection.
    } else {
      if (approx) { distanceKm = approx.distanceKm; distanceApprox = true; }
      else if (d && typeof d.computeApproxForPincode === 'function') { try { d.computeApproxForPincode(loc.pincode); } catch (e) {} }
    }

    // Only a CONFIRMED (address) distance feeds the rules' distance slabs.
    var distOpts = conf.confirmed ? { distanceKm: conf.distanceKm } : {};
    var ct = cartTotalPaise();
    var data = dr ? dr.getProgressData(ct == null ? 0 : ct, loc, distOpts) : null;
    var hasRule = !!(data && data.reason !== 'none' && data.rule);

    var eligibleCart = cartFourHourEligible();
    var svcOpts = { fourHourEligibleCart: eligibleCart };
    if (distOpts.distanceKm != null) { svcOpts.distanceKm = distOpts.distanceKm; }
    var svc = (dr && hasRule) ? dr.getServiceOptions(loc, svcOpts) : null;
    var serviceOptions = (svc && svc.options) || [];

    // 4-hour from the quick-commerce ZONE (matches the cart + ShipZip, Phase 2.11F.3),
    // not just a metaobject rule — so the popup doesn't contradict checkout either.
    var fourHourArea = !!(loc.isQuickCommerce === true || loc.zone === 'quick_commerce');
    var hasFourOpt = false;
    for (var i = 0; i < serviceOptions.length; i++) { if (serviceOptions[i].serviceType === 'four_hour') { hasFourOpt = true; break; } }
    var fourHourAvailable = (eligibleCart && fourHourArea) || hasFourOpt;

    // --- Phase 2.11I: distance-based Standard + 4-hour ESTIMATE -----------------
    // Local zones only (Kolkata / quick-commerce) have the local km slabs; a PAN India
    // pincode keeps the "final charge at checkout" wording. A selected full address uses
    // its CONFIRMED single distance; a pincode uses the sampled area MIN/MAX range. Pure
    // mapping comes from GanguramShippingEstimate (config-driven). ESTIMATE / display only.
    var se = window.GanguramShippingEstimate;
    var isLocal = !!(loc.isKolkata === true || loc.zone === 'kolkata' || loc.zone === 'quick_commerce');
    var estimate = null;
    if (se && isLocal) {
      if (isAddress && conf.confirmed) {
        var akm = conf.distanceKm;
        estimate = { basis: 'address', minKm: akm, maxKm: akm, standard: se.standardForKm(akm), four: se.fourHourForRange(akm, akm, true) };
      } else if (!isAddress) {
        var range = (d && typeof d.getAreaRangeForPincode === 'function') ? d.getAreaRangeForPincode(loc.pincode) : null;
        if (range) {
          estimate = { basis: 'area', minKm: range.minKm, maxKm: range.maxKm, standard: se.standardForRange(range.minKm, range.maxKm), four: se.fourHourForRange(range.minKm, range.maxKm, false) };
        } else if (d && typeof d.computeAreaRangeForPincode === 'function') {
          try { d.computeAreaRangeForPincode(loc.pincode); } catch (e) {} // async -> fires event -> re-render
        }
      }
    }

    return {
      label: displayLabel(loc),
      pincode: loc.pincode,
      isAddress: isAddress,
      isLocal: isLocal,
      estimate: estimate,
      distanceKm: distanceKm, approximate: distanceApprox,
      hasRule: hasRule,
      fourHourAvailable: fourHourAvailable, hasFourOpt: hasFourOpt,
      mov: hasRule ? data.mov : null,
      movMet: hasRule ? (data.movMet === true) : true,
      movRemaining: hasRule ? data.movRemaining : 0,
      freeDeliveryMet: hasRule ? data.freeDeliveryMet : false,
      cartTotal: ct,
      serviceOptions: serviceOptions
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

  function renderCard(card, st) {
    var body = card.querySelector('[data-gde-body]');
    var titleEl = card.querySelector('[data-gde-title]');
    if (!st || !body) { hide(card); return; }
    if (titleEl) { setText(titleEl, copy('title')); }
    body.textContent = '';
    var se = window.GanguramShippingEstimate;
    var est = st.estimate, standardShown = false, fourShown = false;

    var status = document.createElement('p'); status.className = 'ganguram-delivery-estimate__status'; status.textContent = copy('statusAvailable'); body.appendChild(status);
    if (st.label) { body.appendChild(row(copy('locationLabel'), st.label)); }

    // --- prominent Standard estimate (local zone with a computed distance) ---
    if (est && est.standard && se) {
      var rangeText = se.formatRange(est.standard.minPrice, est.standard.maxPrice) + (est.standard.beyond ? '+' : '');
      body.appendChild(strong(copy('standardEstimateLabel') + ' ' + rangeText));
      standardShown = true;
    }

    // --- 4-hour line (only when the zone + cart make it eligible) ---
    if (st.fourHourAvailable) {
      if (est && est.four) {
        if (est.four.state === 'yes') { body.appendChild(strong(tmpl(copy('fourHourFlat'), { price: se.money(est.four.price) }))); fourShown = true; }
        else if (est.four.state === 'maybe') { body.appendChild(noteEl(copy('fourHourMaybe'))); fourShown = true; }
        // 'no' -> hide (conservative; never over-promise 4-hour vs checkout)
      } else if (se) {
        body.appendChild(strong(tmpl(copy('fourHourFlat'), { price: se.money(se.config().fourHour.flatPrice) }))); fourShown = true;
      }
    }

    // --- fallback: no distance estimate -> existing per-mode rows ("final at checkout") ---
    if (!standardShown) {
      for (var i = 0; i < st.serviceOptions.length; i++) {
        var o = st.serviceOptions[i];
        var name = o.serviceLabel || (o.serviceType === 'four_hour' ? copy('fourHourLabel') : copy('standardLabel'));
        var chg = (st.freeDeliveryMet && o.serviceType !== 'four_hour') ? copy('freeDelivery')
          : (o.deliveryCharge == null) ? copy('chargeAtCheckout')
          : (o.deliveryCharge === 0 ? copy('freeDelivery') : fmtMoney(o.deliveryCharge));
        body.appendChild(row(name, chg));
      }
      if (st.fourHourAvailable && !st.hasFourOpt && !fourShown) { body.appendChild(row(copy('fourHourLabel'), copy('chargeAtCheckout'))); }
    }

    // --- based-on note ---
    if (est && est.basis === 'area') { body.appendChild(noteEl(tmpl(copy('basedOnArea'), { pincode: st.pincode }))); }
    else if (est && est.basis === 'address') { body.appendChild(noteEl(copy('basedOnAddressEstimate'))); }
    else { body.appendChild(noteEl(st.isAddress ? copy('basedOnAddress') : copy('basedOnPincode'))); }

    // --- "Delivery details" accordion (keeps the main card compact) ---
    if (est || st.mov != null || st.cartTotal != null) {
      var det = document.createElement('details'); det.className = 'ganguram-delivery-estimate__details';
      var sum = document.createElement('summary'); sum.className = 'ganguram-delivery-estimate__details-summary'; sum.textContent = copy('detailsTitle'); det.appendChild(sum);
      var dbody = document.createElement('div'); dbody.className = 'ganguram-delivery-estimate__details-body'; det.appendChild(dbody);
      if (st.pincode) { dbody.appendChild(row(copy('pincodeLabel'), st.pincode)); }
      if (est) {
        dbody.appendChild(row(copy('estimateTypeLabel'), est.basis === 'address' ? copy('estimateTypeAddress') : copy('estimateTypeArea')));
        dbody.appendChild(row(copy('distanceRangeLabel'), fmtKmRange(est.minKm, est.maxKm)));
        if (est.standard) { dbody.appendChild(row(copy('slabRangeLabel'), se.formatRange(est.standard.minPrice, est.standard.maxPrice) + (est.standard.beyond ? '+' : ''))); }
        if (st.fourHourAvailable && est.four) {
          var fourTxt = est.four.state === 'yes' ? se.money(est.four.price)
            : est.four.state === 'maybe' ? copy('fourHourMaybe')
            : copy('fourHourNotForDistance');
          dbody.appendChild(row(copy('fourHourDetailLabel'), fourTxt));
        }
      }
      if (st.mov != null) { dbody.appendChild(row(copy('movLabel'), fmtMoney(st.mov))); }
      if (st.cartTotal != null) { dbody.appendChild(row(copy('cartValueLabel'), fmtMoney(st.cartTotal))); }
      if (st.mov != null && !st.movMet && st.cartTotal != null) { dbody.appendChild(row(copy('remainingLabel'), fmtMoney(st.movRemaining))); }
      var fin = document.createElement('p'); fin.className = 'ganguram-delivery-estimate__details-note'; fin.textContent = copy('finalAtCheckout'); dbody.appendChild(fin);
      body.appendChild(det);
    }

    card.setAttribute('data-gde-basis', st.isAddress ? 'address' : 'pincode');
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

  window.GanguramDeliveryEstimate = { render: render, compute: compute };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
