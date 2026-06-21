/*
 * Ganguram — Custom Sweets Box Builder (Phase 2.12A)
 * ---------------------------------------------------------------------------
 * Lets a customer compose a "Custom Sweets Box": pick a column count (4/5/6),
 * choose one configured sweet per slot, optionally fill the remaining slots, see a
 * LIVE total, and add the whole box to the cart as GROUPED lines sharing a box id.
 *
 * SHOPIFY-SAFE PRICING: every selectable item maps to a REAL Shopify variant. The
 * box is added as one cart line PER slot referencing that variant id, so Shopify
 * computes the real price/weight/tax at checkout. The live total here is only a
 * PREVIEW built from the variant prices the config carries (rendered from Liquid
 * `variant.price`) — it never invents a price.
 *
 * DELIVERY ELIGIBILITY is computed from the SELECTED ITEMS (not the parent product
 * tag), reusing window.GanguramZoneRules.isProductDeliverableToZone — the SAME rule
 * the cart eligibility + product visibility use. No ShipZip / service-code / MOV /
 * date-picker / pincode-resolver change.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.GanguramBoxBuilder && window.GanguramBoxBuilder.__init) { return; }

  function cfg() { return window.GanguramBoxBuilderConfig || {}; }
  function enabled() { return cfg().enabled !== false; }
  function copy(key) {
    var c = cfg().copy || {};
    var d = {
      chooseItem: 'Choose an item…',
      slotLabel: 'Slot __N__',
      columnsLabel: 'Number of columns',
      fillRemaining: 'Fill remaining columns with __ITEM__',
      totalLabel: 'Box total:',
      addToCart: 'Add box to cart',
      adding: 'Adding…',
      incomplete: 'Please select items for all columns.',
      itemUnavailable: 'This item is currently unavailable. Please choose another item.',
      boxUnavailable: 'This box is not available for the selected pincode.',
      priceChanged: 'Your box price has changed. Please review before adding to cart.',
      added: 'Box added to your cart.',
      addError: 'Sorry, we could not add the box. Please try again.'
    };
    return (c[key] != null) ? String(c[key]) : d[key];
  }
  function tmpl(s, vars) {
    s = String(s == null ? '' : s); vars = vars || {};
    return s.replace(/__([A-Z0-9]+)__/g, function (_, k) { var kk = k.toLowerCase(); return (vars[kk] != null) ? vars[kk] : ''; });
  }
  function addUrl() {
    return cfg().addUrl ||
      (window.KROWN && KROWN.settings && KROWN.settings.routes && KROWN.settings.routes.cart_add_url) || '/cart/add.js';
  }
  function symbol() { return cfg().currencySymbol || '₹'; }
  function formatMoney(paise) {
    var n = (typeof paise === 'number' && isFinite(paise)) ? paise : 0;
    var rupees = n / 100;
    var s = (Math.round(rupees) === rupees) ? String(rupees) : rupees.toFixed(2);
    return symbol() + s;
  }

  // ---- config items ---------------------------------------------------------
  function items() {
    var list = (cfg().items || []).slice();
    list = list.filter(function (i) { return i && i.id != null && i.variantId != null && i.available !== false; });
    list.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    return list;
  }
  function itemsById() {
    var m = {}; items().forEach(function (i) { m[String(i.id)] = i; }); return m;
  }
  function columnCounts() {
    var cc = cfg().columnCounts;
    if (cc && cc.length) { return cc.slice().map(Number).filter(function (n) { return n > 0; }); }
    return [4, 5, 6];
  }
  function defaultColumns() {
    var d = Number(cfg().defaultColumns), cc = columnCounts();
    return (cc.indexOf(d) !== -1) ? d : cc[0];
  }
  function boxName() { return cfg().boxName || 'Custom Sweets Box'; }
  function itemLabel(it) { return it.displayName + (it.qtyLabel ? ' ' + it.qtyLabel : ''); }

  // ---- PURE helpers (unit-testable) -----------------------------------------
  // slots: array of item objects (or null) per column.
  function boxTotal(slots) {
    var t = 0;
    (slots || []).forEach(function (it) { if (it && typeof it.price === 'number') { t += it.price; } });
    return t;
  }
  function boxComposition(slots) {
    var out = [];
    (slots || []).forEach(function (it, idx) {
      if (it) { out.push({ slot: idx + 1, displayName: it.displayName, qtyLabel: it.qtyLabel || '', price: it.price, label: itemLabel(it) }); }
    });
    return out;
  }
  function isComplete(slots) {
    if (!slots || !slots.length) { return false; }
    for (var i = 0; i < slots.length; i++) { if (!slots[i]) { return false; } }
    return true;
  }
  function tagsOf(it) {
    return { kolkata: !!it.kolkata, panIndia: !!it.panIndia, quickCommerce: !!it.quickCommerce, localDelivery: !!it.localDelivery };
  }
  // Box delivery eligibility from the SELECTED items + the active zone. Reuses the shared
  // per-item deliverability rule. fourHour only when the zone is quick-commerce AND every
  // selected item is Quick Commerce. No pincode -> don't block (resolved later in cart).
  function boxEligibility(slots, zone) {
    var selected = (slots || []).filter(Boolean);
    if (!zone) { return { deliverable: true, fourHour: false, unavailable: [], hasItems: selected.length > 0 }; }
    var rule = window.GanguramZoneRules && window.GanguramZoneRules.isProductDeliverableToZone;
    var unavailable = [], allQC = selected.length > 0;
    selected.forEach(function (it) {
      if (rule && !rule(tagsOf(it), zone)) { unavailable.push(it); }
      if (!it.quickCommerce) { allQC = false; }
    });
    var deliverable = unavailable.length === 0;
    return { deliverable: deliverable, fourHour: deliverable && allQC && zone === 'quick_commerce', unavailable: unavailable, hasItems: selected.length > 0 };
  }
  function generateBoxId() {
    return 'box-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  // Build the /cart/add.js payload: ONE line per slot -> the real variant + grouping props.
  function buildAddPayload(box) {
    var comp = boxComposition(box.slots).map(function (c) { return 'Slot ' + c.slot + ': ' + c.label; }).join(' · ');
    var lineItems = [];
    (box.slots || []).forEach(function (it, idx) {
      if (!it) { return; }
      lineItems.push({
        id: it.variantId,
        quantity: 1,
        properties: {
          '_ganguram_box_id': box.boxId,
          '_ganguram_box_parent': box.boxName,
          '_ganguram_box_columns': String(box.columns),
          '_ganguram_box_slot': String(idx + 1),
          '_ganguram_box_name': box.boxName,
          '_ganguram_box_item': itemLabel(it),
          '_ganguram_box_qty_label': it.qtyLabel || '',
          '_ganguram_box_composition': comp
        }
      });
    });
    return { items: lineItems };
  }

  // ---- controller -----------------------------------------------------------
  function el(tag, cls) { var e = document.createElement(tag); if (cls) { e.className = cls; } return e; }
  function activeZone() {
    var z = window.GanguramZone;
    if (!z || typeof z.getSelectedDeliveryLocation !== 'function') { return null; }
    try { var loc = z.getSelectedDeliveryLocation(); return (loc && loc.pincode && loc.isServiceable === true) ? loc.zone : null; } catch (e) { return null; }
  }

  function Builder(root) {
    this.root = root;
    this.byId = itemsById();
    this.columns = defaultColumns();
    this.slots = [];            // item objects or null, length === columns
    this.auto = {};             // { slotIndex: true } for auto-filled slots
    this.lastItemId = '';       // most-recent manual selection -> the "fill with" item
    this.fillOn = false;
    this.busy = false;
    this.build();
    this.setColumns(this.columns);
  }
  Builder.prototype.q = function (sel) { return this.root.querySelector(sel); };
  Builder.prototype.build = function () {
    var r = this.root;
    r.textContent = '';
    // column selector
    var colWrap = el('div', 'ganguram-box__columns'); colWrap.setAttribute('data-gbb-columns', '');
    var colLabel = el('span', 'ganguram-box__columns-label'); colLabel.textContent = copy('columnsLabel'); colWrap.appendChild(colLabel);
    var self = this;
    columnCounts().forEach(function (n) {
      var b = el('button', 'ganguram-box__col-btn'); b.type = 'button'; b.textContent = String(n);
      b.setAttribute('data-gbb-col', String(n)); b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { self.setColumns(n); });
      colWrap.appendChild(b);
    });
    r.appendChild(colWrap);
    // slots
    this.slotsEl = el('div', 'ganguram-box__slots'); this.slotsEl.setAttribute('data-gbb-slots', ''); r.appendChild(this.slotsEl);
    // fill remaining
    this.fillWrap = el('label', 'ganguram-box__fill'); this.fillWrap.setAttribute('data-gbb-fill', ''); this.fillWrap.setAttribute('hidden', '');
    this.fillCb = el('input'); this.fillCb.type = 'checkbox'; this.fillCb.setAttribute('data-gbb-fill-cb', '');
    this.fillCb.addEventListener('change', function () { self.onFillToggle(); });
    this.fillText = el('span', 'ganguram-box__fill-text');
    this.fillWrap.appendChild(this.fillCb); this.fillWrap.appendChild(this.fillText); r.appendChild(this.fillWrap);
    // message
    this.msgEl = el('p', 'ganguram-box__message'); this.msgEl.setAttribute('data-gbb-message', ''); this.msgEl.setAttribute('role', 'status'); this.msgEl.setAttribute('hidden', ''); r.appendChild(this.msgEl);
    // total + add
    var foot = el('div', 'ganguram-box__footer');
    this.totalEl = el('div', 'ganguram-box__total'); this.totalEl.setAttribute('data-gbb-total', '');
    var tl = el('span', 'ganguram-box__total-label'); tl.textContent = copy('totalLabel');
    this.totalVal = el('span', 'ganguram-box__total-value'); this.totalVal.setAttribute('data-gbb-total-value', '');
    this.totalEl.appendChild(tl); this.totalEl.appendChild(this.totalVal); foot.appendChild(this.totalEl);
    this.addBtn = el('button', 'ganguram-box__add button button--solid button--fullwidth'); this.addBtn.type = 'button';
    this.addBtn.setAttribute('data-gbb-add', ''); this.addBtn.textContent = copy('addToCart');
    this.addBtn.addEventListener('click', function () { self.onAdd(); });
    foot.appendChild(this.addBtn);
    r.appendChild(foot);
  };
  Builder.prototype.optionsHtml = function (selectedId) {
    var sel = el('select', 'ganguram-box__select');
    var ph = el('option'); ph.value = ''; ph.textContent = copy('chooseItem'); sel.appendChild(ph);
    items().forEach(function (it) {
      var o = el('option'); o.value = String(it.id);
      o.textContent = itemLabel(it) + ' — ' + formatMoney(it.price);
      if (String(it.id) === String(selectedId)) { o.selected = true; }
      sel.appendChild(o);
    });
    return sel;
  };
  Builder.prototype.setColumns = function (n) {
    n = Number(n);
    if (columnCounts().indexOf(n) === -1) { return; }
    // keep existing selections that still fit; truncate / extend with null
    var prev = this.slots.slice();
    this.columns = n; this.slots = []; this.auto = {};
    for (var i = 0; i < n; i++) { this.slots[i] = (prev[i] || null); }
    // column buttons active state
    var btns = this.root.querySelectorAll('[data-gbb-col]');
    for (var b = 0; b < btns.length; b++) {
      var on = Number(btns[b].getAttribute('data-gbb-col')) === n;
      btns[b].classList.toggle('is-selected', on); btns[b].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    this.renderSlots();
    this.refresh();
  };
  Builder.prototype.renderSlots = function () {
    var self = this; this.slotsEl.textContent = '';
    for (var i = 0; i < this.columns; i++) {
      (function (idx) {
        var card = el('div', 'ganguram-box__slot'); card.setAttribute('data-gbb-slot', String(idx + 1));
        var lab = el('label', 'ganguram-box__slot-label'); lab.textContent = tmpl(copy('slotLabel'), { n: idx + 1 });
        var selId = self.slots[idx] ? self.slots[idx].id : '';
        var sel = self.optionsHtml(selId);
        sel.setAttribute('data-gbb-select', ''); sel.setAttribute('aria-label', tmpl(copy('slotLabel'), { n: idx + 1 }));
        sel.addEventListener('change', function () { self.onSelect(idx, sel.value); });
        var price = el('span', 'ganguram-box__slot-price'); price.setAttribute('data-gbb-slot-price', '');
        price.textContent = self.slots[idx] ? formatMoney(self.slots[idx].price) : '';
        card.appendChild(lab); card.appendChild(sel); card.appendChild(price);
        if (self.slots[idx]) { card.classList.add('is-filled'); }
        self.slotsEl.appendChild(card);
      })(i);
    }
  };
  Builder.prototype.onSelect = function (idx, value) {
    this.slots[idx] = value ? (this.byId[value] || null) : null;
    delete this.auto[idx];                       // a manual change un-marks auto-fill
    if (value) { this.lastItemId = value; }
    this.syncSlotUI(idx);
    this.updateFillControl();
    this.refresh();
  };
  Builder.prototype.onFillToggle = function () {
    this.fillOn = !!this.fillCb.checked;
    if (this.fillOn) {
      var fillItem = this.byId[this.lastItemId];
      if (!fillItem) { this.fillCb.checked = false; this.fillOn = false; return; }
      for (var i = 0; i < this.columns; i++) {
        if (!this.slots[i]) { this.slots[i] = fillItem; this.auto[i] = true; this.syncSlotUI(i); }
      }
    } else {
      for (var j = 0; j < this.columns; j++) {
        if (this.auto[j]) { this.slots[j] = null; delete this.auto[j]; this.syncSlotUI(j); }
      }
    }
    this.refresh();
  };
  Builder.prototype.syncSlotUI = function (idx) {
    var card = this.slotsEl.children[idx]; if (!card) { return; }
    var sel = card.querySelector('[data-gbb-select]');
    var price = card.querySelector('[data-gbb-slot-price]');
    var it = this.slots[idx];
    if (sel) { sel.value = it ? String(it.id) : ''; }
    if (price) { price.textContent = it ? formatMoney(it.price) : ''; }
    card.classList.toggle('is-filled', !!it);
  };
  Builder.prototype.updateFillControl = function () {
    var hasEmpty = this.slots.indexOf(null) !== -1 || this.slots.some(function (s) { return !s; });
    var item = this.byId[this.lastItemId];
    if (item && hasEmpty) {
      this.fillText.textContent = tmpl(copy('fillRemaining'), { item: item.displayName });
      this.fillWrap.removeAttribute('hidden');
    } else {
      this.fillWrap.setAttribute('hidden', '');
      this.fillCb.checked = false; this.fillOn = false;
    }
  };
  Builder.prototype.setMessage = function (text) {
    if (text) { this.msgEl.textContent = text; this.msgEl.removeAttribute('hidden'); }
    else { this.msgEl.textContent = ''; this.msgEl.setAttribute('hidden', ''); }
  };
  Builder.prototype.refresh = function () {
    this.totalVal.textContent = formatMoney(boxTotal(this.slots));
    this.updateFillControl();
    var complete = isComplete(this.slots);
    var elig = boxEligibility(this.slots, activeZone());
    var ok = complete && elig.deliverable;
    this.addBtn.disabled = !ok || this.busy;
    this.addBtn.setAttribute('aria-disabled', (!ok || this.busy) ? 'true' : 'false');
    if (!complete) { this.setMessage(elig.hasItems ? copy('incomplete') : ''); }
    else if (!elig.deliverable) {
      this.setMessage(elig.unavailable.length === 1
        ? copy('itemUnavailable') : copy('boxUnavailable'));
    } else { this.setMessage(''); }
    // expose state for diagnostics/tests
    this.state = { columns: this.columns, slots: this.slots.slice(), total: boxTotal(this.slots), complete: complete, eligibility: elig };
  };
  Builder.prototype.onAdd = function () {
    if (this.busy) { return; }
    if (!isComplete(this.slots)) { this.setMessage(copy('incomplete')); return; }
    var elig = boxEligibility(this.slots, activeZone());
    if (!elig.deliverable) { this.setMessage(elig.unavailable.length === 1 ? copy('itemUnavailable') : copy('boxUnavailable')); return; }
    var box = { boxId: generateBoxId(), boxName: boxName(), columns: this.columns, slots: this.slots.slice() };
    var payload = buildAddPayload(box);
    this.busy = true; this.addBtn.disabled = true; this.addBtn.textContent = copy('adding');
    var self = this;
    fetch(addUrl(), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'same-origin', body: JSON.stringify(payload)
    }).then(function (r) { if (!r.ok) { throw new Error('add failed'); } return r.json(); })
      .then(function () {
        self.setMessage(copy('added'));
        if (typeof window.refreshCart === 'function') { try { window.refreshCart(true); } catch (e) {} }
        try { window.dispatchEvent(new CustomEvent('ganguram:box-added', { detail: { boxId: box.boxId, columns: box.columns } })); } catch (e) {}
      })
      .catch(function () { self.setMessage(copy('addError')); })
      .finally(function () { self.busy = false; self.addBtn.textContent = copy('addToCart'); self.refresh(); });
  };

  function init() {
    if (!enabled()) { return; }
    var roots = document.querySelectorAll('[data-ganguram-box-builder]');
    for (var i = 0; i < roots.length; i++) {
      if (roots[i].__gbb) { continue; }
      try { roots[i].__gbb = new Builder(roots[i]); } catch (e) {}
    }
    // re-evaluate eligibility when the pincode changes
    window.addEventListener('ganguram:delivery-location-changed', function () {
      var rs = document.querySelectorAll('[data-ganguram-box-builder]');
      for (var j = 0; j < rs.length; j++) { if (rs[j].__gbb) { try { rs[j].__gbb.refresh(); } catch (e) {} } }
    });
  }

  window.GanguramBoxBuilder = {
    __init: true,
    // pure helpers (tested)
    boxTotal: boxTotal, boxComposition: boxComposition, isComplete: isComplete,
    boxEligibility: boxEligibility, buildAddPayload: buildAddPayload, generateBoxId: generateBoxId,
    formatMoney: formatMoney, items: items, itemsById: itemsById, columnCounts: columnCounts,
    Builder: Builder, init: init
  };

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
