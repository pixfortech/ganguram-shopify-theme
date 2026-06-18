/*
 * Ganguram — Admin-controlled "4 Hours Delivery" display logic (Phase 2.7)
 * ---------------------------------------------------------------------------
 * Storefront DISPLAY / ELIGIBILITY only. Controls whether the 4 Hours Delivery
 * menu link / homepage tile / collection are presented, based on:
 *   - an ADMIN enable flag,
 *   - an ADMIN time window (active days + start/end + timezone),
 *   - the selected delivery zone (PAN India never sees it).
 *
 * It does NOT change checkout, shipping rates, MOV, date/slot, cart, payment, or
 * the product-zone filter. The 4-hour collection's "only Quick Commerce products"
 * rule and the PAN-India menu-link hiding are already handled by the existing
 * product-zone filter + zone-visibility engine; this module ADDS the
 * admin-enable + time-window + customer-guidance layer on top, reversibly.
 *
 * Config comes from window.Ganguram4HourConfig (set by
 * snippets/ganguram-4hour-delivery-config.liquid from theme settings — nothing is
 * hard-coded here). Uses window.GanguramZone + 'ganguram:delivery-location-changed'.
 * Fail-safe: with no config, it does nothing. No jQuery/Bootstrap/FontAwesome,
 * no localStorage writes, no redirects, no ShipZip/SBZ/zipLogic.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguram4HourInit) { return; }
  window.__ganguram4HourInit = true;

  var EVENT = 'ganguram:delivery-location-changed';
  var HIDDEN = 'ganguram-4h-hidden';
  var DISABLED = 'ganguram-4h-disabled';
  var NOTE = 'ganguram-4h-note';
  var BANNER_ATTR = 'data-ganguram-4h-banner';
  // Menu links + homepage category tiles (same surfaces the zone-visibility engine uses).
  var LINK_SEL = 'a.menu-link[href*="/collections/"], .js-slider-item a[href*="/collections/"]';

  function cfg() { return window.Ganguram4HourConfig || null; }
  function handle() { var c = cfg(); return ((c && c.handle) ? String(c.handle) : '4-hour-delivery').toLowerCase(); }
  function enabled() { var c = cfg(); return !!(c && c.enabled); }
  function behaviour() { var c = cfg(); return (c && c.inactiveBehaviour === 'hide') ? 'hide' : 'disable'; }
  function title() { var c = cfg(); return (c && c.title) ? String(c.title) : ''; }
  function msg(key) { var c = cfg(); return (c && c.messages && c.messages[key]) ? String(c.messages[key]) : ''; }
  function normalUrl() { var c = cfg(); return (c && c.normalDeliveryUrl) ? String(c.normalDeliveryUrl) : '/collections/all'; }

  // ---- time window (read entirely from admin config; nothing hard-coded) -----
  function parseDays(raw) {
    if (!raw) { return null; } // null => every day
    var out = [];
    String(raw).split(',').forEach(function (d) {
      var k = d.trim().toLowerCase().slice(0, 3);
      if (k) { out.push(k); }
    });
    return out.length ? out : null;
  }
  function parseHM(s) {
    var m = String(s == null ? '' : s).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) { return null; }
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (h < 0 || h > 24 || mi < 0 || mi > 59) { return null; }
    return h * 60 + mi;
  }
  // Current {day:'mon'..'sun', minutes} in the configured timezone (fallback: local).
  function nowInTz(tz) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz || 'Asia/Kolkata', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
      }).formatToParts(new Date());
      var day = '', h = 0, mi = 0;
      parts.forEach(function (p) {
        if (p.type === 'weekday') { day = p.value.toLowerCase().slice(0, 3); }
        else if (p.type === 'hour') { h = parseInt(p.value, 10) % 24; }
        else if (p.type === 'minute') { mi = parseInt(p.value, 10); }
      });
      return { day: day, minutes: h * 60 + mi };
    } catch (e) {
      var d = new Date();
      var names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      return { day: names[d.getDay()], minutes: d.getHours() * 60 + d.getMinutes() };
    }
  }
  // true when "now" is inside the admin window. Misconfigured times fail OPEN
  // (treated as within) so a typo never silently hides the service.
  function withinWindow() {
    var c = cfg(); if (!c) { return false; }
    var days = parseDays(c.days);
    var start = parseHM(c.start), end = parseHM(c.end);
    var now = nowInTz(c.timezone);
    if (days && days.indexOf(now.day) === -1) { return false; }
    if (start == null || end == null) { return true; }   // misconfig -> don't hide
    if (start === end) { return true; }                  // equal -> treat as all-day
    if (start < end) { return now.minutes >= start && now.minutes < end; }
    return now.minutes >= start || now.minutes < end;    // overnight window
  }

  // ---- zone -----------------------------------------------------------------
  function activeZone() {
    var z = window.GanguramZone; if (!z || typeof z.getSelectedDeliveryLocation !== 'function') { return null; }
    var loc = z.getSelectedDeliveryLocation();
    if (!loc || !loc.pincode || loc.isServiceable !== true) { return null; }
    return loc.zone;
  }

  // status of the 4-hour service for the current context:
  //   'ok' | 'disabled' (admin off) | 'pan' (PAN India) | 'inactive' (outside window)
  function status() {
    if (!enabled()) { return 'disabled'; }
    if (activeZone() === 'pan_india') { return 'pan'; }
    if (!withinWindow()) { return 'inactive'; }
    return 'ok';
  }

  // ---- menu links / tiles ---------------------------------------------------
  function handleOf(href) { var m = (href || '').match(/\/collections\/([^\/?#]+)/); return m ? m[1].toLowerCase() : null; }
  function is4hLink(a) { return handleOf(a.getAttribute('href') || '') === handle(); }
  function labelEl(a) { return a.querySelector('span span') || a.querySelector('span') || a; }

  function setLabel(a, text) { var el = labelEl(a); if (el) { el.textContent = text; } }
  function applyTitle(a) {
    if (a.className.indexOf('menu-link') === -1) { return; } // title override only for menu links, not image tiles
    var t = title(); if (!t) { return; }
    var el = labelEl(a); if (!el) { return; }
    if (el.textContent.trim() === t) { return; }
    if (a.__g4hOrigTitle == null) { a.__g4hOrigTitle = el.textContent; }
    el.textContent = t;
  }
  function resetLink(a) {
    var box = a.closest('li, .js-slider-item') || a;
    box.classList.remove(HIDDEN);
    a.classList.remove(DISABLED);
    a.removeAttribute('aria-disabled');
    a.removeAttribute('title');
    var note = a.querySelector('.' + NOTE);
    if (note && note.parentNode) { note.parentNode.removeChild(note); }
    if (a.__g4hOrigTitle != null) { setLabel(a, a.__g4hOrigTitle); a.__g4hOrigTitle = null; }
    if (a.__g4hClick) { a.removeEventListener('click', a.__g4hClick); a.__g4hClick = null; }
  }
  function hideLink(a) { (a.closest('li, .js-slider-item') || a).classList.add(HIDDEN); }
  function disableLink(a, message) {
    a.classList.add(DISABLED);
    a.setAttribute('aria-disabled', 'true');
    if (message) {
      a.setAttribute('title', message);
      var note = document.createElement('span');
      note.className = NOTE;
      note.textContent = message;
      a.appendChild(note);
    }
    a.__g4hClick = function (e) { e.preventDefault(); e.stopPropagation(); };
    a.addEventListener('click', a.__g4hClick);
  }

  function applyLinks(st) {
    var links = document.querySelectorAll(LINK_SEL);
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (!is4hLink(a)) { continue; }
      resetLink(a);
      if (st === 'ok') { applyTitle(a); continue; }
      if (st === 'disabled' || st === 'pan') { hideLink(a); continue; } // off / PAN -> hide entirely
      // inactive (outside the admin window):
      if (behaviour() === 'hide') { hideLink(a); }
      else { applyTitle(a); disableLink(a, msg('inactive')); }
    }
  }

  // ---- 4-hour collection page banner / guidance -----------------------------
  function onCollectionPage() {
    var m = location.pathname.match(/\/collections\/([^\/?#]+)/);
    return !!m && m[1].toLowerCase() === handle();
  }
  function gridAnchor() {
    var grids = document.querySelectorAll('[data-ganguram-collection]');
    for (var i = 0; i < grids.length; i++) {
      if ((grids[i].getAttribute('data-ganguram-collection') || '').toLowerCase() === handle()) { return grids[i]; }
    }
    return document.getElementById('main-collection-product-grid');
  }
  function removeBanner() {
    var b = document.querySelector('[' + BANNER_ATTR + ']');
    if (b && b.parentNode) { b.parentNode.removeChild(b); }
  }
  function applyBanner(st) {
    if (!onCollectionPage()) { removeBanner(); return; }
    var text, kind, guide = false;
    if (st === 'ok') { text = msg('quickOnly'); kind = 'info'; }          // info: only QC items show here
    else if (st === 'pan') { text = msg('panIndia'); kind = 'warn'; guide = true; }
    else { text = msg('inactive'); kind = 'warn'; guide = true; }          // disabled / inactive
    if (!text) { removeBanner(); return; }

    var anchor = gridAnchor();
    var banner = document.querySelector('[' + BANNER_ATTR + ']');
    if (!banner) {
      banner = document.createElement('div');
      banner.setAttribute(BANNER_ATTR, '');
      if (anchor && anchor.parentNode) { anchor.parentNode.insertBefore(banner, anchor); }
      else { (document.querySelector('main') || document.body).insertBefore(banner, (document.querySelector('main') || document.body).firstChild); }
    }
    banner.className = 'ganguram-4h-banner ganguram-4h-banner--' + kind;
    banner.textContent = '';
    var p = document.createElement('p');
    p.className = 'ganguram-4h-banner__text';
    p.textContent = text;
    banner.appendChild(p);
    if (guide) {
      var a = document.createElement('a');
      a.className = 'ganguram-4h-banner__link';
      a.href = normalUrl();
      a.textContent = (cfg() && cfg().normalDeliveryLabel) ? String(cfg().normalDeliveryLabel) : 'Continue with normal delivery';
      banner.appendChild(a);
    }
  }

  // ---- orchestrate ----------------------------------------------------------
  function apply() {
    if (!cfg()) { return; } // fail-safe: no admin config -> do nothing
    var st = status();
    applyLinks(st);
    applyBanner(st);
  }
  function debounce(fn, wait) {
    var t;
    return function () { clearTimeout(t); var a = arguments, c = this; t = setTimeout(function () { fn.apply(c, a); }, wait); };
  }
  var applyDebounced = debounce(apply, 120);

  function init() {
    apply();
    window.addEventListener(EVENT, apply);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { apply(); } });
    // Re-evaluate the time window periodically so the link flips at open/close.
    setInterval(apply, 60000);
    // Re-apply when the menu DOM is (re)built — e.g. the cloned mobile drawer.
    if ('MutationObserver' in window && document.body) {
      var obs = new MutationObserver(function (mutations) {
        var relevant = mutations.some(function (m) {
          return Array.prototype.some.call(m.addedNodes, function (n) {
            return n.nodeType === 1 && ((n.matches && n.matches(LINK_SEL)) || (n.querySelector && n.querySelector(LINK_SEL)));
          });
        });
        if (relevant) { applyDebounced(); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
