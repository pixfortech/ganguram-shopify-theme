/*
 * Ganguram — Delivery Zone Resolver  (Phase 2.1a foundation)
 * ---------------------------------------------------------------------------
 * Single source of truth for pincode -> delivery-zone classification.
 * Pure, dependency-free. No jQuery / Bootstrap / FontAwesome / external libs.
 *
 * SCOPE (deliberately tiny):
 *   - classify a pincode into a zone
 *   - read / write / clear the selected delivery location
 *   - announce changes via a browser event
 * It does NOT (and must not, here) touch cart, checkout, MOV, delivery
 * date/slot, shipping rates, zipLogic availability, cart auto-removal, product
 * visibility, menu/search hiding, banners or collection filtering. Those are
 * owned by the SBZ / zipLogic apps and by later phases (2.1b, 2.2, 2.3, 2.5).
 *
 * SBZ COMPATIBILITY: the raw pincode is mirrored to localStorage["Zipcode"]
 * (the exact legacy key the SBZ ShippingApp reads). Do not rename this key.
 *
 * This file is INERT on load: it only defines window.GanguramZone. It performs
 * no DOM work and dispatches no event until a caller invokes the API.
 * ---------------------------------------------------------------------------
 */
(function (window, document) {
  'use strict';

  // ===========================================================================
  // 1) SINGLE SOURCE OF TRUTH — zone config (migrated once from theme 2.3.2).
  //    Override seam: define window.GanguramZoneConfig BEFORE this script to
  //    supply the lists from Liquid / shop metafields later, WITHOUT editing or
  //    duplicating this file. If absent, DEFAULT_CONFIG below is the one source.
  // ===========================================================================
  var DEFAULT_CONFIG = {
    // Kolkata + Howrah hyperlocal-serviceable pincodes.
    kolkata: '700001,700002,700003,700004,700005,700006,700007,700008,700009,700010,700011,700012,700013,700014,700015,700016,700017,700018,700019,700020,700021,700022,700023,700024,700025,700026,700027,700028,700029,700030,700031,700032,700033,700034,700035,700036,700037,700038,700039,700040,700041,700042,700043,700044,700045,700046,700047,700048,700049,700050,700051,700052,700053,700054,700055,700056,700057,700058,700059,700060,700061,700062,700063,700064,700065,700066,700067,700068,700069,700070,700071,700072,700073,700074,700075,700076,700077,700078,700079,700080,700081,700082,700083,700084,700085,700086,700087,700088,700089,700090,700091,700092,700093,700094,700095,700097,700098,700099,700100,700101,700102,700105,700106,700107,700108,700109,700110,700111,700112,700113,700114,700115,700116,700117,700119,700120,700129,700131,700132,700133,700134,700136,700139,700140,700142,700143,700155,700156,711101,711102,711103,711104,711105,711106,711107,711108,711109,711110,711111,711112,711113,711114,711201,711202,711203,711204,711205,711227,712233,712235,712246,712248,712258',
    // Quick-commerce (express) subset of the Kolkata area.
    quickCommerce: '700001,700002,700003,700004,700005,700006,700007,700009,700010,700011,700012,700013,700014,700015,700016,700017,700019,700020,700021,700022,700023,700025,700027,700028,700029,700030,700035,700036,700037,700042,700043,700046,700048,700050,700054,700055,700057,700059,700062,700064,700065,700067,700069,700071,700072,700073,700074,700076,700077,700080,700085,700087,700089,700090,700091,700097,700101,700102,700105,700106,700108,700109,700136,711101,711102,711104,711105,711106,711107,711108,711202,711204',
    labels: {
      kolkata: 'Kolkata',
      quick_commerce: 'Quick Commerce',
      pan_india: 'PAN India',
      not_serviceable: 'Not serviceable',
      unknown: ''
    }
  };

  // Storage keys + event name.
  var SBZ_KEY = 'Zipcode';                    // compatibility contract (SBZ reads this) — do not rename
  var NS_KEY  = 'ganguram.deliveryLocation';  // namespaced JSON snapshot for our own components
  var EVENT   = 'ganguram:delivery-location-changed';

  // ===========================================================================
  // helpers (internal)
  // ===========================================================================
  function resolveConfig(override) {
    var c = override || window.GanguramZoneConfig || DEFAULT_CONFIG;
    return {
      kolkata: String(c.kolkata == null ? '' : c.kolkata),
      quickCommerce: String(c.quickCommerce == null ? '' : c.quickCommerce),
      labels: assign({}, DEFAULT_CONFIG.labels, c.labels || {})
    };
  }

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i];
      if (s) { for (var k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) { target[k] = s[k]; } } }
    }
    return target;
  }

  function normalizePincode(value) {
    return (value == null ? '' : String(value)).replace(/\D/g, '').slice(0, 6);
  }

  function isValidPincode(pin) {
    // Indian PIN: exactly 6 digits, never starts with 0.
    return /^[1-9][0-9]{5}$/.test(pin);
  }

  function listHas(listStr, pin) {
    // Exact, comma-bounded membership test (no substring false-positives).
    return ((',' + listStr + ',').indexOf(',' + pin + ',') !== -1);
  }

  function makeResult(pin, zone, label) {
    return {
      pincode: pin,
      zone: zone, // 'kolkata' | 'quick_commerce' | 'pan_india' | 'not_serviceable' | 'unknown'
      label: label || '',
      isKolkata: zone === 'kolkata' || zone === 'quick_commerce',
      isPanIndia: zone === 'pan_india',
      isQuickCommerce: zone === 'quick_commerce',
      isServiceable: zone === 'kolkata' || zone === 'quick_commerce' || zone === 'pan_india'
    };
  }

  // ===========================================================================
  // 2) PURE FUNCTION — classifyPincode(pincode[, configOverride])
  //    No DOM, no storage, no side effects, never throws. Safe to unit-test.
  // ===========================================================================
  function classifyPincode(pincode, configOverride) {
    var cfg = resolveConfig(configOverride);
    var L = cfg.labels;
    var pin = normalizePincode(pincode);

    if (pin === '' || !isValidPincode(pin)) {
      return makeResult(pin, 'unknown', L.unknown);
    }
    // Quick-commerce is the most specific zone (express within Kolkata).
    if (listHas(cfg.quickCommerce, pin)) {
      return makeResult(pin, 'quick_commerce', L.quick_commerce);
    }
    if (listHas(cfg.kolkata, pin)) {
      return makeResult(pin, 'kolkata', L.kolkata);
    }
    // Any other VALID Indian pincode -> Pan-India (mirrors the 2.3.2 fallback).
    // Note: 'not_serviceable' is reserved for a future config-driven rule and
    // is NOT produced by the default classifier today (parity with 2.3.2).
    return makeResult(pin, 'pan_india', L.pan_india);
  }

  // ===========================================================================
  // 3) STORAGE + EVENT
  // ===========================================================================
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
    if (!ls) { return ''; }
    var snap = readSnapshot(ls);
    if (snap && snap.pincode) { return normalizePincode(snap.pincode); }
    return normalizePincode(ls.getItem(SBZ_KEY) || ''); // fall back to legacy key
  }

  function getSelectedDeliveryLocation() {
    return classifyPincode(getSelectedPincode());
  }

  function setSelectedPincode(pincode) {
    var result = classifyPincode(pincode);
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
        v: 1
      }));
    }
    dispatchChange(result);
    return result;
  }

  function clearSelectedDeliveryLocation() {
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
