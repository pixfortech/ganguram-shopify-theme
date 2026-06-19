/*
 * Ganguram — Saved Delivery Locations shell (Phase 2.8A)
 * ---------------------------------------------------------------------------
 * Extends the delivery pincode popup into an Amazon-style location selector:
 *   - records recently-used GUEST locations in a namespaced localStorage key
 *     (max 5, pincode + zone label only — NO full address),
 *   - renders the recent list + lets the customer re-select one,
 *   - lets a logged-in customer pick a saved Shopify address (its zip),
 *   - adds a "Clear selection" action.
 *
 * EVERY selection goes through window.GanguramZone (setSelectedPincode /
 * clearSelectedDeliveryLocation), so the existing 'ganguram:delivery-location-
 * changed' event + all downstream filters keep working unchanged. It NEVER writes
 * localStorage["Zipcode"] directly, NEVER classifies pincodes itself, and adds NO
 * Google Maps / checkout-autofill / product-filtering logic. UI/storage shell only.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramSavedLocationsInit) { return; }
  window.__ganguramSavedLocationsInit = true;

  var EVENT = 'ganguram:delivery-location-changed';
  var RECENT_KEY = 'ganguram.recentLocations'; // namespaced; NOT the SBZ "Zipcode" key
  var MAX = 5;

  function zone() { return window.GanguramZone || null; }

  // Customer-facing label (city/name + pincode; never the internal zone label).
  // Uses the shared helper; falls back to a safe local rule if it isn't loaded.
  function displayLabel(loc) {
    if (window.GanguramDisplayLabel && typeof window.GanguramDisplayLabel.get === 'function') {
      return window.GanguramDisplayLabel.get(loc);
    }
    if (!loc || !loc.pincode) { return ''; }
    if (loc.city) { return loc.city + ' ' + loc.pincode; }
    if (loc.isKolkata || loc.zone === 'kolkata' || loc.zone === 'quick_commerce') { return 'Kolkata ' + loc.pincode; }
    return String(loc.pincode);
  }

  function safeLS() {
    try { var t = '__gz_rl__'; window.localStorage.setItem(t, t); window.localStorage.removeItem(t); return window.localStorage; }
    catch (e) { return null; }
  }

  // ---- recent-location storage (guest) -------------------------------------
  function getRecents() {
    var ls = safeLS(); if (!ls) { return []; }
    try { var arr = JSON.parse(ls.getItem(RECENT_KEY) || '[]'); return Array.isArray(arr) ? arr : []; }
    catch (e) { return []; }
  }
  function setRecents(arr) {
    var ls = safeLS(); if (!ls) { return; }
    try { ls.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, MAX))); } catch (e) {}
  }
  function addRecent(loc) {
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return; }
    var arr = getRecents().filter(function (r) { return r && r.pincode && r.pincode !== loc.pincode; });
    arr.unshift({ pincode: loc.pincode, zone: loc.zone || '', label: loc.label || '', ts: Date.now() });
    setRecents(arr);
  }

  // ---- popup DOM helpers ----------------------------------------------------
  function popup() { return document.getElementById('ganguram-delivery-popup'); }
  function q(sel) { var r = popup(); return r ? r.querySelector(sel) : null; }
  function currentLoc() { var z = zone(); return z ? z.getSelectedDeliveryLocation() : null; }
  function status(msg, state) {
    var s = q('[data-gdp-status]'); if (!s) { return; }
    s.textContent = msg || '';
    if (state) { s.setAttribute('data-gdp-state', state); } else { s.removeAttribute('data-gdp-state'); }
  }

  // Validate WITHOUT classifying ourselves: ask the resolver, then set via it.
  function applyPincode(pin) {
    var z = zone(); if (!z) { return; }
    var test = z.classifyPincode(pin);
    if (!test || test.zone === 'unknown' || test.isServiceable !== true) {
      status('That pincode is not serviceable. Please try another.', 'error');
      return;
    }
    z.setSelectedPincode(pin); // persists + fires the change event (popup closes via its own handler)
  }

  // ---- rendering ------------------------------------------------------------
  function renderRecents() {
    var ul = q('[data-gdp-recent]'); var section = q('[data-gdp-recent-section]');
    if (!ul) { return; }
    var recents = getRecents();
    var cur = currentLoc();
    ul.textContent = '';
    if (!recents.length) { if (section) { section.hidden = true; } return; } // hide the section when empty (clean)
    if (section) { section.hidden = false; }
    recents.forEach(function (r) {
      var li = document.createElement('li');
      var wrap = document.createElement('span');
      wrap.className = 'ganguram-delivery-popup__chip-wrap' + (cur && cur.pincode === r.pincode ? ' is-current' : '');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ganguram-delivery-popup__chip';
      b.setAttribute('data-gdp-recent-item', '');
      b.setAttribute('data-gdp-pin', r.pincode);
      b.textContent = displayLabel(r);
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'ganguram-delivery-popup__chip-remove';
      x.setAttribute('data-gdp-recent-remove', '');
      x.setAttribute('data-gdp-pin', r.pincode);
      x.setAttribute('aria-label', 'Remove ' + r.pincode + ' from recent locations');
      x.textContent = '×';
      wrap.appendChild(b); wrap.appendChild(x);
      li.appendChild(wrap);
      ul.appendChild(li);
    });
  }
  function removeRecent(pin) {
    setRecents(getRecents().filter(function (r) { return r && r.pincode !== pin; }));
    renderRecents();
  }
  function renderClear() {
    var c = q('[data-gdp-clear]'); if (!c) { return; }
    var cur = currentLoc();
    c.hidden = !(cur && cur.pincode && cur.isServiceable === true);
  }
  function render() { renderRecents(); renderClear(); }

  // ---- wiring ---------------------------------------------------------------
  function wire() {
    var r = popup(); if (!r) { return; }
    r.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) { return; }
      var remove = t.closest('[data-gdp-recent-remove]');
      if (remove) { e.preventDefault(); removeRecent(remove.getAttribute('data-gdp-pin') || ''); return; }
      var recent = t.closest('[data-gdp-recent-item]');
      if (recent) { e.preventDefault(); applyPincode(recent.getAttribute('data-gdp-pin') || ''); return; }
      var saved = t.closest('[data-gdp-saved-item]');
      if (saved) {
        e.preventDefault();
        var zip = (saved.getAttribute('data-gdp-zip') || '').replace(/\D/g, '').slice(0, 6);
        applyPincode(zip);
        return;
      }
      var clear = t.closest('[data-gdp-clear]');
      if (clear) {
        e.preventDefault();
        if (zone() && typeof zone().clearSelectedDeliveryLocation === 'function') { zone().clearSelectedDeliveryLocation(); }
        status('Selection cleared.', '');
        return;
      }
    });
  }

  function onChange() { addRecent(currentLoc()); render(); }

  function init() {
    if (!popup()) { return; }
    wire();
    addRecent(currentLoc()); // seed with an already-selected location on load
    render();
    window.addEventListener(EVENT, onChange);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
