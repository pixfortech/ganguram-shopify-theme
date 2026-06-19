/*
 * Ganguram — manual-pincode -> city enrichment  (display hotfix)
 * ---------------------------------------------------------------------------
 * When a delivery PINCODE is selected (manually, from a recent chip, or a saved
 * address) and we don't yet know its CITY, this asynchronously asks the existing
 * Phase 2.9B Google setup for the city/locality and makes every surface show the
 * same customer-facing label ("Mumbai 400001" instead of just "400001").
 *
 * DISPLAY / ENRICHMENT ONLY. It never changes the internal zone, the resolver,
 * product filtering, cart eligibility/removal/undo, checkout, or the STORED cart
 * zone attributes. It is fully FAIL-OPEN: no Google key / not enabled / lookup
 * fails / API not enabled -> the pincode-only display is kept and nothing breaks.
 *
 * How it stays cheap + safe:
 *   - Google is NOT loaded on page load. A lookup happens only on an actual
 *     delivery-location CHANGE (a deliberate user action), and only for a pincode
 *     whose city is still unknown AND whose zone isn't Kolkata/Quick-Commerce
 *     (those already display as "Kolkata <pincode>" via the zone rule).
 *   - Results are cached in a small namespaced key (ganguram.pincodeCityCache:
 *     pincode -> { city, state, ts }) so a pincode is looked up at most once ever.
 *   - One attempt per pincode per page (no retry storms), and the refresh signal
 *     is a separate 'ganguram:delivery-label-updated' event that surfaces use to
 *     RE-RENDER ONLY — it never re-enters this module, so there is no event loop.
 *
 * PRIVACY: stores only pincode + city + (optional) state + timestamp. Never
 * lat/lng, never place_id, never a full address.
 * No jQuery / Bootstrap / FontAwesome.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramPincodeEnrichInit) { return; }
  window.__ganguramPincodeEnrichInit = true;

  var EVENT = 'ganguram:delivery-location-changed';   // listen (resolver changes)
  var LABEL_EVENT = 'ganguram:delivery-label-updated'; // emit (display refresh only)
  var RECENT_KEY = 'ganguram.recentLocations';          // shared with saved-locations / places
  var CACHE_KEY = 'ganguram.pincodeCityCache';          // our own small cache
  var CACHE_MAX = 50;

  var attempted = {}; // pincodes we've already asked Google for, this page (no retry storms)

  function zone() { return window.GanguramZone || null; }
  function places() { return window.GanguramPlaces || null; }
  function norm(p) { return String(p == null ? '' : p).replace(/\D/g, '').slice(0, 6); }
  function safeLS() { try { var t = '__ge__'; window.localStorage.setItem(t, t); window.localStorage.removeItem(t); return window.localStorage; } catch (e) { return null; } }
  function isKolkataLike(loc) { return !!(loc && (loc.isKolkata === true || loc.zone === 'kolkata' || loc.zone === 'quick_commerce')); }

  // ---- cache (pincode -> {city,state,ts}) ----------------------------------
  function readCache() { var s = safeLS(); if (!s) { return {}; } try { var o = JSON.parse(s.getItem(CACHE_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } }
  function writeCache(o) { var s = safeLS(); if (!s) { return; } try { s.setItem(CACHE_KEY, JSON.stringify(o)); } catch (e) {} }
  function cacheGet(pin) { var o = readCache(); return o[pin] || null; }
  function cachePut(pin, city, state) {
    var o = readCache();
    o[pin] = { city: city || '', state: state || '', ts: Date.now() };
    var keys = Object.keys(o);
    if (keys.length > CACHE_MAX) { // evict oldest to keep it small
      keys.sort(function (a, b) { return (o[a].ts || 0) - (o[b].ts || 0); });
      while (keys.length > CACHE_MAX) { delete o[keys.shift()]; }
    }
    writeCache(o);
  }

  // ---- recent-locations city (read + write the existing entry) -------------
  function recentCityFor(pin) {
    var s = safeLS(); if (!s) { return null; }
    try {
      var arr = JSON.parse(s.getItem(RECENT_KEY) || '[]'); if (!Array.isArray(arr)) { return null; }
      for (var i = 0; i < arr.length; i++) { if (arr[i] && norm(arr[i].pincode) === pin && arr[i].city) { return { city: String(arr[i].city), state: String(arr[i].state || '') }; } }
    } catch (e) {}
    return null;
  }
  function writeRecentCity(pin, city, state) {
    var s = safeLS(); if (!s) { return; }
    try {
      var arr = JSON.parse(s.getItem(RECENT_KEY) || '[]'); if (!Array.isArray(arr)) { return; }
      var changed = false;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && norm(arr[i].pincode) === pin) {
          if (city && arr[i].city !== city) { arr[i].city = city; changed = true; }
          if (state && arr[i].state !== state) { arr[i].state = state; changed = true; }
          break;
        }
      }
      if (changed) { s.setItem(RECENT_KEY, JSON.stringify(arr)); }
    } catch (e) {}
  }

  function fireLabelUpdated(pin) {
    var detail = { pincode: pin };
    try { window.dispatchEvent(new CustomEvent(LABEL_EVENT, { detail: detail })); }
    catch (e) { try { var ev = document.createEvent('CustomEvent'); ev.initCustomEvent(LABEL_EVENT, false, false, detail); window.dispatchEvent(ev); } catch (e2) {} }
  }

  // Persist a known city everywhere a surface might read it, then refresh the UI.
  function applyCity(pin, city, state) {
    cachePut(pin, city, state);
    writeRecentCity(pin, city, state);
    fireLabelUpdated(pin);
  }

  // Decide whether/how to enrich a pincode. Fail-open at every step.
  function enrich(pin, loc) {
    pin = norm(pin);
    if (pin.length !== 6) { return; }

    var cached = cacheGet(pin);
    if (cached && cached.city) { writeRecentCity(pin, cached.city, cached.state); return; } // known -> no Google

    var recCity = recentCityFor(pin);  // e.g. captured by the Google ADDRESS search
    if (recCity) { cachePut(pin, recCity.city, recCity.state); return; }                    // promote -> no Google

    if (isKolkataLike(loc)) { return; } // Kolkata/QC already show "Kolkata <pincode>" via the zone rule

    if (attempted[pin]) { return; }     // one Google attempt per pincode per page
    var p = places();
    if (!p || typeof p.lookupCityByPincode !== 'function') { return; } // Google layer absent -> fail open
    attempted[pin] = true;
    p.lookupCityByPincode(pin).then(function (res) {
      if (res && res.city) { applyCity(pin, res.city, res.state); } // else keep pincode-only
    }).catch(function () { /* fail open */ });
  }

  function onChange(e) {
    var loc = (e && e.detail) ? e.detail : (zone() ? zone().getSelectedDeliveryLocation() : null);
    if (!loc || !loc.pincode) { return; } // cleared -> nothing to enrich
    enrich(norm(loc.pincode), loc);
  }

  function init() {
    window.addEventListener(EVENT, onChange);
    // On load: NO Google. If we already cached a city for the current pincode,
    // make sure the recent entry carries it (the display helper also reads the
    // cache directly, so surfaces already show the city without any network).
    var z = zone();
    var loc = z ? z.getSelectedDeliveryLocation() : null;
    var pin = loc ? norm(loc.pincode) : '';
    if (pin) { var c = cacheGet(pin); if (c && c.city) { writeRecentCity(pin, c.city, c.state); } }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
