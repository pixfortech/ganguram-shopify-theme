/* Page through products eligible for the selected PIN in Shopify's current sort order. */
(() => {
  'use strict';
  if (window.ganguramCollectionPagesLoaded) return;
  window.ganguramCollectionPagesLoaded = true;
  const cardSelector = '[data-ganguram-product-card]';
  let controller;
  let current;

  function pageURL(number) {
    const url = new URL(location.href);
    if (number === 1) url.searchParams.delete('page');
    else url.searchParams.set('page', number);
    return url;
  }

  async function loadIndex(signal) {
    const rows = [];
    let pages = 1;
    for (let n = 1; n <= pages; n++) {
      const url = pageURL(n);
      url.searchParams.set('view', 'delivery-index');
      const response = await fetch(url, {signal});
      if (!response.ok) throw Error('Product index unavailable');
      const index = await response.json();
      if (index.page !== n || !Array.isArray(index.products)) throw Error('Invalid index');
      pages = index.pages;
      rows.push(...index.products);
    }
    return rows;
  }

  function renderPager(pager, page, pages) {
    if (!pager) return;
    pager.hidden = pages < 2;
    if (pages < 2) return;
    const list = pager.querySelector('.pagination');
    const arrow = (selector, number, enabled) => {
      const item = list.querySelector(selector).cloneNode(true);
      const link = document.createElement(enabled ? 'a' : 'span');
      const existing = item.querySelector('a') || item;
      link.append(...Array.from(existing.childNodes).map(node => node.cloneNode(true)));
      if (enabled) link.href = pageURL(number);
      item.classList.toggle('disabled', !enabled);
      item.replaceChildren(link);
      return item;
    };
    const items = [arrow('.prev', page - 1, page > 1)];
    for (let n = 1; n <= pages; n++) {
      if (n > 1 && n < pages && Math.abs(n-page) > 1) {
        if (n !== 2 && n !== page + 2) continue;
        if (items.at(-1).textContent === '…') continue;
        const gap = document.createElement('li');
        gap.className = 'lap-hide';
        gap.textContent = '…';
        items.push(gap);
        continue;
      }
      const item = document.createElement('li');
      item.className = 'lap-hide';
      if (n === page) {
        item.classList.add('active');
        item.setAttribute('aria-current','page');
        item.textContent = n;
      } else {
        const link = document.createElement('a');
        link.href = pageURL(n);
        link.textContent = n;
        item.append(link);
      }
      items.push(item);
    }
    const mobile = list.querySelector('.mobile').cloneNode(true);
    mobile.firstElementChild.textContent = page + ' / ' + pages;
    list.replaceChildren(...items, mobile, arrow('.next', page + 1, page < pages));
  }

  function setCount(grid, count) {
    document.querySelectorAll('#CollectionProductCount').forEach(el => {
      el.textContent = count === 1 ? grid.dataset.countOne :
        grid.dataset.countMany.replace(/987[,.\s\u202f]?654/g, String(count));
    });
  }

  async function render(resetPage = false) {
    controller?.abort();
    const grid = document.getElementById('main-collection-product-grid');
    if (!grid || !grid.dataset.pageSize) return;
    const locationState = window.GanguramZone?.getSelectedDeliveryLocation();
    const zone = locationState?.isServiceable && locationState.pincode && locationState.zone;
    const rules = window.GanguramZoneRules;
    if (!rules) return;
    if (!zone) {
      if (current?.grid === grid && current.changed) location.replace(pageURL(1));
      return;
    }
    if (!current || current.grid !== grid) {
      const cards = Array.from(grid.children).filter(el => el.matches(cardSelector));
      const pager = grid.querySelector('[data-delivery-pagination]');
      current = {grid, cards, index:null, changed:false, pager, originalPager:pager?.cloneNode(true)};
    }
    const state = current;
    grid.querySelector('[data-retry-collection]')?.remove();
    controller = new AbortController();
    const signal = controller.signal;
    const size = Number(grid.dataset.pageSize);
    const total = Number(grid.dataset.total);
    if (!total) return;
    if (total <= size) {
      const visible = state.cards.filter(card=>rules.cardAllowed(card, zone));
      setCount(grid, visible.length);
      state.changed = true;
      return;
    }
    grid.dataset.deliveryResult = 'loading';
    grid.setAttribute('aria-busy','true');
    try {
      const rows = state.index || await loadIndex(signal);
      if (signal.aborted || !grid.isConnected) return;
      if (rows.length !== total) throw Error('Collection changed during pagination');
      state.index = rows;
      const quick = (window.GanguramQuickCommerceHandles || []).includes(grid.dataset.ganguramCollection);
      const eligible = rows.map(([id,k,p,q,l],i)=>({id,source:Math.floor(i/size)+1,
        allowed:rules.isProductVisibleForContext({kolkata:k,panIndia:p,quickCommerce:q,localDelivery:l},zone,quick?'quick':'normal')})).filter(row=>row.allowed);
      const pages = Math.ceil(eligible.length / size);
      const requested = Number(new URL(location.href).searchParams.get('page')) || 1;
      const page = resetPage ? 1 : Math.max(1, Math.min(requested,pages));
      const wanted = eligible.slice((page-1)*size,page*size);
      const byId = new Map(state.cards.map(el=>[el.id,el]));
      const pending = wanted.filter(row=>!byId.has('product-item-'+row.id));
      await Promise.all([...new Set(pending.map(row=>row.source))].map(async n=>{
        const url = pageURL(n);
        url.searchParams.set('section_id',grid.dataset.id);
        const response = await fetch(url,{signal});
        if (!response.ok) throw Error('Collection page unavailable');
        const doc = new DOMParser().parseFromString(await response.text(),'text/html');
        doc.querySelectorAll('#main-collection-product-grid > '+cardSelector).forEach(el=>{
          byId.set(el.id,el);
        });
      }));
      if (signal.aborted || !grid.isConnected) return;
      const chosen = wanted.map(row=>byId.get('product-item-'+row.id));
      if (chosen.some(el=>!el)) throw Error('Product order changed');
      const pager = state.pager;
      // For zero matches keep source cards hidden so the existing PIN-change control works.
      const cards = chosen.length ? chosen : state.cards;
      for (const el of cards) {
        el.classList.toggle('ganguram-zone-hidden', !chosen.length);
        if (el.ownerDocument !== document) {
          el.querySelectorAll('form template').forEach(template=>template.closest('form').append(template.content.cloneNode(true)));
        }
      }
      grid.replaceChildren(...cards,...(pager?[pager]:[]));
      renderPager(pager,page,pages);
      state.changed = true;
      grid.dataset.deliveryResult = chosen.length ? 'ready' : 'empty';
      if (requested !== page) history.replaceState(history.state,'',pageURL(page));
      setCount(grid,eligible.length);
      document.dispatchEvent(new CustomEvent('ganguram:collection-page-ready'));
    } catch (error) {
      if (signal.aborted || !grid.isConnected) return;
      grid.dataset.deliveryResult = 'fallback';
      // Keep the original Shopify page available if the connection drops.
      for (const card of state.cards) card.classList.toggle('ganguram-zone-hidden', !rules.cardAllowed(card, zone));
      state.pager = state.originalPager?.cloneNode(true);
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.dataset.retryCollection = '';
      retry.className = 'button button--outline';
      retry.textContent = 'Retry loading available products';
      retry.addEventListener('click', () => render());
      grid.replaceChildren(...state.cards, retry, ...(state.pager ? [state.pager] : []));
      setCount(grid,total);
      state.changed = true;
    } finally {
      if (!signal.aborted) grid.removeAttribute('aria-busy');
    }
  }

  const start = () => render();
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  window.addEventListener('load',()=>{ if (!current) start(); },{once:true});
  window.addEventListener('ganguram:delivery-location-changed',()=>render(true));
  document.addEventListener('krown:main-collection-grid:filtered',()=>queueMicrotask(start));
  document.addEventListener('shopify:section:load',start);
})();
