/*
 * Ganguram — Cart delivery progress + service options (Phase 2.11C)
 * ---------------------------------------------------------------------------
 * ADVISORY cart UI. Consumes window.GanguramDeliveryRules:
 *   - getProgressData(cartSubtotal, location)  -> MOV / free-delivery progress
 *   - getServiceOptions(location, options)     -> standard / 4-hour service options
 * and paints a small, read-only panel at the top of the cart (drawer + page):
 *   - a progress bar + "add X more" message toward the MOV / free-delivery threshold,
 *   - a display-only delivery charge line,
 *   - the available delivery SERVICE options (standard + 4-hour), each showing its
 *     charge and — for standard — its date-picker requirement / earliest date.
 *
 * It is DISPLAY/ADVISORY ONLY. It NEVER enforces a minimum order, blocks or changes
 * checkout, sets the real shipping charge, mutates the cart, or touches ShipZip /
 * SBZ / zipLogic / Google / the pincode resolver / settings_data.json. The 4-hour
 * option is hidden when the cart is not 4-hour-eligible (all lines must be Quick
 * Commerce). Fully FAIL-OPEN: no rules / no selection / any error -> the panel just
 * hides and nothing breaks.
 *
 * Money is PAISE (matching cart.total_price). No jQuery / Bootstrap / FontAwesome.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramDeliveryProgressInit) { return; }
  window.__ganguramDeliveryProgressInit = true;

  function cfg() { return window.GanguramDeliveryProgressConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function copy(key) {
    var c = cfg().copy || {};
    var d = {
      movRemaining: 'Add __AMOUNT__ to reach the minimum order.',
      freeDeliveryRemaining: 'Add __AMOUNT__ more for free delivery.',
      freeDeliveryUnlocked: 'You’ve unlocked free delivery!',
      minimumMet: 'Minimum order reached.',
      deliveryChargeFrom: 'Delivery from __AMOUNT__',
      freeDelivery: 'Free delivery',
      datePickerNote: 'Choose a delivery date',
      earliestNote: 'earliest __DATE__',
      standardLabel: 'Standard delivery',
      fourHourLabel: '4-hour delivery'
    };
    return (c[key] != null) ? String(c[key]) : d[key];
  }
  // Replace Liquid-safe tokens __AMOUNT__ / __DATE__ (the form used in the snippet —
  // single-brace {amount} breaks Shopify's Liquid parser) with the given values.
  // The legacy {amount}/{date} form is still accepted for backward compatibility.
  function tmpl(s, vars) {
    s = String(s == null ? '' : s);
    vars = vars || {};
    return s
      .replace(/__([A-Z0-9]+)__/g, function (_, k) { var kk = k.toLowerCase(); return (vars[kk] != null) ? vars[kk] : ''; })
      .replace(/\{(\w+)\}/g, function (_, k) { return (vars[k] != null) ? vars[k] : ''; });
  }

  function rules() { return window.GanguramDeliveryRules || null; }
  function zone() { return window.GanguramZone || null; }
  function fmtMoney(paise) { var dr = rules(); return (dr && typeof dr.formatMoney === 'function') ? dr.formatMoney(paise) : ''; }

  function containers() { return document.querySelectorAll('[data-ganguram-delivery-progress]'); }
  function hide(el) { try { el.setAttribute('hidden', 'hidden'); } catch (e) {} }

  // Cart is 4-hour eligible only if it has items and EVERY line is Quick Commerce.
  function cartFourHourEligible(container) {
    var scope = (container && container.closest && container.closest('cart-form')) || document;
    var lines = scope.querySelectorAll('[data-ganguram-cart-line]');
    if (!lines.length) { return false; }
    for (var i = 0; i < lines.length; i++) {
      if (String(lines[i].getAttribute('data-ganguram-quick-commerce')) !== 'true') { return false; }
    }
    return true;
  }

  function earliestDate(offsetDays) {
    try {
      var d = new Date();
      var n = parseInt(offsetDays, 10); if (!isFinite(n)) { n = 0; }
      d.setDate(d.getDate() + n);
      try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(d); }
      catch (e) { return d.toDateString(); }
    } catch (e) { return ''; }
  }

  function buildServiceLi(o) {
    var li = document.createElement('li');
    li.className = 'ganguram-delivery-progress__service';
    li.setAttribute('data-gdpr-service', o.serviceType || '');

    var name = document.createElement('span');
    name.className = 'ganguram-delivery-progress__service-name';
    name.textContent = o.serviceLabel || (o.serviceType === 'four_hour' ? copy('fourHourLabel') : copy('standardLabel'));
    li.appendChild(name);

    if (o.deliveryCharge != null) {
      var ch = document.createElement('span');
      ch.className = 'ganguram-delivery-progress__service-charge';
      ch.textContent = (o.deliveryCharge === 0) ? copy('freeDelivery') : fmtMoney(o.deliveryCharge);
      li.appendChild(ch);
    }

    var notes = [];
    if (o.datePickerRequired) {
      var note = copy('datePickerNote');
      if (o.defaultDateOffsetDays != null) {
        var d = earliestDate(o.defaultDateOffsetDays);
        if (d) { note += ' · ' + tmpl(copy('earliestNote'), { date: d }); }
      }
      notes.push(note);
    }
    if (o.customerMessageForDeliveryDate) { notes.push(o.customerMessageForDeliveryDate); }
    if (o.customerMessageForCartValue) { notes.push(o.customerMessageForCartValue); }
    if (notes.length) {
      var noteEl = document.createElement('span');
      noteEl.className = 'ganguram-delivery-progress__service-note';
      noteEl.textContent = notes.join(' · ');
      li.appendChild(noteEl);
    }
    return li;
  }

  function render(container) {
    try {
      if (!enabled()) { hide(container); return; }
      var dr = rules(); var z = zone();
      if (!dr || !z) { hide(container); return; }
      var location = z.getSelectedDeliveryLocation();
      if (!location || !location.pincode || location.isServiceable !== true) { hide(container); return; }

      var subtotal = parseInt(container.getAttribute('data-gdpr-cart-total'), 10);
      if (!isFinite(subtotal) || subtotal < 0) { subtotal = 0; }

      var data = dr.getProgressData(subtotal, location);
      if (!data || data.reason === 'none' || !data.rule) { hide(container); return; } // fail open: no rules

      // ---- progress bar + message --------------------------------------------
      var barEl = container.querySelector('[data-gdpr-bar]');
      var fillEl = container.querySelector('[data-gdpr-bar-fill]');
      var msgEl = container.querySelector('[data-gdpr-message]');
      var target = null, message = '';
      if (data.mov != null && !data.movMet) {
        target = data.mov;
        message = tmpl(copy('movRemaining'), { amount: fmtMoney(data.movRemaining) });
      } else if (data.freeDeliveryThreshold != null && !data.freeDeliveryMet) {
        target = data.freeDeliveryThreshold;
        message = tmpl(copy('freeDeliveryRemaining'), { amount: fmtMoney(data.freeDeliveryRemaining) });
      } else if (data.freeDeliveryMet) {
        message = copy('freeDeliveryUnlocked');
      } else if (data.mov != null) {
        message = copy('minimumMet');
      }
      var pct = target ? Math.max(0, Math.min(100, Math.round(subtotal / target * 100))) : 100;
      if (barEl && fillEl) {
        fillEl.style.width = pct + '%';
        if (message) { barEl.removeAttribute('hidden'); barEl.setAttribute('aria-valuenow', String(pct)); }
        else { barEl.setAttribute('hidden', 'hidden'); }
      }
      if (msgEl) { msgEl.textContent = message; if (message) { msgEl.removeAttribute('hidden'); } else { msgEl.setAttribute('hidden', 'hidden'); } }

      // ---- delivery charge (display only) ------------------------------------
      var chargeEl = container.querySelector('[data-gdpr-charge]');
      if (chargeEl) {
        var chargeText = '';
        if (data.freeDeliveryMet) { chargeText = copy('freeDelivery'); }
        else if (data.deliveryCharge != null) {
          chargeText = (data.deliveryCharge === 0) ? copy('freeDelivery') : tmpl(copy('deliveryChargeFrom'), { amount: fmtMoney(data.deliveryCharge) });
        }
        if (chargeText) { chargeEl.textContent = chargeText; chargeEl.removeAttribute('hidden'); }
        else { chargeEl.setAttribute('hidden', 'hidden'); }
      }

      // ---- service options (standard + 4-hour; 4-hour hidden if cart ineligible)
      var svcEl = container.querySelector('[data-gdpr-services]');
      if (svcEl) {
        svcEl.textContent = '';
        var svc = dr.getServiceOptions(location, { fourHourEligibleCart: cartFourHourEligible(container) });
        var opts = (svc && svc.options) || [];
        for (var i = 0; i < opts.length; i++) { svcEl.appendChild(buildServiceLi(opts[i])); }
        if (opts.length) { svcEl.removeAttribute('hidden'); } else { svcEl.setAttribute('hidden', 'hidden'); }
      }

      container.removeAttribute('hidden');
    } catch (e) { hide(container); } // fully fail-open
  }

  function renderAll() {
    var els = containers();
    for (var i = 0; i < els.length; i++) { render(els[i]); }
  }

  // The cart re-renders (qty change / refreshCart) replace the panel markup; observe
  // the cart-form(s) and re-paint. Mirrors the cart-attributes summary approach.
  function observeCartForms() {
    if (!('MutationObserver' in window)) { return; }
    var forms = document.querySelectorAll('cart-form');
    if (!forms.length) { return; }
    var pending = false;
    var schedule = function () {
      if (pending) { return; }
      pending = true;
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
    window.addEventListener('ganguram:delivery-label-updated', renderAll);
  }

  // small public hook (handy for re-render / testing); not required for operation
  window.GanguramDeliveryProgress = { render: renderAll };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
