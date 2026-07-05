/*
 * Ganguram — Custom Sweets Box builder (Phase B1, READ-ONLY preview).
 * Backend-driven builder + live preview from window.GanguramCustomBoxConfig.
 * NO cart calls, NO delivery/checkout logic — Add-to-Cart is a disabled "Preview mode"
 * placeholder. Loaded only on products with custom_box.enabled (see the snippet).
 *
 * B1 polish: sequential row unlocking (Row N enabled only after Row N-1 is chosen;
 * clearing an earlier row resets/disables later rows). No layered overlays yet (B1.5).
 */
(function () {
  'use strict';

  var mount = document.querySelector('[data-gcb-mount]');
  var cfg = window.GanguramCustomBoxConfig;
  if (!mount) { return; }
  if (!cfg || !cfg.items || !cfg.items.length) { return; }

  try {
    build(cfg, mount);
  } catch (e) {
    mount.innerHTML = '<p class="gcb__notice">The custom box builder couldn’t load — please refresh the page.</p>';
    if (window.console && console.error) { console.error('[custom-box]', e); }
  }

  function build(cfg, mount) {
    // ---- helpers ----------------------------------------------------------
    function el(tag, cls) { var n = document.createElement(tag); if (cls) { n.className = cls; } return n; }
    function bySort(a, b) { return (a.sort || 0) - (b.sort || 0); }

    var money = (function () {
      var fmt = null;
      try { fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: cfg.currency || 'INR' }); } catch (e) {}
      return function (cents) {
        if (cents == null) { return '—'; }
        var amount = cents / 100;
        if (fmt) { try { return fmt.format(amount); } catch (e) {} }
        return '₹' + amount.toFixed(2);
      };
    })();

    function tagScope(item) {
      var t = item.tags || {};
      if (t.panIndia) { return 'pan_india'; }
      if (t.kolkata) { return 'kolkata_only'; }
      if (t.localDelivery) { return 'local_only'; }
      if (t.quickCommerce) { return 'quick_commerce_only'; }
      return '';
    }
    function itemLabel(item) {
      switch (tagScope(item)) {
        case 'pan_india': return { text: 'PAN India eligible', cls: 'is-pan' };
        case 'kolkata_only': return { text: 'Kolkata / serviceable-pincode only', cls: 'is-kol' };
        case 'local_only': return { text: 'Local delivery only', cls: 'is-local' };
        case 'quick_commerce_only': return { text: 'Quick Commerce / local', cls: 'is-qc' };
        default: return { text: 'Check delivery for your area', cls: 'is-unknown' };
      }
    }
    function scopeMismatch(item) {
      var declared = (item.deliveryScope || '').trim();
      if (!declared) { return false; }
      var derived = tagScope(item);
      return derived && declared !== derived;
    }
    function boxEligibility(items) {
      var anyLocal = false, allPan = true, has = false;
      items.forEach(function (it) {
        if (!it) { return; }
        has = true;
        var s = tagScope(it);
        if (s !== 'pan_india') { allPan = false; }
        if (s === 'kolkata_only' || s === 'local_only' || s === 'quick_commerce_only') { anyLocal = true; }
      });
      if (!has) { return null; }
      if (anyLocal) { return { text: 'This box: Kolkata / serviceable-pincode only', cls: 'is-kol' }; }
      if (allPan) { return { text: 'This box: PAN India eligible', cls: 'is-pan' }; }
      return { text: 'This box: check delivery for your area', cls: 'is-unknown' };
    }

    // ---- data -------------------------------------------------------------
    var items = cfg.items.slice().sort(bySort);
    var itemById = {}; items.forEach(function (it) { itemById[it.id] = it; });
    var boxTypes = (cfg.boxTypes || []).slice().sort(bySort);
    var rowCounts = (cfg.rowCounts && cfg.rowCounts.length) ? cfg.rowCounts.slice() : [cfg.defaultRows || 2];
    rowCounts = rowCounts.map(Number).filter(function (n) { return n > 0; });
    if (!rowCounts.length) { rowCounts = [2]; }

    // ---- state ------------------------------------------------------------
    var state = {
      boxTypeId: boxTypes.length ? boxTypes[0].id : null,
      rowCount: (rowCounts.indexOf(Number(cfg.defaultRows)) !== -1 ? Number(cfg.defaultRows) : rowCounts[0]),
      rows: []
    };
    function resizeRows() { while (state.rows.length < state.rowCount) { state.rows.push(null); } state.rows.length = state.rowCount; }
    resizeRows();

    // ---- scaffold ---------------------------------------------------------
    mount.innerHTML = '';
    var grid = el('div', 'gcb__grid');
    var config = el('div', 'gcb__panel gcb__config');

    // box type selector (only if more than one)
    if (boxTypes.length > 1) {
      var btWrap = el('div', 'gcb__field');
      var btLabel = el('span', 'gcb__field-label'); btLabel.textContent = 'Box type'; btWrap.appendChild(btLabel);
      var btRow = el('div', 'gcb__chips');
      boxTypes.forEach(function (bt) {
        var b = el('button', 'gcb__chip'); b.type = 'button'; b.textContent = bt.name;
        var on = bt.id === state.boxTypeId;
        if (on) { b.classList.add('is-selected'); }
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.addEventListener('click', function () {
          state.boxTypeId = bt.id;
          Array.prototype.forEach.call(btRow.children, function (c, i) {
            var sel = boxTypes[i] && boxTypes[i].id === bt.id;
            c.classList.toggle('is-selected', sel); c.setAttribute('aria-pressed', sel ? 'true' : 'false');
          });
          renderPreview();
        });
        btRow.appendChild(b);
      });
      btWrap.appendChild(btRow); config.appendChild(btWrap);
    }

    // row-count selector
    var rcWrap = el('div', 'gcb__field');
    var rcLabel = el('span', 'gcb__field-label'); rcLabel.textContent = 'Number of rows'; rcWrap.appendChild(rcLabel);
    var rcRow = el('div', 'gcb__chips');
    rowCounts.forEach(function (n) {
      var b = el('button', 'gcb__chip'); b.type = 'button'; b.textContent = String(n);
      var on = n === state.rowCount;
      if (on) { b.classList.add('is-selected'); }
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function () {
        state.rowCount = n; resizeRows(); renderRows(); renderPreview();
        Array.prototype.forEach.call(rcRow.children, function (c) {
          var sel = c.textContent === String(n);
          c.classList.toggle('is-selected', sel); c.setAttribute('aria-pressed', sel ? 'true' : 'false');
        });
      });
      rcRow.appendChild(b);
    });
    rcWrap.appendChild(rcRow); config.appendChild(rcWrap);

    // rows
    var rowsWrap = el('div', 'gcb__rows'); config.appendChild(rowsWrap);

    function optionLabel(it) {
      var bits = [it.title];
      if (it.pieces) { bits.push(it.pieces + ' pcs'); }
      if (it.price != null) { bits.push(money(it.price)); }
      if (!it.available) { bits.push('— unavailable'); }
      return bits.join(' · ');
    }

    // SEQUENTIAL UNLOCKING: row idx is enabled only when the previous row is chosen.
    function rowEnabled(idx) { return idx === 0 || state.rows[idx - 1] != null; }

    function renderRows() {
      rowsWrap.innerHTML = '';
      for (var i = 0; i < state.rowCount; i++) {
        (function (idx) {
          var enabled = rowEnabled(idx);
          var row = el('div', 'gcb__row' + (enabled ? '' : ' is-locked'));
          var selId = 'gcb-row-' + idx;
          var lab = el('label', 'gcb__row-label'); lab.textContent = 'Row ' + (idx + 1); lab.setAttribute('for', selId);
          var sel = el('select', 'gcb__select'); sel.id = selId; sel.disabled = !enabled;
          if (!enabled) { sel.setAttribute('aria-disabled', 'true'); }
          var ph = el('option'); ph.value = '';
          ph.textContent = enabled ? 'Choose an item…' : 'Select Row ' + idx + ' first';
          sel.appendChild(ph);
          items.forEach(function (it) {
            var o = el('option'); o.value = String(it.id); o.textContent = optionLabel(it);
            if (!it.available) { o.disabled = true; }
            if (state.rows[idx] === it.id) { o.selected = true; }
            sel.appendChild(o);
          });
          sel.addEventListener('change', function () {
            var val = sel.value === '' ? null : Number(sel.value);
            state.rows[idx] = val;
            // clearing / emptying an earlier row resets every later row
            if (val == null) { for (var k = idx + 1; k < state.rowCount; k++) { state.rows[k] = null; } }
            renderRows();   // refresh enabled/disabled states + later-row values
            renderPreview();
          });
          row.appendChild(lab); row.appendChild(sel);
          rowsWrap.appendChild(row);
        })(i);
      }
    }

    // preview
    var preview = el('div', 'gcb__panel gcb__preview'); preview.setAttribute('data-gcb-preview', '');
    grid.appendChild(config); grid.appendChild(preview);
    mount.appendChild(grid);

    function renderPreview() {
      preview.innerHTML = '';
      var bt = boxTypes.filter(function (b) { return b.id === state.boxTypeId; })[0];

      if (bt && bt.image) {
        var fig = el('div', 'gcb__preview-image');
        var img = el('img'); img.src = bt.image; img.alt = bt.name || 'Box'; img.loading = 'lazy'; img.width = 640; img.height = 640;
        fig.appendChild(img); preview.appendChild(fig);
      }

      var head = el('div', 'gcb__preview-head');
      head.textContent = (bt ? bt.name : 'Custom Box') + ' · ' + state.rowCount + ' rows';
      preview.appendChild(head);

      var list = el('ul', 'gcb__summary');
      var chosen = [], subtotal = 0;
      for (var i = 0; i < state.rowCount; i++) {
        var it = state.rows[i] != null ? itemById[state.rows[i]] : null;
        chosen.push(it);
        var li = el('li', 'gcb__summary-row');
        if (!it) {
          li.classList.add('is-empty');
          li.textContent = 'Row ' + (i + 1) + ' — ' + (rowEnabled(i) ? 'not chosen yet' : 'locked');
        } else {
          if (it.image) { var th = el('img', 'gcb__summary-thumb'); th.src = it.image; th.alt = it.title; th.loading = 'lazy'; th.width = 48; th.height = 48; li.appendChild(th); }
          var body = el('div', 'gcb__summary-body');
          var name = el('span', 'gcb__summary-name'); name.textContent = 'Row ' + (i + 1) + ': ' + it.title; body.appendChild(name);
          var meta = el('span', 'gcb__summary-meta'); meta.textContent = (it.pieces ? it.pieces + ' pcs · ' : '') + money(it.price); body.appendChild(meta);
          var lab = itemLabel(it); var tag = el('span', 'gcb__pill ' + lab.cls); tag.textContent = lab.text; body.appendChild(tag);
          if (scopeMismatch(it)) { var w = el('span', 'gcb__pill is-warn'); w.textContent = '⚠ delivery_scope ≠ product tags'; body.appendChild(w); }
          li.appendChild(body);
          if (it.price != null) { subtotal += it.price; }
        }
        list.appendChild(li);
      }
      preview.appendChild(list);

      var elig = boxEligibility(chosen);
      if (elig) { var e = el('div', 'gcb__box-elig gcb__pill ' + elig.cls); e.textContent = elig.text; preview.appendChild(e); }

      var totals = el('div', 'gcb__totals');
      var tl = el('span', 'gcb__totals-label'); tl.textContent = 'Box subtotal';
      var tv = el('span', 'gcb__totals-value'); tv.textContent = money(subtotal);
      totals.appendChild(tl); totals.appendChild(tv); preview.appendChild(totals);
      var note = el('p', 'gcb__totals-note'); note.textContent = 'before discounts, tax & shipping'; preview.appendChild(note);

      var atc = el('button', 'gcb__add button button--solid button--fullwidth');
      atc.type = 'button'; atc.disabled = true; atc.setAttribute('aria-disabled', 'true');
      atc.textContent = 'Preview mode — Add to Cart coming soon';
      preview.appendChild(atc);
    }

    renderRows();
    renderPreview();
  }
})();
