/*
 * Ganguram — Shipping ESTIMATE mapping (Phase 2.11I)
 * ---------------------------------------------------------------------------
 * PURE, config-driven mapping of a driving distance (or a pincode-area distance
 * RANGE) to a Standard-delivery charge ESTIMATE, plus a 4-hour eligibility note.
 * This is the ONLY place the local slab table + the 4-hour radius live, so they
 * are trivial to change from the config snippet (window.GanguramEstimateConfig).
 *
 * It is an ESTIMATE / display helper only. It does NOT call Google, touch the
 * cart, or know about ShipZip — ShipZip remains the source of the FINAL checkout
 * rate. No checkout / service-code / MOV / eligibility / visibility change.
 *
 * Slabs are CUMULATIVE upper bounds in km (0–maxKm of slab 0, then up to slab 1…):
 *   0–5 km ₹50 · 5.01–10 km ₹70 · 10.01–15 km ₹100 · 15.01–20 km ₹150.
 * Prices are whole RUPEES (not paise) — this is a customer-facing estimate.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramShippingEstimate) { return; }

  function assign(t) {
    for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; if (s) { for (var k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) { t[k] = s[k]; } } } }
    return t;
  }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  function defaults() {
    return {
      // ShipZip-style LOCAL standard slabs (cumulative km upper bounds).
      standardSlabs: [
        { maxKm: 5, price: 50 },
        { maxKm: 10, price: 70 },
        { maxKm: 15, price: 100 },
        { maxKm: 20, price: 150 }
      ],
      fourHour: { maxDistanceKm: 10, flatPrice: 10 },
      panIndia: { perWeightG: 500, pricePerUnit: 80 },   // ₹80 per 500 g (Part B)
      currencySymbol: '₹',
      rangeSeparator: '–',
      cacheVersion: 1,
      cacheTtlMs: 24 * 60 * 60 * 1000,   // 24h
      sampleEdgeMidpoints: false          // sample 5 points (centre + 4 corners) by default
    };
  }

  // Merge config over defaults. Slabs are sorted ascending by maxKm and validated.
  function config() {
    var d = defaults(), c = window.GanguramEstimateConfig || {};
    var slabs = (c.standardSlabs && c.standardSlabs.length) ? c.standardSlabs : d.standardSlabs;
    slabs = slabs
      .map(function (s) { return { maxKm: num(s.maxKm), price: num(s.price) }; })
      .filter(function (s) { return s.maxKm != null && s.price != null; })
      .sort(function (a, b) { return a.maxKm - b.maxKm; });
    if (!slabs.length) { slabs = d.standardSlabs; }
    var fh = assign({}, d.fourHour, c.fourHour || {});
    return {
      standardSlabs: slabs,
      fourHour: { maxDistanceKm: num(fh.maxDistanceKm) != null ? fh.maxDistanceKm : d.fourHour.maxDistanceKm,
        flatPrice: num(fh.flatPrice) != null ? fh.flatPrice : d.fourHour.flatPrice },
      panIndia: (function () { var p = assign({}, d.panIndia, c.panIndia || {});
        return { perWeightG: num(p.perWeightG) != null && p.perWeightG > 0 ? p.perWeightG : d.panIndia.perWeightG,
          pricePerUnit: num(p.pricePerUnit) != null ? p.pricePerUnit : d.panIndia.pricePerUnit }; })(),
      currencySymbol: c.currencySymbol != null ? String(c.currencySymbol) : d.currencySymbol,
      rangeSeparator: c.rangeSeparator != null ? String(c.rangeSeparator) : d.rangeSeparator,
      cacheVersion: c.cacheVersion != null ? c.cacheVersion : d.cacheVersion,
      cacheTtlMs: num(c.cacheTtlMs) != null ? c.cacheTtlMs : d.cacheTtlMs,
      sampleEdgeMidpoints: c.sampleEdgeMidpoints === true
    };
  }

  // The slab a single distance falls into. `beyond` = past the last slab's maxKm.
  function slabForKm(km) {
    km = num(km);
    if (km == null || km < 0) { return null; }
    var slabs = config().standardSlabs;
    for (var i = 0; i < slabs.length; i++) { if (km <= slabs[i].maxKm) { return { index: i, price: slabs[i].price, maxKm: slabs[i].maxKm, beyond: false }; } }
    var last = slabs[slabs.length - 1];
    return { index: slabs.length - 1, price: last.price, maxKm: last.maxKm, beyond: true };
  }

  // Single-distance (full-address) standard estimate.
  function standardForKm(km) {
    var s = slabForKm(km);
    return s ? { minPrice: s.price, maxPrice: s.price, isRange: false, beyond: s.beyond } : null;
  }

  // Pincode-AREA standard estimate from a min/max sampled distance.
  function standardForRange(minKm, maxKm) {
    var lo = slabForKm(minKm), hi = slabForKm(maxKm);
    if (!lo || !hi) { return null; }
    return { minPrice: lo.price, maxPrice: hi.price, isRange: lo.price !== hi.price, beyond: hi.beyond };
  }

  // 4-hour eligibility from distance. state: 'yes' (within radius), 'maybe' (the pincode
  // area straddles the radius — confirm with a full address), 'no' (beyond the radius).
  function fourHourForRange(minKm, maxKm, isAddress) {
    var max = config().fourHour.maxDistanceKm, price = config().fourHour.flatPrice;
    minKm = num(minKm); maxKm = num(maxKm);
    if (maxKm == null) { return { state: 'unknown', price: price, maxDistanceKm: max }; }
    if (isAddress || minKm == null || minKm === maxKm) {
      return { state: (maxKm <= max) ? 'yes' : 'no', price: price, maxDistanceKm: max };
    }
    if (maxKm <= max) { return { state: 'yes', price: price, maxDistanceKm: max }; }
    if (minKm <= max) { return { state: 'maybe', price: price, maxDistanceKm: max }; }
    return { state: 'no', price: price, maxDistanceKm: max };
  }

  function money(rupees) { return config().currencySymbol + Math.round(num(rupees) || 0); }
  function formatRange(minPrice, maxPrice) {
    var c = config();
    return (minPrice === maxPrice) ? money(minPrice) : (money(minPrice) + c.rangeSeparator + money(maxPrice));
  }

  // Full slab SPAN (cheapest slab .. dearest slab) — the configured FALLBACK estimate shown
  // for a known LOCAL pincode when the live distance can't be computed (Routes API failure).
  function fallbackRange() {
    var slabs = config().standardSlabs;
    if (!slabs.length) { return null; }
    return { minPrice: slabs[0].price, maxPrice: slabs[slabs.length - 1].price, isRange: slabs[0].price !== slabs[slabs.length - 1].price, beyond: false };
  }

  // PAN India weight-based estimate (Part B): ceil(weightGrams / perWeightG) × pricePerUnit.
  // Uses ONLY the Shopify cart/variant weight (grams) — never parses a product title.
  // No usable weight -> { available:false }, and the UI shows "starts from ₹X per <unit>".
  //   400 g -> ₹80 · 500 g -> ₹80 · 501 g -> ₹160 · 1000 g -> ₹160 · 1200 g -> ₹240
  function panIndiaForWeight(grams) {
    var p = config().panIndia;
    grams = num(grams);
    if (grams == null || grams <= 0) { return { available: false, price: null, fromPrice: p.pricePerUnit, perWeightG: p.perWeightG }; }
    var units = Math.ceil(grams / p.perWeightG);
    return { available: true, price: units * p.pricePerUnit, units: units, grams: grams, fromPrice: p.pricePerUnit, perWeightG: p.perWeightG };
  }

  // Cache key for an area-range computation: pincode + origin + config version (the
  // version bumps when slabs/sampling change). Used by the distance module's cache.
  function areaCacheKey(pincode, origin) {
    var c = config();
    var o = origin ? (Math.round(origin.lat * 1e4) / 1e4) + ',' + (Math.round(origin.lng * 1e4) / 1e4) : '';
    return 'ganguram.estimate.area|v' + c.cacheVersion + '|' + String(pincode || '') + '|' + o;
  }

  // The LOCAL delivery radius = the dearest standard slab's upper bound (e.g. 20 km).
  function localRadiusKm() { var s = config().standardSlabs; return s.length ? s[s.length - 1].maxKm : 20; }
  function round1(km) { return Math.round(num(km) * 10) / 10; }

  // ============================================================================
  // THE single source of truth for the delivery-mode decision (Phase 2.12D).
  // DISTANCE-FIRST: a full-address driving distance (or a pincode-area sampled range)
  // decides LOCAL vs PAN India — NOT the pincode zone and NOT a product's PAN India tag.
  // Returns exactly ONE consistent mode set, so the popup and the cart can never disagree.
  //
  // ctx: {
  //   isAddress,            // a full Google address is selected
  //   distanceKm,           // confirmed full-address driving distance (km) or null
  //   areaRange,            // pincode-area { minKm, maxKm } or null
  //   zone,                 // resolver zone (fallback only, when no distance)
  //   cartWeightGrams,      // for the PAN India estimate
  //   fourHourEligibleCart, // all cart items Quick Commerce (default true: capability)
  //   panIndiaEligibleCart  // all cart items PAN India eligible (default true)
  // }
  // -> { mode: 'local'|'pan_india'|'block'|'pending'|'prompt', basis, standard, fourHour,
  //      panIndia, distanceKm, range, localRadiusKm, fourHourRadiusKm, isLocalWithin20,
  //      isQuickWithin10, panIndiaEligible, crossesLocal, reasonPan, reasonFourHour }
  // ============================================================================
  function resolveDeliveryState(ctx) {
    ctx = ctx || {};
    var c = config();
    var localR = localRadiusKm();
    var fourR = c.fourHour.maxDistanceKm;
    var qcCart = ctx.fourHourEligibleCart !== false;   // default true (empty cart -> show capability)
    var panCart = ctx.panIndiaEligibleCart !== false;  // default true
    var price4 = c.fourHour.flatPrice;
    var hasDist = (typeof ctx.distanceKm === 'number' && isFinite(ctx.distanceKm));

    var s = {
      mode: 'prompt', basis: 'none',
      distanceKm: hasDist ? ctx.distanceKm : null,
      range: ctx.areaRange || null,
      standard: null, fourHour: null, panIndia: null,
      localRadiusKm: localR, fourHourRadiusKm: fourR,
      isLocalWithin20: false, isQuickWithin10: false, panIndiaEligible: panCart, crossesLocal: false,
      reasonPan: '', reasonFourHour: ''
    };
    function four(state, reason) { s.fourHour = { state: state, price: price4 }; s.reasonFourHour = reason; }

    // ---- full address, no distance yet -> PENDING (never flash a wrong PAN India mode) ----
    if (ctx.isAddress && !hasDist) {
      s.basis = 'address'; s.mode = 'pending';
      s.reasonPan = 'full address selected — computing driving distance, no mode shown yet';
      return s;
    }

    // ---- 1) FULL ADDRESS with a confirmed driving distance (highest priority) ----
    if (ctx.isAddress && hasDist) {
      var km = ctx.distanceKm; s.basis = 'address';
      if (km <= localR) {
        s.mode = 'local'; s.isLocalWithin20 = true; s.standard = standardForKm(km);
        s.reasonPan = 'address ' + round1(km) + 'km is within the ' + localR + 'km local radius -> NOT PAN India';
        if (km <= fourR) { s.isQuickWithin10 = true; four(qcCart ? 'yes' : 'no', qcCart ? ('within ' + fourR + 'km and cart is Quick-Commerce eligible') : ('within ' + fourR + 'km but cart is not all Quick Commerce')); }
        else { four('no', 'distance ' + round1(km) + 'km > ' + fourR + 'km -> 4 Hours not available'); }
      } else {
        four('no', 'distance ' + round1(km) + 'km > ' + localR + 'km -> no local delivery, no 4 Hours');
        if (panCart) { s.mode = 'pan_india'; s.panIndia = panIndiaForWeight(ctx.cartWeightGrams); s.reasonPan = 'address ' + round1(km) + 'km > ' + localR + 'km and all items PAN India eligible'; }
        else { s.mode = 'block'; s.reasonPan = 'address > ' + localR + 'km but some items are local-only -> not deliverable'; }
      }
      return s;
    }

    // ---- 2) PINCODE-ONLY with a sampled area range ----
    if (!ctx.isAddress && ctx.areaRange && typeof ctx.areaRange.minKm === 'number') {
      var lo = ctx.areaRange.minKm, hi = ctx.areaRange.maxKm; s.basis = 'area';
      if (lo <= localR) {
        s.mode = 'local'; s.isLocalWithin20 = true; s.crossesLocal = hi > localR;
        s.standard = standardForRange(lo, Math.min(hi, localR));
        s.reasonPan = 'pincode area (' + round1(lo) + '–' + round1(hi) + 'km) overlaps the ' + localR + 'km local radius -> local, NOT PAN India';
        if (hi <= fourR) { s.isQuickWithin10 = true; four(qcCart ? 'yes' : 'no', qcCart ? ('whole area within ' + fourR + 'km + QC cart') : ('whole area within ' + fourR + 'km but cart not all-QC')); }
        else if (lo <= fourR) { four('maybe', 'area straddles ' + fourR + 'km -> enter full address to confirm 4 Hours'); }
        else { four('no', 'whole sampled area beyond ' + fourR + 'km'); }
      } else {
        four('no', 'pincode area beyond ' + localR + 'km -> no local, no 4 Hours');
        if (panCart) { s.mode = 'pan_india'; s.panIndia = panIndiaForWeight(ctx.cartWeightGrams); s.reasonPan = 'pincode area > ' + localR + 'km and all items PAN India'; }
        else { s.mode = 'block'; s.reasonPan = 'pincode area > ' + localR + 'km but some items local-only'; }
      }
      return s;
    }

    // ---- 3) NO distance -> zone fallback (degraded; refined once a distance is known) ----
    s.basis = 'zone';
    if (ctx.zone === 'kolkata' || ctx.zone === 'quick_commerce') {
      s.mode = 'local'; s.isLocalWithin20 = true; s.standard = fallbackRange();
      four((ctx.zone === 'quick_commerce' && qcCart) ? 'yes' : 'no', ctx.zone === 'quick_commerce' ? (qcCart ? 'quick-commerce zone + QC cart (no distance yet)' : 'quick-commerce zone but cart not all-QC') : 'local (non quick-commerce) zone, no distance yet');
      s.reasonPan = 'local zone (' + ctx.zone + '), no distance yet -> local fallback span';
    } else if (ctx.zone === 'pan_india') {
      four('no', 'PAN India zone -> no 4 Hours');
      if (panCart) { s.mode = 'pan_india'; s.panIndia = panIndiaForWeight(ctx.cartWeightGrams); s.reasonPan = 'PAN India zone (no distance) and all items PAN India'; }
      else { s.mode = 'block'; s.reasonPan = 'PAN India zone but some items local-only'; }
    }
    return s;
  }

  window.GanguramShippingEstimate = {
    config: config,
    localRadiusKm: localRadiusKm,
    slabForKm: slabForKm,
    standardForKm: standardForKm,
    standardForRange: standardForRange,
    fourHourForRange: fourHourForRange,
    fallbackRange: fallbackRange,
    panIndiaForWeight: panIndiaForWeight,
    resolveDeliveryState: resolveDeliveryState,
    money: money,
    formatRange: formatRange,
    areaCacheKey: areaCacheKey
  };
})();
