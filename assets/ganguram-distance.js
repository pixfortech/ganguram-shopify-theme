/*
 * Ganguram — Driving-distance provider (Phase 2.11D)
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
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramDistance) { return; }

  var EVENT_CHANGED = 'ganguram:delivery-location-changed';
  var EVENT_DISTANCE = 'ganguram:delivery-distance-updated';
  var STORE_KEY = 'ganguram.deliveryDistance'; // { pincode, distanceKm, ts }

  function cfg() { return window.GanguramDistanceConfig || {}; }
  function enabled() { return cfg().enabled === true; }
  function norm(p) { return String(p == null ? '' : p).replace(/\D/g, '').slice(0, 6); }

  function origin() {
    var o = cfg().origin;
    if (!o) { return null; }
    if (typeof o === 'object' && isFinite(o.lat) && isFinite(o.lng)) { return { lat: +o.lat, lng: +o.lng }; }
    var m = String(o).split(',');
    if (m.length === 2) { var la = parseFloat(m[0]), ln = parseFloat(m[1]); if (isFinite(la) && isFinite(ln)) { return { lat: la, lng: ln }; } }
    return null;
  }

  function safeLS() { try { var t = '__gd__'; window.localStorage.setItem(t, t); window.localStorage.removeItem(t); return window.localStorage; } catch (e) { return null; } }
  function readStore() { var s = safeLS(); if (!s) { return null; } try { var o = JSON.parse(s.getItem(STORE_KEY) || 'null'); return (o && typeof o === 'object') ? o : null; } catch (e) { return null; } }
  function writeStore(o) { var s = safeLS(); if (!s) { return; } try { s.setItem(STORE_KEY, JSON.stringify(o)); } catch (e) {} }
  function clearStore() { var s = safeLS(); if (!s) { return; } try { s.removeItem(STORE_KEY); } catch (e) {} }

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
    if (currentSelectedPin() && currentSelectedPin() !== p) { return; } // selection moved on -> ignore stale result
    writeStore({ pincode: p, distanceKm: n, ts: Date.now() });
    fire(EVENT_DISTANCE, { pincode: p, distanceKm: n, confirmed: true });
  }

  // ---- Google Distance Matrix (driving) — reuses GanguramPlaces.loadMaps -----
  function routesLib(maps) {
    return (maps && typeof maps.importLibrary === 'function') ? maps.importLibrary('routes') : Promise.resolve(maps);
  }
  function computeDrivingDistanceKm(dest) {
    var o = origin();
    if (!enabled() || !o || !dest) { return Promise.resolve(null); }
    var places = window.GanguramPlaces;
    if (!places || typeof places.loadMaps !== 'function') { return Promise.resolve(null); }
    return places.loadMaps().then(routesLib).then(function (lib) {
      var g = window.google && window.google.maps;
      var Svc = (lib && lib.DistanceMatrixService) || (g && g.DistanceMatrixService);
      if (typeof Svc !== 'function') { return null; }
      var unit = (g && g.UnitSystem) ? g.UnitSystem.METRIC : 0;
      return new Promise(function (resolve) {
        var done = false, fin = function (v) { if (!done) { done = true; resolve(v); } };
        var timer = setTimeout(function () { fin(null); }, 8000); // never wedge the caller
        try {
          new Svc().getDistanceMatrix(
            { origins: [o], destinations: [dest], travelMode: 'DRIVING', unitSystem: unit },
            function (resp, status) {
              clearTimeout(timer);
              if (status !== 'OK' || !resp || !resp.rows || !resp.rows[0]) { fin(null); return; }
              var el = resp.rows[0].elements && resp.rows[0].elements[0];
              if (!el || el.status !== 'OK' || !el.distance) { fin(null); return; }
              fin(el.distance.value / 1000); // metres -> km
            }
          );
        } catch (e) { clearTimeout(timer); fin(null); }
      });
    }).catch(function () { return null; });
  }

  // Compute distance for a selected full address (dest coords) and store it.
  function computeAndStore(pincode, dest) {
    var p = norm(pincode);
    if (!p || !dest) { return Promise.resolve(null); }
    return computeDrivingDistanceKm(dest).then(function (km) {
      if (km != null) { setConfirmedDistance(p, km); }
      return km;
    }).catch(function () { return null; });
  }

  // A new (non-address) location change makes any prior confirmed distance stale:
  // every change first drops to ESTIMATED; an address selection re-confirms it via
  // computeAndStore AFTER this event fires.
  function onChange() { clearStore(); }

  window.GanguramDistance = {
    getForPincode: getForPincode,
    setConfirmedDistance: setConfirmedDistance,
    computeDrivingDistanceKm: computeDrivingDistanceKm,
    computeAndStore: computeAndStore,
    isEnabled: function () { return enabled() && !!origin(); }
  };

  window.addEventListener(EVENT_CHANGED, onChange);
})();
