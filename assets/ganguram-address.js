/*
 * Ganguram — Selected structured address store (Phase 2.11F.2)
 * ---------------------------------------------------------------------------
 * Tracks whether the customer has SELECTED a full Google address (vs entered only a
 * pincode), independent of whether a driving distance could be computed. Defines
 * window.GanguramAddress.
 *
 * ROOT-CAUSE FIX: the popup estimate used to derive "selected address" mode from
 * GanguramDistance.getForPincode().confirmed — which is only true when the Distance
 * Matrix call SUCCEEDS. So a selected address with no/failed distance wrongly read as
 * "based on your pincode". The address basis now comes from THIS store instead.
 *
 * Stores a structured record (place_id, formatted_address, address1/2, city, state,
 * country, zip, lat, lng, source) so the popup estimate can switch basis and the
 * checkout-prefill module can fill Shopify's shipping fields. Keyed to the current
 * pincode: a manual pincode entry (which fires delivery-location-changed without a
 * following setSelectedAddress) clears it back to pincode mode.
 *
 * Display/handoff only — never changes the resolver, MOV, ShipZip, or settings_data.
 * Fail-open: no localStorage / any error -> no selected address (pincode mode).
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramAddress) { return; }

  var KEY = 'ganguram.selectedAddress';
  var EVENT_CHANGED = 'ganguram:delivery-location-changed';
  var EVENT_ADDRESS = 'ganguram:delivery-address-updated';

  function norm(p) { return String(p == null ? '' : p).replace(/\D/g, '').slice(0, 6); }
  function safeLS() { try { var t = '__ga__'; window.localStorage.setItem(t, t); window.localStorage.removeItem(t); return window.localStorage; } catch (e) { return null; } }
  function read() { var s = safeLS(); if (!s) { return null; } try { var o = JSON.parse(s.getItem(KEY) || 'null'); return (o && typeof o === 'object') ? o : null; } catch (e) { return null; } }
  function write(o) { var s = safeLS(); if (!s) { return; } try { s.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function clearStore() { var s = safeLS(); if (!s) { return; } try { s.removeItem(KEY); } catch (e) {} }

  function currentPin() {
    var z = window.GanguramZone;
    if (z && typeof z.getSelectedDeliveryLocation === 'function') { try { return norm((z.getSelectedDeliveryLocation() || {}).pincode); } catch (e) {} }
    return '';
  }
  function fire(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); }
    catch (e) { try { var ev = document.createEvent('CustomEvent'); ev.initCustomEvent(name, false, false, detail); window.dispatchEvent(ev); } catch (e2) {} }
  }

  function setSelectedAddress(addr) {
    if (!addr || !addr.pincode) { return; }
    var p = norm(addr.pincode);
    if (currentPin() && currentPin() !== p) { return; } // selection moved on
    var rec = {
      source: 'selected_address',
      pincode: p, zip: p,
      place_id: String(addr.place_id || ''),
      formatted_address: String(addr.formatted_address || ''),
      address1: String(addr.address1 || ''),
      address2: String(addr.address2 || ''),
      city: String(addr.city || ''),
      state: String(addr.state || ''),
      country: String(addr.country || ''),
      lat: (typeof addr.lat === 'number' && isFinite(addr.lat)) ? addr.lat : null,
      lng: (typeof addr.lng === 'number' && isFinite(addr.lng)) ? addr.lng : null,
      ts: Date.now()
    };
    write(rec);
    fire(EVENT_ADDRESS, { pincode: p, source: rec.source });
  }

  // The stored address, only if it still matches the current pincode (else stale -> null).
  function getSelectedAddress() {
    var rec = read();
    if (rec && norm(rec.pincode) === currentPin() && currentPin()) { return rec; }
    return null;
  }
  function hasSelectedAddress() { return !!getSelectedAddress(); }

  function onChange() { clearStore(); }

  window.GanguramAddress = {
    setSelectedAddress: setSelectedAddress,
    getSelectedAddress: getSelectedAddress,
    hasSelectedAddress: hasSelectedAddress,
    clear: clearStore
  };

  window.addEventListener(EVENT_CHANGED, onChange);
})();
