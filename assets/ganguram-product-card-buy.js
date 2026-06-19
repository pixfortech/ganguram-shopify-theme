/*
 * Ganguram — Product-card "Buy now" (Phase 2.11D.1)
 * ---------------------------------------------------------------------------
 * Adds an express "Buy now" button next to "Add to cart" on product CARDS for
 * single-variant products (rendered by snippets/quick-buy.liquid when
 * show_buy_now is passed). It reuses the theme's existing AJAX add (the
 * <product-form> submit) — it does NOT implement its own cart/checkout — and
 * then PROCEEDS toward checkout ONLY if the cart-side MOV / checkout guard
 * allows it; otherwise it opens the cart drawer so the customer sees the
 * minimum-order notice.
 *
 * It NEVER bypasses the pincode / MOV / delivery-eligibility guard, never changes
 * Shopify checkout, the final shipping charge, ShipZip / SBZ / zipLogic, or the
 * resolver. Multi-variant products keep the theme's option-selection flow (this
 * file only handles [data-ganguram-buy-now], which is rendered for single-variant
 * cards only). Fully FAIL-OPEN: if anything is missing it falls back to opening
 * the cart drawer / cart page and never force-navigates past an unknown guard.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (window.__ganguramProductCardBuyInit) { return; }
  window.__ganguramProductCardBuyInit = true;

  function cfg() { return window.GanguramProductCardBuyConfig || {}; }
  function cartUrl() { return cfg().cartUrl || '/cart'; }
  function checkoutUrl() { return cfg().checkoutUrl || '/checkout'; }

  // null = guard not loaded (unknown); true/false = blocked state.
  function guardBlocked() {
    var g = window.GanguramDeliveryProgress;
    if (g && typeof g.isCheckoutBlocked === 'function') {
      try { return g.isCheckoutBlocked() === true; } catch (e) {}
    }
    return null;
  }

  function openDrawer() {
    var d = document.getElementById('site-cart-sidebar');
    if (d && typeof d.show === 'function') { try { d.show(); return true; } catch (e) {} }
    return false;
  }

  function go(url) { try { window.location.assign(url); } catch (e) { window.location.href = url; } }

  // After the item is added: respect the MOV / checkout guard.
  function proceed() {
    var blocked = guardBlocked();
    if (blocked === true) { openDrawer(); return; }          // below MOV -> show cart, do NOT checkout
    if (blocked === false) { go(checkoutUrl()); return; }    // allowed -> express checkout
    // guard unknown (not loaded) -> never auto-checkout past an unknown guard
    if (!openDrawer()) { go(cartUrl()); }
  }

  function onClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-ganguram-buy-now]') : null;
    if (!btn) { return; }
    e.preventDefault();
    if (btn.getAttribute('aria-disabled') === 'true' || btn.disabled) { return; }

    var form = btn.closest('product-form');
    var addBtn = form ? form.querySelector('[name="add"], [data-js-product-add-to-cart]') : null;
    if (!form || !addBtn) { go(cartUrl()); return; } // no theme form -> safe fallback

    var done = false;
    function finish(fn) { if (done) { return; } done = true; form.removeEventListener('add-to-cart', onAdded); fn && fn(); }
    function onAdded() {
      // let the cart drawer markup (and the MOV panel) re-render before we read the guard
      finish(function () { if (window.requestAnimationFrame) { window.requestAnimationFrame(proceed); } else { setTimeout(proceed, 60); } });
    }
    form.addEventListener('add-to-cart', onAdded);
    // safety net: if the add event never arrives, just open the cart drawer
    setTimeout(function () { finish(function () { openDrawer(); }); }, 6000);

    btn.classList.add('working');
    try { addBtn.click(); }
    catch (err) { try { form.requestSubmit ? form.requestSubmit(addBtn) : form.submit(); } catch (e2) { finish(function () { go(cartUrl()); }); } }
  }

  document.addEventListener('click', onClick, true);
})();
