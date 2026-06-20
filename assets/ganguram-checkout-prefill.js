/*
 * Ganguram — Checkout shipping-address prefill (Phase 2.11F.2)
 * ---------------------------------------------------------------------------
 * When the customer selected a full Google address in the delivery popup and then
 * clicks the STANDARD checkout button, this prefills Shopify's checkout shipping
 * fields by appending the documented checkout[shipping_address][...] parameters to
 * the checkout URL (built from window.GanguramAddress). Defines no public surface.
 *
 * SAFE BY DESIGN:
 *   - Only the standard checkout button (#CheckOut / [name="checkout"]). It NEVER
 *     touches Shop Pay / dynamic checkout buttons (those bypass the cart form and
 *     can't be prefilled this way — documented limitation).
 *   - Respects the MOV soft guard: if checkout is blocked it does nothing.
 *   - Only fills fields that are SAFELY KNOWN from the selected address (address1/2,
 *     city, province, country, zip) — never invents email / name / phone.
 *   - Preserves the cart, cart attributes, discount codes and the payment flow (the
 *     session cart is unchanged; only the shipping address is pre-populated).
 *   - Fail-open: no selected address / disabled / any error -> normal checkout.
 * No checkout/shipping-rate/ShipZip/SBZ/zipLogic/resolver/settings_data change.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramCheckoutPrefillInit) { return; }
  window.__ganguramCheckoutPrefillInit = true;

  function cfg() { return window.GanguramCheckoutPrefillConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function checkoutUrl() { return cfg().checkoutUrl || '/checkout'; }

  function guardBlocked() {
    var g = window.GanguramDeliveryProgress;
    if (g && typeof g.isCheckoutBlocked === 'function') { try { return g.isCheckoutBlocked() === true; } catch (e) {} }
    return false;
  }
  function selectedAddress() {
    var a = window.GanguramAddress;
    if (a && typeof a.getSelectedAddress === 'function') { try { return a.getSelectedAddress(); } catch (e) {} }
    return null;
  }
  function buildUrl(addr) {
    var fields = [
      ['address1', addr.address1], ['address2', addr.address2],
      ['city', addr.city], ['province', addr.state],
      ['country', addr.country], ['zip', addr.zip || addr.pincode]
    ];
    var parts = [];
    for (var i = 0; i < fields.length; i++) {
      var v = fields[i][1];
      if (v != null && String(v) !== '') {
        parts.push('checkout[shipping_address][' + fields[i][0] + ']=' + encodeURIComponent(String(v)));
      }
    }
    if (!parts.length) { return null; }
    var base = checkoutUrl();
    return base + (base.indexOf('?') === -1 ? '?' : '&') + parts.join('&');
  }

  function onClick(e) {
    if (!enabled()) { return; }
    var t = e.target;
    if (!t || !t.closest) { return; }
    // standard checkout button/link only — never dynamic / Shop Pay buttons
    if (t.closest('.shopify-payment-button, [data-shopify="payment-button"], .additional-checkout-buttons')) { return; }
    var hit = t.closest('#CheckOut, [name="checkout"]');
    if (!hit) { return; }
    if (guardBlocked()) { return; }                 // MOV guard owns the blocked case
    var addr = selectedAddress();
    if (!addr || !addr.address1 || !addr.city) { return; } // nothing safe to prefill
    var url = buildUrl(addr);
    if (!url) { return; }
    e.preventDefault();
    try { window.location.assign(url); } catch (err) { window.location.href = url; }
  }

  document.addEventListener('click', onClick, true);
})();
