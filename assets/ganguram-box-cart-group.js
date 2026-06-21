/*
 * Ganguram — Custom Sweets Box: cart grouping (Phase 2.12A)
 * ---------------------------------------------------------------------------
 * Box lines are normal cart lines that share a `_ganguram_box_id` line property
 * (stamped onto the cart-line DOM as data-ganguram-box-id). This module brackets the
 * consecutive lines of each box with a GROUP HEADER ("Custom Sweets Box · 4 Columns"),
 * a per-line "Slot N" badge, and a FOOTER (box total + "Remove box"), so the box reads
 * as one card. "Remove box" sets every line in the group to 0 via /cart/update.js.
 *
 * Display + a safe grouped-remove only. It never changes prices (Shopify owns them — the
 * total is summed from the rendered final_line_price), the pincode resolver, MOV, ShipZip,
 * the date picker, or the eligibility rules. Re-runs on cart re-render; fail-open.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramBoxCartGroupInit) { return; }
  window.__ganguramBoxCartGroupInit = true;

  var LINE = '[data-ganguram-cart-line]';
  var busy = false;

  function cfg() { return window.GanguramBoxCartGroupConfig || {}; }
  function updateUrl() {
    return cfg().updateUrl || (window.KROWN && KROWN.settings && KROWN.settings.routes && KROWN.settings.routes.cart_update_url) || '/cart/update.js';
  }
  function symbol() { return cfg().currencySymbol || '₹'; }
  function money(paise) { var n = parseInt(paise, 10) || 0, r = n / 100; return symbol() + ((Math.round(r) === r) ? r : r.toFixed(2)); }
  function copy(k) {
    var c = cfg().copy || {}, d = { columns: '__N__ Columns', boxTotal: 'Box total:', removeBox: 'Remove box', slot: 'Slot __N__' };
    return (c[k] != null) ? String(c[k]) : d[k];
  }
  function tmpl(s, v) { s = String(s == null ? '' : s); v = v || {}; return s.replace(/__([A-Z0-9]+)__/g, function (_, k) { var kk = k.toLowerCase(); return (v[kk] != null) ? v[kk] : ''; }); }
  function el(t, c) { var e = document.createElement(t); if (c) { e.className = c; } return e; }

  function boxLines() { return Array.prototype.slice.call(document.querySelectorAll(LINE + '[data-ganguram-box-id]')); }
  function groupId(line) { return line.getAttribute('data-ganguram-box-id') || ''; }

  function clearDecor() {
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-ganguram-box-group-header], [data-ganguram-box-group-footer], [data-ganguram-box-slot-badge]'),
      function (n) { if (n.parentNode) { n.parentNode.removeChild(n); } }
    );
  }

  function enhance() {
    clearDecor();
    var lines = boxLines();
    if (!lines.length) { return; }
    var i = 0;
    while (i < lines.length) {
      var id = groupId(lines[i]); if (!id) { i++; continue; }
      var group = [lines[i]], j = i + 1;
      while (j < lines.length && groupId(lines[j]) === id && lines[j].parentNode === lines[i].parentNode) { group.push(lines[j]); j++; }
      try { decorate(group); } catch (e) {}
      i = j;
    }
  }

  function decorate(group) {
    var first = group[0], last = group[group.length - 1], parent = first.parentNode;
    if (!parent) { return; }
    var name = first.getAttribute('data-ganguram-box-name') || 'Custom Sweets Box';
    var cols = first.getAttribute('data-ganguram-box-columns') || String(group.length);
    var total = 0, keys = [];
    group.forEach(function (l) {
      total += parseInt(l.getAttribute('data-ganguram-line-price'), 10) || 0;
      var k = l.getAttribute('data-ganguram-line-key'); if (k) { keys.push(k); }
      l.classList.add('ganguram-box-group__line');
      var slot = l.getAttribute('data-ganguram-box-slot');
      if (slot) {
        var badge = el('span', 'ganguram-box-group__slot'); badge.setAttribute('data-ganguram-box-slot-badge', '');
        badge.textContent = tmpl(copy('slot'), { n: slot });
        if (l.firstChild) { l.insertBefore(badge, l.firstChild); } else { l.appendChild(badge); }
      }
    });
    var header = el('div', 'ganguram-box-group__header'); header.setAttribute('data-ganguram-box-group-header', '');
    var hName = el('span', 'ganguram-box-group__name'); hName.textContent = name;
    var hCols = el('span', 'ganguram-box-group__cols'); hCols.textContent = tmpl(copy('columns'), { n: cols });
    header.appendChild(hName); header.appendChild(hCols);
    parent.insertBefore(header, first);

    var footer = el('div', 'ganguram-box-group__footer'); footer.setAttribute('data-ganguram-box-group-footer', '');
    var tot = el('span', 'ganguram-box-group__total'); tot.textContent = copy('boxTotal') + ' ' + money(total);
    var rm = el('button', 'ganguram-box-group__remove'); rm.type = 'button'; rm.textContent = copy('removeBox');
    rm.setAttribute('aria-label', copy('removeBox') + ' — ' + name);
    rm.addEventListener('click', function () { removeBox(keys); });
    footer.appendChild(tot); footer.appendChild(rm);
    if (last.nextSibling) { parent.insertBefore(footer, last.nextSibling); } else { parent.appendChild(footer); }
  }

  function removeBox(keys) {
    if (busy || !keys.length) { return; }
    busy = true;
    var updates = {}; keys.forEach(function (k) { updates[k] = 0; });
    fetch(updateUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ updates: updates }) })
      .then(function (r) { return r.json(); })
      .then(function () { if (typeof window.refreshCart === 'function') { try { window.refreshCart(false); } catch (e) {} } })
      .catch(function () {})
      .finally(function () { busy = false; });
  }

  // Observe cart re-renders. Disconnect while WE mutate the DOM so our own header/footer
  // insertions never re-trigger the observer (no loop), then reconnect.
  var observer = null, forms = [], queued = false;
  function reconnect() { if (!observer) { return; } for (var i = 0; i < forms.length; i++) { try { observer.observe(forms[i], { childList: true, subtree: true }); } catch (e) {} } }
  function schedule() {
    if (queued) { return; }
    queued = true;
    var run = function () { queued = false; if (observer) { observer.disconnect(); } enhance(); reconnect(); };
    if (window.requestAnimationFrame) { window.requestAnimationFrame(run); } else { setTimeout(run, 0); }
  }
  function observe() {
    if (!('MutationObserver' in window)) { return; }
    forms = Array.prototype.slice.call(document.querySelectorAll('cart-form'));
    if (!forms.length) { return; }
    observer = new MutationObserver(schedule);
    reconnect();
  }

  function init() {
    enhance();
    observe();
    window.addEventListener('ganguram:box-added', function () { if (typeof window.refreshCart === 'function') { try { window.refreshCart(true); } catch (e) {} } });
  }

  window.GanguramBoxCartGroup = { enhance: enhance, removeBox: removeBox, init: init };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
