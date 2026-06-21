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

  // Cache key for an area-range computation: pincode + origin + config version (the
  // version bumps when slabs/sampling change). Used by the distance module's cache.
  function areaCacheKey(pincode, origin) {
    var c = config();
    var o = origin ? (Math.round(origin.lat * 1e4) / 1e4) + ',' + (Math.round(origin.lng * 1e4) / 1e4) : '';
    return 'ganguram.estimate.area|v' + c.cacheVersion + '|' + String(pincode || '') + '|' + o;
  }

  window.GanguramShippingEstimate = {
    config: config,
    slabForKm: slabForKm,
    standardForKm: standardForKm,
    standardForRange: standardForRange,
    fourHourForRange: fourHourForRange,
    fallbackRange: fallbackRange,
    money: money,
    formatRange: formatRange,
    areaCacheKey: areaCacheKey
  };
})();
