/* Ganguram delivery rules, scoped to the computed postal zone.
 * Manual PIN, prefix and state overrides cannot change delivery eligibility.
 * Distance bands select tariffs within a zone; a long road route never turns
 * an included Kolkata postal area into PAN India. Beyond 20 km, Standard
 * Delivery uses the highest configured local tier (currently INR 150).
 * This module returns rule data; ShipZip enforces checkout rates separately.
 * Currency values are paise. Distances are kilometres.
 */
(function () {
  'use strict';
  if (window.GanguramDeliveryRules) { return; } // idempotent

  function cfg() { return window.GanguramDeliveryRulesConfig || {}; }
  function rawRules() { var r = cfg().rules; return Array.isArray(r) ? r : []; }

  function num(v) {
    if (v == null || v === '') { return null; }
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : null;
  }
  function intOr(v, d) { var n = num(v); return n == null ? d : Math.round(n); }
  function trim(v) { return String(v == null ? '' : v).trim(); }
  function csv(s) {
    return String(s == null ? '' : s).split(',').map(function (x) { return x.replace(/\s+/g, ''); }).filter(Boolean);
  }
  function csvLower(s) {
    return String(s == null ? '' : s).split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
  }
  function normPin(v) { return String(v == null ? '' : v).replace(/\D/g, '').slice(0, 6); }

  function readJSON(key) {
    try { var raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  // State for a pincode, from the read-only enrichment caches (never written here).
  function stateFor(pin) {
    if (!pin) { return ''; }
    var c = readJSON('ganguram.pincodeCityCache');
    if (c && c[pin] && c[pin].state) { return String(c[pin].state); }
    var arr = readJSON('ganguram.recentLocations');
    if (Array.isArray(arr)) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && normPin(arr[i].pincode) === pin && arr[i].state) { return String(arr[i].state); }
      }
    }
    return '';
  }

  function currentLocation() {
    var z = window.GanguramZone;
    if (z && typeof z.getSelectedDeliveryLocation === 'function') {
      try { return z.getSelectedDeliveryLocation(); } catch (e) {}
    }
    return null;
  }

  // ---- normalized, active rules --------------------------------------------
  function getRules() {
    return rawRules()
      .filter(function (r) { return r && r.active !== false; })
      .map(function (r) {
        // state matchers: the dedicated state_key/state_name fields PLUS the
        // descriptive `state` field, all case-insensitive.
        var stateNames = csvLower(r.stateName).concat(csvLower(r.state));
        return {
          name: r.name || '',
          active: r.active !== false,
          priority: intOr(r.priority, 0),
          zone: trim(r.zone),
          pincodes: csv(r.pincode),
          prefixes: csv(r.pincodePrefix),
          stateKeys: csvLower(r.stateKey),
          stateNames: stateNames,
          city: r.city || '',
          state: r.state || '',
          localRadiusKm: num(r.localRadiusKm),
          distanceMinKm: num(r.distanceMinKm),
          distanceMaxKm: num(r.distanceMaxKm),
          mov: num(r.mov),
          deliveryCharge: num(r.deliveryCharge),
          freeDeliveryThreshold: num(r.freeDeliveryThreshold),
          fourHourEligible: r.fourHourEligible === true,
          message: r.message || '',
          // delivery service option fields (2.11B.2)
          serviceType: trim(r.serviceType).toLowerCase(),
          serviceLabel: r.serviceLabel || '',
          datePickerRequired: r.datePickerRequired === true,
          defaultDateOffsetDays: (function () { var n = num(r.defaultDateOffsetDays); return n == null ? null : Math.round(n); })(),
          requiresFourHourEligibleCart: r.requiresFourHourEligibleCart === true,
          customerMessageForCartValue: r.customerMessageForCartValue || '',
          customerMessageForDeliveryDate: r.customerMessageForDeliveryDate || ''
        };
      });
  }

  function isPanIndiaDefault(r) { return r.zone === 'pan_india'; }
  function isLocalZone(z) { return z === 'kolkata' || z === 'quick_commerce'; }
  // Global catch-all: no match criteria at all (and not the PAN India default).
  function isGlobalDefault(r) {
    return (!r.zone || r.zone === 'default') &&
      r.pincodes.length === 0 && r.prefixes.length === 0 &&
      r.stateKeys.length === 0 && r.stateNames.length === 0 &&
      r.localRadiusKm == null && r.distanceMinKm == null && r.distanceMaxKm == null;
  }
  function byPriorityDesc(a, b) { return (b.priority || 0) - (a.priority || 0); }

  function pack(rule, reason) {
    return {
      rule: rule || null,
      reason: reason,
      mov: rule ? rule.mov : null,
      deliveryCharge: rule ? rule.deliveryCharge : null,
      freeDeliveryThreshold: rule ? rule.freeDeliveryThreshold : null,
      fourHourEligible: rule ? rule.fourHourEligible : null,
      message: rule ? rule.message : ''
    };
  }

  function normService(r) { return r.serviceType || 'standard'; } // blank -> 'standard' (default service)

  // ---- shared resolution context (used by resolve + getServiceOptions) -----
  function buildContext(location, options) {
    options = options || {};
    var loc = location || currentLocation();
    var pin = loc ? normPin(loc.pincode) : '';
    var zone = loc ? trim(loc.zone) : '';
    var state = (loc && loc.state) ? String(loc.state) : (options.state ? String(options.state) : stateFor(pin));
    state = state ? state.trim().toLowerCase() : '';
    var distanceKm = num(options.distanceKm);
    var allRules = getRules();
    // Distance mode is GLOBAL (based on whether ANY rule defines a band/radius), so
    // local-vs-remote is decided the same way for every service type.
    var hasDistanceRules = allRules.some(function (r) {
      return r.localRadiusKm != null || r.distanceMinKm != null || r.distanceMaxKm != null;
    });
    return { pin: pin, zone: zone, state: state, distanceKm: distanceKm, distanceMode: (distanceKm != null && hasDistanceRules), allRules: allRules };
  }

  // Most-specific-wins over a GIVEN rule subset, using a shared context.
  // Returns { rule, reason }. resolve() runs it over ALL rules; getServiceOptions()
  // runs it once per service type so each service yields its best rule for the slab.
  function resolveAmong(rules, ctx) {
    var pin = ctx.pin, zone = ctx.zone, state = ctx.state, distanceKm = ctx.distanceKm, distanceMode = ctx.distanceMode;
    if (!rules.length) { return { rule: null, reason: 'none' }; }

    // A PIN's polygon decides its zone. Neither a manually entered PIN/prefix,
    // a descriptive state field nor a long road route may override that decision.
    if (zone !== 'kolkata' && zone !== 'pan_india') return {rule:null, reason:'unknown_zone'};
    rules = rules.filter(function (r) {
      return r.pincodes.length === 0 && r.prefixes.length === 0 &&
        (r.zone === zone || isGlobalDefault(r));
    });
    if (distanceMode) {
      var band = rules.filter(function (r) {
        return (r.distanceMinKm != null || r.distanceMaxKm != null) &&
          (r.distanceMinKm == null || distanceKm >= r.distanceMinKm) &&
          (r.distanceMaxKm == null || distanceKm <= r.distanceMaxKm);
      }).sort(byPriorityDesc);
      if (band.length) return {rule:band[0], reason:'distance'};
    }
    // Zone defaults apply to the entire expanded postal boundary. Radius-only
    // records no longer determine membership; their prices are retained locally.
    var defaults = rules.filter(function (r) {
      return r.zone === zone && r.distanceMinKm == null && r.distanceMaxKm == null;
    }).sort(byPriorityDesc);
    if (defaults.length) {
      var fallback = defaults[0];
      // Newly included postal areas can have road routes beyond the old 20 km
      // slab. Match the approved highest local tier instead of the legacy default.
      if (zone === 'kolkata' && distanceKm > 20 && normService(fallback) === 'standard' && window.GanguramShippingEstimate) {
        fallback = Object.assign({}, fallback, {
          deliveryCharge: window.GanguramShippingEstimate.standardForKm(distanceKm).maxPrice * 100,
          freeDeliveryThreshold: null
        });
      }
      return {rule:fallback, reason:'postal_zone'};
    }
    var global = rules.filter(isGlobalDefault).sort(byPriorityDesc);
    if (global.length) return {rule:global[0], reason:'default'};
    return { rule: null, reason: 'none' };
  }

  function resolve(location, options) {
    var ctx = buildContext(location, options);
    var r = resolveAmong(ctx.allRules, ctx);
    return pack(r.rule, r.reason);
  }

  // ---- delivery service options (2.11B.2) ----------------------------------
  // Returns the best rule PER service type for the location — e.g. a 'standard'
  // and a 'four_hour' option for the same distance slab — so Phase 2.11C can offer
  // delivery service choices. DATA ONLY; no UI, no enforcement.
  function serviceOption(r, reason) {
    return {
      serviceType: normService(r),
      serviceLabel: r.serviceLabel,
      reason: reason,
      name: r.name,
      priority: r.priority,
      mov: r.mov,
      deliveryCharge: r.deliveryCharge,
      freeDeliveryThreshold: r.freeDeliveryThreshold,
      fourHourEligible: r.fourHourEligible,
      datePickerRequired: r.datePickerRequired,
      defaultDateOffsetDays: r.defaultDateOffsetDays,
      requiresFourHourEligibleCart: r.requiresFourHourEligibleCart,
      customerMessageForCartValue: r.customerMessageForCartValue,
      customerMessageForDeliveryDate: r.customerMessageForDeliveryDate,
      message: r.message,
      eligible: true // refined below for options that require a 4-hour-eligible cart
    };
  }

  // options: { distanceKm, state, fourHourEligibleCart }  (all optional)
  //   fourHourEligibleCart: true | false | undefined(unknown).
  // A four-hour option (requiresFourHourEligibleCart) is DROPPED when the cart is
  // known ineligible (req #5); when eligibility is unknown it is kept with
  // eligible:null so Phase 2.11C can filter it safely once it knows (req #6).
  function getServiceOptions(location, options) {
    options = options || {};
    var ctx = buildContext(location, options);
    var four = options.fourHourEligibleCart;
    var known = (four === true || four === false);

    // distinct service types present (blank normalized to 'standard')
    var seen = {}, services = [];
    for (var i = 0; i < ctx.allRules.length; i++) {
      var s = normService(ctx.allRules[i]);
      if (!seen[s]) { seen[s] = 1; services.push(s); }
    }

    var out = [];
    services.forEach(function (svc) {
      var subset = ctx.allRules.filter(function (r) { return normService(r) === svc; });
      var res = resolveAmong(subset, ctx);
      if (!res.rule) { return; }
      var o = serviceOption(res.rule, res.reason);
      if (o.requiresFourHourEligibleCart) {
        if (four === false) { return; }              // known ineligible -> drop (req #5)
        o.eligible = (four === true) ? true : null;   // null = unknown -> 2.11C filters (req #6)
      }
      out.push(o);
    });

    // standard first, then four_hour, then others; tie-break by priority desc
    var rank = { standard: 0, four_hour: 1 };
    out.sort(function (a, b) {
      var ra = (a.serviceType in rank) ? rank[a.serviceType] : 2;
      var rb = (b.serviceType in rank) ? rank[b.serviceType] : 2;
      return (ra - rb) || ((b.priority || 0) - (a.priority || 0));
    });

    var primary = null;
    for (var j = 0; j < out.length; j++) { if (out[j].serviceType === 'standard') { primary = out[j]; break; } }
    if (!primary && out.length) { primary = out[0]; }

    return {
      reason: primary ? primary.reason : 'none',
      primary: primary,
      fourHourEligibleCartKnown: known,
      fourHourEligibleCart: known ? four : null,
      options: out
    };
  }

  // ---- progress data (DATA ONLY — no UI) -----------------------------------
  function getProgressData(cartSubtotal, location, options) {
    var sub = num(cartSubtotal);
    if (sub == null || sub < 0) { sub = 0; }
    var res = resolve(location, options || {});
    var mov = res.mov;
    var fdt = res.freeDeliveryThreshold;

    var movMet = (mov == null) ? true : sub >= mov;
    var movRemaining = (mov != null && sub < mov) ? (mov - sub) : 0;

    var freeDeliveryMet = (fdt == null) ? false : sub >= fdt;
    var freeDeliveryRemaining = (fdt == null) ? null : (sub < fdt ? (fdt - sub) : 0);

    return {
      rule: res.rule,
      reason: res.reason,
      cartSubtotal: sub,
      mov: mov,
      deliveryCharge: res.deliveryCharge,
      freeDeliveryThreshold: fdt,
      fourHourEligible: res.fourHourEligible,
      message: res.message,
      movMet: movMet,
      movRemaining: movRemaining,
      freeDeliveryMet: freeDeliveryMet,
      freeDeliveryRemaining: freeDeliveryRemaining
    };
  }

  // ---- money formatting (paise -> string) ----------------------------------
  function formatMoney(paise) {
    var v = num(paise);
    if (v == null) { return ''; }
    var rupees = v / 100;
    var cur = cfg().currency || 'INR';
    try {
      var fractions = (rupees % 1 === 0) ? 0 : 2;
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: cur,
        minimumFractionDigits: fractions, maximumFractionDigits: 2
      }).format(rupees);
    } catch (e) {
      return '₹' + (rupees % 1 === 0 ? String(rupees) : rupees.toFixed(2));
    }
  }

  window.GanguramDeliveryRules = {
    getRules: getRules,
    resolve: resolve,
    getServiceOptions: getServiceOptions,
    getProgressData: getProgressData,
    formatMoney: formatMoney,
    version: 4
  };
})();
