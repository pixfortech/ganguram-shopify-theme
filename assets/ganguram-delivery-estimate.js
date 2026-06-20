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
      distanceApprox: 'Approx. __KM__ km',
      distanceExact: '__KM__ km',
      distanceApproxNote: 'Approx. distance based on pincode',
      movLabel: 'Minimum order:',
      cartValueLabel: 'Cart value:',
      remainingLabel: 'Add to continue:',
      chargeLabel: 'Delivery charge:',
      chargeAtCheckout: 'Final charge at checkout',
      freeDelivery: 'Free delivery',
      modesLabel: 'Available:',
      standardLabel: 'Standard',
      fourHourLabel: '4 Hours'
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

    var d = dist();
    var est = (d && typeof d.getEstimate === 'function') ? d.getEstimate(loc.pincode) : { distanceKm: null, approximate: false, confirmed: false };
    // No distance yet -> kick off the approximate pincode-centroid geocode (re-renders on event).
    if (d && est.distanceKm == null && typeof d.computeApproxForPincode === 'function') {
      try { d.computeApproxForPincode(loc.pincode); } catch (e) {}
    }
    var distOpts = (est.confirmed && est.distanceKm != null) ? { distanceKm: est.distanceKm } : {};

    var ct = cartTotalPaise();
    var data = dr ? dr.getProgressData(ct == null ? 0 : ct, loc, distOpts) : null;
    var hasRule = !!(data && data.reason !== 'none' && data.rule);

    var svcOpts = { fourHourEligibleCart: cartFourHourEligible() };
    if (distOpts.distanceKm != null) { svcOpts.distanceKm = distOpts.distanceKm; }
    var svc = (dr && hasRule) ? dr.getServiceOptions(loc, svcOpts) : null;

    return {
      label: displayLabel(loc),
      distanceKm: est.distanceKm, approximate: est.approximate, confirmed: est.confirmed,
      hasRule: hasRule,
      mov: hasRule ? data.mov : null,
      movMet: hasRule ? (data.movMet === true) : true,
      movRemaining: hasRule ? data.movRemaining : 0,
      deliveryCharge: hasRule ? data.deliveryCharge : null,
      freeDeliveryMet: hasRule ? data.freeDeliveryMet : false,
      cartTotal: ct,
      serviceOptions: (svc && svc.options) || []
    };
  }

  function row(label, value) {
    var r = document.createElement('div'); r.className = 'ganguram-delivery-estimate__row';
    var l = document.createElement('span'); l.className = 'ganguram-delivery-estimate__label'; l.textContent = label;
    var v = document.createElement('span'); v.className = 'ganguram-delivery-estimate__value'; v.textContent = (value == null ? '' : value);
    r.appendChild(l); r.appendChild(v); return r;
  }

  function renderCard(card, st) {
    var body = card.querySelector('[data-gde-body]');
    var titleEl = card.querySelector('[data-gde-title]');
    if (!st || !body) { hide(card); return; }
    if (titleEl) { setText(titleEl, copy('title')); }
    body.textContent = '';

    var status = document.createElement('p'); status.className = 'ganguram-delivery-estimate__status'; status.textContent = copy('statusAvailable'); body.appendChild(status);
    if (st.label) { body.appendChild(row(copy('locationLabel'), st.label)); }
    if (st.distanceKm != null) {
      var km = Math.round(st.distanceKm * 10) / 10;
      var dval = st.approximate ? tmpl(copy('distanceApprox'), { km: km }) : tmpl(copy('distanceExact'), { km: km });
      body.appendChild(row(copy('distanceLabel'), dval));
    }
    if (st.mov != null) { body.appendChild(row(copy('movLabel'), fmtMoney(st.mov))); }
    if (st.cartTotal != null) { body.appendChild(row(copy('cartValueLabel'), fmtMoney(st.cartTotal))); }
    if (st.mov != null && !st.movMet && st.cartTotal != null) { body.appendChild(row(copy('remainingLabel'), fmtMoney(st.movRemaining))); }
    if (st.hasRule) {
      var chargeVal = st.freeDeliveryMet ? copy('freeDelivery')
        : (st.deliveryCharge == null) ? copy('chargeAtCheckout')
        : (st.deliveryCharge === 0 ? copy('freeDelivery') : fmtMoney(st.deliveryCharge));
      body.appendChild(row(copy('chargeLabel'), chargeVal));
    }
    // available modes (chips)
    if (st.serviceOptions.length) {
      var modesWrap = document.createElement('div'); modesWrap.className = 'ganguram-delivery-estimate__modes';
      var lbl = document.createElement('span'); lbl.className = 'ganguram-delivery-estimate__label'; lbl.textContent = copy('modesLabel'); modesWrap.appendChild(lbl);
      for (var i = 0; i < st.serviceOptions.length; i++) {
        var o = st.serviceOptions[i];
        var chip = document.createElement('span'); chip.className = 'ganguram-delivery-estimate__chip';
        chip.textContent = o.serviceLabel || (o.serviceType === 'four_hour' ? copy('fourHourLabel') : copy('standardLabel'));
        modesWrap.appendChild(chip);
      }
      body.appendChild(modesWrap);
    }
    var note = document.createElement('p'); note.className = 'ganguram-delivery-estimate__note';
    var basis = st.confirmed ? copy('basedOnAddress') : copy('basedOnPincode');
    if (st.approximate && st.distanceKm != null) { basis += ' ' + copy('distanceApproxNote') + '.'; }
    note.textContent = basis; body.appendChild(note);

    card.setAttribute('data-gde-basis', st.confirmed ? 'address' : 'pincode');
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
