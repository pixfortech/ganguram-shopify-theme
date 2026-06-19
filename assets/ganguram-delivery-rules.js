/*
 * Ganguram — Delivery rule engine (read + resolve)  (Phase 2.11B foundation)
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
 * Units: all money values are PAISE (integer minor units), matching Shopify's
 * cart.total_price. formatMoney() converts paise → a display string.
 *
 * Public API:
 *   getRules()                              -> normalized active rules (array)
 *   resolve(location, options)              -> { rule, reason, mov, deliveryCharge,
 *                                                freeDeliveryThreshold, fourHourEligible, message }
 *   getProgressData(cartSubtotal, location) -> resolve(...) + cartSubtotal, movRemaining,
 *                                                movMet, freeDeliveryRemaining, freeDeliveryMet
 *   formatMoney(paise)                      -> localized currency string
 *
 * `location` defaults to GanguramZone.getSelectedDeliveryLocation() when omitted.
 * `reason` ∈ exact_pincode | prefix | distance | zone | default | none.
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
  function csv(s) {
    return String(s == null ? '' : s)
      .split(',')
      .map(function (x) { return x.replace(/\s+/g, ''); })
      .filter(Boolean);
  }
  function normPin(v) { return String(v == null ? '' : v).replace(/\D/g, '').slice(0, 6); }

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
        return {
          name: r.name || '',
          active: r.active !== false,
          priority: intOr(r.priority, 0),
          zone: String(r.zone == null ? '' : r.zone).trim(),
          pincodes: csv(r.pincode),
          prefixes: csv(r.pincodePrefix),
          city: r.city || '',
          state: r.state || '',
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

  // A "default" rule carries no specific match criteria (catch-all).
  function isCatchAll(r) {
    return (!r.zone || r.zone === 'default') &&
      r.pincodes.length === 0 &&
      r.prefixes.length === 0 &&
      r.distanceMinKm == null && r.distanceMaxKm == null;
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
    var zone = loc ? String(loc.zone == null ? '' : loc.zone).trim() : '';
    var rules = getRules();
    if (!rules.length) { return pack(null, 'none'); }

    // 1) exact pincode
    if (pin) {
      var exact = rules.filter(function (r) { return r.pincodes.indexOf(pin) !== -1; }).sort(byPriorityDesc);
      if (exact.length) { return pack(exact[0], 'exact_pincode'); }
    }

    // 2) pincode prefix (longest prefix wins, then priority)
    if (pin) {
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

    // 3) distance band (deferred feature — only when a distance is supplied)
    var dist = num(options.distanceKm);
    if (dist != null) {
      var db = rules.filter(function (r) {
        var hasBand = r.distanceMinKm != null || r.distanceMaxKm != null;
        var aboveMin = r.distanceMinKm == null || dist >= r.distanceMinKm;
        var belowMax = r.distanceMaxKm == null || dist <= r.distanceMaxKm;
        return hasBand && aboveMin && belowMax;
      }).sort(byPriorityDesc);
      if (db.length) { return pack(db[0], 'distance'); }
    }

    // 4) zone
    if (zone) {
      var zr = rules.filter(function (r) { return r.zone && r.zone === zone; }).sort(byPriorityDesc);
      if (zr.length) { return pack(zr[0], 'zone'); }
    }

    // 5) default / catch-all
    var def = rules.filter(isCatchAll).sort(byPriorityDesc);
    if (def.length) { return pack(def[0], 'default'); }

    return pack(null, 'none');
  }

  // ---- progress data (DATA ONLY — no UI) -----------------------------------
  function getProgressData(cartSubtotal, location) {
    var sub = num(cartSubtotal);
    if (sub == null || sub < 0) { sub = 0; }
    var res = resolve(location, {});
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
    version: 1
  };
})();
