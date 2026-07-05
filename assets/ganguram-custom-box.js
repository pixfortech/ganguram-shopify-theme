/*
 * Ganguram — Custom Sweets Box builder (Phase B1, READ-ONLY preview).
 *
 * Backend-driven builder + live preview. Config is read from an INERT JSON island
 * (<script type="application/json" id="ganguram-custom-box-config">) via JSON.parse —
 * there is NO window global and nothing is ever printed to the page as text.
 *
 * NO cart calls, NO delivery/checkout logic and NO customer-facing delivery badges.
 * Add-to-Cart is a disabled "Preview mode" placeholder. Loaded only on products with
 * custom_box.enabled (see snippets/ganguram-custom-box-builder.liquid).
 *
 * B1 polish: sequential row unlocking (Row N unlocks only after Row N-1 is chosen;
 * clearing an earlier row resets later rows). Locked rows render as a clean card,
 * NOT a disabled <select>. No layered overlays yet (B1.5).
 */
(function () {
  'use strict';

  var mount = document.querySelector('[data-gcb-mount]');
  if (!mount) { return; }

  var cfg = readConfig();
  if (!cfg || !cfg.items || !cfg.items.length) { return; }

  try {
    build(cfg, mount);
  } catch (e) {
    mount.innerHTML = '<p class="gcb__notice">The custom box builder couldn’t load — please refresh the page.</p>';
    if (window.console && console.error) { console.error('[custom-box]', e); }
  }

  // Parse the inert JSON data island. Never touches the DOM as visible text.
  function readConfig() {
    var node = document.getElementById('ganguram-custom-box-config');
    if (!node) { return null; }
    try {
      return JSON.parse(node.textContent);
    } catch (e) {
      if (window.console && console.error) { console.error('[custom-box] bad config', e); }
      return null;
    }
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

    // row-count selector — large tappable buttons
    var rcWrap = el('div', 'gcb__field');
    var rcLabel = el('span', 'gcb__field-label'); rcLabel.textContent = 'Number of rows'; rcWrap.appendChild(rcLabel);
    var rcRow = el('div', 'gcb__chips gcb__chips--count');
    rowCounts.forEach(function (n) {
      var b = el('button', 'gcb__chip gcb__chip--count'); b.type = 'button'; b.textContent = String(n);
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
          if (!enabled) {
            // LOCKED ROW: a clean card, never a disabled <select> (no tiled chevrons).
            var locked = el('div', 'gcb__row gcb__row--locked');
            var llab = el('span', 'gcb__row-label'); llab.textContent = 'Row ' + (idx + 1);
            var card = el('div', 'gcb__locked-card');
            var lock = el('span', 'gcb__locked-icon'); lock.setAttribute('aria-hidden', 'true'); lock.textContent = '🔒';
            var msg = el('span', 'gcb__locked-text'); msg.textContent = 'Select Row ' + idx + ' first';
            card.appendChild(lock); card.appendChild(msg);
            locked.appendChild(llab); locked.appendChild(card);
            rowsWrap.appendChild(locked);
            return;
          }

          var row = el('div', 'gcb__row');
          var selId = 'gcb-row-' + idx;
          var lab = el('label', 'gcb__row-label'); lab.textContent = 'Row ' + (idx + 1); lab.setAttribute('for', selId);
          var sel = el('select', 'gcb__select'); sel.id = selId;
          var ph = el('option'); ph.value = ''; ph.textContent = 'Choose an item…';
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
            renderRows();   // refresh locked/unlocked states + later-row values
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
      var subtotal = 0;
      for (var i = 0; i < state.rowCount; i++) {
        var it = state.rows[i] != null ? itemById[state.rows[i]] : null;
        var li = el('li', 'gcb__summary-row');
        if (!it) {
          li.classList.add('is-empty');
          li.textContent = 'Row ' + (i + 1) + ' — ' + (rowEnabled(i) ? 'not chosen yet' : 'locked');
        } else {
          if (it.image) { var th = el('img', 'gcb__summary-thumb'); th.src = it.image; th.alt = it.title; th.loading = 'lazy'; th.width = 48; th.height = 48; li.appendChild(th); }
          var body = el('div', 'gcb__summary-body');
          var name = el('span', 'gcb__summary-name'); name.textContent = 'Row ' + (i + 1) + ': ' + it.title; body.appendChild(name);
          var meta = el('span', 'gcb__summary-meta'); meta.textContent = (it.pieces ? it.pieces + ' pcs · ' : '') + money(it.price); body.appendChild(meta);
          li.appendChild(body);
          if (it.price != null) { subtotal += it.price; }
        }
        list.appendChild(li);
      }
      preview.appendChild(list);

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
