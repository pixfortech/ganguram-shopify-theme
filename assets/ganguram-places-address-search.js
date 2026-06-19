/*
 * Ganguram — Google Places full-address search (Phase 2.9B) — PINCODE-FINDER ONLY
 * ---------------------------------------------------------------------------
 * Adds an OPTIONAL address typeahead inside the existing delivery popup. It only
 * helps the customer find their pincode: on selecting an address it extracts the
 * Indian postal_code, validates it via the existing resolver, and commits it
 * through the SAME path as the manual input — GanguramZone.setSelectedPincode(pin).
 * The pincode/zone stays the single source of truth; this module changes no
 * filtering/cart/checkout logic and never writes localStorage["Zipcode"] directly.
 *
 * - Uses google.maps.places.PlaceAutocompleteElement (Places API New), India-only.
 * - Lazy-loads the Maps JS API only when the popup opens / the search is focused;
 *   single-load + reuses an already-loaded google.maps (e.g. the stores map).
 * - Fully fail-open: no key / disabled / Google blocked -> the manual pincode flow
 *   is untouched and the search UI stays hidden or shows a friendly message.
 * - Privacy-minimal: stores only city/state alongside the recent pincode entry;
 *   no full street address, no lat/lng, no place_id for guests.
 * No jQuery/Bootstrap/FontAwesome, no map UI, no checkout autofill.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramPlacesInit) { return; }
  window.__ganguramPlacesInit = true;

  var RECENT_KEY = 'ganguram.recentLocations';

  function cfg() { return window.GanguramPlacesConfig || {}; }
  function apiKey() { return String(cfg().apiKey || '').trim(); }
  function enabled() { return cfg().enabled === true && apiKey() !== ''; }
  function country() { return String(cfg().country || 'in').toLowerCase(); }

  function popup() { return document.getElementById('ganguram-delivery-popup'); }
  function q(sel) { var p = popup(); return p ? p.querySelector(sel) : null; }
  function zone() { return window.GanguramZone || null; }

  function setAddrStatus(msg, state) {
    var s = q('[data-gdp-address-status]'); if (!s) { return; }
    s.textContent = msg || '';
    if (state) { s.setAttribute('data-gdp-state', state); } else { s.removeAttribute('data-gdp-state'); }
  }
  function focusManualInput() { var i = q('[data-gdp-input]'); if (i) { try { i.focus(); } catch (e) {} } }

  // ---- Google Maps JS loader (single-load; reuse an existing instance) -------
  var loaderPromise = null;
  function loadGoogle() {
    if (loaderPromise) { return loaderPromise; }
    if (window.google && window.google.maps) {
      // already loaded (e.g. by the stores map) — reuse it; do NOT load twice.
      loaderPromise = Promise.resolve(window.google.maps);
      return loaderPromise;
    }
    loaderPromise = new Promise(function (resolve, reject) {
      var cb = '__ganguramPlacesGmapsReady';
      window[cb] = function () { resolve(window.google && window.google.maps); };
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey()) + '&loading=async&callback=' + cb;
      s.onerror = function () { reject(new Error('maps-load-failed')); };
      document.head.appendChild(s);
    });
    return loaderPromise;
  }
  function placesLib(maps) {
    return (maps && typeof maps.importLibrary === 'function')
      ? maps.importLibrary('places')
      : Promise.resolve(maps && maps.places);
  }

  // ---- mount the autocomplete element (once) --------------------------------
  var mounted = false;
  function unavailable() {
    mounted = false;
    var slot = q('[data-gdp-address-search]'); if (slot) { slot.textContent = ''; }
    setAddrStatus('Address search unavailable. Please enter pincode manually.', 'error');
  }
  function mount() {
    if (mounted || !enabled()) { return; }
    var slot = q('[data-gdp-address-search]'); if (!slot) { return; }
    mounted = true; // guard before async work so we never double-mount
    loadGoogle()
      .then(placesLib)
      .then(function (places) {
        if (!places || typeof places.PlaceAutocompleteElement !== 'function') { throw new Error('no-place-autocomplete'); }
        var el = new places.PlaceAutocompleteElement({ includedRegionCodes: [country()] });
        el.setAttribute('data-gdp-address-el', '');
        el.style.width = '100%';
        slot.textContent = '';
        slot.appendChild(el);
        el.addEventListener('gmp-select', onSelect);
      })
      .catch(function () { unavailable(); });
  }

  function compOf(components, type) {
    if (!components) { return null; }
    for (var i = 0; i < components.length; i++) {
      var t = components[i] && components[i].types;
      if (t && t.indexOf(type) !== -1) { return components[i]; }
    }
    return null;
  }

  function onSelect(e) {
    setAddrStatus('', '');
    var pred = e && e.placePrediction;
    if (!pred || typeof pred.toPlace !== 'function') {
      setAddrStatus('Couldn’t read that address. Please enter your pincode below.', 'error'); focusManualInput(); return;
    }
    var place;
    try { place = pred.toPlace(); } catch (err) { setAddrStatus('Couldn’t read that address. Please enter your pincode below.', 'error'); focusManualInput(); return; }
    place.fetchFields({ fields: ['addressComponents'] })
      .then(function () {
        var comps = place.addressComponents || [];
        var countryC = compOf(comps, 'country');
        var iso = countryC ? String(countryC.shortText || '').toUpperCase() : '';
        if (iso && iso !== 'IN') { setAddrStatus('We currently deliver within India only.', 'error'); return; }
        var postal = compOf(comps, 'postal_code');
        var pin = postal ? String(postal.longText || postal.shortText || '').replace(/\D/g, '').slice(0, 6) : '';
        if (pin.length !== 6) {
          setAddrStatus('Couldn’t read a pincode from that address. Please enter your 6-digit pincode below.', 'error');
          focusManualInput(); return;
        }
        applyPincode(pin, comps);
      })
      .catch(function () {
        setAddrStatus('Couldn’t read that address. Please enter your pincode below.', 'error'); focusManualInput();
      });
  }

  // Route the pincode through the SAME validate+commit path as the manual input.
  function applyPincode(pin, comps) {
    var z = zone(); if (!z) { setAddrStatus('Delivery lookup is unavailable. Please reload.', 'error'); return; }
    var test = z.classifyPincode(pin);
    if (!test || test.zone === 'unknown' || test.isServiceable !== true) {
      setAddrStatus('That pincode is not serviceable. Please try another.', 'error'); return;
    }
    z.setSelectedPincode(pin);   // persists + fires the change event (recent added; popup closes)
    enrichRecent(pin, comps);    // attach a privacy-minimal summary to that recent entry
    setAddrStatus('', '');
  }

  // ---- lightweight, privacy-minimal summary on the recent entry -------------
  function safeLS() { try { var t = '__gz_p__'; window.localStorage.setItem(t, t); window.localStorage.removeItem(t); return window.localStorage; } catch (e) { return null; } }
  function enrichRecent(pin, comps) {
    var ls = safeLS(); if (!ls) { return; }
    try {
      var arr = JSON.parse(ls.getItem(RECENT_KEY) || '[]'); if (!Array.isArray(arr)) { return; }
      var cityC = compOf(comps, 'locality') || compOf(comps, 'postal_town') || compOf(comps, 'sublocality');
      var stateC = compOf(comps, 'administrative_area_level_1');
      var city = cityC ? String(cityC.longText || '') : '';
      var state = stateC ? String(stateC.longText || '') : '';
      var changed = false;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].pincode === pin) {
          if (city) { arr[i].city = city; changed = true; }
          if (state) { arr[i].state = state; changed = true; }
          break;
        }
      }
      if (changed) { ls.setItem(RECENT_KEY, JSON.stringify(arr)); }
    } catch (e) {}
  }

  // ---- activation (lazy) ----------------------------------------------------
  function activate() {
    var section = q('[data-gdp-address-search-section]');
    if (section) { section.hidden = false; }      // reveal the search UI (key present)
    var p = popup();
    if (p && 'MutationObserver' in window) {
      var obs = new MutationObserver(function () { if (!p.hidden) { mount(); } });
      obs.observe(p, { attributes: true, attributeFilter: ['hidden', 'class'] });
    }
    if (p && !p.hidden) { mount(); }               // already open
    var slot = q('[data-gdp-address-search]');
    if (slot) { slot.addEventListener('focusin', mount); } // also mount on focus
  }

  // Invalid key / referrer block surfaces via Google's global auth-failure hook.
  if (typeof window.gm_authFailure !== 'function') {
    window.gm_authFailure = function () { unavailable(); };
  }

  function init() {
    if (!popup()) { return; }
    if (!enabled()) { return; }                    // no key / disabled -> manual pincode only; search stays hidden
    activate();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
