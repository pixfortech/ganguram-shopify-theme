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
  function fullAddress() {
    var a = selectedAddress();
    if (a && a.source === 'selected_address' && a.address1 && a.city) { return a; }
    var c = cartAddress();                       // CLEAN-SESSION fallback: cart attributes are the source of truth
    return (c && c.address1 && c.city) ? c : null;
  }
  function activePincode() {
    var z = window.GanguramZone;
    try { var loc = z && z.getSelectedDeliveryLocation(); if (loc && loc.pincode && loc.isServiceable === true) { return String(loc.pincode); } } catch (e) {}
    return cartPincode();                         // CLEAN-SESSION fallback: pincode mirrored on the cart
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
    var url = currentCheckoutUrl();
    if (!url) { return; }                             // no serviceable pincode -> normal checkout (fail-open, as before)
    e.preventDefault();
    // Force-save the method + attributes (fire-and-forget; cart-attributes' keepalive flushSync is
    // the navigation-safe backup) and redirect SYNCHRONOUSLY to the prefill URL — same as before,
    // so the click never stalls. (Buy Now uses the async verify path since it already awaits the add.)
    try { forceSave(); } catch (e2) {}
    lastHandoff = { status: 'redirecting', buyNow: false, reason: null, verified: null, allowed: true, at: Date.now() };
    go(url);
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
  function cartJsUrl() { return cfg().cartUrl || '/cart.js'; }
  function cartPageUrl() { return cfg().cartPageUrl || '/cart'; }
  function hasAnyPincode() { return !!(activePincode() || cartPincode()); }
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
  function forceSave() {
    var ps = [];
    try { var ca = window.GanguramCartAttributes; if (ca && typeof ca.flush === 'function') { ps.push(Promise.resolve(ca.flush())); } } catch (e) {}
    try { var mc = window.GanguramDeliveryMethodChoice; if (mc && typeof mc.flush === 'function') { ps.push(Promise.resolve(mc.flush())); } } catch (e) {}
    return Promise.all(ps).catch(function () { return []; });
  }
  function verifyCart() {
    try {
      return fetch(cartJsUrl(), { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          cartCache = (cart && cart.attributes) || {};
          var pin = cartPincode();
          var method = String(cartCache['ganguram_preferred_delivery_method'] || '');
          return { ok: !!pin, pincode: !!pin, method: !!method, cartPincode: pin, cartMethod: method };
        })
        .catch(function () { return { ok: false, pincode: false, method: false }; });
    } catch (e) { return Promise.resolve({ ok: false, pincode: false, method: false }); }
  }
  function timeoutP(ms, val) { return new Promise(function (res) { setTimeout(function () { res(val); }, ms); }); }
  function deny(reason, buyNow) { lastHandoff = { status: 'blocked', buyNow: !!buyNow, reason: reason, verified: null, allowed: false, at: Date.now() }; return { ok: false, reason: reason, buyNow: !!buyNow, allowed: false }; }

  // The one entry point. opts.buyNow=true when called by a Buy Now button (after the AJAX add).
  function prepareCheckout(opts) {
    opts = opts || {}; var buyNow = !!opts.buyNow;
    if (!enabled()) { return Promise.resolve(deny('disabled', buyNow)); }
    if (!hasAnyPincode()) { openPincodePopup(); return Promise.resolve(deny('no_pincode', buyNow)); }
    if (guardBlocked()) { if (buyNow) { if (!openCart()) { go(cartPageUrl()); } } return Promise.resolve(deny(dateBlocked() ? 'date_required' : 'mov', buyNow)); }
    lastHandoff = { status: 'saving', buyNow: buyNow, reason: null, verified: null, allowed: false, at: Date.now() };
    return forceSave()
      .then(function () { lastHandoff.status = 'verifying'; return Promise.race([verifyCart(), timeoutP(VERIFY_TIMEOUT_MS, { ok: false, timedOut: true })]); })
      .then(function (v) {
        lastHandoff.verified = !!(v && v.ok);
        var url = currentCheckoutUrl();
        if (!url) { return deny('no_url', buyNow); }
        lastHandoff.status = 'redirecting'; lastHandoff.allowed = true; lastHandoff.reason = null;
        go(url);
        return { ok: true, reason: null, buyNow: buyNow, verified: lastHandoff.verified, url: url, allowed: true };
      })
      .catch(function () {
        var url = currentCheckoutUrl();
        if (url) { lastHandoff.status = 'redirecting'; lastHandoff.allowed = true; go(url); return { ok: true, reason: 'failopen', verified: false, url: url, buyNow: buyNow, allowed: true }; }
        return deny('error', buyNow);
      });
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
      handoffStatus: lastHandoff.status,
      sending: paramsOf(url),
      // ---- checkout-field prefill audit (the exact URL/payload the theme sends to Shopify) ----
      checkoutRedirectUrl: url,
      checkoutPrefillPayload: paramsOf(url),
      checkoutPrefillMode: mode,
      cartAttributeAddress1: (cartAddr ? cartAddr.address1 : null),
      cartAttributeCity: (cartAddr ? cartAddr.city : null),
      cartAttributeProvince: (cartAddr ? cartAddr.state : null),
      cartAttributeZip: (cartAddr ? cartAddr.zip : (cartPin || null)),
      // FALSE by design: theme JS CANNOT visibly auto-fill Shopify's one-page checkout shipping
      // address — the new checkout ignores checkout[shipping_address][...] URL params. The data is
      // preserved in cart/order attributes (above + ShipZip reads the pincode). True field prefill
      // needs a logged-in customer (Shopify auto-fills) or a Checkout UI Extension / Storefront Cart
      // API buyerIdentity. See docs/phase2-checkout-prefill-limitation.md.
      shopifyCheckoutFieldPrefillSupported: false,
      willRedirect: enabled() && !guardBlocked() && !!url,
      reason: (mode === 'none') ? 'no serviceable pincode (in-memory) and none on the cart attributes — enter a pincode/address' : null,
      themeEstimate: themeEstimate(norm(pin))
    };
  }

  // ---- ShipZip rate diagnosis (Phase 2.12G) — READ-ONLY console helper ----------------------
  // The CHECKOUT shipping rate is produced by ShipZip, which the theme cannot read or set. These
  // helpers surface the THEME-side truth (outlet origin, destination, driving distance, the slab
  // the theme expects) and map an OBSERVED checkout rupee value back to a likely ShipZip cause,
  // using the theme's OWN slab table (which mirrors the ShipZip distance tiers). Console-only; no
  // rate / service-code / eligibility / MOV / estimate-logic change. Run it on the CART page
  // (theme JS does not run on Shopify's hosted checkout) and compare with the rate at checkout.
  function themeOrigin() {
    try { var d = window.GanguramDistance; var s = (d && typeof d.debugState === 'function') ? d.debugState() : null; return s ? s.origin : null; } catch (e) { return null; }
  }
  function slabTable() {
    try { var se = window.GanguramShippingEstimate; return (se && typeof se.config === 'function') ? (se.config().standardSlabs || []) : []; } catch (e) { return []; }
  }
  // Distance band [fromKm, toKm] for a slab index in the cumulative table.
  function bandFor(slabs, i) { return { fromKm: i === 0 ? 0 : slabs[i - 1].maxKm, toKm: slabs[i].maxKm }; }
  // The slab the THEME expects for the current confirmed full-address distance (or null).
  function themeExpected() {
    var d = window.GanguramDistance, se = window.GanguramShippingEstimate;
    var addr = fullAddress();
    var pin = activePincode() || (addr ? (addr.zip || addr.pincode) : '');
    if (!d || !se || !pin || typeof d.getForPincode !== 'function') { return null; }
    var conf = d.getForPincode(norm(pin));
    if (!conf || conf.confirmed !== true || conf.distanceKm == null) { return null; }
    var slabKm = (typeof se.slabInputKm === 'function') ? se.slabInputKm(conf.distanceKm) : conf.distanceKm;
    var slab = (typeof se.slabForKm === 'function') ? se.slabForKm(slabKm) : null;
    if (!slab) { return null; }
    return { distanceKm: Math.round(conf.distanceKm * 10) / 10, distanceMeters: Math.round(conf.distanceKm * 1000),
      slabMaxKm: slab.maxKm, rupees: slab.price, formatted: (typeof se.money === 'function') ? se.money(slab.price) : ('₹' + slab.price) };
  }
  // Map an OBSERVED checkout rupee value to a likely ShipZip cause + the exact setting to change.
  function explainCheckoutRate(observed) {
    observed = Number(observed);
    var slabs = slabTable(), theme = themeExpected(), origin = themeOrigin();
    var out = { observedRupees: isFinite(observed) ? observed : null, themeExpected: theme };
    var hit = -1, i;
    for (i = 0; i < slabs.length; i++) { if (slabs[i].price === observed) { hit = i; break; } }
    if (hit >= 0) {
      var b = bandFor(slabs, hit);
      out.shipZipTier = '₹' + observed + ' = the ' + b.fromKm + '–' + b.toKm + ' km tier';
      out.shipZipImpliedDistanceKm = b;
      if (theme && observed === theme.rupees) {
        out.conclusion = 'MATCH — ShipZip applied the same tier the theme expects (' + theme.formatted + '). No discrepancy.';
        out.exactSetting = 'None.';
      } else {
        out.conclusion = 'ShipZip applied its ' + b.fromKm + '–' + b.toKm + ' km tier, so ShipZip computed a distance of ~' + b.fromKm + '–' + b.toKm + ' km'
          + (theme ? ' — but the theme computes ' + theme.distanceKm + ' km (expects ' + theme.formatted + ')' : '')
          + '. ShipZip is measuring a DIFFERENT distance than the theme, so its ORIGIN or destination GEOCODING is wrong (most likely the ShipZip origin is not Beadon Street).';
        out.exactSetting = 'Set the ShipZip rate ORIGIN/warehouse to the same outlet the theme uses: ' + JSON.stringify(origin) + ' (Beadon Street). Confirm ShipZip geocodes the checkout address1+zip to Eco Park, not the outlet.';
        out.alsoRuleOut = 'DUPLICATE rate — rename the rate to "Standard Delivery TEST 123"; if the checkout label does not change, a different rate is being returned.';
      }
      out.disambiguateBase = 'If ₹' + observed + ' could also be this rate’s BASE price, set Base=₹999 in the tier-bump test to tell base from tier apart.';
    } else {
      out.shipZipTier = 'no distance tier has price ₹' + observed;
      out.conclusion = '₹' + observed + ' matches no distance tier (' + slabs.map(function (s) { return '₹' + s.price; }).join(' / ') + '), so it is either the ShipZip BASE/fallback price (the distance condition was not met or no tier matched) or a DUPLICATE/other rate.';
      out.exactSetting = 'Run the tier-bump test (0–5=₹51, 5.01–10=₹71, 10.01–15=₹101, 15.01–20=₹151, Base=₹999): ₹999 => base/fallback; a 51/71/101/151 value => that exact tier; an unchanged ₹' + observed + ' => a duplicate/other rate (use the rename test).';
    }
    return out;
  }
  // Consolidated THEME-side snapshot to compare against the ShipZip checkout rate.
  function shipZipDiagnosis() {
    var slabs = slabTable(), theme = themeExpected(), addr = fullAddress();
    var pin = activePincode() || (addr ? (addr.zip || addr.pincode) : '');
    var url = addr ? buildUrl('full_address', addr, pin) : (norm(pin) ? buildUrl('pincode_only', null, pin) : null);
    return {
      note: 'CHECKOUT rate is produced by ShipZip; the theme cannot set or override it. Compare these THEME values with the ShipZip rate at checkout.',
      themeOrigin: themeOrigin(),
      selectedPincode: activePincode(),
      sending: paramsOf(url),
      themeDistanceKm: theme ? theme.distanceKm : null,
      themeDistanceMeters: theme ? theme.distanceMeters : null,
      themeExpectedStandard: theme ? theme.formatted : null,
      themeSlabTiers: slabs.map(function (s, i) { var b = bandFor(slabs, i); return { band: b.fromKm + '–' + b.toKm + ' km', rupees: s.price }; }),
      observedRateInterpretation: {
        '50': 'ShipZip 0–5 km tier (or a duplicate ₹50 rate) — ShipZip distance ≤5 km',
        '70': 'ShipZip 5.01–10 km tier',
        '100': 'ShipZip 10.01–15 km tier OR the ₹100 base/fallback',
        '150': 'ShipZip 15.01–20 km tier — matches the theme for Eco Park',
        '999 (test base)': 'ShipZip base/fallback — no tier matched'
      },
      howToUse: 'GanguramCheckoutPrefill.explainCheckoutRate(<the ₹ you see at checkout>) -> conclusion + exact setting.'
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

  window.GanguramCheckoutPrefill = { debugState: debugState, prepareCheckout: prepareCheckout, shipZipDiagnosis: shipZipDiagnosis, explainCheckoutRate: explainCheckoutRate, hydrate: hydrate };

  document.addEventListener('click', onClick, true);
  hydrate();                                                                   // load: cart is already populated from prior pages
  window.addEventListener('ganguram:delivery-location-changed', function () { setTimeout(hydrate, 700); }); // after the cart-attributes write lands
  window.addEventListener('ganguram:delivery-address-updated', function () { setTimeout(hydrate, 700); });
})();
