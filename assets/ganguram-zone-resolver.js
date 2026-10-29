/* Ganguram postal-area delivery classification. All overlapping postal areas
 * belong wholly to Kolkata. Road distance is ONLY used for prices/express service.
 * No handwritten PIN lists, prefixes, geocoder bounds or centre-point guesses.
 */
(function (window, document) {
  'use strict';
  var SBZ_KEY = 'Zipcode', NS_KEY = 'ganguram.deliveryLocation';
  var EVENT = 'ganguram:delivery-location-changed';
  var memoryPin = '';
  var lastSnapshot = null;
  var classificationCache = Object.create(null), nationalSet = null, nationalData = null;
  function normalizePincode(value) { return value == null ? '' : String(value).trim(); }
  function resolveConfig(override) { return override || window.GanguramZoneConfig || {}; }
  function makeResult(pin, zone, reason) {
    var labels = {kolkata:'Kolkata', pan_india:'PAN India', not_serviceable:'Not serviceable', unknown:''};
    return {pincode:pin, zone:zone, label:labels[zone], reason:reason || '',
      isKolkata:zone === 'kolkata', isPanIndia:zone === 'pan_india', isQuickCommerce:false,
      isServiceable:zone === 'kolkata' || zone === 'pan_india'};
  }
  function classifyPincode(pincode, configOverride) {
    var pin = normalizePincode(pincode), cfg = resolveConfig(configOverride);
    if (!/^[1-9][0-9]{5}$/.test(pin)) return makeResult(pin, 'unknown', 'invalid_pin');
    var data = window.GanguramPostalBoundaries, geo = window.GanguramPostalGeometry;
    var ll = String(cfg.origin || '').split(',').map(Number), origin = [ll[1], ll[0]];
    if (!data || data.version !== 1 || !geo || ll.length !== 2 || !ll.every(Number.isFinite) ||
        !String(cfg.origin || '').trim() || Math.abs(ll[0]) > 90 || Math.abs(ll[1]) > 180 ||
        geo.distance(origin, data.centre) > 0.001) {
      // ShipZip uses an export built for this exact outlet. A changed origin must
      // be regenerated and synchronised before either zone can be promised.
      return makeResult(pin, 'unknown', 'boundary_data_unavailable');
    }
    if (nationalData !== data) {
      nationalSet = new Set(data.nationalPins.split(',')); nationalData = data;
      classificationCache = Object.create(null);
    }
    if (!nationalSet.has(pin)) return makeResult(pin, 'unknown', 'pin_not_in_postal_data');
    var key = origin.join(',') + ':' + pin, local = classificationCache[key];
    if (local === undefined) {
      try {
        local = !!data.geometries[pin] && geo.distanceToGeometry(origin, data.geometries[pin]) <= 20 + 1e-6;
        classificationCache[key] = local;
      } catch (e) { return makeResult(pin, 'unknown', 'invalid_boundary_data'); }
    }
    return makeResult(pin, local ? 'kolkata' : 'pan_india', local ? 'postal_polygon_intersects_20km' : 'outside_postal_boundary');
  }
  // Express service is independent of the Kolkata/PAN India zone. Require a
  // confirmed address distance; estimates must never promise four-hour delivery.
  function expressEligible(pin) {
    var d = window.GanguramDistance, se = window.GanguramShippingEstimate;
    if (!d || !se) return false;
    var distance = d.getForPincode(pin), c = se.config().fourHour;
    return !!(c.enabled && distance.confirmed && distance.distanceKm <= c.maxDistanceKm);
  }
  function safeLS() {
    try {
      var t = '__gz_probe__';
      window.localStorage.setItem(t, t);
      window.localStorage.removeItem(t);
      return window.localStorage;
    } catch (e) {
      return null; // private mode / disabled storage -> degrade gracefully
    }
  }

  function readSnapshot(ls) {
    try {
      var raw = ls.getItem(NS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getSelectedPincode() {
    var ls = safeLS();
    if (!ls) { return memoryPin; }
    var snap = readSnapshot(ls);
    if (snap && snap.pincode) { return normalizePincode(snap.pincode); }
    return normalizePincode(ls.getItem(SBZ_KEY) || ''); // fall back to legacy key
  }

  function getSelectedDeliveryLocation() {
    var result = classifyPincode(getSelectedPincode());
    result.isQuickCommerce = result.isKolkata && expressEligible(result.pincode);
    return result;
  }

  function setSelectedPincode(pincode) {
    var result = classifyPincode(pincode);
    memoryPin = result.pincode;
    var ls = safeLS();
    if (ls) {
      // SBZ compatibility: keep the raw pincode under the exact legacy key.
      ls.setItem(SBZ_KEY, result.pincode);
      // Namespaced snapshot for our own components (richer + versioned).
      ls.setItem(NS_KEY, JSON.stringify({
        pincode: result.pincode,
        zone: result.zone,
        label: result.label,
        ts: Date.now(),
        v: 2
      }));
    }
    lastSnapshot = ls ? ls.getItem(NS_KEY) : null;
    dispatchChange(result);
    return result;
  }

  function clearSelectedDeliveryLocation() {
    memoryPin = '';
    lastSnapshot = null;
    var ls = safeLS();
    if (ls) {
      ls.removeItem(SBZ_KEY);
      ls.removeItem(NS_KEY);
    }
    var result = classifyPincode('');
    dispatchChange(result);
    return result;
  }

  function dispatchChange(result) {
    var evt;
    try {
      evt = new CustomEvent(EVENT, { detail: result });
    } catch (e) {
      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(EVENT, false, false, result);
    }
    window.dispatchEvent(evt);
  }

  // localStorage notifications are delivered only to OTHER documents. Read the
  // final snapshot, not the event payload, so queued events cannot restore old data.
  function reconcileSelection() {
    var ls = safeLS();
    if (!ls) { return; }
    var snapshot = ls.getItem(NS_KEY);
    if (snapshot === lastSnapshot) { return; }
    lastSnapshot = snapshot;
    memoryPin = getSelectedPincode();
    var result = classifyPincode(memoryPin);
    result.external = true;
    dispatchChange(result);
  }
  try { lastSnapshot = window.localStorage.getItem(NS_KEY); } catch (e) {}
  window.addEventListener('storage', function (e) {
    if (e.key === NS_KEY || e.key === null) { reconcileSelection(); }
  });
  window.addEventListener('pageshow', reconcileSelection);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { reconcileSelection(); }
  });

  // ===========================================================================
  // public API
  // ===========================================================================
  window.GanguramZone = {
    // pure
    classifyPincode: classifyPincode,
    // read
    getSelectedPincode: getSelectedPincode,
    getSelectedDeliveryLocation: getSelectedDeliveryLocation,
    // write
    setSelectedPincode: setSelectedPincode,
    clearSelectedDeliveryLocation: clearSelectedDeliveryLocation,
    // meta
    EVENT_NAME: EVENT,
    STORAGE_KEY_SBZ: SBZ_KEY,
    STORAGE_KEY_NS: NS_KEY,
    getConfig: function () { return resolveConfig(); }
  };
})(window, document);
