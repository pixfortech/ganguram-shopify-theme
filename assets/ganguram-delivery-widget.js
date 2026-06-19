/*
 * Ganguram — "Delivering to…" header widget  (Phase 2.1b)
 * ---------------------------------------------------------------------------
 * UI only. Reads/writes the delivery location EXCLUSIVELY through
 * window.GanguramZone (Phase 2.1a). It never writes localStorage directly,
 * never touches cart/checkout/MOV/date-slot/shipping/zipLogic/product
 * visibility/menu/search/banners, and performs no redirects.
 *
 * Supports multiple instances (e.g. desktop + mobile). All instances stay in
 * sync via the 'ganguram:delivery-location-changed' event.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramDeliveryWidgetInit) { return; } // idempotent
  window.__ganguramDeliveryWidgetInit = true;

  var EVENT = 'ganguram:delivery-location-changed';

  function zone() { return window.GanguramZone || null; } // may be null -> degrade gracefully
  function widgets() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-ganguram-delivery-widget]'));
  }
  function q(root, sel) { return root.querySelector(sel); }

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

  // --- display -------------------------------------------------------------
  function renderOne(w, loc) {
    var valueEl = q(w, '[data-gdw-value]');
    var clearBtn = q(w, '[data-gdw-clear]');
    if (loc && loc.pincode) {
      valueEl.textContent = displayLabel(loc);
      w.setAttribute('data-gdw-zone', loc.zone || '');
      if (clearBtn) { clearBtn.hidden = false; }
    } else {
      valueEl.textContent = 'Select pincode';
      w.removeAttribute('data-gdw-zone');
      if (clearBtn) { clearBtn.hidden = true; }
    }
  }
  function renderAll(loc) { widgets().forEach(function (w) { renderOne(w, loc); }); }

  function currentLocation() {
    var z = zone();
    return z ? z.getSelectedDeliveryLocation() : null;
  }

  // --- panel open/close ----------------------------------------------------
  function isOpen(w) {
    var p = q(w, '[data-gdw-panel]');
    return p && !p.hidden;
  }
  function closePanel(w) {
    var p = q(w, '[data-gdw-panel]');
    var t = q(w, '[data-gdw-trigger]');
    if (p) { p.hidden = true; }
    if (t) { t.setAttribute('aria-expanded', 'false'); }
  }
  function closeAll() { widgets().forEach(closePanel); }
  function openPanel(w) {
    closeAll();
    var p = q(w, '[data-gdw-panel]');
    var t = q(w, '[data-gdw-trigger]');
    if (!p) { return; }
    // position the (mobile) fixed panel right under the trigger
    if (t) {
      var r = t.getBoundingClientRect();
      p.style.setProperty('--gdw-panel-top', Math.round(r.bottom + 8) + 'px');
    }
    p.hidden = false;
    if (t) { t.setAttribute('aria-expanded', 'true'); }
    var input = q(w, '[data-gdw-input]');
    if (input) {
      var pin = (currentLocation() && currentLocation().pincode) || '';
      input.value = pin;
      try { input.focus(); input.select(); } catch (e) {}
    }
    setStatus(w, '', '');
  }
  function togglePanel(w) { isOpen(w) ? closePanel(w) : openPanel(w); }

  function setStatus(w, msg, state) {
    var s = q(w, '[data-gdw-status]');
    if (!s) { return; }
    s.textContent = msg || '';
    if (state) { s.setAttribute('data-gdw-state', state); } else { s.removeAttribute('data-gdw-state'); }
  }

  // --- actions -------------------------------------------------------------
  function apply(w) {
    var z = zone();
    var input = q(w, '[data-gdw-input]');
    var raw = input ? (input.value || '').trim() : '';

    if (!z) {
      setStatus(w, 'Delivery lookup is unavailable right now. Please reload and try again.', 'error');
      return;
    }
    // Validate WITHOUT storing (pure classify). Unknown => invalid.
    var test = z.classifyPincode(raw);
    if (!test || test.zone === 'unknown' || !test.isServiceable) {
      setStatus(w, 'Please enter a valid 6-digit pincode.', 'error');
      return; // do not store invalid input
    }
    var loc = z.setSelectedPincode(raw); // persists + fires event -> renderAll
    setStatus(w, 'Delivering to ' + displayLabel(loc) + '.', 'ok');
    // close shortly after, so the status is briefly visible
    window.setTimeout(function () { closePanel(w); }, 900);
  }

  function clearSelection(w) {
    var z = zone();
    if (z) { z.clearSelectedDeliveryLocation(); } // fires event -> renderAll
    var input = q(w, '[data-gdw-input]');
    if (input) { input.value = ''; }
    setStatus(w, 'Pincode cleared.', '');
  }

  // --- wiring --------------------------------------------------------------
  function wire(w) {
    var trigger = q(w, '[data-gdw-trigger]');
    var applyBtn = q(w, '[data-gdw-apply]');
    var clearBtn = q(w, '[data-gdw-clear]');
    var input = q(w, '[data-gdw-input]');

    if (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        // Phase 2.4: open the premium popup; fall back to the inline dropdown if the popup module isn't present.
        if (window.GanguramDelivery && typeof window.GanguramDelivery.openDeliveryLocationPopup === 'function') {
          window.GanguramDelivery.openDeliveryLocationPopup();
        } else {
          togglePanel(w);
        }
      });
    }
    if (applyBtn) { applyBtn.addEventListener('click', function () { apply(w); }); }
    if (clearBtn) { clearBtn.addEventListener('click', function () { clearSelection(w); }); }
    if (input) {
      // keep input numeric, 6 digits max
      input.addEventListener('input', function () { input.value = input.value.replace(/\D/g, '').slice(0, 6); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); apply(w); }
        else if (e.key === 'Escape') { closePanel(w); }
      });
    }
    // prevent clicks inside the panel from bubbling to the document close handler
    var panel = q(w, '[data-gdw-panel]');
    if (panel) { panel.addEventListener('click', function (e) { e.stopPropagation(); }); }
  }

  function init() {
    var ws = widgets();
    if (!ws.length) { return; }
    ws.forEach(wire);
    renderAll(currentLocation()); // shows "Select pincode" if none / resolver missing

    // keep every instance in sync with resolver changes
    window.addEventListener(EVENT, function (e) { renderAll((e && e.detail) || currentLocation()); });
    // a later async city enrichment refreshes the visible label (display only)
    window.addEventListener('ganguram:delivery-label-updated', function () { renderAll(currentLocation()); });

    // close on outside click / Escape
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-ganguram-delivery-widget]')) { closeAll(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeAll(); } });
    window.addEventListener('resize', closeAll, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
