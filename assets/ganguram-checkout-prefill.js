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
    return (a && a.source === 'selected_address' && a.address1 && a.city) ? a : null;
  }
  function activePincode() {
    var z = window.GanguramZone;
    try { var loc = z && z.getSelectedDeliveryLocation(); return (loc && loc.pincode && loc.isServiceable === true) ? String(loc.pincode) : ''; }
    catch (e) { return ''; }
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
    if (guardBlocked()) { return; }                  // MOV + date guards own the blocked case
    var addr = fullAddress();
    var pin = activePincode() || (addr ? (addr.zip || addr.pincode) : '');
    var url;
    if (addr) { url = buildUrl('full_address', addr, pin); }
    else if (norm(pin)) { url = buildUrl('pincode_only', null, pin); }
    else { return; }                                  // no serviceable pincode -> normal checkout
    if (!url) { return; }
    e.preventDefault();
    try { window.location.assign(url); } catch (err) { window.location.href = url; }
  }

  document.addEventListener('click', onClick, true);
})();
