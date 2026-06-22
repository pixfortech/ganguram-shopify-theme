/*
 * Ganguram — Cart minimum-order-value (MOV) resolver  (distance-based slabs)
 * ---------------------------------------------------------------------------
 * The SINGLE source of truth for "what is the minimum order value for this cart, and is it met?".
 * The cart progress bar (drawer + page) and the 4-Hour evaluator both consult it, so they can
 * never disagree. Display / advisory only — it does not change ShipZip rates, the Standard
 * shipping slabs, the 4HR/STD service codes, pincode eligibility, product visibility, the Custom
 * Box Builder, or discounts. It never mutates the cart.
 *
 * The MOV scales with DELIVERY DISTANCE using the SAME distance the Standard shipping estimate
 * uses: the confirmed full-address route distance (biased up by the same slabSafetyMarginKm) or
 * the pincode-area upper bound, matched to the SAME slab boundaries (GanguramShippingEstimate's
 * standardSlabs — 0–5 / 5.01–10 / 10.01–15 / 15.01–20 km). Each slab maps to an admin-configured
 * MOV (Theme settings → "Ganguram — Cart delivery & MOV bar").
 *
 * Resolution priority (resolve()):
 *   A. rule    — the matched `ganguram_delivery_rule` metaobject's Minimum order value (already
 *                distance-resolved by the rule engine). Always honoured (it is the merchant's rule).
 *   B. distance_slab — the theme distance MOV slab for the route distance (local zones only).
 *   C. fallback — a flat MOV used only when no distance is available.
 *   D. none    — nothing applies → no bar.
 * PAN India never uses local distance slabs (optional separate PAN India MOV). Beyond the local
 * radius → no local MOV.
 *
 * config: window.GanguramCartMovConfig (published from theme settings). Fail-safe: with no estimate
 * / no distance / no config it degrades to rule-only or none, never throwing. No jQuery.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramCartMov) { return; }

  function cfg() { return window.GanguramCartMovConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function blocksEnabled() { return cfg().blocks === true; }
  function paiseOrNull(v) { var n = parseInt(v, 10); return (isFinite(n) && n > 0) ? n : null; }
  function slabsPaise() {
    var a = cfg().slabsPaise;
    return Array.isArray(a) ? a.map(function (x) { var n = parseInt(x, 10); return (isFinite(n) && n > 0) ? n : null; }) : [];
  }
  function panMov() { return paiseOrNull(cfg().panIndiaPaise); }
  function fallbackMov() { return paiseOrNull(cfg().fallbackPaise); }

  function se() { return window.GanguramShippingEstimate || null; }
  function gd() { return window.GanguramDistance || null; }
  function isPanIndia(loc) { return !!(loc && (loc.zone === 'pan_india' || loc.isPanIndia === true)); }
  function isLocal(loc) { return !!(loc && (loc.zone === 'kolkata' || loc.zone === 'quick_commerce' || loc.isKolkata === true || loc.isQuickCommerce === true)); }
  function round1(km) { return (km == null) ? null : Math.round(km * 10) / 10; }

  // Route distance for the MOV — the SAME value the Standard estimate uses: a confirmed
  // full-address distance (biased up by slabSafetyMarginKm) or the pincode-area upper bound.
  // Returns { km, adjustedKm, basis } or null (no distance yet -> caller falls to fallback).
  function routeDistance(location, ctx) {
    ctx = ctx || {};
    var s = se();
    var adj = function (km) { return (s && typeof s.slabInputKm === 'function') ? s.slabInputKm(km) : km; };
    if (ctx.confirmed && ctx.distanceKm != null) { return { km: ctx.distanceKm, adjustedKm: adj(ctx.distanceKm), basis: 'address' }; }
    var d = gd(); if (!d || !location) { return null; }
    if (typeof d.getForPincode === 'function') {
      var conf = d.getForPincode(location.pincode);
      if (conf && conf.confirmed && conf.distanceKm != null) { return { km: conf.distanceKm, adjustedKm: adj(conf.distanceKm), basis: 'address' }; }
    }
    if (typeof d.getAreaRangeForPincode === 'function') {
      var ar = d.getAreaRangeForPincode(location.pincode);
      if (ar && ar.maxKm != null) { return { km: ar.maxKm, adjustedKm: ar.maxKm, basis: 'pincode_area' }; } // range already brackets uncertainty (no extra margin)
    }
    return null;
  }

  // Human label for a slab index, from the SAME standardSlabs the estimate uses (e.g. "10.01–15 km").
  function slabLabel(index) {
    var s = se(); if (!s || typeof s.config !== 'function') { return 'slab ' + (index + 1); }
    var slabs = (s.config().standardSlabs) || [];
    if (!slabs[index]) { return 'slab ' + (index + 1); }
    var hi = slabs[index].maxKm;
    var lo = (index === 0) ? 0 : slabs[index - 1].maxKm;
    return (index === 0 ? ('0–' + hi) : ((lo + 0.01) + '–' + hi)) + ' km';
  }

  // The distance MOV slab (local zones only). null when: no estimate, no MOV slabs configured,
  // no distance available, or the distance is beyond the local radius (the "beyond" slab).
  function distanceSlab(location, ctx) {
    var s = se(); if (!s || typeof s.slabForKm !== 'function') { return null; }
    var movs = slabsPaise(); if (!movs.length) { return null; }
    var rd = routeDistance(location, ctx); if (!rd) { return null; }
    var slab = s.slabForKm(rd.adjustedKm); if (!slab) { return null; }
    if (slab.beyond) { return null; }                          // outside local radius -> no local MOV
    var idx = (slab.index >= movs.length) ? (movs.length - 1) : slab.index;
    var mov = movs[idx]; if (mov == null) { return null; }
    return { mov: mov, index: slab.index, label: slabLabel(slab.index), km: rd.km, adjustedKm: rd.adjustedKm, basis: rd.basis };
  }

  // Priority A: the rule MOV. Reuse the caller's already-resolved value when given (no double work).
  function ruleMov(location, ctx) {
    ctx = ctx || {};
    if (ctx.ruleMov != null) { return { mov: ctx.ruleMov, met: ctx.ruleMovMet === true }; }
    var dr = window.GanguramDeliveryRules;
    if (!dr || typeof dr.getProgressData !== 'function' || !location) { return { mov: null }; }
    try {
      var opts = (ctx.confirmed && ctx.distanceKm != null) ? { distanceKm: ctx.distanceKm } : {};
      var data = dr.getProgressData(ctx.subtotal || 0, location, opts);
      return (data && data.mov != null) ? { mov: data.mov, met: data.movMet === true } : { mov: null };
    } catch (e) { return { mov: null }; }
  }

  function finalize(out, sub, isRule) {
    if (out.mov != null) {
      out.movMet = sub >= out.mov;
      out.amountRemaining = out.movMet ? 0 : (out.mov - sub);
      out.movBarVisible = true;
      // `blocking` = this MOV enforces checkout (and gates 4HR) when unmet. The rule MOV always
      // blocks (the merchant's enforced minimum). The theme MOV (distance / fallback / PAN) blocks
      // ONLY when "Block checkout below MOV" is ticked — otherwise the bar is display-only guidance.
      out.blocking = (isRule === true) || blocksEnabled();
      out.checkoutBlockedByMov = !out.movMet && out.blocking;
    }
    return out;
  }

  // resolve(location, subtotal, ctx?) -> the one MOV decision. ctx may carry the SAME distance the
  // estimate used ({ distanceKm, confirmed }) and the already-resolved rule MOV ({ ruleMov, ruleMovMet }).
  function resolve(location, subtotal, ctx) {
    ctx = ctx || {}; var sub = (subtotal != null && subtotal >= 0) ? subtotal : 0; ctx.subtotal = sub;
    var out = { mov: null, movSource: 'none', matchedMovSlab: null, routeDistanceKm: null,
      cartSubtotal: sub, movMet: true, amountRemaining: 0, movBarVisible: false, checkoutBlockedByMov: false, blocksEnabled: blocksEnabled() };
    if (!location || location.isServiceable !== true) { return out; }

    // A. rule MOV — honoured even when the bar feature is off (merchant's rule + guard).
    var rm = ruleMov(location, ctx);
    if (rm.mov != null) { out.mov = rm.mov; out.movSource = 'rule'; return finalize(out, sub, true); }

    if (!enabled()) { return out; } // feature off -> only the rule MOV above applies

    // PAN India: never local slabs; optional separate PAN India MOV.
    if (isPanIndia(location) && !isLocal(location)) {
      var pan = panMov();
      if (pan != null) { out.mov = pan; out.movSource = 'pan_india'; return finalize(out, sub, false); }
      return out; // hidden
    }
    // B. distance slab (local).
    var ds = distanceSlab(location, ctx);
    if (ds) { out.mov = ds.mov; out.movSource = 'distance_slab'; out.matchedMovSlab = ds.label; out.routeDistanceKm = round1(ds.km); return finalize(out, sub, false); }
    // C. fallback — only when no distance was available.
    var fb = fallbackMov();
    if (fb != null) { out.mov = fb; out.movSource = 'fallback'; return finalize(out, sub, false); }
    // D. none.
    return out;
  }

  function zoneLoc() {
    var z = window.GanguramZone;
    try { return (z && typeof z.getSelectedDeliveryLocation === 'function') ? z.getSelectedDeliveryLocation() : null; } catch (e) { return null; }
  }
  function domSubtotal() {
    var els = document.querySelectorAll('[data-gdpr-cart-total]');
    for (var i = 0; i < els.length; i++) { var v = parseInt(els[i].getAttribute('data-gdpr-cart-total'), 10); if (isFinite(v) && v >= 0) { return v; } }
    return 0;
  }

  window.GanguramCartMov = {
    resolve: resolve,
    slabLabel: slabLabel,
    // DEV-ONLY diagnostics (console). Resolves for the live cart + selected location.
    debugState: function () {
      var loc = zoneLoc();
      var r = resolve(loc, domSubtotal());
      return {
        selectedPincode: (loc && loc.pincode) || null,
        zone: (loc && loc.zone) || null,
        enabled: enabled(),
        slabsPaise: slabsPaise(),
        routeDistanceKm: r.routeDistanceKm,
        movSource: r.movSource,
        matchedMovSlab: r.matchedMovSlab,
        mov: r.mov,
        cartSubtotal: r.cartSubtotal,
        amountRemaining: r.amountRemaining,
        movMet: r.movMet,
        movBarVisible: r.movBarVisible,
        blocksEnabled: r.blocksEnabled,
        checkoutBlockedByMov: r.checkoutBlockedByMov
      };
    }
  };
})();
