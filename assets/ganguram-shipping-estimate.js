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
      fourHour: { enabled: true, maxDistanceKm: 10, flatPrice: 10 },  // radius is ADMIN-CONFIGURABLE (e.g. 10 or 20 km)
      panIndia: { perWeightG: 500, pricePerUnit: 80 },   // ₹80 per 500 g (Part B)
      slabSafetyMarginKm: 0.3,   // bias a full-address distance UP this many km before slab matching (anti under-estimate; 0 disables)
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
      fourHour: {
        enabled: fh.enabled !== false,   // admin toggle (default on)
        maxDistanceKm: num(fh.maxDistanceKm) != null ? fh.maxDistanceKm : d.fourHour.maxDistanceKm,
        flatPrice: num(fh.flatPrice) != null ? fh.flatPrice : d.fourHour.flatPrice
      },
      panIndia: (function () { var p = assign({}, d.panIndia, c.panIndia || {});
        return { perWeightG: num(p.perWeightG) != null && p.perWeightG > 0 ? p.perWeightG : d.panIndia.perWeightG,
          pricePerUnit: num(p.pricePerUnit) != null ? p.pricePerUnit : d.panIndia.pricePerUnit }; })(),
      slabSafetyMarginKm: (function () { var m = num(c.slabSafetyMarginKm); return (m != null && m >= 0) ? m : d.slabSafetyMarginKm; })(),
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

  // Bias a raw full-address driving distance UP by the configured safety margin (km) BEFORE
  // slab matching, so a distance sitting just under a slab boundary is never UNDER-charged —
  // e.g. a ~15 km address that the Routes API returns as 14.9 km must not show the 10–15 km
  // (₹100) slab when the true tier is 15–20 km (₹150). DISPLAY ESTIMATE ONLY; ShipZip remains
  // the authoritative checkout rate, so biasing the estimate up only ever errs toward NOT
  // under-quoting. Clamped to the local-standard radius so an in-radius address never renders a
  // "beyond" (₹150+) slab. slabSafetyMarginKm: 0 -> exact route distance (no bias). Applied to a
  // single full-address distance only — a pincode-AREA range already brackets uncertainty with
  // its max end, so the range path is left exact.
  function slabInputKm(km) {
    var k = num(km);
    if (k == null || k < 0) { return k; }
    var margin = config().slabSafetyMarginKm;
    var padded = k + (margin > 0 ? margin : 0);
    padded = Math.round(padded * 100) / 100;                        // kill float noise
    var localMax = localRadiusKm();
    if (k <= localMax && padded > localMax) { padded = localMax; }  // never push an in-radius address "beyond"
    return padded;
  }

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
  // -> { mode, basis, standard, fourHour, panIndia, distanceKm, range,
  //      localStandardMaxDistanceKm, fourHourMaxDistanceKm, fourHourEnabled,
  //      isWithinLocalStandardRadius, isWithinFourHourRadius, allItemsQuickCommerce,
  //      panIndiaEligible, crossesLocal, reasonPan, reasonFourHour }
  // Both radii are ADMIN-CONFIGURABLE (standardSlabs' last maxKm; fourHour.maxDistanceKm).
  // ============================================================================
  function resolveDeliveryState(ctx) {
    ctx = ctx || {};
    var c = config();
    var localMax = localRadiusKm();                    // configured local-standard max (e.g. 20 km)
    var fourMax = c.fourHour.maxDistanceKm;            // configured 4-hour max (admin: 10 or 20 km…)
    var fourOn = c.fourHour.enabled !== false;         // admin toggle
    var qcCart = ctx.fourHourEligibleCart !== false;   // default true (empty cart -> show capability)
    var panCart = ctx.panIndiaEligibleCart !== false;  // default true
    var price4 = c.fourHour.flatPrice;
    var hasDist = (typeof ctx.distanceKm === 'number' && isFinite(ctx.distanceKm));

    var s = {
      mode: 'prompt', basis: 'none',
      distanceKm: hasDist ? ctx.distanceKm : null,
      slabDistanceKm: null,
      range: ctx.areaRange || null,
      standard: null, fourHour: null, panIndia: null,
      localStandardMaxDistanceKm: localMax, fourHourMaxDistanceKm: fourMax, fourHourEnabled: fourOn,
      isWithinLocalStandardRadius: false, isWithinFourHourRadius: false,
      allItemsQuickCommerce: qcCart, panIndiaEligible: panCart, crossesLocal: false,
      reasonPan: '', reasonFourHour: ''
    };
    // Within the configured 4-hour radius -> 'yes' (when QC) / 'no' (when not QC); the admin
    // toggle (fourHour.enabled) can force it off entirely.
    function four(state, reason) { if (!fourOn) { state = 'no'; reason = '4 Hours disabled in config'; } s.fourHour = { state: state, price: price4 }; s.reasonFourHour = reason; }
    function withinFour() { s.isWithinFourHourRadius = true; four(qcCart ? 'yes' : 'no', qcCart ? ('within the configured ' + fourMax + 'km 4-hour radius and all items Quick Commerce') : ('within the configured ' + fourMax + 'km 4-hour radius but cart is not all Quick Commerce')); }

    s.basis = ctx.isAddress ? 'address' : (ctx.areaRange ? 'area' : 'zone');
    if (ctx.zone === 'kolkata') {
      s.mode = 'local'; s.isWithinLocalStandardRadius = true;
      s.reasonPan = 'Entire postal polygon belongs to the Kolkata delivery boundary';
      if (ctx.isAddress && hasDist) {
        s.slabDistanceKm = slabInputKm(ctx.distanceKm);
        s.standard = standardForKm(s.slabDistanceKm);
        if (ctx.distanceKm <= fourMax) withinFour();
        else four('no', 'Address exceeds the configured express distance');
      } else {
        s.standard = ctx.areaRange ? standardForRange(ctx.areaRange.minKm, ctx.areaRange.maxKm) : fallbackRange();
        four('maybe', 'Enter a full address to confirm express availability');
      }
      // Beyond 20 km, keep the highest configured local tier (approved ₹150).
      // Postal eligibility remains Kolkata even when the driving route is longer.
    } else if (ctx.zone === 'pan_india') {
      four('no', 'Outside the Kolkata postal boundary');
      if (panCart) { s.mode = 'pan_india'; s.panIndia = panIndiaForWeight(ctx.cartWeightGrams); }
      else { s.mode = 'block'; s.reasonPan = 'Some products are unavailable for this pincode'; }
    }
    return s;
  }

  window.GanguramShippingEstimate = {
    config: config,
    localRadiusKm: localRadiusKm,
    slabForKm: slabForKm,
    slabInputKm: slabInputKm,
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
