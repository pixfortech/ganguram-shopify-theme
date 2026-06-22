/*
 * Ganguram — 4 Hours Delivery: cart-side availability evaluator (Phase 2 time window)
 * ---------------------------------------------------------------------------
 * The SINGLE source of truth for "is the 4 Hours Delivery option available RIGHT NOW
 * for this cart?", so the cart drawer, the cart page, the persisted checkout method and
 * the delivery-panel chips can never disagree. Read-only / display only.
 *
 * 4 Hours is available only when ALL of these hold:
 *   1. it is ENABLED in admin            (Ganguram4HourConfig.enabled)
 *   2. the current time is INSIDE the 4HR window in the configured timezone
 *      (Ganguram4HourConfig.start/startTime .. end/endTime, timezone, optional days)
 *   3. the customer is INSIDE the 4HR radius   (the quick_commerce zone — the same
 *      basis ShipZip + the cart-attribute handoff already use)
 *   4. EVERY cart item is Quick Commerce eligible
 *   5. the cart meets the minimum order value IF a delivery rule sets one (else N/A)
 *   ( PAN India never qualifies. )
 *
 * It reads window.Ganguram4HourConfig (admin), window.GanguramZone (selected zone),
 * the cart lines ([data-ganguram-cart-line] / [data-ganguram-quick-commerce]) and, for
 * the optional MOV gate, window.GanguramDeliveryRules + [data-gdpr-cart-total]. It NEVER
 * mutates the cart, changes ShipZip rates / service codes / distance slabs / the MOV
 * formula / pincode prefill / the Custom Box Builder / discounts, and never blocks
 * checkout. Fail-safe: with no admin config it treats the window as OPEN (so 4HR is not
 * hidden by an unconfigured store). No jQuery; theme has no dependency on it (consumers
 * fall back to their legacy behaviour when this module is absent).
 *
 * Public API: window.GanguramFourHour
 *   evaluate()            -> the full decision (see fields below)
 *   isAvailableNow()      -> evaluate().visible
 *   isOutsideTimeOnly()   -> true when the ONLY reason 4HR is hidden is the time window
 *   isWithinTimeWindow()  -> boolean (time only)
 *   isEnabled()           -> admin flag
 *   currentKolkataTime()  -> "HH:MM" in the configured timezone
 *   message()             -> "4 hours delivery is available between 9:00 AM and 6:00 PM."
 *   debugState()          -> DEV-ONLY console diagnostics
 * Fires window event 'ganguram:four-hour-window-changed' when the window opens/closes so
 * an open cart re-evaluates at the boundary.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramFourHour) { return; }

  function cfg() { return window.Ganguram4HourConfig || null; }
  function enabled() { var c = cfg(); return !!(c && c.enabled); }
  function startRaw() { var c = cfg(); return (c && (c.startTime || c.start)) || ''; }
  function endRaw() { var c = cfg(); return (c && (c.endTime || c.end)) || ''; }
  function tz() { var c = cfg(); return (c && c.timezone) || 'Asia/Kolkata'; }

  // ---- time window (read entirely from admin config; nothing hard-coded) -----
  function parseDays(raw) {
    if (!raw) { return null; } // null => every day
    var out = [];
    String(raw).split(',').forEach(function (d) { var k = d.trim().toLowerCase().slice(0, 3); if (k) { out.push(k); } });
    return out.length ? out : null;
  }
  function parseHM(s) {
    var m = String(s == null ? '' : s).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) { return null; }
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (h < 0 || h > 24 || mi < 0 || mi > 59) { return null; }
    return h * 60 + mi;
  }
  // Current { day:'mon'..'sun', minutes } in the configured timezone (fallback: local).
  function nowInTz(z) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: z || 'Asia/Kolkata', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
      }).formatToParts(new Date());
      var day = '', h = 0, mi = 0;
      parts.forEach(function (p) {
        if (p.type === 'weekday') { day = p.value.toLowerCase().slice(0, 3); }
        else if (p.type === 'hour') { h = parseInt(p.value, 10) % 24; }
        else if (p.type === 'minute') { mi = parseInt(p.value, 10); }
      });
      return { day: day, minutes: h * 60 + mi };
    } catch (e) {
      var d = new Date();
      var names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      return { day: names[d.getDay()], minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }
  // true when "now" is inside the admin window. No config / misconfigured times fail OPEN
  // (treated as within) so 4HR is never silently hidden by an unconfigured/typo'd window.
  function withinWindow() {
    var c = cfg(); if (!c) { return true; }
    var days = parseDays(c.days);
    var start = parseHM(startRaw()), end = parseHM(endRaw());
    var now = nowInTz(tz());
    if (days && days.indexOf(now.day) === -1) { return false; }
    if (start == null || end == null) { return true; }   // misconfig -> don't hide
    if (start === end) { return true; }                  // equal -> all-day
    if (start < end) { return now.minutes >= start && now.minutes < end; }
    return now.minutes >= start || now.minutes < end;     // overnight window
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmt24(mins) { if (mins == null) { return ''; } var h = Math.floor(mins / 60) % 24, m = mins % 60; return pad(h) + ':' + pad(m); }
  function fmt12(mins) {
    if (mins == null) { return ''; }
    var h = Math.floor(mins / 60) % 24, m = mins % 60, ap = h < 12 ? 'AM' : 'PM', h12 = h % 12; if (h12 === 0) { h12 = 12; }
    return h12 + ':' + pad(m) + ' ' + ap;
  }
  function startText() { return fmt12(parseHM(startRaw())); }
  function endText() { return fmt12(parseHM(endRaw())); }
  function currentKolkataTime() { return fmt24(nowInTz(tz()).minutes); }

  // Customer-facing "available between X and Y" message (admin-overridable template).
  function message() {
    var c = cfg();
    var tpl = (c && c.messages && (c.messages.cartTimeWindow || c.messages.timeWindow)) ||
      '4 hours delivery is available between __START__ and __END__.';
    var s = startText(), e = endText();
    if (!s || !e) { return ''; } // no parseable window -> no message
    return String(tpl).replace(/__START__/g, s).replace(/__END__/g, e);
  }

  // ---- zone + cart context (read-only) --------------------------------------
  function loc() {
    var z = window.GanguramZone;
    if (!z || typeof z.getSelectedDeliveryLocation !== 'function') { return null; }
    try { var l = z.getSelectedDeliveryLocation(); return (l && l.pincode && l.isServiceable === true) ? l : null; } catch (e) { return null; }
  }
  function isPanIndia(l) { return !!(l && (l.zone === 'pan_india' || l.isPanIndia === true)); }
  // 4HR radius = the quick-commerce zone (the resolver's quick_commerce pincode list —
  // the same source ShipZip + the cart handoff use). No distance-slab logic is touched.
  function withinRadius(l) { return !!(l && (l.isQuickCommerce === true || l.zone === 'quick_commerce')); }
  function cartLines() { return document.querySelectorAll('[data-ganguram-cart-line]'); }
  function cartAllQuickCommerce() {
    var ls = cartLines(); if (!ls.length) { return false; }
    for (var i = 0; i < ls.length; i++) { if (String(ls[i].getAttribute('data-ganguram-quick-commerce')) !== 'true') { return false; } }
    return true;
  }
  function readSubtotal() {
    var els = document.querySelectorAll('[data-gdpr-cart-total]');
    for (var i = 0; i < els.length; i++) { var v = parseInt(els[i].getAttribute('data-gdpr-cart-total'), 10); if (isFinite(v) && v >= 0) { return v; } }
    return 0;
  }
  // MOV gate, "if applicable". Prefers the shared GanguramCartMov resolver so 4HR respects the SAME
  // distance-based minimum the cart progress bar shows. We gate 4HR on the MOV only when that MOV
  // actually BLOCKS (a rule MOV, or the theme MOV with "Block checkout below MOV" on) — a display-
  // only MOV is guidance, so it never hides 4HR. Fail-open to the rule engine, then to "not required".
  function movState(l) {
    if (window.GanguramCartMov && typeof window.GanguramCartMov.resolve === 'function') {
      try { var r = window.GanguramCartMov.resolve(l, readSubtotal()); return { required: r.blocking === true, met: r.movMet }; } catch (e) {}
    }
    var dr = window.GanguramDeliveryRules;
    if (!dr || typeof dr.getProgressData !== 'function' || !l) { return { required: false, met: true }; }
    try {
      var data = dr.getProgressData(readSubtotal(), l, {});
      if (!data || data.mov == null) { return { required: false, met: true }; }
      return { required: true, met: data.movMet === true };   // a rule MOV always blocks
    } catch (e) { return { required: false, met: true }; }
  }

  // ---- the single decision --------------------------------------------------
  // hiddenReason is the FIRST failing condition, ordered so 'outside_time' is reported
  // only when the cart would otherwise qualify (enabled + radius + all-QC + MOV met) —
  // that is exactly when the "available between X and Y" message should show.
  function evaluate() {
    var c = cfg();
    var l = loc();
    var en = enabled();
    var radius = withinRadius(l);
    var allQc = cartAllQuickCommerce();
    var mv = movState(l);
    var withinTime = withinWindow();

    var reason = '', visible = true;
    // Only gate on the admin enable flag when the store is actually configured. With NO config
    // the module can't know the merchant's intent, so it fails OPEN (legacy radius + all-QC).
    if (c && !en) { reason = 'disabled'; visible = false; }
    else if (isPanIndia(l) && !radius) { reason = 'pan_india'; visible = false; }
    else if (!radius) { reason = 'outside_radius'; visible = false; }
    else if (!allQc) { reason = 'mixed_cart'; visible = false; }
    else if (mv.required && !mv.met) { reason = 'below_mov'; visible = false; }
    else if (!withinTime) { reason = 'outside_time'; visible = false; }

    return {
      enabled: en,
      withinTime: withinTime,
      currentKolkataTime: currentKolkataTime(),
      windowStart: startText(),
      windowEnd: endText(),
      windowText: (startText() && endText()) ? (startText() + ' and ' + endText()) : '',
      withinRadius: radius,
      cartAllQuickCommerce: allQc,
      movRequired: mv.required,
      movMet: mv.met,
      visible: visible,
      hiddenReason: reason
    };
  }

  function isAvailableNow() { return evaluate().visible; }
  function isOutsideTimeOnly() { return evaluate().hiddenReason === 'outside_time'; }

  // ---- boundary watcher: re-notify consumers when the window opens/closes ----
  var lastWithin = null;
  function watch() {
    try {
      var now = withinWindow();
      if (lastWithin !== null && now !== lastWithin) {
        try { window.dispatchEvent(new CustomEvent('ganguram:four-hour-window-changed', { detail: { withinTime: now } })); }
        catch (e) { /* older browsers: consumers also listen to location/cart events */ }
      }
      lastWithin = now;
    } catch (e) {}
  }
  function init() { lastWithin = withinWindow(); try { setInterval(watch, 30000); } catch (e) {} }

  window.GanguramFourHour = {
    evaluate: evaluate,
    isAvailableNow: isAvailableNow,
    isOutsideTimeOnly: isOutsideTimeOnly,
    isWithinTimeWindow: withinWindow,
    isEnabled: enabled,
    currentKolkataTime: currentKolkataTime,
    message: message,
    // DEV-ONLY diagnostics (console). Display only; never customer-facing.
    debugState: function () {
      var e = evaluate();
      return {
        currentKolkataTime: e.currentKolkataTime,
        isWithinFourHourTimeWindow: e.withinTime,
        isWithinFourHourRadius: e.withinRadius,
        cartAllQuickCommerce: e.cartAllQuickCommerce,
        finalFourHourVisible: e.visible,
        hiddenReason: e.hiddenReason || '(visible)',
        // supporting detail
        enabled: e.enabled,
        movRequired: e.movRequired,
        movMet: e.movMet,
        window: (e.windowStart && e.windowEnd) ? (e.windowStart + ' – ' + e.windowEnd) : '(open / unconfigured)',
        message: message()
      };
    }
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
