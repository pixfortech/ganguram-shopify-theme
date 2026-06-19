/*
 * Ganguram — customer-facing delivery location DISPLAY LABEL helper  (UI hotfix)
 * ---------------------------------------------------------------------------
 * ONE source of truth for the label a customer SEES for a delivery location
 * (header trigger, popup current card, recent chips, cart summary). Display only.
 *
 * It NEVER changes business logic: the internal delivery ZONE
 * ('kolkata' | 'quick_commerce' | 'pan_india' | 'not_serviceable' | 'unknown')
 * and its internal zone label are untouched and still drive product filtering,
 * cart eligibility and the cart attributes. This helper only decides what TEXT
 * to render — and it never exposes the internal labels "Quick Commerce" or
 * "PAN India" as the customer-facing source.
 *
 * Priority (first match wins) for a location-like object
 * { pincode, zone, isKolkata, city, state, name, company }:
 *   1. saved-address name/company + pincode   -> "Rahul 700008"
 *   2. real city (Google Places / recent)     -> "Kolkata 700071", "New Delhi 110001"
 *   3. Kolkata or Quick-Commerce zone         -> "Kolkata <pincode>"  (public city name)
 *   4. otherwise                              -> "<pincode>"          (e.g. PAN India w/o city)
 *
 * When only a resolver location is given (pincode + zone, no city), it will — by
 * default — borrow a short safe city/name ALREADY stored on the recent-locations
 * entry for that same pincode (read-only) so the city shows wherever it was
 * captured. No new storage, no network, no Google calls.
 *
 * No deps. Defines window.GanguramDisplayLabel. Inert on load.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramDisplayLabel) { return; } // idempotent; never re-define

  var RECENT_KEY = 'ganguram.recentLocations'; // read-only; owned by saved-locations / places
  var CACHE_KEY = 'ganguram.pincodeCityCache'; // read-only; owned by the pincode-enrich module
  var KOLKATA_CITY = 'Kolkata';                // public city name for the Kolkata/QC zone

  function str(v) { return (v == null ? '' : String(v)).trim(); }
  function normPin(v) { return str(v).replace(/\D/g, '').slice(0, 6); }

  function recentFor(pin) {
    if (!pin) { return null; }
    try {
      var raw = window.localStorage.getItem(RECENT_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) { return null; }
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && normPin(arr[i].pincode) === pin) { return arr[i]; }
      }
    } catch (e) {}
    return null;
  }

  // Pincode -> city cache (populated by the enrichment module). Read-only here, and
  // a fallback source of the city when the recent-locations entry doesn't have it
  // (e.g. it was evicted, or the pincode was enriched in another tab).
  function cacheCityFor(pin) {
    if (!pin) { return null; }
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (o && o[pin]) { return o[pin]; }
    } catch (e) {}
    return null;
  }

  function isKolkataLike(obj, zone) {
    return !!(obj && (obj.isKolkata === true)) || zone === 'kolkata' || zone === 'quick_commerce';
  }

  // Build the customer-facing label.
  // opts.lookupRecent (default true): let a resolver location borrow a stored
  // city/name for the same pincode. Pass { lookupRecent: false } for a pure read.
  function get(loc, opts) {
    opts = opts || {};
    if (!loc) { return ''; }
    var pin = normPin(loc.pincode);
    if (!pin) { return ''; }

    var name = str(loc.name) || str(loc.company);
    var city = str(loc.city);
    var zone = str(loc.zone);
    var kolkata = isKolkataLike(loc, zone);

    if ((!name || !city) && opts.lookupRecent !== false) {
      var rec = recentFor(pin);
      if (rec) {
        if (!city) { city = str(rec.city); }
        if (!name) { name = str(rec.name) || str(rec.company); }
        if (!zone) { zone = str(rec.zone); }
        kolkata = kolkata || isKolkataLike(rec, str(rec.zone));
      }
      if (!city) { var cc = cacheCityFor(pin); if (cc) { city = str(cc.city); } } // enriched city cache
    }

    if (name) { return name + ' ' + pin; }            // 1. saved address name/company
    if (city) { return city + ' ' + pin; }            // 2. real city (Places / recent)
    if (kolkata) { return KOLKATA_CITY + ' ' + pin; } // 3. Kolkata / Quick Commerce -> "Kolkata"
    return pin;                                       // 4. pincode only (never "PAN India")
  }

  window.GanguramDisplayLabel = {
    get: get,
    KOLKATA_CITY: KOLKATA_CITY,
    version: 1
  };
})();
