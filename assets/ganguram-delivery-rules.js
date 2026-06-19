/*
 * Ganguram — Delivery rule engine (read + resolve)  (Phase 2.11B, extended 2.11B.1)
 * ---------------------------------------------------------------------------
 * Reads the admin-configured delivery rules published by
 * snippets/ganguram-delivery-rules-config.liquid (from the `ganguram_delivery_rule`
 * metaobject) and resolves the single rule that applies to the currently selected
 * delivery location. Defines window.GanguramDeliveryRules.
 *
 * FOUNDATION ONLY — a pure data/resolver layer. It renders NO UI, builds NO
 * progress bar, enforces NO MOV, sets NO delivery charge, and changes NO
 * checkout / cart / ShipZip / SBZ / zipLogic / Google / resolver behaviour. It is
 * INERT on load (only defines the global) and fully FAIL-OPEN: with no config /
 * no rules / no selection it returns a safe null/default and never throws.
 *
 * MODEL (2.11B.1): supports state-level MOV and distance-radius local delivery.
 * Resolution priority (most-specific-wins):
 *   1. exact_pincode — always highest (explicit per-pincode admin override).
 *   2/3. "DISTANCE MODE" — when a distanceKm is supplied AND at least one rule
 *        defines a band/radius (i.e. a Google address with coordinates):
 *          a. distance band  (distance_min_km..distance_max_km)         -> 'distance'
 *          b. local radius   (distanceKm <= local_radius_km = local)    -> 'local_radius'
 *        A FAR address (beyond every band/radius) matches NEITHER, so it is treated
 *        as REMOTE: pincode-prefix local rules are SKIPPED and it falls through to
 *        state / PAN India even if its pincode is in West Bengal (requirement #6).
 *      OTHERWISE (manual pincode entry, or no band/radius rules configured):
 *          prefix — rule.pincode_prefix matches, longest prefix wins  -> 'prefix'
 *   4. state      — state_key / state_name / state matches the location's state
 *   5. pan_india  — the PAN India default rule (zone_key = 'pan_india')
 *   6. default    — the global catch-all (a rule with no match criteria)
 *   -> none       — nothing matched and no default exists
 *
 * Manual pincode-only entries supply no distance, so they use exact -> prefix ->
 * state -> PAN India (requirement #7); exact distance needs address coordinates.
 *
 * Units: money values are PAISE (integer minor units, matching cart.total_price);
 * distances are KILOMETRES. `location` defaults to
 * GanguramZone.getSelectedDeliveryLocation(); the location's STATE (for tier 4) is
 * taken from location.state, else options.state, else the read-only enrichment
 * caches (ganguram.pincodeCityCache / ganguram.recentLocations).
 *
 * Public API:
 *   getRules()
 *   resolve(location, options)               options: { distanceKm, state }
 *   getProgressData(cartSubtotal, location, options)   (DATA ONLY — no UI)
 *   formatMoney(paise)
 * No jQuery / Bootstrap / FontAwesome.
 * ---------------------------------------------------------------------------
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
          message: r.message || ''
        };
      });
  }

  function isPanIndiaDefault(r) { return r.zone === 'pan_india'; }
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

  // ---- resolution (most-specific-wins) -------------------------------------
  function resolve(location, options) {
    options = options || {};
    var loc = location || currentLocation();
    var pin = loc ? normPin(loc.pincode) : '';
    var state = (loc && loc.state) ? String(loc.state) : (options.state ? String(options.state) : stateFor(pin));
    state = state ? state.trim().toLowerCase() : '';
    var distanceKm = num(options.distanceKm);
    var rules = getRules();
    if (!rules.length) { return pack(null, 'none'); }

    // 1) exact pincode — always highest (explicit per-pincode override)
    if (pin) {
      var exact = rules.filter(function (r) { return r.pincodes.indexOf(pin) !== -1; }).sort(byPriorityDesc);
      if (exact.length) { return pack(exact[0], 'exact_pincode'); }
    }

    // Distance mode: a distance is supplied AND the admin configured at least one
    // band/radius rule. In that case distance is AUTHORITATIVE for local-vs-remote
    // and pincode-prefix local is bypassed (so a far address is never "local").
    var hasDistanceRules = rules.some(function (r) {
      return r.localRadiusKm != null || r.distanceMinKm != null || r.distanceMaxKm != null;
    });
    var distanceMode = (distanceKm != null && hasDistanceRules);

    if (distanceMode) {
      // 3a) explicit distance band (most specific)
      var band = rules.filter(function (r) {
        var hasBand = r.distanceMinKm != null || r.distanceMaxKm != null;
        var aboveMin = r.distanceMinKm == null || distanceKm >= r.distanceMinKm;
        var belowMax = r.distanceMaxKm == null || distanceKm <= r.distanceMaxKm;
        return hasBand && aboveMin && belowMax;
      }).sort(byPriorityDesc);
      if (band.length) { return pack(band[0], 'distance'); }

      // 3b) local radius (within radius -> local/Kolkata). Smallest radius that
      //     still contains the distance wins, then priority. BEYOND every radius
      //     -> no match here; skip prefix and fall through (requirement #6).
      var rad = rules
        .filter(function (r) { return r.localRadiusKm != null && distanceKm <= r.localRadiusKm; })
        .sort(function (a, b) { return (a.localRadiusKm - b.localRadiusKm) || byPriorityDesc(a, b); });
      if (rad.length) { return pack(rad[0], 'local_radius'); }
    } else if (pin) {
      // 2) pincode prefix (manual entry / no distance) — longest prefix wins
      var pref = rules
        .map(function (r) {
          var best = 0;
          for (var i = 0; i < r.prefixes.length; i++) {
            var p = r.prefixes[i];
            if (p && pin.indexOf(p) === 0 && p.length > best) { best = p.length; }
          }
          return { r: r, plen: best };
        })
        .filter(function (x) { return x.plen > 0; })
        .sort(function (a, b) { return (b.plen - a.plen) || byPriorityDesc(a.r, b.r); });
      if (pref.length) { return pack(pref[0].r, 'prefix'); }
    }

    // 4) state (state_key / state_name / state)
    if (state) {
      var st = rules.filter(function (r) {
        return r.stateNames.indexOf(state) !== -1 || r.stateKeys.indexOf(state) !== -1;
      }).sort(byPriorityDesc);
      if (st.length) { return pack(st[0], 'state'); }
    }

    // 5) PAN India default
    var pi = rules.filter(isPanIndiaDefault).sort(byPriorityDesc);
    if (pi.length) { return pack(pi[0], 'pan_india'); }

    // 6) global default / catch-all
    var def = rules.filter(isGlobalDefault).sort(byPriorityDesc);
    if (def.length) { return pack(def[0], 'default'); }

    return pack(null, 'none');
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
    getProgressData: getProgressData,
    formatMoney: formatMoney,
    version: 2
  };
})();
