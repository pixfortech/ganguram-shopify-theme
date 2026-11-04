/* Launcher presentation only. Never changes Smile rewards, customer data or delivery. */
(function () {
  'use strict';
  if (document.getElementById('ganguram-rewards-glass')) return;
  var css = document.createElement('style');
  css.id = 'ganguram-rewards-glass';
  css.textContent = `
    :root{--gg-launcher-height:52px;--gg-launcher-bottom:20px;--gg-launcher-inset:20px;--gg-launcher-radius:16px;--gg-launcher-bg:rgba(73,72,141,.7);--gg-launcher-blur:blur(6px);--gg-launcher-shadow:0 2px 8px rgba(0,0,0,.12)}
    #smile-ui-lite-launcher-frame-container,#smile-ui-container .smile-launcher-frame-container{
      box-sizing:border-box!important;left:max(var(--gg-launcher-inset),env(safe-area-inset-left,0px))!important;right:auto!important;
      bottom:max(var(--gg-launcher-bottom),env(safe-area-inset-bottom,0px))!important;
      width:148px!important;height:var(--gg-launcher-height)!important;min-height:0!important;
      border-radius:var(--gg-launcher-radius)!important;overflow:hidden!important;
      background:var(--gg-launcher-bg)!important;-webkit-backdrop-filter:var(--gg-launcher-blur)!important;backdrop-filter:var(--gg-launcher-blur)!important;
      box-shadow:var(--gg-launcher-shadow)!important;
    }
    #smile-lite-launcher-frame,#smile-ui-container .smile-launcher-frame{
      display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:100%!important;max-height:100%!important;border:0!important;
    }
    @media(min-width:750px){#smile-ui-container .smile-panel-frame-container{bottom:calc(var(--gg-launcher-bottom) + var(--gg-launcher-height) + 12px)!important;max-height:calc(100dvh - var(--gg-launcher-bottom) - var(--gg-launcher-height) - 28px)!important}}
  `;
  document.head.appendChild(css);
  var frameCSS = `
    html,body,.frame-root,.frame-content{box-sizing:border-box!important;margin:0!important;padding:0!important;width:100%!important;height:100%!important;min-width:0!important;overflow:hidden!important;background:transparent!important;scrollbar-width:none!important}
    html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important}
    button,button:focus,.launcher-button{box-sizing:border-box!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0 14px!important;background:transparent!important;color:#fff!important;border:0!important;border-radius:0!important;line-height:1.2!important}
    button:focus-visible{outline:2px solid white!important;outline-offset:-4px!important}
    .launcher-container{box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;padding:0!important;border-radius:0!important;background:transparent!important}
    button img,.launcher-container .launcher-icon{width:24px!important;height:24px!important;flex-shrink:0!important}
    button img+span,.launcher-container .launcher-icon+.launcher-text{margin-left:10px!important;font-size:15px!important;line-height:1.2!important}
    .launcher-container .launcher-close-icon{width:24px!important;height:24px!important;inset:50% auto auto 50%!important;transform:translate(-50%,-50%)!important;margin:0!important;padding:0!important}
  `;
  var frames = new WeakSet();
  function styleFrame(frame) {
    try {
      var doc = frame.contentDocument;
      if (!doc || !doc.head) return;
      if (!doc.getElementById('ganguram-launcher-fit')) {
        var style = doc.createElement('style');
        style.id = 'ganguram-launcher-fit';
        style.textContent = frameCSS;
        doc.head.appendChild(style);
      }
      var button = doc.querySelector('button');
      if (button && !button.getAttribute('aria-label')) button.setAttribute('aria-label', 'Rewards');
      if (frame.getAttribute('scrolling') !== 'no') frame.setAttribute('scrolling', 'no');
    } catch (_) { /* Native app remains usable if an app update changes frame origin. */ }
  }
  function findActivator(root) {
    if (!root) return null;
    var found = root.querySelector('[part~="activator"]');
    if (found) return found;
    var children = root.querySelectorAll('*');
    for (var i=0;i<children.length;i++) {
      if (children[i].shadowRoot) {
        found = findActivator(children[i].shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }
  function put(name,value) {
    if (document.documentElement.style.getPropertyValue(name)!==value) document.documentElement.style.setProperty(name,value);
  }
  var activator, resizeObserver;
  function sync() {
    document.querySelectorAll('#smile-lite-launcher-frame,#smile-ui-container .smile-launcher-frame').forEach(function(frame) {
      if (!frames.has(frame)) { frames.add(frame); frame.addEventListener('load',function(){styleFrame(frame);}); }
      styleFrame(frame);
    });
    var chat = document.querySelector('shopify-chat');
    var button = findActivator(chat && chat.shadowRoot);
    if (!button) return;
    if (button !== activator) {
      activator=button;
      if (resizeObserver) resizeObserver.disconnect();
      resizeObserver=new ResizeObserver(schedule);
      resizeObserver.observe(button);
    }
    var rect=button.getBoundingClientRect();
    if (rect.width<1 || rect.height<1) return;
    var s=getComputedStyle(button);
    put('--gg-launcher-height',rect.height+'px');
    put('--gg-launcher-bottom',Math.max(16,window.innerHeight-rect.bottom)+'px');
    put('--gg-launcher-inset',Math.max(16,window.innerWidth-rect.right)+'px');
    put('--gg-launcher-radius',s.borderRadius);
    put('--gg-launcher-bg',s.backgroundColor);
    put('--gg-launcher-blur',s.backdropFilter || 'blur(6px)');
    put('--gg-launcher-shadow',s.boxShadow);
  }
  var queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;sync();});}
  function relevant(node){return node.nodeType===1 && (node.matches('shopify-chat,[id^="smile-"],.smile-launcher-frame,.smile-launcher-frame-container') || node.querySelector('shopify-chat,#smile-lite-launcher-frame,.smile-launcher-frame'));}
  new MutationObserver(function(records){
    if(records.some(function(record){return Array.from(record.addedNodes).some(relevant);}))schedule();
  }).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',schedule);
  sync();
  /* Bounded discovery while deferred app shadow roots initialise; no perpetual polling. */
  [250,750,1500,3000,6000,12000].forEach(function(ms){setTimeout(schedule,ms);});
})();
