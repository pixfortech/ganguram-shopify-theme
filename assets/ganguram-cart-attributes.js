/*
 * Ganguram — Delivery location -> cart attributes handoff  (Phase 2.10A / 2.11D.2)
 * ---------------------------------------------------------------------------
 * Mirrors the SELECTED delivery location (pincode + zone, via GanguramZone — the
 * single source of truth) into Shopify CART ATTRIBUTES, so the delivery context
 * travels with the cart/order for admin visibility and a shipping-app handoff.
 *
 * 2.11D.2: ALSO writes app-facing eligibility signals a shipping-rate app (ShipZip)
 * can match on to offer / hide its 4-hour rate — ganguram_all_quick_commerce
 * ('true' only when EVERY cart line is Quick-Commerce-tagged), ganguram_delivery_
 * mode_candidates ('standard' or 'standard,four_hour'), ganguram_selected_pincode,
 * ganguram_delivery_zone. This only EXPOSES the cart's eligibility to the app via
 * cart attributes (the one channel that survives into checkout — localStorage/DOM
 * do not). It does NOT create, change or fake any shipping rate; the app/admin
 * still owns the actual 4-hour rate, its zipcode match and its time window.
 *
 * HANDOFF ONLY. This module:
 *   - listens to the existing 'ganguram:delivery-location-changed' event,
 *   - reads state via GanguramZone.getSelectedDeliveryLocation() (no new resolver),
 *   - PATCHes a small, fixed set of cart attributes via the Ajax Cart API
 *     (/cart/update.js), merging — never clobbering other attributes,
 *   - debounces writes and skips redundant ones (compares against /cart.js),
 *   - does a best-effort, NON-BLOCKING flush right before checkout,
 *   - optionally paints a subtle read-only "Delivering to: <zone> <pincode>" line.
 *
 * It must NOT (and does not): autofill or change checkout, change the checkout URL
 * or button behaviour, touch MOV / date-slot / shipping rates / SBZ / ShipZip /
 * zipLogic / payment, change product/cart eligibility or cart removal/undo, change
 * product/menu/search filtering, add Google Maps, or write localStorage["Zipcode"]
 * directly. It is fully FAIL-OPEN: any Ajax error is a silent console warning and
 * never blocks the customer or checkout.
 *
 * PRIVACY: stores only the pincode, zone, zone label, a coarse source label, and —
 * only when it was already captured as a short safe summary (city/state on the
 * recent-locations entry) — that city/state string. Never a full street address,
 * never lat/lng, never a Google place_id.
 *
 * No jQuery / Bootstrap / FontAwesome / external libs.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramCartAttributesInit) { return; }
  window.__ganguramCartAttributesInit = true;

  var EVENT = 'ganguram:delivery-location-changed';
  var RECENT_KEY = 'ganguram.recentLocations'; // read-only here; owned by saved-locations/places
  var ALLOWED_SOURCES = { manual: 1, recent: 1, saved_address: 1, google_places: 1 };

  // ---- config (single-sourced from the snippet) -----------------------------
  function cfg() { return window.GanguramCartAttributesConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function updateUrl() { return cfg().updateUrl || '/cart/update.js'; }
  function cartUrl() { return cfg().cartUrl || '/cart.js'; }
  function debounceMs() { var n = parseInt(cfg().debounceMs, 10); return (isFinite(n) && n >= 0) ? n : 600; }
  function summaryEnabled() { return cfg().summaryEnabled !== false; }
  function summaryLabel() { return cfg().summaryLabel || 'Delivering to:'; }
  function keys() {
    var k = cfg().keys || {};
    return {
      pincode: k.pincode || 'Delivery Pincode',
      zone: k.zone || 'Delivery Zone',
      zoneLabel: k.zoneLabel || 'Delivery Zone Label',
      source: k.source || 'Delivery Location Source',
      addressSummary: k.addressSummary || 'Delivery Address Summary',
      // App-facing (snake_case) signals a shipping-rate app (e.g. ShipZip) can match
      // on to offer / hide the 4-hour rate. These do NOT change checkout or rates —
      // they only EXPOSE the cart's Quick-Commerce eligibility + location to the app,
      // which remains the sole owner of the actual rate (Phase 2.11D.2).
      allQuickCommerce: k.allQuickCommerce || 'ganguram_all_quick_commerce',
      deliveryModeCandidates: k.deliveryModeCandidates || 'ganguram_delivery_mode_candidates',
      selectedPincode: k.selectedPincode || 'ganguram_selected_pincode',
      deliveryZone: k.deliveryZone || 'ganguram_delivery_zone',
      // Selected FULL address mirrored to the cart so the checkout prefill survives a CLEAN /
      // private session (no localStorage). Underscore-prefixed -> present in /cart.js but hidden
      // from the order "Additional details" (the prefilled shipping address is the order record).
      shipAddress1: k.shipAddress1 || '_ganguram_ship_address1',
      shipAddress2: k.shipAddress2 || '_ganguram_ship_address2',
      shipCity: k.shipCity || '_ganguram_ship_city',
      shipProvince: k.shipProvince || '_ganguram_ship_province',
      shipCountry: k.shipCountry || '_ganguram_ship_country',
      shipZip: k.shipZip || '_ganguram_ship_zip',
      shipLat: k.shipLat || '_ganguram_ship_lat',
      shipLng: k.shipLng || '_ganguram_ship_lng'
    };
  }

  function warn(msg, err) {
    try { if (window.console && console.warn) { console.warn('[ganguram-cart-attributes] ' + msg, err || ''); } } catch (e) {}
  }

  function zone() { return window.GanguramZone || null; }
  function currentLoc() {
    var z = zone();
    if (!z || typeof z.getSelectedDeliveryLocation !== 'function') { return null; }
    try { return z.getSelectedDeliveryLocation(); } catch (e) { return null; }
  }
  function norm(p) { return String(p == null ? '' : p).replace(/\D/g, '').slice(0, 6); }
  // The SELECTED full Google address (or null) — mirrored to the cart so the prefill survives
  // a clean / private session. Read-only; GanguramAddress owns the store.
  function selectedAddress() {
    var a = window.GanguramAddress;
    if (a && typeof a.getSelectedAddress === 'function') { try { return a.getSelectedAddress(); } catch (e) {} }
    return null;
  }

  // ---- privacy-minimal enrichment (read-only) -------------------------------
  // city/state only ever live on the recent-locations entry, and ONLY when the
  // customer used Google Places (the places module enriches them). We read them
  // to build a short safe summary + infer the source; we never store anything else.
  function recentFor(pin) {
    if (!pin) { return null; }
    try {
      var raw = window.localStorage.getItem(RECENT_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) { return null; }
      for (var i = 0; i < arr.length; i++) { if (arr[i] && arr[i].pincode === pin) { return arr[i]; } }
    } catch (e) {}
    return null;
  }
  function safeSummary(rec) {
    if (!rec) { return ''; }
    var parts = [];
    if (rec.city) { parts.push(String(rec.city)); }
    if (rec.state) { parts.push(String(rec.state)); }
    return parts.join(', ');
  }
  function inferSource(detail, rec) {
    var s = detail && detail.source;          // honoured if a future caller provides one
    if (s && ALLOWED_SOURCES[s]) { return s; }
    if (rec && (rec.city || rec.state)) { return 'google_places'; } // only Places enriches these
    return 'manual';
  }

  // ---- cart Quick-Commerce eligibility (read-only, from the cart-line DOM) ----
  // The cart drawer (global) + cart page render each line with
  // data-ganguram-quick-commerce="true|false" (set ONLY from the 'Quick Commerce'
  // product tag). "All quick commerce" = the cart has items and EVERY line is true.
  function cartQuickCommerceState() {
    var lines = document.querySelectorAll('[data-ganguram-cart-line]');
    if (!lines.length) { return { hasItems: false, allQuickCommerce: false }; }
    for (var i = 0; i < lines.length; i++) {
      if (String(lines[i].getAttribute('data-ganguram-quick-commerce')) !== 'true') {
        return { hasItems: true, allQuickCommerce: false };
      }
    }
    return { hasItems: true, allQuickCommerce: true };
  }
  function isLocalZone(loc) {
    return !!(loc && (loc.zone === 'kolkata' || loc.zone === 'quick_commerce' || loc.isKolkata === true || loc.isQuickCommerce === true));
  }
  // 4-hour AREA eligibility = the quick-commerce zone (matches the cart panel + ShipZip,
  // Phase 2.11F.3). A Kolkata pincode that is NOT quick-commerce does not get four_hour.
  function fourHourArea(loc) {
    return !!(loc && (loc.isQuickCommerce === true || loc.zone === 'quick_commerce'));
  }

  // ---- desired attribute map ------------------------------------------------
  // Blank values are intentional: /cart/update.js removes an attribute when its
  // value is '', which is exactly how we "clear" the handoff.
  function desiredAttributes(detail) {
    var K = keys();
    var out = {};
    out[K.pincode] = ''; out[K.zone] = ''; out[K.zoneLabel] = ''; out[K.source] = ''; out[K.addressSummary] = '';
    out[K.allQuickCommerce] = ''; out[K.deliveryModeCandidates] = ''; out[K.selectedPincode] = ''; out[K.deliveryZone] = '';
    out[K.shipAddress1] = ''; out[K.shipAddress2] = ''; out[K.shipCity] = ''; out[K.shipProvince] = '';
    out[K.shipCountry] = ''; out[K.shipZip] = ''; out[K.shipLat] = ''; out[K.shipLng] = '';
    var loc = currentLoc();
    if (loc && loc.pincode && loc.isServiceable === true) {
      var rec = recentFor(loc.pincode);
      out[K.pincode] = loc.pincode;
      out[K.zone] = loc.zone || '';
      out[K.zoneLabel] = loc.label || '';
      out[K.source] = inferSource(detail, rec);
      out[K.addressSummary] = safeSummary(rec); // '' when no safe summary exists -> pincode+zone only

      // App-facing signals (ShipZip etc.). selectedPincode/deliveryZone mirror the
      // human-readable pincode/zone under stable snake_case keys; allQuickCommerce is
      // 'true'/'false' (blank when the cart is empty); deliveryModeCandidates lists
      // 'standard' (always) + 'four_hour' ONLY when every cart line is Quick Commerce
      // AND a local (Kolkata / quick_commerce) zone is selected. The app still owns
      // the final rate, time-window and zipcode checks.
      out[K.selectedPincode] = loc.pincode;
      out[K.deliveryZone] = loc.zone || '';
      var qc = cartQuickCommerceState();
      if (qc.hasItems) {
        out[K.allQuickCommerce] = qc.allQuickCommerce ? 'true' : 'false';
        var cand = ['standard'];
        if (qc.allQuickCommerce && fourHourArea(loc)) { cand.push('four_hour'); }
        out[K.deliveryModeCandidates] = cand.join(',');
      }

      // Mirror the SELECTED full address (if one is set for THIS pincode) to the cart so the
      // checkout prefill survives a clean / private session with no localStorage. Pincode-only
      // selections leave these blank, so a stale address can never ride along.
      var addr = selectedAddress();
      if (addr && norm(addr.zip || addr.pincode) === norm(loc.pincode) && addr.address1) {
        out[K.shipAddress1] = String(addr.address1 || '');
        out[K.shipAddress2] = String(addr.address2 || '');
        out[K.shipCity] = String(addr.city || '');
        out[K.shipProvince] = String(addr.state || '');
        out[K.shipCountry] = String(addr.country || '');
        out[K.shipZip] = norm(addr.zip || addr.pincode || loc.pincode);
        if (typeof addr.lat === 'number' && isFinite(addr.lat)) { out[K.shipLat] = String(addr.lat); }
        if (typeof addr.lng === 'number' && isFinite(addr.lng)) { out[K.shipLng] = String(addr.lng); }
      }
    }
    return out;
  }
  function hasPincode(attrs) { return !!attrs[keys().pincode]; }
  function signature(attrs) { try { return JSON.stringify(attrs); } catch (e) { return String(Math.random()); } }

  // ---- sync -----------------------------------------------------------------
  var lastSig = null, lastWriteStatus = 'idle', lastWriteAt = null, lastWriteError = null;

  function postAttributes(attrs, useKeepalive) {
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ attributes: attrs })
    };
    if (useKeepalive) { opts.keepalive = true; }
    return fetch(updateUrl(), opts);
  }

  // Compare against the live cart so we never write redundantly and so a missing
  // attribute counts as blank (a fresh visitor with no selection => no write).
  function doSync(detail) {
    if (!enabled()) { return; }
    var desired = desiredAttributes(detail);
    var desiredSig = signature(desired);
    if (desiredSig === lastSig) { lastWriteStatus = 'in_sync'; return; }
    lastWriteStatus = 'writing'; lastWriteError = null;
    fetch(cartUrl(), { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var cur = (cart && cart.attributes) || {};
        var same = true;
        for (var name in desired) {
          if (!Object.prototype.hasOwnProperty.call(desired, name)) { continue; }
          if (String(cur[name] == null ? '' : cur[name]) !== String(desired[name])) { same = false; break; }
        }
        if (same) { lastSig = desiredSig; lastWriteStatus = 'in_sync'; lastWriteAt = Date.now(); return null; }
        return postAttributes(desired, false).then(function () { lastSig = desiredSig; lastWriteStatus = 'ok'; lastWriteAt = Date.now(); });
      })
      .catch(function (err) { lastWriteStatus = 'error'; lastWriteError = (err && err.message) || String(err); warn('cart attribute sync failed (non-blocking)', err); });
  }

  var timer = null;
  function scheduleSync(detail) {
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(function () { timer = null; doSync(detail); }, debounceMs());
  }

  // Best-effort flush right before checkout. Only pushes when a pincode is set,
  // uses keepalive so it survives navigation, and NEVER blocks or preventDefaults.
  function flushSync() {
    if (!enabled()) { return; }
    var desired = desiredAttributes(null);
    if (!hasPincode(desired)) { return; }     // nothing meaningful to push; clearing is event-driven
    var desiredSig = signature(desired);
    if (desiredSig === lastSig) { return; }   // already in sync this session
    try {
      postAttributes(desired, true)
        .then(function () { lastSig = desiredSig; })
        .catch(function (err) { warn('pre-checkout sync failed (non-blocking)', err); });
    } catch (err) { warn('pre-checkout sync threw (non-blocking)', err); }
  }

  // ---- optional read-only "Delivering to:" summary --------------------------
  // Customer-facing label (city/name + pincode; never the internal zone label).
  // Uses the shared helper; falls back to a safe local rule if it isn't loaded.
  // DISPLAY ONLY: the stored "Delivery Zone" / "Delivery Zone Label" cart
  // attributes still use the internal zone + label (see desiredAttributes()).
  function displayLabel(loc) {
    if (window.GanguramDisplayLabel && typeof window.GanguramDisplayLabel.get === 'function') {
      return window.GanguramDisplayLabel.get(loc);
    }
    if (!loc || !loc.pincode) { return ''; }
    if (loc.city) { return loc.city + ' ' + loc.pincode; }
    if (loc.isKolkata || loc.zone === 'kolkata' || loc.zone === 'quick_commerce') { return 'Kolkata ' + loc.pincode; }
    return String(loc.pincode);
  }
  function renderSummary() {
    if (!summaryEnabled()) { return; }
    var els = document.querySelectorAll('[data-ganguram-cart-delivery-summary]');
    if (!els.length) { return; }
    var loc = currentLoc();
    var show = !!(loc && loc.pincode && loc.isServiceable === true);
    var value = show ? displayLabel(loc) : '';
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      try {
        var labelEl = el.querySelector('[data-gcd-label]');
        var valueEl = el.querySelector('[data-gcd-value]');
        if (labelEl) { labelEl.textContent = summaryLabel(); }
        if (valueEl) { valueEl.textContent = value; }
        if (show) { el.removeAttribute('hidden'); } else { el.setAttribute('hidden', 'hidden'); }
      } catch (e) {}
    }
  }

  // The cart re-renders via several paths (component-cart qty change, refreshCart);
  // each replaces the cart-form's HTML, dropping our painted text. Observe the
  // cart-form(s) and re-paint after any re-render. childList covers innerHTML swaps.
  function observeCartForms() {
    if (!('MutationObserver' in window)) { return; }
    var forms = document.querySelectorAll('cart-form');
    if (!forms.length) { return; }
    var pending = false;
    var schedule = function () {
      if (pending) { return; }
      pending = true;
      // Re-paint the summary AND re-sync attributes: cart contents may have changed
      // (add/remove), which changes the Quick-Commerce eligibility signal. doSync is
      // debounced + idempotent (diffs against /cart.js), so this is cheap.
      var run = function () { pending = false; renderSummary(); scheduleSync(null); };
      if (window.requestAnimationFrame) { window.requestAnimationFrame(run); } else { setTimeout(run, 0); }
    };
    var obs = new MutationObserver(schedule);
    for (var i = 0; i < forms.length; i++) {
      try { obs.observe(forms[i], { childList: true }); } catch (e) {}
    }
  }

  // ---- wiring ---------------------------------------------------------------
  function onChange(e) {
    var detail = (e && e.detail) ? e.detail : null;
    renderSummary();
    scheduleSync(detail);
  }
  function onCheckoutIntent(e) {
    var t = e.target;
    if (!t || !t.closest) { return; }
    if (t.closest('[name="checkout"], #CheckOut, [data-ganguram-checkout]')) { flushSync(); }
  }
  function onSubmit(e) {
    var f = e.target;
    if (f && f.id === 'cart') { flushSync(); }   // covers Enter / non-mouse checkout submit
  }

  function init() {
    renderSummary();
    observeCartForms();
    window.addEventListener(EVENT, onChange);
    // City enrichment completed later -> refresh the summary label and re-sync the
    // now city-aware address summary attribute (debounced, idempotent, fail-open).
    window.addEventListener('ganguram:delivery-label-updated', function () { renderSummary(); scheduleSync(null); });
    // A SELECTED full address fires this AFTER the location-changed event (which cleared any
    // prior address) — re-sync so the address fields reach the cart for the checkout prefill.
    window.addEventListener('ganguram:delivery-address-updated', function () { scheduleSync(null); });
    document.addEventListener('click', onCheckoutIntent, true);
    document.addEventListener('submit', onSubmit, true);
    // Make sure an already-selected pincode is reflected on the cart before checkout.
    var loc = currentLoc();
    if (loc && loc.pincode && loc.isServiceable === true) { scheduleSync(null); }
  }

  // DEV-ONLY diagnostics — whether the selection actually reached the cart attributes (the clean-
  // device handoff). cartAttributesWriteStatus: 'idle' | 'writing' | 'ok' | 'in_sync' | 'error'.
  window.GanguramCartAttributes = {
    debugState: function () {
      var loc = currentLoc();
      return {
        enabled: enabled(),
        cartAttributesWriteStatus: lastWriteStatus,
        lastWriteAt: lastWriteAt,
        lastWriteError: lastWriteError,
        selectedPincode: (loc && loc.pincode) || null,
        serviceable: !!(loc && loc.isServiceable === true),
        desiredAttributes: desiredAttributes(null)
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
