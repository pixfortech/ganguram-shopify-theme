/*
 * Ganguram — Conditional checkout shipping-address prefill (Phase 2.11F.2 → 2.12B)
 * ---------------------------------------------------------------------------
 * On the STANDARD checkout button, prefills Shopify's checkout shipping fields by
 * appending the documented checkout[shipping_address][...] params to the checkout URL.
 * Two CLEAR modes — and it never sends a guessed or stale address:
 *
 *   - pincode_only  (manual pincode, no selected address): send ONLY country + zip.
 *                   Address / city / province are NOT sent (Shopify infers/handles them;
 *                   we must not push stale or guessed data).
 *   - full_address  (a Google address was selected for the active pincode): send
 *                   country + zip + address1 (+ address2) + city + province.
 *
 * Mode comes from window.GanguramAddress.getSelectedAddress(), which is keyed to the
 * active pincode and cleared on every location change — so selecting a full address and
 * then later entering only a pincode falls back to pincode_only (no stale address1 /
 * city / province / locality / formatted address is reused).
 *
 * SAFE BY DESIGN:
 *   - Standard checkout button only (#CheckOut / [name="checkout"]); never Shop Pay /
 *     dynamic checkout buttons.
 *   - DATE SAFETY: does nothing while checkout is blocked — by the MOV / not-deliverable
 *     guard (GanguramDeliveryProgress.isCheckoutBlocked) OR a required delivery date being
 *     missing (GanguramDeliveryDatePicker.isDateMissing). The redirect can never bypass the
 *     cart-page delivery-date requirement.
 *   - Preserves the cart / cart attributes (incl. the saved delivery date) / discounts /
 *     payment flow. Fail-open: disabled / no pincode / any error -> normal checkout.
 * No checkout-rate / ShipZip / SBZ / zipLogic / resolver / MOV / service-code / estimate /
 * eligibility / settings_data change.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramCheckoutPrefillInit) { return; }
  window.__ganguramCheckoutPrefillInit = true;

  function cfg() { return window.GanguramCheckoutPrefillConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  // OPT-IN hard-block. When true, a genuine persistent verify miss BLOCKS checkout and asks the
  // customer to reselect their location. Default false: keepalive requests help writes survive
  // navigation but do not guarantee delivery, so we fail-open-redirect (never trap a paying customer)
  // and only record the mismatch in diagnostics.
  function blockUntilVerified() { return cfg().blockUntilVerified === true; }
  function checkoutUrl() { return cfg().checkoutUrl || '/checkout'; }
  function defaultCountry() { return cfg().defaultCountry || 'India'; }
  function norm(p) { return String(p == null ? '' : p).replace(/\D/g, '').slice(0, 6); }

  // Blocked when the MOV / not-deliverable guard blocks OR a REQUIRED delivery date is
  // missing — so the prefill redirect can NEVER bypass the cart-page date requirement.
  function guardBlocked() {
    try { var g = window.GanguramDeliveryProgress; if (g && typeof g.isCheckoutBlocked === 'function' && g.isCheckoutBlocked() === true) { return true; } } catch (e) {}
    try { var d = window.GanguramDeliveryDatePicker; if (d && typeof d.isDateMissing === 'function' && d.isDateMissing() === true) { return true; } } catch (e) {}
    return false;
  }

  function selectedAddress() {
    var a = window.GanguramAddress;
    if (a && typeof a.getSelectedAddress === 'function') { try { return a.getSelectedAddress(); } catch (e) {} }
    return null;
  }
  // A FULL address only when one was actually SELECTED (source) AND it carries the street +
  // city. Otherwise null -> pincode_only mode (we never reuse stale address fields).
  var selectionChanged = false;
  function fullAddress() {
    var a = selectedAddress();
    if (a && a.source === 'selected_address' && a.address1 && a.city) { return a; }
    // Once a customer makes a selection, the address store is authoritative,
    // including its deliberate empty value after a manual PIN entry.
    if (selectionChanged) { return null; }
    var c = cartAddress();
    return (c && c.address1 && c.city && norm(c.zip) === norm(activePincode())) ? c : null;
  }
  function activePincode() {
    var z = window.GanguramZone;
    try { var loc = z && z.getSelectedDeliveryLocation();
      if (loc && loc.pincode) { return loc.isServiceable === true ? String(loc.pincode) : ''; }
    } catch (e) {}
    return selectionChanged ? '' : cartPincode();                         // CLEAN-SESSION fallback: pincode mirrored on the cart
  }

  function param(name, value) {
    return (value != null && String(value) !== '')
      ? 'checkout[shipping_address][' + name + ']=' + encodeURIComponent(String(value)) : '';
  }
  function buildUrl(mode, addr, pin) {
    var zip = norm(pin || (addr && (addr.zip || addr.pincode)));
    var country = (mode === 'full_address' && addr && addr.country) ? addr.country : defaultCountry();
    var parts = [param('country', country), param('zip', zip)];
    if (mode === 'full_address' && addr) {
      parts.push(param('address1', addr.address1));
      parts.push(param('address2', addr.address2));
      parts.push(param('city', addr.city));
      parts.push(param('province', addr.state));
    }
    parts = parts.filter(Boolean);
    if (!parts.length) { return null; }
    var base = checkoutUrl();
    return base + (base.indexOf('?') === -1 ? '?' : '&') + parts.join('&');
  }

  function onClick(e) {
    if (!enabled()) { return; }
    var t = e.target;
    if (!t || !t.closest) { return; }
    if (t.closest('.shopify-payment-button, [data-shopify="payment-button"], .additional-checkout-buttons')) { return; }
    if (!t.closest('#CheckOut, [name="checkout"]')) { return; }
    if (guardBlocked()) { return; }                  // MOV + date guards own the blocked case (preventDefault + notice)
    if (!currentCheckoutUrl()) { return; }            // no serviceable pincode -> normal checkout (fail-open)
    e.preventDefault();
    prepareCheckout({ buyNow: false });
  }

  // ---------------------------------------------------------------------------
  // SHARED CHECKOUT HANDOFF — Buy Now and the cart checkout button use the SAME pipeline:
  // validate pincode (popup if none) -> validate MOV + required Standard date -> force-save the
  // cart attributes (pincode/address) + the delivery method -> VERIFY /cart.js -> redirect to the
  // prefill URL. Fail-open: a slow /cart.js never traps the customer (verify is time-boxed; the
  // keepalive flushSync in cart-attributes is the navigation-safe backup). PAN India needs no
  // distance/latLng — it resolves to PAN_INDIA and prefills pincode-only.
  // ---------------------------------------------------------------------------
  var VERIFY_TIMEOUT_MS = 1500;
  var lastHandoff = { status: 'idle', buyNow: false, reason: null, verified: null, allowed: null, at: null };
  var lastVerifiedCartAttributes = null;
  function cartJsUrl() { return cfg().cartUrl || '/cart.js'; }
  function cartPageUrl() { return cfg().cartPageUrl || '/cart'; }
  function hasAnyPincode() { return !!activePincode(); }
  function dateBlocked() { try { var d = window.GanguramDeliveryDatePicker; return !!(d && typeof d.isDateMissing === 'function' && d.isDateMissing() === true); } catch (e) { return false; } }
  function openPincodePopup() { try { var p = window.GanguramDelivery || window.GanguramPincodePopup; if (p && typeof p.openDeliveryLocationPopup === 'function') { p.openDeliveryLocationPopup(); return true; } } catch (e) {} return false; }
  function openCart() { try { var d = document.getElementById('site-cart-sidebar'); if (d && typeof d.show === 'function') { d.show(); return true; } } catch (e) {} return false; }
  function go(url) { try { window.location.assign(url); } catch (e) { window.location.href = url; } }
  function currentCheckoutUrl() {
    var addr = fullAddress();
    var pin = activePincode() || (addr ? (addr.zip || addr.pincode) : '');
    if (addr) { return buildUrl('full_address', addr, pin); }
    if (norm(pin)) { return buildUrl('pincode_only', null, pin); }
    return null;
  }
  function forceSave(opts) {
    var ka = !!(opts && opts.keepalive);
    var caP = Promise.resolve(null), mcP = Promise.resolve(null);
    try { var ca = window.GanguramCartAttributes; if (ca && typeof ca.flush === 'function') { caP = Promise.resolve(ca.flush(ka)); } } catch (e) {}
    try { var mc = window.GanguramDeliveryMethodChoice; if (mc && typeof mc.flush === 'function') { mcP = Promise.resolve(mc.flush(ka)); } } catch (e) {}
    return Promise.all([caP, mcP]).then(function (r) { return { cartAttrs: r[0], method: r[1] }; }).catch(function () { return { cartAttrs: null, method: null }; });
  }
  function summarizeSync(s) {
    if (!s) { return 'none'; }
    var ca = s.cartAttrs;
    if (ca && ca.written === true) { return 'ok'; }
    if (ca && ca.reason) { return 'cart_attrs:' + ca.reason; }
    return (window.GanguramCartAttributes && typeof window.GanguramCartAttributes.flush === 'function') ? 'unknown' : 'no_writer';
  }
  function verifyCart() {
    try {
      return fetch(cartJsUrl(), { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          cartCache = (cart && cart.attributes) || {};
          var pin = cartPincode();
          var matches = !!pin && pin === norm(activePincode());
          var method = String(cartCache['ganguram_preferred_delivery_method'] || '');
          lastVerifiedCartAttributes = { pincode: pin, address1: (cartAddress() ? cartAddress().address1 : ''), method: method };
          return { ok: matches, pincode: matches, method: !!method, cartPincode: pin, cartMethod: method, errored: false };
        })
        .catch(function () { return { ok: false, pincode: false, method: false, errored: true }; });
    } catch (e) { return Promise.resolve({ ok: false, pincode: false, method: false, errored: true }); }
  }
  function timeoutP(ms, val) { return new Promise(function (res) { setTimeout(function () { res(val); }, ms); }); }
  function deny(reason, buyNow) { lastHandoff = { status: 'blocked', buyNow: !!buyNow, reason: reason, verified: null, allowed: false, at: Date.now() }; return { ok: false, reason: reason, buyNow: !!buyNow, allowed: false }; }

  // The one entry point — cart checkout, cart-drawer checkout, AND Buy Now all use it. opts.buyNow
  // marks the Buy Now flow. Pipeline: validate -> force-save (keepalive) -> VERIFY /cart.js -> only
  // redirect once confirmed; retry once on a genuine miss; BLOCK + reselect on a persistent miss; but
  // FAIL-OPEN (redirect) on a verify infra error/timeout so a slow network never traps the customer
  // (keepalive already wrote the attributes). PAN India needs no distance/latLng.
  var MAX_VERIFY_RETRIES = 1;
  function prepareCheckout(opts) {
    opts = opts || {}; var buyNow = !!opts.buyNow;
    if (!enabled()) { return Promise.resolve(deny('disabled', buyNow)); }
    if (!hasAnyPincode()) { openPincodePopup(); return Promise.resolve(deny('no_pincode', buyNow)); }
    if (guardBlocked()) { if (buyNow) { if (!openCart()) { go(cartPageUrl()); } } return Promise.resolve(deny(dateBlocked() ? 'date_required' : 'mov', buyNow)); }
    var missingBefore = !(cartPincode() && cartAddress());
    var handoffPin = activePincode();
    lastHandoff = { status: 'saving', buyNow: buyNow, reason: null, verified: null, allowed: false, missingBefore: missingBefore, syncStatus: null, mismatch: null, at: Date.now() };

    function redirectNow(reason) {
      if (activePincode() !== handoffPin || guardBlocked()) { return deny('selection_changed', buyNow); }
      var url = currentCheckoutUrl();
      if (!url) { return deny('no_url', buyNow); }
      lastHandoff.status = 'redirecting'; lastHandoff.allowed = true; lastHandoff.reason = reason || null;
      go(url);
      return { ok: true, reason: reason || null, buyNow: buyNow, verified: lastHandoff.verified, url: url, allowed: true };
    }
    function blockReselect() {
      lastHandoff.status = 'blocked'; lastHandoff.allowed = false; lastHandoff.reason = 'cart_attributes_unverified'; lastHandoff.mismatch = true;
      openPincodePopup();   // ask the customer to reselect the delivery location (re-writes the attributes)
      return { ok: false, reason: 'cart_attributes_unverified', buyNow: buyNow, allowed: false };
    }
    function attempt(n) {
      // keepalive so the write survives even if we later fail-open-redirect on a verify infra error.
      return Promise.race([forceSave({ keepalive: true }), timeoutP(VERIFY_TIMEOUT_MS, null)])
        .then(function (statuses) { lastHandoff.syncStatus = summarizeSync(statuses); lastHandoff.status = 'verifying'; return Promise.race([verifyCart(), timeoutP(VERIFY_TIMEOUT_MS, { ok: false, errored: true, timedOut: true })]); })
        .then(function (v) {
          lastHandoff.verified = !!(v && v.pincode);
          if (v && v.pincode) { lastHandoff.mismatch = false; return redirectNow(); }   // confirmed -> go
          if (v && v.errored) { return redirectNow('failopen_verify_error'); }           // infra issue -> never trap
          if (n < MAX_VERIFY_RETRIES) { return attempt(n + 1); }                          // genuinely absent -> retry the save
          lastHandoff.mismatch = true;                                                    // persistent real miss recorded for diagnostics
          // OPT-IN: hard-block + reselect. DEFAULT: fail-open-redirect (the keepalive save already
          // wrote the attributes; blocking the highest-traffic button would only cost conversions).
          return blockUntilVerified() ? blockReselect() : redirectNow('unverified_failopen');
        })
        .catch(function () { return redirectNow('failopen_exception'); });
    }
    return attempt(0);
  }

  // DEV-ONLY diagnostics (Phase 2.12C) — never customer-facing, no console noise. In the
  // console (incl. the theme preview): window.GanguramCheckoutPrefill.debugState() shows the
  // mode, the EXACT params being sent, the stored lat/lng, and the THEME's km + Standard rate
  // for the same address — so you can confirm the theme estimate (e.g. ₹70) and, if checkout
  // (ShipZip) disagrees, narrow it to ShipZip's origin/slab/geocoding (admin), not the theme.
  function paramsOf(url) {
    var out = {}; if (!url) { return out; }
    (url.split('?')[1] || '').split('&').forEach(function (kv) {
      var m = decodeURIComponent(kv).match(/^checkout\[shipping_address\]\[([^\]]+)\]=(.*)$/);
      if (m) { out[m[1]] = m[2]; }
    });
    return out;
  }
  function themeEstimate(pin) {
    var d = window.GanguramDistance, se = window.GanguramShippingEstimate;
    if (!d || !se || typeof d.getForPincode !== 'function' || typeof se.standardForKm !== 'function') { return null; }
    var conf = d.getForPincode(pin);
    if (!conf || conf.confirmed !== true || conf.distanceKm == null) {
      var area = (typeof d.getAreaRangeForPincode === 'function') ? d.getAreaRangeForPincode(pin) : null;
      return area ? { basis: 'pincode_area', km: area.minKm + '–' + area.maxKm, rate: se.formatRange(se.standardForRange(area.minKm, area.maxKm).minPrice, se.standardForRange(area.minKm, area.maxKm).maxPrice) }
        : { basis: 'none', km: null, rate: null, note: 'no confirmed full-address distance yet — open the address in the popup' };
    }
    // Use the SAME slab-safety padding the popup/cart use, so this diagnostic never disagrees
    // with the shown estimate (km stays the RAW route distance; slabKm is what feeds the slab).
    var slabKm = (typeof se.slabInputKm === 'function') ? se.slabInputKm(conf.distanceKm) : conf.distanceKm;
    var slab = se.standardForKm(slabKm);
    return { basis: 'full_address', km: Math.round(conf.distanceKm * 10) / 10, slabKm: Math.round(slabKm * 100) / 100, rate: slab ? se.money(slab.minPrice) : null };
  }
  function debugState() {
    var addr = fullAddress();
    var pin = activePincode() || (addr ? (addr.zip || addr.pincode) : '');
    var mode = addr ? 'full_address' : (norm(pin) ? 'pincode_only' : 'none');
    var url = (mode === 'full_address') ? buildUrl('full_address', addr, pin)
      : (mode === 'pincode_only') ? buildUrl('pincode_only', null, pin) : null;
    // The EXACT shipping_address params attached to the redirect URL, + per-field booleans, so the
    // audit can prove the theme IS sending the full address (and Shopify, not the theme, drops it).
    var pay = paramsOf(url);
    var has = function (k) { return Object.prototype.hasOwnProperty.call(pay, k) && pay[k] !== ''; };
    var paramsIncluded = { country: has('country'), zip: has('zip'), address1: has('address1'), address2: has('address2'), city: has('city'), province: has('province') };
    var paramKeys = Object.keys(pay).map(function (k) { return 'checkout[shipping_address][' + k + ']'; });
    // Why the redirect is/ isn't blocked — so "prefill not sending" can be told apart from a
    // genuine MOV / required-delivery-date block (the redirect is skipped while blocked, by design).
    var movBlocked = false, dateMissing = false;
    try { var g = window.GanguramDeliveryProgress; movBlocked = !!(g && typeof g.isCheckoutBlocked === 'function' && g.isCheckoutBlocked() === true); } catch (e) {}
    try { var d = window.GanguramDeliveryDatePicker; dateMissing = !!(d && typeof d.isDateMissing === 'function' && d.isDateMissing() === true); } catch (e) {}
    var latlng = addr ? { lat: addr.lat, lng: addr.lng } : null;
    // Where the address/pincode came from — proves the prefill no longer depends on stale
    // localStorage: 'selected_address'/'zone' = same-session, 'cart_attributes' = hydrated from /cart.js.
    var lsAddr = selectedAddress();
    var addressSource = (lsAddr && lsAddr.source === 'selected_address' && lsAddr.address1 && lsAddr.city) ? 'selected_address'
      : (cartAddress() ? 'cart_attributes' : 'none');
    var zonePin = ''; try { var l = window.GanguramZone && window.GanguramZone.getSelectedDeliveryLocation(); zonePin = (l && l.isServiceable === true && l.pincode) ? String(l.pincode) : ''; } catch (e) {}
    var pincodeSource = zonePin ? 'zone' : (cartPincode() ? 'cart_attributes' : 'none');
    // Clean-device proof: localStorage is only a SAME-SESSION cache (EMPTY on a fresh device /
    // private mode). The prefill must work from the cart attribute + in-memory selection, NOT this.
    var lsPin = ''; try { lsPin = norm((window.localStorage && window.localStorage.getItem('Zipcode')) || ''); } catch (e) {}
    var cartPin = cartPincode();
    var cartAddr = cartAddress();
    var method = null; try { var mc = window.GanguramDeliveryMethodChoice; method = (mc && typeof mc.getPreferred === 'function') ? mc.getPreferred().code : null; } catch (e) {}
    var panEligible = (function () {
      var lines = document.querySelectorAll('[data-ganguram-cart-line]'); if (!lines.length) { return null; }
      for (var i = 0; i < lines.length; i++) { if (String(lines[i].getAttribute('data-ganguram-pan-india')) !== 'true') { return false; } }
      return true;
    })();
    return {
      mode: mode,
      enabled: enabled(),
      blocked: guardBlocked(),
      blockedReason: movBlocked ? 'mov' : (dateMissing ? 'delivery_date_missing' : null),
      // data-source view (clean-device): in-memory zone vs the cart attribute vs the localStorage cache
      localStorageSelectedPincode: lsPin || null,
      cartAttributePincode: cartPin || null,
      selectedPincode: activePincode(),
      pincodeSource: pincodeSource,
      selectedAddress: addr ? (addr.formatted_address || (addr.address1 + ', ' + addr.city)) : null,
      addressSource: addressSource,
      selectedAddressSource: addressSource,   // alias — same key name the cart-attributes debugState uses
      addressLatLng: latlng,
      storedLatLng: latlng,
      cartHydrated: !!cartCache,
      cartAttributesHydrated: !!cartCache,
      cartShipAttributes: cartCache ? { pincode: cartPincode(), address: cartAddress() } : null,
      panIndiaEligible: panEligible,
      finalDeliveryMethod: method,
      // Buy Now / checkout handoff state (the shared prepareCheckout pipeline)
      isBuyNowFlow: !!lastHandoff.buyNow,
      buyNowIntercepted: lastHandoff.status !== 'idle',
      buyNowBlockedReason: (lastHandoff.allowed === false) ? lastHandoff.reason : null,
      checkoutRedirectBlocked: (lastHandoff.status === 'blocked'),
      checkoutRedirectAllowed: (lastHandoff.allowed === true),
      cartAttributesVerifiedBeforeRedirect: lastHandoff.verified,
      cartAttributesMissingBeforeRedirect: (lastHandoff.missingBefore === undefined ? null : lastHandoff.missingBefore),
      forcedCartAttributeSyncStatus: lastHandoff.syncStatus,
      verificationMismatch: (lastHandoff.mismatch === undefined ? null : lastHandoff.mismatch),
      lastVerifiedCartAttributes: lastVerifiedCartAttributes,
      handoffStatus: lastHandoff.status,
      sending: pay,
      // ---- checkout-field prefill audit (the EXACT URL/payload the theme sends to Shopify) ----
      checkoutRedirectUrl: url,
      checkoutPrefillPayload: pay,
      checkoutPrefillMode: mode,
      checkoutParamsIncluded: paramsIncluded,      // which checkout[shipping_address][*] params are attached
      checkoutParamKeys: paramKeys,                // the exact param keys on the URL
      checkoutParamsIgnoredLikely: null, // storefront cannot observe whether hosted checkout applied each field
      cartAttributeAddress1: (cartAddr ? cartAddr.address1 : null),
      cartAttributeAddress2: (cartAddr ? cartAddr.address2 : null),
      cartAttributeCity: (cartAddr ? cartAddr.city : null),
      cartAttributeProvince: (cartAddr ? cartAddr.state : null),
      cartAttributeCountry: (cartAddr ? cartAddr.country : null),
      cartAttributeZip: (cartAddr ? cartAddr.zip : (cartPin || null)),
      // Standard checkout URL prefill was verified on this store (2026-10-29).
      // Accelerated wallets or a saved customer address may override the supplied values.
      shopifyCheckoutFieldPrefillSupported: true,
      willRedirect: enabled() && !guardBlocked() && !!url,
      reason: (mode === 'none') ? 'no serviceable pincode (in-memory) and none on the cart attributes — enter a pincode/address' : null,
      themeEstimate: themeEstimate(norm(pin))
    };
  }

  // ---- clean-session hydration (Phase 2.12L) — cart attributes are the SOURCE OF TRUTH -------
  // localStorage (GanguramAddress / GanguramZone) is only a same-session cache; it is EMPTY on a
  // clean / private session (or when localStorage is blocked, e.g. Safari private mode). So we
  // read /cart.js on load (and after a selection) and use the cart's mirrored pincode/address as
  // the fallback — so the checkout address handoff works for a REAL customer, not just a browser
  // that happens to have saved state. Read-only; never writes; fail-open.
  var cartCache = null, hydrating = false;
  function cartUrl() { return cfg().cartUrl || '/cart.js'; }
  function shipKeys() {
    return {
      pincode: 'ganguram_selected_pincode',
      address1: '_ganguram_ship_address1', address2: '_ganguram_ship_address2',
      city: '_ganguram_ship_city', province: '_ganguram_ship_province',
      country: '_ganguram_ship_country', zip: '_ganguram_ship_zip',
      lat: '_ganguram_ship_lat', lng: '_ganguram_ship_lng'
    };
  }
  function cartPincode() { var a = cartCache, K = shipKeys(); return a ? norm(a[K.pincode] || a[K.zip] || '') : ''; }
  function cartAddress() {
    var a = cartCache, K = shipKeys();
    if (!a) { return null; }
    var a1 = a[K.address1], city = a[K.city];
    if (!a1 || !city) { return null; }            // pincode-only on the cart -> no stale address reused
    return {
      source: 'cart_attributes',
      address1: String(a1), address2: String(a[K.address2] || ''),
      city: String(city), state: String(a[K.province] || ''), country: String(a[K.country] || ''),
      zip: norm(a[K.zip] || a[K.pincode] || ''),
      lat: a[K.lat] ? parseFloat(a[K.lat]) : null, lng: a[K.lng] ? parseFloat(a[K.lng]) : null
    };
  }
  function hydrate() {
    if (hydrating || typeof window.fetch !== 'function') { return; }
    hydrating = true;
    try {
      window.fetch(cartUrl(), { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (cart) { cartCache = (cart && cart.attributes) || {}; })
        .catch(function () {})
        .then(function () { hydrating = false; });
    } catch (e) { hydrating = false; }
  }

  window.GanguramCheckoutPrefill = { debugState: debugState, prepareCheckout: prepareCheckout, hydrate: hydrate };

  document.addEventListener('click', onClick, true);
  hydrate();                                                                   // load: cart is already populated from prior pages
  window.addEventListener('ganguram:delivery-location-changed', function () { selectionChanged = true; cartCache = null; setTimeout(hydrate, 700); }); // after the cart-attributes write lands
  window.addEventListener('ganguram:delivery-address-updated', function () { setTimeout(hydrate, 700); });
})();
