/*
 * Ganguram — Empty collection warning + redirect after pincode filtering (Phase 2.7C)
 * ---------------------------------------------------------------------------
 * On a COLLECTION page, when a valid serviceable pincode is selected and the
 * product-zone filter has hidden EVERY product in the collection grid, show a
 * prominent, premium warning and redirect to the homepage after an
 * admin-configurable countdown. If products become visible again (pincode change
 * back, facet change), the warning is removed and the countdown cancelled.
 *
 * It REUSES the existing filter output (cards toggled with .ganguram-zone-hidden
 * by ganguram-product-zone-filter.js) and the existing pincode state
 * (GanguramZone + 'ganguram:delivery-location-changed'). It does NOT re-implement
 * the eligibility matrix or pincode classification.
 *
 * Only on collection pages (body.template-collection). Never on search / cart /
 * product / home. Never while the pincode is empty / invalid / unserviceable, and
 * never for a NATURALLY empty collection (zero product cards before filtering).
 *
 * No checkout/MOV/shipping/ShipZip/SBZ/zipLogic. No pincode lists. No Google API.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramEmptyCollectionInit) { return; }
  window.__ganguramEmptyCollectionInit = true;

  var EVENT = 'ganguram:delivery-location-changed';
  var CARD = '[data-ganguram-product-card]';          // same marker the filter uses
  var HIDDEN = 'ganguram-zone-hidden';                // same class the filter toggles
  var GRID_ID = 'main-collection-product-grid';       // the collection template's grid
  var ACTIVE_BODY = 'ganguram-empty-collection-active';

  var warningEl = null;
  var timer = null;
  var remaining = 0;
  var paused = false;       // set when the customer clicks "Change Pincode"
  var redirecting = false;

  function cfg() { return window.GanguramEmptyCollectionConfig || {}; }
  function enabled() { var c = cfg(); return c.enabled !== false; } // default on
  function seconds() { var n = parseInt(cfg().seconds, 10); return (n && n > 0) ? n : 6; }
  function target() { return cfg().target || '/'; }
  function titleText() { return cfg().title || 'No products available for this pincode'; }
  function bodyText() { return cfg().body || 'No products in this collection are available for the selected pincode.'; }
  function redirectTextFor(n) {
    var t = cfg().redirectText || 'Redirecting to homepage in {seconds} seconds.';
    return t.replace('{seconds}', String(n));
  }

  function isCollectionPage() {
    return !!(document.body && document.body.classList.contains('template-collection'));
  }
  function activeZone() {
    var z = window.GanguramZone;
    if (!z || typeof z.getSelectedDeliveryLocation !== 'function') { return null; }
    var loc = z.getSelectedDeliveryLocation();
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }
    return loc;
  }
  function grid() { return document.getElementById(GRID_ID); }
  function counts(g) {
    var cards = g.querySelectorAll(CARD);
    var visible = 0;
    for (var i = 0; i < cards.length; i++) { if (!cards[i].classList.contains(HIDDEN)) { visible++; } }
    return { total: cards.length, visible: visible };
  }

  function openPincode() {
    if (window.GanguramDelivery && typeof window.GanguramDelivery.openDeliveryLocationPopup === 'function') {
      window.GanguramDelivery.openDeliveryLocationPopup('Enter a delivery pincode to continue.');
      return;
    }
    var t = document.querySelector('[data-gdw-trigger]');
    if (t) { t.click(); }
  }

  function cancelCountdown() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  function cleanup() {
    cancelCountdown();
    paused = false;
    if (warningEl && warningEl.parentNode) { warningEl.parentNode.removeChild(warningEl); }
    warningEl = null;
    if (document.body) { document.body.classList.remove(ACTIVE_BODY); }
  }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) { e.className = cls; } return e; }
  function buildWarning() {
    var box = el('div', 'ganguram-ecw');
    box.setAttribute('data-ganguram-empty-collection', '');
    box.setAttribute('role', 'alert');
    var inner = el('div', 'ganguram-ecw__inner');

    var h = el('p', 'ganguram-ecw__title');
    h.textContent = titleText();
    var b = el('p', 'ganguram-ecw__body');
    b.textContent = bodyText();
    var count = el('p', 'ganguram-ecw__countdown');
    var progress = el('div', 'ganguram-ecw__progress');
    var bar = el('div', 'ganguram-ecw__progress-bar');
    progress.appendChild(bar);

    var actions = el('div', 'ganguram-ecw__actions');
    var change = el('button', 'ganguram-ecw__btn');
    change.type = 'button';
    change.textContent = 'Change Pincode';
    change.addEventListener('click', function () { onChangePincode(); });
    var home = el('a', 'ganguram-ecw__btn ganguram-ecw__btn--primary');
    home.href = target();
    home.textContent = 'Go to Home Now';
    home.addEventListener('click', function () { redirecting = true; }); // let the link navigate
    actions.appendChild(change);
    actions.appendChild(home);

    inner.appendChild(h);
    inner.appendChild(b);
    inner.appendChild(count);
    inner.appendChild(progress);
    inner.appendChild(actions);
    box.appendChild(inner);

    box._count = count; box._bar = bar;
    return box;
  }

  function ensureWarning() {
    var g = grid();
    if (!g) { return null; }
    if (warningEl && document.body.contains(warningEl)) { return warningEl; }
    warningEl = buildWarning();
    // Insert before the grid so a facet AJAX re-render of the grid never wipes it.
    if (g.parentNode) { g.parentNode.insertBefore(warningEl, g); }
    document.body.classList.add(ACTIVE_BODY);
    return warningEl;
  }

  function renderCountdown() {
    if (!warningEl) { return; }
    warningEl._count.textContent = redirectTextFor(remaining);
    var pct = Math.max(0, Math.min(100, (remaining / seconds()) * 100));
    warningEl._bar.style.width = pct + '%';
  }
  function startCountdown() {
    cancelCountdown();
    remaining = seconds();
    renderCountdown();
    timer = setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        cancelCountdown();
        renderCountdown();
        redirecting = true;
        try { window.location.assign(target()); } catch (e) { window.location.href = target(); }
        return;
      }
      renderCountdown();
    }, 1000);
  }

  function showWarning() {
    var first = !warningEl || !document.body.contains(warningEl);
    ensureWarning();
    if (!warningEl) { return; }
    if (first && !paused) { startCountdown(); }
    else if (paused) { warningEl._count.textContent = ''; warningEl._bar.style.width = '0%'; }
  }

  function onChangePincode() {
    paused = true;
    cancelCountdown();
    if (warningEl) { warningEl._count.textContent = ''; warningEl._bar.style.width = '0%'; }
    openPincode();
  }

  // ---- evaluate -------------------------------------------------------------
  function evaluate() {
    if (redirecting) { return; }
    if (!enabled() || !isCollectionPage()) { cleanup(); return; }
    var g = grid();
    if (!g) { cleanup(); return; }
    if (!activeZone()) { cleanup(); return; }          // no / invalid / unserviceable pincode
    var c = counts(g);
    if (c.total === 0) { cleanup(); return; }           // naturally empty collection -> no redirect
    if (c.visible === 0) { showWarning(); }             // all filtered out -> warn + countdown
    else { cleanup(); }                                 // products visible -> cancel
  }

  function debounce(fn, wait) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, wait); };
  }
  // Settle slightly LONGER than the product filter (≈120ms) so it has toggled
  // .ganguram-zone-hidden before we count.
  var evaluateSoon = debounce(evaluate, 200);

  function init() {
    if (!isCollectionPage()) { return; }
    // A pincode change starts a fresh cycle (re-enable the countdown).
    window.addEventListener(EVENT, function () { paused = false; evaluateSoon(); });
    var g = grid();
    if (g && 'MutationObserver' in window) {
      var obs = new MutationObserver(evaluateSoon);
      obs.observe(g, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    // Initial check (covers an already-selected pincode on load).
    evaluateSoon();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
