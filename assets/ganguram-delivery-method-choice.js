/*
 * Ganguram — Persist the cart's chosen delivery method for checkout (Phase 2.12H)
 * ---------------------------------------------------------------------------
 * The customer picks ONE delivery method in the cart; checkout should then show only
 * that method (so Shopify effectively auto-selects it). Theme JS cannot auto-select a
 * Shopify checkout shipping method, so the supported workaround is: save the choice as
 * a CART ATTRIBUTE, then a Delivery Customization (a Shipzy rule, or a Shopify Delivery
 * Customization Function) HIDES every non-selected method at checkout.
 *
 * This module owns ONLY the cart-attribute side. It DERIVES the chosen method from the
 * EXISTING cart UI — the local date-picker's Standard / 4 Hours toggle ([data-gdd-type])
 * plus the selected zone — so there is never a second, competing selector that could
 * disagree with the date picker:
 *   - PAN India zone                          -> PAN_INDIA
 *   - local zone, 4-hour available + chosen   -> 4HR
 *   - local zone, otherwise                   -> STD
 *   - no serviceable pincode / blocked        -> (cleared; no attribute)
 * It writes two attributes a Delivery Customization can match on:
 *   ganguram_preferred_delivery_method = STD | 4HR | PAN_INDIA
 *   ganguram_preferred_delivery_label  = Standard Delivery | 4 hours delivery | PAN India Shipping
 *
 * Date safety: when the method is 4HR or PAN India it CLEARS the Standard date/time
 * attributes (Delivery-Date / Delivery-Time) so a stale local date can't ride along; for
 * Standard it leaves them to the date picker (which still requires a date). When the
 * choice becomes invalid (pincode/cart change), it re-derives + re-persists and shows a
 * soft "please review your delivery method" notice — never blocks checkout.
 *
 * GUARDRAILS: it does NOT change ShipZip rate amounts, the 4HR/STD service codes, the
 * distance slabs, product eligibility, the pincode resolver, MOV, the unavailable-items
 * modal, the Custom Box Builder, or any date-picker attribute NAMES. Reads the date-picker
 * attribute keys from its config (never renames them). Merge-only cart writes; fully
 * fail-open; theme CSS variables only; no jQuery.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramDeliveryMethodChoice) { return; }

  var STORE_KEY = 'ganguram.preferredMethod';

  function cfg() { return window.GanguramDeliveryMethodChoiceConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function updateUrl() { return cfg().updateUrl || '/cart/update.js'; }
  function debounceMs() { var n = parseInt(cfg().debounceMs, 10); return (isFinite(n) && n >= 0) ? n : 400; }
  function keys() {
    var k = cfg().keys || {};
    return {
      method: k.method || 'ganguram_preferred_delivery_method',
      label: k.label || 'ganguram_preferred_delivery_label',
      orderMethod: k.orderMethod || 'Delivery Method'   // readable order attribute (single owner)
    };
  }
  function cartUrl() { return cfg().cartUrl || '/cart.js'; }
  function labels() {
    var l = cfg().labels || {};
    return { STD: l.STD || 'Standard Delivery', '4HR': l['4HR'] || '4 hours delivery', PAN_INDIA: l.PAN_INDIA || 'PAN India Shipping' };
  }
  // Date-picker attribute keys — READ from its config so we clear (never rename) the right ones.
  function dateKeys() {
    var dk = (window.GanguramDeliveryDatePickerConfig && window.GanguramDeliveryDatePickerConfig.attributeKeys) || {};
    return { date: dk.date || 'Delivery-Date', time: dk.time || 'Delivery-Time', dateReadable: dk.dateReadable || 'Delivery Date' };
  }
  function copy(key) {
    var c = cfg().copy || {};
    var d = {
      notice: 'Your delivery options changed. Please review your delivery method below.',
      methodSummary: 'Delivery Method:',
      dateSummary: 'Preferred Date:',
      datePrompt: 'Choose a delivery date'
    };
    return (c[key] != null) ? String(c[key]) : d[key];
  }

  function safeLS() { try { var t = '__gmc__'; window.localStorage.setItem(t, t); window.localStorage.removeItem(t); return window.localStorage; } catch (e) { return null; } }
  function readStored() { var s = safeLS(); if (!s) { return null; } try { var v = s.getItem(STORE_KEY); return v ? v : null; } catch (e) { return null; } }
  function writeStored(code) { var s = safeLS(); if (!s) { return; } try { if (code) { s.setItem(STORE_KEY, code); } else { s.removeItem(STORE_KEY); } } catch (e) {} }

  function zone() { return window.GanguramZone || null; }
  function currentLoc() {
    var z = zone();
    if (!z || typeof z.getSelectedDeliveryLocation !== 'function') { return null; }
    try { return z.getSelectedDeliveryLocation(); } catch (e) { return null; }
  }
  function lines() { return document.querySelectorAll('[data-ganguram-cart-line]'); }
  function cartAllQuickCommerce() {
    var l = lines(); if (!l.length) { return false; }
    for (var i = 0; i < l.length; i++) { if (String(l[i].getAttribute('data-ganguram-quick-commerce')) !== 'true') { return false; } }
    return true;
  }
  function isLocal(loc) { return !!(loc && (loc.zone === 'kolkata' || loc.zone === 'quick_commerce' || loc.isKolkata === true || loc.isQuickCommerce === true)); }
  function isQuickCommerceZone(loc) { return !!(loc && (loc.isQuickCommerce === true || loc.zone === 'quick_commerce')); }
  function isPanIndia(loc) { return !!(loc && (loc.zone === 'pan_india' || loc.isPanIndia === true)); }

  // The date picker's chosen delivery type ('standard' | 'four_hour') — the SAME toggle the
  // customer sees. Reads the checked radio's property (not the :checked pseudo) so it works
  // everywhere. null when no picker/radio is present (then local defaults to Standard).
  function datePickerType() {
    var rs = document.querySelectorAll('[data-gdd-type]');
    for (var i = 0; i < rs.length; i++) { if (rs[i].checked) { return String(rs[i].value || ''); } }
    return null;
  }

  // ---- derive the ONE chosen method from the live cart state -----------------
  // Zone-based (matches ShipZip's rate zones + the date picker), so the persisted choice
  // lines up with the actual checkout rates. Returns 'STD' | '4HR' | 'PAN_INDIA' | null.
  function deriveCode() {
    var loc = currentLoc();
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }
    if (isPanIndia(loc) && !isLocal(loc)) { return 'PAN_INDIA'; }
    if (isLocal(loc)) {
      var fourHourAvailable = cartAllQuickCommerce() && isQuickCommerceZone(loc);
      return (fourHourAvailable && datePickerType() === 'four_hour') ? '4HR' : 'STD';
    }
    return null;
  }
  function labelFor(code) { return code ? (labels()[code] || '') : ''; }

  // ---- cart attribute write (merge; clears with '' — never clobbers other attrs) ----
  var lastSig = null, timer = null;
  function postAttrs(attrs) {
    try {
      return fetch(updateUrl(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ attributes: attrs })
      });
    } catch (e) { return null; }
  }
  function desiredAttrs(code) {
    var K = keys(), DK = dateKeys(), out = {};
    out[K.method] = code || '';
    out[K.label] = labelFor(code);
    out[K.orderMethod] = labelFor(code);   // readable "Delivery Method" order attribute (single owner)
    // 4 Hours / PAN India need no local date -> clear any stale Standard date/time so it can't
    // travel to the order. Standard leaves them to the date picker (which still requires one).
    if (code === '4HR' || code === 'PAN_INDIA') { out[DK.date] = ''; out[DK.time] = ''; out[DK.dateReadable] = ''; }
    return out;
  }
  function persist(code) {
    var attrs = desiredAttrs(code);
    var sig; try { sig = JSON.stringify(attrs); } catch (e) { sig = code || ''; }
    // Don't fire a redundant clear for a fresh visitor who never had a selection.
    if (!code && lastSig === null) { return; }
    if (sig === lastSig) { return; }
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(function () { timer = null; lastSig = sig; postAttrs(attrs); }, debounceMs());
  }

  // ---- "please review your method" notice (progressive enhancement) ----------
  // Shown only when the method CHANGED because the pincode/cart changed (not on the
  // customer's own toggle). Created next to the date picker if the page has no
  // [data-ganguram-method-choice-notice] of its own. Never blocks checkout.
  function notices() { return document.querySelectorAll('[data-ganguram-method-choice-notice]'); }
  function ensureNotices() {
    if (notices().length) { return; }
    var pickers = document.querySelectorAll('[data-ganguram-delivery-datepicker]');
    for (var i = 0; i < pickers.length; i++) {
      var p = pickers[i], parent = p.parentNode; if (!parent) { continue; }
      var n = document.createElement('p');
      n.className = 'ganguram-delivery-method-choice__notice';
      n.setAttribute('data-ganguram-method-choice-notice', '');
      n.setAttribute('role', 'status'); n.setAttribute('aria-live', 'polite');
      n.setAttribute('hidden', 'hidden');
      try { parent.insertBefore(n, p.nextSibling); } catch (e) { parent.appendChild(n); }
    }
  }
  function showNotice(on) {
    ensureNotices();
    var ns = notices();
    for (var i = 0; i < ns.length; i++) {
      if (on) { ns[i].textContent = copy('notice'); ns[i].removeAttribute('hidden'); }
      else { ns[i].textContent = ''; ns[i].setAttribute('hidden', 'hidden'); }
    }
  }

  // ---- cart delivery summary (method + preferred date) -----------------------
  // "Delivery Method: <label>" and, for Standard, "Preferred Date: <YYYY-MM-DD>". The
  // estimate / "final charge confirmed at checkout" lines are rendered by the delivery
  // panel; this only adds the chosen method + date. Created before the date picker if the
  // page has no [data-ganguram-delivery-method-summary] of its own.
  function summaries() { return document.querySelectorAll('[data-ganguram-delivery-method-summary]'); }
  function ensureSummaries() {
    if (summaries().length) { return; }
    var pickers = document.querySelectorAll('[data-ganguram-delivery-datepicker]');
    for (var i = 0; i < pickers.length; i++) {
      var p = pickers[i], parent = p.parentNode; if (!parent) { continue; }
      var s = document.createElement('div');
      s.className = 'ganguram-delivery-method-choice__summary';
      s.setAttribute('data-ganguram-delivery-method-summary', '');
      s.setAttribute('hidden', 'hidden');
      try { parent.insertBefore(s, p); } catch (e) { parent.appendChild(s); }
    }
  }
  // The date the customer picked in the calendar (YYYY-MM-DD), live from the input.
  function selectedDateYmd() {
    var inp = document.querySelector('[data-gdd-date]');
    return (inp && inp.value) ? String(inp.value) : '';
  }
  function summaryRow(text) { var p = document.createElement('p'); p.className = 'ganguram-delivery-method-choice__summary-row'; p.textContent = text; return p; }
  function renderSummary(code) {
    ensureSummaries();
    var ss = summaries(); if (!ss.length) { return; }
    for (var i = 0; i < ss.length; i++) {
      var box = ss[i]; box.textContent = '';
      if (!code) { box.setAttribute('hidden', 'hidden'); continue; }
      box.appendChild(summaryRow(copy('methodSummary') + ' ' + labelFor(code)));
      if (code === 'STD') {                                  // 4HR / PAN India need no date line
        var d = selectedDateYmd();
        box.appendChild(summaryRow(copy('dateSummary') + ' ' + (d || copy('datePrompt'))));
      }
      box.removeAttribute('hidden');
    }
  }

  // ---- diagnostics: inspect the cart attributes that will reach the order -----
  // window.GanguramDeliveryMethodChoice.inspectCartAttributes() -> Promise of the exact
  // handoff attributes currently on the cart (so QA can confirm them BEFORE checkout).
  function inspectCartAttributes() {
    try {
      return fetch(cartUrl(), { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          var a = (cart && cart.attributes) || {}, K = keys(), DK = dateKeys();
          return {
            ganguram_preferred_delivery_method: a[K.method] || '',
            ganguram_preferred_delivery_label: a[K.label] || '',
            'Delivery Method': a[K.orderMethod] || '',
            'Delivery-Date': a[DK.date] || '',
            'Delivery Date': a[DK.dateReadable] || '',
            'Delivery-Time': a[DK.time] || ''
          };
        }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  // ---- apply: derive, persist, and (on context changes) flag a re-review ------
  var current = null;     // last derived code this session
  function apply(reason) {
    if (!enabled()) { return null; }
    var prev = (current !== null) ? current : readStored();
    var code = deriveCode();
    current = code;
    writeStored(code);
    persist(code);
    renderSummary(code);
    // A context change (pincode/cart) that invalidates or switches the prior choice -> ask to review.
    var contextChange = (reason === 'location' || reason === 'cart');
    if (contextChange && prev && prev !== code) { showNotice(true); }
    else if (reason === 'user' || (code && prev === code)) { showNotice(false); }
    return code;
  }
  function render() { ensureSummaries(); ensureNotices(); apply('init'); }

  // ---- wiring ----------------------------------------------------------------
  function onCartControlChange(e) {
    var t = e.target; if (!t) { return; }
    var isType = (t.closest && t.closest('[data-gdd-type]')) || (t.getAttribute && t.getAttribute('data-gdd-type') != null);
    if (isType) { apply('user'); return; }                                  // method toggle -> re-derive
    if (t.getAttribute && t.getAttribute('data-gdd-date') != null) { renderSummary(deriveCode()); }  // calendar -> refresh summary
  }
  function observeCartForms() {
    if (!('MutationObserver' in window)) { return; }
    var forms = document.querySelectorAll('cart-form'); if (!forms.length) { return; }
    var pending = false, schedule = function () {
      if (pending) { return; } pending = true;
      var run = function () { pending = false; ensureNotices(); apply('cart'); };
      if (window.requestAnimationFrame) { window.requestAnimationFrame(run); } else { setTimeout(run, 0); }
    };
    var obs = new MutationObserver(schedule);
    for (var i = 0; i < forms.length; i++) { try { obs.observe(forms[i], { childList: true }); } catch (e) {} }
  }
  function init() {
    render();
    observeCartForms();
    window.addEventListener('ganguram:delivery-location-changed', function () { apply('location'); });
    window.addEventListener('ganguram:delivery-label-updated', function () { apply('location'); });
    document.addEventListener('change', onCartControlChange, false);
  }

  window.GanguramDeliveryMethodChoice = {
    apply: apply,
    render: render,
    inspectCartAttributes: inspectCartAttributes,
    getPreferred: function () { var code = deriveCode(); return { code: code, label: labelFor(code) }; },
    // DEV-ONLY diagnostics (never customer-facing).
    debugState: function () {
      var loc = currentLoc(), code = deriveCode();
      return {
        enabled: enabled(),
        zone: loc ? loc.zone : null,
        serviceable: !!(loc && loc.isServiceable === true),
        cartAllQuickCommerce: cartAllQuickCommerce(),
        datePickerType: datePickerType(),
        preferredMethod: code,
        preferredLabel: labelFor(code),
        attributesSent: desiredAttrs(code),
        stored: readStored()
      };
    }
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
