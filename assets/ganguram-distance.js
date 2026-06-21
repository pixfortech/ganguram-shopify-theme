/*
 * Ganguram — Driving-distance provider (Phase 2.11D / 2.11D.1)
 * ---------------------------------------------------------------------------
 * Computes the ACTUAL driving distance from the store outlet to a SELECTED FULL
 * ADDRESS (Google place coordinates) and exposes it as a CONFIRMED distanceKm
 * that the cart rules can use. Defines window.GanguramDistance.
 *
 * Pincode-only selections (manual / recent / saved) get NO confirmed distance —
 * they stay "estimated" (the cart falls back to zone/pincode rules). Only a full
 * address (which carries coordinates) yields a confirmed distance. So:
 *   - manual pincode -> estimated (no distanceKm)
 *   - full address   -> confirmed (driving distanceKm), used for distance slabs
 *
 * It REUSES the existing Phase 2.9B Google setup (window.GanguramPlaces.loadMaps —
 * same merchant key, lazy loader) and the Distance Matrix API. The outlet origin
 * comes from a theme setting (lat,lng). PRIVACY: it stores only the resulting
 * distanceKm + pincode (never the address coordinates).
 *
 * Fully FAIL-OPEN: no origin / not enabled / Distance Matrix unavailable or not
 * enabled on the key / any error -> no confirmed distance, everything keeps
 * working on the estimated (pincode) path. Never changes checkout / shipping /
 * ShipZip / SBZ / zipLogic / the resolver / settings_data.json.
 *
 * 2.11D.1: hardened destination-coordinate normalization (LatLng object OR
 * {lat,lng} literal OR {latitude,longitude}) and added DEV-ONLY debug tracing
 * (window.GanguramDistance.debugState() + console traces when debug is on) so a
 * failed full-address distance can be diagnosed WITHOUT any customer-facing text.
 * Enable debug with ?ganguram_debug=1, localStorage['ganguram.debug']='1', or
 * window.GanguramDistanceConfig.debug = true.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramDistance) { return; }

  var EVENT_CHANGED = 'ganguram:delivery-location-changed';
  var EVENT_DISTANCE = 'ganguram:delivery-distance-updated';
  var STORE_KEY = 'ganguram.deliveryDistance'; // { pincode, distanceKm, ts }

  // last computation outcome — DEV-ONLY (never shown to customers)
  var state = { lastReason: '', lastDistanceKm: null, lastDest: null, lastAt: 0 };

  function cfg() { return window.GanguramDistanceConfig || {}; }
  function enabled() { return cfg().enabled === true; }
  function norm(p) { return String(p == null ? '' : p).replace(/\D/g, '').slice(0, 6); }

  function safeLS() { try { var t = '__gd__'; window.localStorage.setItem(t, t); window.localStorage.removeItem(t); return window.localStorage; } catch (e) { return null; } }

  function isDebug() {
    try {
      if (cfg().debug === true) { return true; }
      var ls = safeLS();
      if (ls && ls.getItem('ganguram.debug') === '1') { return true; }
      if (typeof location !== 'undefined' && /[?&]ganguram_debug=1\b/.test(location.search || '')) { return true; }
    } catch (e) {}
    return false;
  }
  function dlog() { if (isDebug()) { try { console.log.apply(console, ['[GanguramDistance]'].concat([].slice.call(arguments))); } catch (e) {} } }
  function setReason(r) { state.lastReason = r; state.lastAt = Date.now(); }

  function origin() {
    var o = cfg().origin;
    if (!o) { return null; }
    if (typeof o === 'object' && isFinite(o.lat) && isFinite(o.lng)) { return { lat: +o.lat, lng: +o.lng }; }
    var m = String(o).split(',');
    if (m.length === 2) { var la = parseFloat(m[0]), ln = parseFloat(m[1]); if (isFinite(la) && isFinite(ln)) { return { lat: la, lng: ln }; } }
    return null;
  }

  // Accept a Google LatLng (lat()/lng() methods), a {lat,lng} literal (numbers or
  // functions), or {latitude,longitude}; return a clean {lat,lng} literal or null.
  function normDest(dest) {
    if (!dest) { return null; }
    var lat = (typeof dest.lat === 'function') ? dest.lat() : dest.lat;
    var lng = (typeof dest.lng === 'function') ? dest.lng() : dest.lng;
    if (lat == null && dest.latitude != null) { lat = dest.latitude; }
    if (lng == null && dest.longitude != null) { lng = dest.longitude; }
    lat = parseFloat(lat); lng = parseFloat(lng);
    if (isFinite(lat) && isFinite(lng)) { return { lat: lat, lng: lng }; }
    return null;
  }

  function readStore() { var s = safeLS(); if (!s) { return null; } try { var o = JSON.parse(s.getItem(STORE_KEY) || 'null'); return (o && typeof o === 'object') ? o : null; } catch (e) { return null; } }
  function writeStore(o) { var s = safeLS(); if (!s) { return; } try { s.setItem(STORE_KEY, JSON.stringify(o)); } catch (e) {} }
  function clearStore() { var s = safeLS(); if (!s) { return; } try { s.removeItem(STORE_KEY); } catch (e) {} }

  // APPROXIMATE pincode-centroid distance (Phase 2.11F.1) — a separate, lower-trust
  // store used only for the popup ESTIMATE when no full address has confirmed a
  // distance. Always labelled approximate; never a business rule.
  var APPROX_KEY = 'ganguram.deliveryDistanceApprox';
  function readApprox() { var s = safeLS(); if (!s) { return null; } try { var o = JSON.parse(s.getItem(APPROX_KEY) || 'null'); return (o && typeof o === 'object') ? o : null; } catch (e) { return null; } }
  function writeApprox(o) { var s = safeLS(); if (!s) { return; } try { s.setItem(APPROX_KEY, JSON.stringify(o)); } catch (e) {} }
  function clearApprox() { var s = safeLS(); if (!s) { return; } try { s.removeItem(APPROX_KEY); } catch (e) {} }

  function currentSelectedPin() {
    var z = window.GanguramZone;
    if (z && typeof z.getSelectedDeliveryLocation === 'function') { try { return norm((z.getSelectedDeliveryLocation() || {}).pincode); } catch (e) {} }
    return '';
  }

  function fire(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); }
    catch (e) { try { var ev = document.createEvent('CustomEvent'); ev.initCustomEvent(name, false, false, detail); window.dispatchEvent(ev); } catch (e2) {} }
  }

  // Confirmed driving distance for a pincode, or { distanceKm:null, confirmed:false }.
  function getForPincode(pincode) {
    var p = norm(pincode);
    var s = readStore();
    if (s && norm(s.pincode) === p && typeof s.distanceKm === 'number' && isFinite(s.distanceKm)) {
      return { distanceKm: s.distanceKm, confirmed: true };
    }
    return { distanceKm: null, confirmed: false };
  }

  function setConfirmedDistance(pincode, km) {
    var p = norm(pincode);
    var n = (typeof km === 'number' && isFinite(km) && km >= 0) ? km : null;
    if (!p || n == null) { return; }
    if (currentSelectedPin() && currentSelectedPin() !== p) { setReason('stale-pincode'); dlog('ignore stale result for', p, '(selected', currentSelectedPin() + ')'); return; } // selection moved on
    writeStore({ pincode: p, distanceKm: n, ts: Date.now() });
    state.lastDistanceKm = n; setReason('confirmed');
    dlog('confirmed', n, 'km for pincode', p, '-> firing', EVENT_DISTANCE);
    fire(EVENT_DISTANCE, { pincode: p, distanceKm: n, confirmed: true });
  }

  // ---- Google Distance Matrix (driving) — reuses GanguramPlaces.loadMaps -----
  function routesLib(maps) {
    return (maps && typeof maps.importLibrary === 'function') ? maps.importLibrary('routes') : Promise.resolve(maps);
  }
  function computeDrivingDistanceKm(dest) {
    state.lastDest = dest;
    var o = origin();
    if (!enabled()) { setReason('disabled'); dlog('disabled (no outlet origin set)'); return Promise.resolve(null); }
    if (!o) { setReason('bad-origin'); dlog('outlet origin unparseable:', cfg().origin); return Promise.resolve(null); }
    var d = normDest(dest);
    if (!d) { setReason('no-dest-coords'); dlog('no destination coordinates from', dest); return Promise.resolve(null); }
    var places = window.GanguramPlaces;
    if (!places || typeof places.loadMaps !== 'function') { setReason('no-loader'); dlog('GanguramPlaces.loadMaps unavailable'); return Promise.resolve(null); }
    dlog('compute driving distance origin', o, '-> dest', d);
    return places.loadMaps().then(routesLib).then(function (lib) {
      var g = window.google && window.google.maps;
      var Svc = (lib && lib.DistanceMatrixService) || (g && g.DistanceMatrixService);
      if (typeof Svc !== 'function') { setReason('no-service'); dlog('DistanceMatrixService unavailable (is the Distance Matrix API enabled on the key?)'); return null; }
      var unit = (g && g.UnitSystem) ? g.UnitSystem.METRIC : 0;
      return new Promise(function (resolve) {
        var done = false, fin = function (v) { if (!done) { done = true; resolve(v); } };
        var timer = setTimeout(function () { setReason('timeout'); dlog('Distance Matrix timed out (8s)'); fin(null); }, 8000); // never wedge the caller
        try {
          new Svc().getDistanceMatrix(
            { origins: [o], destinations: [d], travelMode: 'DRIVING', unitSystem: unit },
            function (resp, status) {
              clearTimeout(timer);
              if (status !== 'OK' || !resp || !resp.rows || !resp.rows[0]) { setReason('status-' + status); dlog('Distance Matrix status', status); fin(null); return; }
              var el = resp.rows[0].elements && resp.rows[0].elements[0];
              if (!el || el.status !== 'OK' || !el.distance) { setReason('element-' + (el && el.status)); dlog('Distance Matrix element status', el && el.status); fin(null); return; }
              var km = el.distance.value / 1000; // metres -> km
              dlog('Distance Matrix OK ->', km, 'km'); fin(km);
            }
          );
        } catch (e) { clearTimeout(timer); setReason('exception'); dlog('Distance Matrix threw', e); fin(null); }
      });
    }).catch(function (e) { setReason('load-failed'); dlog('maps/routes load failed', e); return null; });
  }

  // Compute distance for a selected full address (dest coords) and store it.
  function computeAndStore(pincode, dest) {
    var p = norm(pincode);
    if (!p) { setReason('no-pincode'); return Promise.resolve(null); }
    if (!normDest(dest)) { setReason('no-dest-coords'); dlog('computeAndStore got no usable coords for', p); return Promise.resolve(null); }
    dlog('computeAndStore pincode', p);
    return computeDrivingDistanceKm(dest).then(function (km) {
      if (km != null) { setConfirmedDistance(p, km); }
      else { dlog('no distance for', p, '- staying ESTIMATED (reason:', state.lastReason + ')'); }
      return km;
    }).catch(function () { setReason('exception'); return null; });
  }

  function getApproxForPincode(pincode) {
    var p = norm(pincode), s = readApprox();
    if (s && norm(s.pincode) === p && typeof s.distanceKm === 'number' && isFinite(s.distanceKm)) {
      return { distanceKm: s.distanceKm, approximate: true };
    }
    return null;
  }

  // Best available distance ESTIMATE for the popup: a confirmed full-address distance
  // (approximate:false) if present, else the approximate pincode-centroid one, else
  // { distanceKm:null }. Display only.
  function getEstimate(pincode) {
    var conf = getForPincode(pincode);
    if (conf.confirmed) { return { distanceKm: conf.distanceKm, approximate: false, confirmed: true }; }
    var ap = getApproxForPincode(pincode);
    if (ap) { return { distanceKm: ap.distanceKm, approximate: true, confirmed: false }; }
    return { distanceKm: null, approximate: false, confirmed: false };
  }

  // Geocode the pincode to its CENTROID and compute an APPROXIMATE distance. Skips
  // if a confirmed full-address distance already exists for the pincode. Fires the
  // distance event (approximate:true) so the popup re-renders. Fail-open.
  function computeApproxForPincode(pincode) {
    var p = norm(pincode);
    if (!p || !enabled() || !origin()) { return Promise.resolve(null); }
    if (getForPincode(p).confirmed) { return Promise.resolve(null); } // address already better
    var ex = getApproxForPincode(p); if (ex) { return Promise.resolve(ex.distanceKm); } // cached
    var places = window.GanguramPlaces;
    if (!places || typeof places.geocodePincode !== 'function') { setReason('no-geocoder'); return Promise.resolve(null); }
    dlog('approx distance: geocoding pincode centroid', p);
    return places.geocodePincode(p).then(function (coords) {
      if (!coords) { setReason('no-pincode-coords'); return null; }
      return computeDrivingDistanceKm(coords).then(function (km) {
        if (km == null) { return null; }
        if (currentSelectedPin() && currentSelectedPin() !== p) { return null; } // selection moved on
        writeApprox({ pincode: p, distanceKm: km, ts: Date.now() });
        dlog('approx', km, 'km for pincode', p, '-> firing', EVENT_DISTANCE);
        fire(EVENT_DISTANCE, { pincode: p, distanceKm: km, confirmed: false, approximate: true });
        return km;
      });
    }).catch(function () { return null; });
  }

  // ---- pincode-AREA distance RANGE (Phase 2.11I) ----------------------------
  // Geocodes the pincode to its area box, samples the centre + corners, and asks the
  // Distance Matrix for ALL of them in ONE request, then reports min/max driving km.
  // Cached per pincode + origin + config version (TTL) so we never re-call Google for the
  // same pincode in a session. Display ESTIMATE only — never a business rule.
  function estimateCfg() {
    var se = window.GanguramShippingEstimate;
    return (se && typeof se.config === 'function') ? se.config() : { cacheTtlMs: 86400000, sampleEdgeMidpoints: false };
  }
  function areaKeyFor(p) {
    var se = window.GanguramShippingEstimate, o = origin();
    return (se && typeof se.areaCacheKey === 'function') ? se.areaCacheKey(p, o) : ('ganguram.deliveryAreaRange|' + p);
  }
  function readAreaCache(key) {
    var s = safeLS(); if (!s) { return null; }
    try {
      var o = JSON.parse(s.getItem(key) || 'null');
      if (!o || typeof o !== 'object') { return null; }
      var ttl = estimateCfg().cacheTtlMs;
      if (ttl && o.ts && (Date.now() - o.ts) > ttl) { s.removeItem(key); return null; } // expired
      if (typeof o.minKm === 'number' && typeof o.maxKm === 'number') { return o; }
    } catch (e) {}
    return null;
  }
  function writeAreaCache(key, o) { var s = safeLS(); if (!s) { return; } try { s.setItem(key, JSON.stringify(o)); } catch (e) {} }

  function samplePoints(area, includeMidpoints) {
    var c = area.center, b = area.bounds, pts = [c];
    if (b) {
      pts.push({ lat: b.north, lng: b.east }); // NE
      pts.push({ lat: b.north, lng: b.west }); // NW
      pts.push({ lat: b.south, lng: b.east }); // SE
      pts.push({ lat: b.south, lng: b.west }); // SW
      if (includeMidpoints) {
        var mLat = (b.north + b.south) / 2, mLng = (b.east + b.west) / 2;
        pts.push({ lat: b.north, lng: mLng }); pts.push({ lat: b.south, lng: mLng });
        pts.push({ lat: mLat, lng: b.east }); pts.push({ lat: mLat, lng: b.west });
      }
    }
    return pts;
  }

  // Batch driving distance: ONE Distance Matrix request, many destinations -> km[] (null
  // per failed element). Keeps the API cost to a single call for the whole pincode area.
  function computeDrivingDistancesKm(dests) {
    var o = origin();
    if (!enabled()) { setReason('disabled'); return Promise.resolve(null); }
    if (!o) { setReason('bad-origin'); return Promise.resolve(null); }
    var ds = (dests || []).map(normDest).filter(Boolean);
    if (!ds.length) { setReason('no-dest-coords'); return Promise.resolve(null); }
    var places = window.GanguramPlaces;
    if (!places || typeof places.loadMaps !== 'function') { setReason('no-loader'); return Promise.resolve(null); }
    return places.loadMaps().then(routesLib).then(function (lib) {
      var g = window.google && window.google.maps;
      var Svc = (lib && lib.DistanceMatrixService) || (g && g.DistanceMatrixService);
      if (typeof Svc !== 'function') { setReason('no-service'); return null; }
      var unit = (g && g.UnitSystem) ? g.UnitSystem.METRIC : 0;
      return new Promise(function (resolve) {
        var done = false, fin = function (v) { if (!done) { done = true; resolve(v); } };
        var timer = setTimeout(function () { setReason('timeout'); fin(null); }, 8000);
        try {
          new Svc().getDistanceMatrix(
            { origins: [o], destinations: ds, travelMode: 'DRIVING', unitSystem: unit },
            function (resp, status) {
              clearTimeout(timer);
              if (status !== 'OK' || !resp || !resp.rows || !resp.rows[0]) { setReason('status-' + status); fin(null); return; }
              var els = resp.rows[0].elements || [];
              fin(els.map(function (el) { return (el && el.status === 'OK' && el.distance) ? el.distance.value / 1000 : null; }));
            }
          );
        } catch (e) { clearTimeout(timer); setReason('exception'); fin(null); }
      });
    }).catch(function (e) { setReason('load-failed'); dlog('area distances load failed', e); return null; });
  }

  // Cached area range for a pincode (sync), or null.
  function getAreaRangeForPincode(pincode) {
    var p = norm(pincode); if (!p) { return null; }
    var c = readAreaCache(areaKeyFor(p));
    return (c && norm(c.pincode) === p) ? { minKm: c.minKm, maxKm: c.maxKm, samples: c.samples, approximate: true } : null;
  }

  function computeAreaRangeForPincode(pincode) {
    var p = norm(pincode);
    if (!p || !enabled() || !origin()) { return Promise.resolve(null); }
    var cached = getAreaRangeForPincode(p);
    if (cached) { dlog('area range cache hit', p, cached); return Promise.resolve(cached); }
    var places = window.GanguramPlaces;
    if (!places || typeof places.geocodePincodeArea !== 'function') { setReason('no-area-geocoder'); return Promise.resolve(null); }
    dlog('area range: geocoding area for', p);
    return places.geocodePincodeArea(p).then(function (area) {
      if (!area || !area.center) { setReason('no-area-coords'); return null; }
      var pts = samplePoints(area, estimateCfg().sampleEdgeMidpoints);
      return computeDrivingDistancesKm(pts).then(function (kms) {
        var valid = (kms || []).filter(function (k) { return typeof k === 'number' && isFinite(k) && k >= 0; });
        if (!valid.length) { setReason('no-area-distances'); return null; }
        if (currentSelectedPin() && currentSelectedPin() !== p) { return null; } // selection moved on
        var minKm = Math.min.apply(null, valid), maxKm = Math.max.apply(null, valid);
        var rec = { pincode: p, minKm: minKm, maxKm: maxKm, samples: valid.length, ts: Date.now() };
        writeAreaCache(areaKeyFor(p), rec);
        dlog('area range', minKm, '-', maxKm, 'km for', p, '(' + valid.length + ' samples) -> firing', EVENT_DISTANCE);
        fire(EVENT_DISTANCE, { pincode: p, distanceKm: minKm, minKm: minKm, maxKm: maxKm, confirmed: false, approximate: true, area: true });
        return { minKm: minKm, maxKm: maxKm, samples: valid.length, approximate: true };
      });
    }).catch(function () { setReason('exception'); return null; });
  }

  // A new (non-address) location change makes any prior single-point distance stale: every
  // change first drops to ESTIMATED; an address selection re-confirms via computeAndStore,
  // and the popup re-runs the pincode estimate. The AREA cache is keyed per pincode (+origin
  // +version) with a TTL, so it is intentionally NOT cleared here (reused across the session).
  function onChange() { dlog('location changed -> clearing distances (back to estimate)'); clearStore(); clearApprox(); setReason('cleared'); }

  window.GanguramDistance = {
    getForPincode: getForPincode,
    getEstimate: getEstimate,
    getApproxForPincode: getApproxForPincode,
    computeApproxForPincode: computeApproxForPincode,
    getAreaRangeForPincode: getAreaRangeForPincode,
    computeAreaRangeForPincode: computeAreaRangeForPincode,
    computeDrivingDistancesKm: computeDrivingDistancesKm,
    setConfirmedDistance: setConfirmedDistance,
    computeDrivingDistanceKm: computeDrivingDistanceKm,
    computeAndStore: computeAndStore,
    isEnabled: function () { return enabled() && !!origin(); },
    // DEV-ONLY introspection (never rendered to customers). Use in the console:
    // window.GanguramDistance.debugState()
    debugState: function () {
      return {
        enabled: enabled(), origin: origin(), store: readStore(),
        selectedPincode: currentSelectedPin(), lastReason: state.lastReason,
        lastDistanceKm: state.lastDistanceKm, debug: isDebug()
      };
    }
  };

  window.addEventListener(EVENT_CHANGED, onChange);
  dlog('ready. enabled=' + enabled() + ' origin=' + JSON.stringify(origin()));
})();
