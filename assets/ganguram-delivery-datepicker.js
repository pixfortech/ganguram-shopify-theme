/*
 * Ganguram — Theme-native local-delivery date picker (cart drawer + cart page)
 * ---------------------------------------------------------------------------
 * ShipZip's delivery date picker is a cart-PAGE app block and does not render in the
 * AJAX cart drawer (and a hosted-checkout picker needs a Checkout UI Extension / Plus).
 * This builds a compact, theme-native date/time picker INSIDE the cart drawer AND the
 * /cart page for LOCAL delivery, saves the selection as cart attributes (so it travels
 * to the order / ShipZip), and softly blocks checkout until a required date is chosen.
 *
 * Defines window.GanguramDeliveryDatePicker. It NEVER changes ShipZip rate logic, the
 * 4HR/STD service codes, the delivery-mode cart-attribute handoff, pincode logic, MOV
 * logic, or product visibility. It only WRITES the date/time/method attributes (merge —
 * never clears ShipZip's other attributes). Fully fail-open: no config / no local cart /
 * any error -> nothing renders and nothing is blocked. Theme variables only (no
 * hardcoded colours). No jQuery / Bootstrap.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramDeliveryDatePicker) { return; }

  function cfg() { return window.GanguramDeliveryDatePickerConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function intOr(v, d) { var n = parseInt(v, 10); return isFinite(n) ? n : d; }
  function copy(key) {
    var c = cfg().copy || {};
    var d = {
      title: 'Delivery date',
      dateLabel: 'Choose a delivery date',
      timeLabel: 'Choose a time slot',
      datePlaceholder: 'Select a date',
      timePlaceholder: 'Select a time',
      typeStandard: 'Standard / Next Day',
      typeFourHour: '4 Hours (Express)',
      expressNote: '4 Hours Delivery is express — delivered today, no date needed.',
      errorDate: 'Please select a delivery date before checkout.',
      errorDateTime: 'Please select a delivery date and time before checkout.'
    };
    return (c[key] != null) ? String(c[key]) : d[key];
  }
  function keys() {
    var k = cfg().attributeKeys || {};
    return {
      date: k.date || 'Delivery-Date',
      dateReadable: k.dateReadable || 'Delivery Date',
      time: k.time || 'Delivery-Time',
      method: k.method || 'Delivery Method'   // READ for restore; the method-choice module WRITES it
    };
  }
  function timeSlots() { var t = cfg().timeSlots; return Array.isArray(t) ? t.filter(Boolean) : []; }
  function requireDate() { return cfg().requireDate !== false; }
  function requireTime() { return cfg().requireTime === true && timeSlots().length > 0; }

  function pickers() { return document.querySelectorAll('[data-ganguram-delivery-datepicker]'); }
  function checkoutButtons() { return document.querySelectorAll('#CheckOut, [name="checkout"]'); }
  function show(el) { if (el) { el.removeAttribute('hidden'); } }
  function hide(el) { if (el) { el.setAttribute('hidden', 'hidden'); } }
  function setText(el, t) { if (el) { el.textContent = (t == null ? '' : t); } }

  // ---- eligibility -----------------------------------------------------------
  function localLocation() {
    var z = window.GanguramZone, loc;
    try { loc = z && typeof z.getSelectedDeliveryLocation === 'function' && z.getSelectedDeliveryLocation(); } catch (e) { return null; }
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }
    var isLocal = loc.isKolkata === true || loc.isQuickCommerce === true || loc.zone === 'kolkata' || loc.zone === 'quick_commerce';
    return isLocal ? loc : null; // PAN India / non-local -> no local date picker
  }
  function lines() { return document.querySelectorAll('[data-ganguram-cart-line]'); }
  function cartHasLocalDelivery() {
    var l = lines(); if (!l.length) { return false; }
    for (var i = 0; i < l.length; i++) { if (String(l[i].getAttribute('data-ganguram-local-delivery')) === 'true') { return true; } }
    return false;
  }
  function cartAllQuickCommerce() {
    var l = lines(); if (!l.length) { return false; }
    for (var i = 0; i < l.length; i++) { if (String(l[i].getAttribute('data-ganguram-quick-commerce')) !== 'true') { return false; } }
    return true;
  }
  function computeState() {
    if (!enabled()) { return { show: false }; }
    var loc = localLocation();
    if (!loc || !cartHasLocalDelivery()) { return { show: false }; }
    var fourHour = cartAllQuickCommerce() && (loc.isQuickCommerce === true || loc.zone === 'quick_commerce');
    return { show: true, fourHourAvailable: fourHour };
  }

  // ---- date / time options ---------------------------------------------------
  function fmtDate(dt) {
    try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(dt); }
    catch (e) { return dt.toDateString(); }
  }
  // ---- calendar (native <input type="date">) helpers -------------------------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
  function parseYmd(s) { var p = String(s || '').split('-'); if (p.length !== 3) { return null; } var dt = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(dt.getTime()) ? null : dt; }
  function readableDate(s) { var dt = parseYmd(s); return dt ? fmtDate(dt) : ''; }
  // The selectable window as YYYY-MM-DD min/max bounds for the calendar input.
  function dateBounds() {
    var min = intOr(cfg().minOffsetDays, 1), max = intOr(cfg().maxOffsetDays, 7);
    if (max < min) { max = min; }
    var base = new Date();
    return {
      min: ymd(new Date(base.getFullYear(), base.getMonth(), base.getDate() + min)),
      max: ymd(new Date(base.getFullYear(), base.getMonth(), base.getDate() + max))
    };
  }
  // Native date inputs can't grey out specific weekdays, so a disabled-weekday pick is
  // rejected on change (validated here) — the only case a heavier custom calendar would add.
  function isDisabledWeekday(s) {
    var dis = Array.isArray(cfg().disabledWeekdays) ? cfg().disabledWeekdays : [];
    var dt = parseYmd(s); return !!(dt && dis.indexOf(dt.getDay()) !== -1);
  }

  // ---- cart attribute write (merge — never clears ShipZip's other attributes) --
  var updateUrl = (function () { return (cfg().updateUrl) || '/cart/update.js'; });
  var lastSig = null, timer = null;
  function postAttrs(attrs) {
    try {
      return fetch(updateUrl(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ attributes: attrs })
      });
    } catch (e) { return null; }
  }
  // Writes the DATE values only: Delivery-Date (YYYY-MM-DD) + a readable copy + optional time.
  // The readable "Delivery Method" order attribute is owned by the method-choice module (single
  // owner), so it is NOT written here — only read (via data-gdd-saved-method) to restore the toggle.
  function saveSelection(date, time) {
    var K = keys(), attrs = {};
    attrs[K.date] = date || '';                          // YYYY-MM-DD ('' clears — e.g. 4HR/express)
    attrs[K.dateReadable] = date ? readableDate(date) : '';
    attrs[K.time] = time || '';
    var sig = date + '|' + time;
    if (sig === lastSig) { return; }
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(function () { timer = null; lastSig = sig; postAttrs(attrs); }, 350);
  }

  // ---- current selection (read from the first visible picker's controls) -----
  function visiblePickers() { var out = [], p = pickers(); for (var i = 0; i < p.length; i++) { if (!p[i].hasAttribute('hidden')) { out.push(p[i]); } } return out; }
  function selectedType(picker) {
    var checked = picker.querySelector('[data-gdd-type]:checked');
    return checked ? checked.value : 'standard';
  }
  function selectedDate(picker) { var s = picker.querySelector('[data-gdd-date]'); return s ? String(s.value || '') : ''; }
  function selectedTime(picker) { var s = picker.querySelector('[data-gdd-time]'); return s ? String(s.value || '') : ''; }

  // A required date is missing when a picker shows, the chosen type is Standard (4HR is
  // express, no date), date selection is required, and no date (or no time) is chosen.
  function missingRequired() {
    var vps = visiblePickers();
    if (!vps.length) { return ''; }
    var p = vps[0];
    if (selectedType(p) === 'four_hour') { return ''; } // express needs no date
    if (requireDate() && !selectedDate(p)) { return requireTime() ? 'errorDateTime' : 'errorDate'; }
    if (requireTime() && !selectedTime(p)) { return 'errorDateTime'; }
    return '';
  }

  // ---- render ---------------------------------------------------------------
  function radio(name, value, label, checked) {
    var wrap = document.createElement('label');
    wrap.className = 'ganguram-delivery-datepicker__type';
    var input = document.createElement('input');
    input.type = 'radio'; input.name = name; input.value = value; input.setAttribute('data-gdd-type', '');
    if (checked) { input.checked = true; }
    var span = document.createElement('span'); span.textContent = label;
    wrap.appendChild(input); wrap.appendChild(span);
    return wrap;
  }
  function fillSelect(sel, options, placeholder, saved) {
    if (!sel) { return; }
    sel.textContent = '';
    var ph = document.createElement('option'); ph.value = ''; ph.textContent = placeholder; sel.appendChild(ph);
    for (var i = 0; i < options.length; i++) {
      var o = document.createElement('option'); o.value = options[i]; o.textContent = options[i];
      if (saved && saved === options[i]) { o.selected = true; }
      sel.appendChild(o);
    }
  }
  function renderPicker(picker, st) {
    if (!st.show) { hide(picker); return; }
    var typesEl = picker.querySelector('[data-gdd-types]');
    var dateField = picker.querySelector('[data-gdd-date-field]');
    var timeField = picker.querySelector('[data-gdd-time-field]');
    var expressEl = picker.querySelector('[data-gdd-express]');
    var savedDate = picker.getAttribute('data-gdd-saved-date') || '';
    var savedTime = picker.getAttribute('data-gdd-saved-time') || '';
    var savedMethod = picker.getAttribute('data-gdd-saved-method') || '';

    setText(picker.querySelector('[data-gdd-title]'), copy('title'));

    // delivery-type radios — only when 4-hour is also available (keep 4HR / STD separate)
    if (typesEl) {
      typesEl.textContent = '';
      if (st.fourHourAvailable) {
        var nm = 'gdd-type-' + (picker.getAttribute('data-gdd-context') || 'x');
        var wantFour = /4|four|express/i.test(savedMethod);
        typesEl.appendChild(radio(nm, 'standard', copy('typeStandard'), !wantFour));
        typesEl.appendChild(radio(nm, 'four_hour', copy('typeFourHour'), wantFour));
        show(typesEl);
      } else { hide(typesEl); }
    }

    // date = native CALENDAR input (restore saved YYYY-MM-DD; set the selectable window)
    var dateInput = picker.querySelector('[data-gdd-date]');
    if (dateInput) {
      var b = dateBounds();
      if (b.min) { dateInput.setAttribute('min', b.min); }
      if (b.max) { dateInput.setAttribute('max', b.max); }
      if (savedDate && !dateInput.value) { dateInput.value = savedDate; }   // YYYY-MM-DD from the cart attribute
    }
    setText(picker.querySelector('[data-gdd-date-label]'), copy('dateLabel'));
    var timeSel = picker.querySelector('[data-gdd-time]');
    if (requireTime() || timeSlots().length) {
      if (timeSel && !timeSel.getAttribute('data-gdd-built')) {
        fillSelect(timeSel, timeSlots(), copy('timePlaceholder'), savedTime);
        timeSel.setAttribute('data-gdd-built', '1');
      }
      setText(picker.querySelector('[data-gdd-time-label]'), copy('timeLabel'));
    }

    applyTypeVisibility(picker);
    if (expressEl) { setText(expressEl, copy('expressNote')); }
    show(picker);
  }

  // toggle date/time fields vs express note based on the chosen type
  function applyTypeVisibility(picker) {
    var four = selectedType(picker) === 'four_hour';
    var dateField = picker.querySelector('[data-gdd-date-field]');
    var timeField = picker.querySelector('[data-gdd-time-field]');
    var expressEl = picker.querySelector('[data-gdd-express]');
    if (four) {
      hide(dateField); hide(timeField); show(expressEl);
    } else {
      show(dateField);
      if (requireTime() || timeSlots().length) { show(timeField); } else { hide(timeField); }
      hide(expressEl);
    }
  }

  function onPickerChange(picker) {
    applyTypeVisibility(picker);
    clearError();
    if (selectedType(picker) === 'four_hour') { saveSelection('', ''); return; }   // express: no date
    var d = selectedDate(picker);
    if (d && isDisabledWeekday(d)) {                 // reject a disabled-weekday pick (native can't grey it out)
      var inp = picker.querySelector('[data-gdd-date]'); if (inp) { inp.value = ''; }
      showError(requireTime() ? 'errorDateTime' : 'errorDate');
      saveSelection('', selectedTime(picker)); return;
    }
    saveSelection(d, selectedTime(picker));
  }

  function clearError() { var p = pickers(); for (var i = 0; i < p.length; i++) { var e = p[i].querySelector('[data-gdd-error]'); setText(e, ''); hide(e); } }
  function showError(code) {
    var vps = visiblePickers();
    for (var i = 0; i < vps.length; i++) {
      var e = vps[i].querySelector('[data-gdd-error]');
      if (e) { setText(e, copy(code)); show(e); if (i === 0 && e.scrollIntoView) { try { e.scrollIntoView({ block: 'center' }); } catch (x) {} } }
    }
  }

  function renderAll() {
    var st = computeState();
    var p = pickers();
    for (var i = 0; i < p.length; i++) { try { renderPicker(p[i], st); } catch (e) { hide(p[i]); } }
  }

  // ---- soft checkout guard (date required) ----------------------------------
  function isDateMissing() { return !!missingRequired(); }
  function onCheckoutClick(e) {
    var t = e.target;
    if (!t || !t.closest) { return; }
    if (!t.closest('#CheckOut, [name="checkout"], .shopify-payment-button, [data-shopify="payment-button"], .additional-checkout-buttons, [data-ganguram-checkout]')) { return; }
    var code = missingRequired();
    if (code) { e.preventDefault(); e.stopPropagation(); showError(code); }
  }
  function onSubmit(e) { var f = e.target; if (f && f.id === 'cart') { var code = missingRequired(); if (code) { e.preventDefault(); e.stopPropagation(); showError(code); } } }

  function observeCartForms() {
    if (!('MutationObserver' in window)) { return; }
    var forms = document.querySelectorAll('cart-form'); if (!forms.length) { return; }
    var pending = false, schedule = function () {
      if (pending) { return; } pending = true;
      var run = function () { pending = false; renderAll(); };
      if (window.requestAnimationFrame) { window.requestAnimationFrame(run); } else { setTimeout(run, 0); }
    };
    var obs = new MutationObserver(schedule);
    for (var i = 0; i < forms.length; i++) { try { obs.observe(forms[i], { childList: true }); } catch (e) {} }
  }

  function init() {
    renderAll();
    observeCartForms();
    window.addEventListener('ganguram:delivery-location-changed', renderAll);
    document.addEventListener('change', function (e) { var p = e.target && e.target.closest && e.target.closest('[data-ganguram-delivery-datepicker]'); if (p) { onPickerChange(p); } }, false);
    document.addEventListener('click', onCheckoutClick, true);
    document.addEventListener('submit', onSubmit, true);
  }

  window.GanguramDeliveryDatePicker = { render: renderAll, isDateMissing: isDateMissing };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
