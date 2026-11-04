/* Presentation only: equalise corresponding card content within each visible row.
 * No changes to delivery eligibility, cart state, checkout or tracking. */
(() => {
  'use strict';
  const selector = '[data-ganguram-product-card]';
  const original = new WeakMap();
  const watched = new WeakSet();
  const widths = new WeakMap();
  let pending = false;
  function remember(el) {
    if (!original.has(el)) original.set(el, {minHeight:el.style.minHeight, marginTop:el.style.marginTop});
  }
  function restore(el) {
    const old = original.get(el);
    if (old) { el.style.minHeight = old.minHeight; el.style.marginTop = old.marginTop; }
  }
  function equalHeight(elements) {
    if (elements.length < 2) return;
    const height = Math.ceil(Math.max(...elements.map(el => el.getBoundingClientRect().height)));
    elements.forEach(el => { remember(el); el.style.minHeight = height + 'px'; });
  }
  function entries(card) {
    const seen = {};
    return Array.from(card.children).filter(el => el.classList.contains('product-item__text')).flatMap((area, areaIndex) =>
      Array.from(area.children).map(el => {
        const kind = Array.from(el.classList).find(name => name.startsWith('product-item__')) || el.tagName;
        const base = areaIndex + ':' + kind;
        const index = seen[base] || 0;
        seen[base] = index + 1;
        return {el, key:base + ':' + index};
      })
    );
  }
  function alignRow(cards) {
    if (cards.length < 2) return;
    equalHeight(cards.map(card => card.querySelector('.product-item__title > div:first-child')).filter(Boolean));
    const packs = cards.map(card => Array.from(card.querySelectorAll('.product-item__pack-options')));
    for (let i=0; i<Math.max(...packs.map(pack=>pack.length)); i++) equalHeight(packs.map(pack=>pack[i]).filter(Boolean));
    const slots = new Map();
    cards.forEach(card => entries(card).forEach(({el,key}) => {
      if (!slots.has(key)) slots.set(key, []);
      slots.get(key).push(el);
    }));
    // Shared theme blocks keep the same order; missing optional blocks are skipped.
    for (const elements of slots.values()) {
      const visible = elements.filter(el=>el.getBoundingClientRect().height > 0);
      if (visible.length < 2) continue;
      const top = Math.max(...visible.map(el=>el.getBoundingClientRect().top));
      const adjustments = visible.map(el=>({el, gap:top-el.getBoundingClientRect().top, margin:parseFloat(getComputedStyle(el).marginTop)||0}));
      adjustments.forEach(({el,gap,margin})=>{ if(gap>.5) {remember(el);el.style.marginTop=(margin+gap)+'px';} });
      equalHeight(visible);
    }
  }
  function badges() {
    const location = window.GanguramZone?.getSelectedDeliveryLocation?.();
    const hide = location?.zone === 'pan_india';
    document.querySelectorAll('[data-ganguram-express-badge]').forEach(el=>{el.hidden=hide;});
  }
  function run() {
    pending=false;
    const cards=Array.from(document.querySelectorAll(selector));
    cards.forEach(card=>{
      entries(card).forEach(({el})=>restore(el));
      card.querySelectorAll('.product-item__title > div:first-child, .product-item__pack-options').forEach(restore);
      if (observer && !watched.has(card)) {watched.add(card);observer.observe(card);}
    });
    const parents=new Map();
    cards.forEach(card=>{
      const rect=card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if(!parents.has(card.parentElement)) parents.set(card.parentElement,[]);
      const rows=parents.get(card.parentElement);
      let row=rows.find(row=>Math.abs(row.top-rect.top)<3);
      if(!row) {row={top:rect.top,cards:[]};rows.push(row);}
      row.cards.push(card);
    });
    parents.forEach(rows=>rows.forEach(row=>alignRow(row.cards)));
    badges();
  }
  function schedule() {if(!pending){pending=true;requestAnimationFrame(run);}}
  const observer = typeof ResizeObserver==='function' ? new ResizeObserver(entries=>{
    let changed=false;
    entries.forEach(({target,contentRect})=>{
      const width=Math.round(contentRect.width*10);
      if(widths.get(target)!==width){widths.set(target,width);changed=true;}
    });
    if(changed)schedule();
  }) : null;
  const mutations=new MutationObserver(records=>{
    if(records.some(record=> record.type==='attributes' ? record.target.matches(selector) :
      [...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1 && (node.matches(selector)||node.querySelector(selector)))))schedule();
  });
  mutations.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
  document.addEventListener('toggle',event=>{if(event.target.matches('.product-item__gift-contents'))schedule();},true);
  document.addEventListener('shopify:section:load',schedule);
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('ganguram:delivery-location-changed',schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();
