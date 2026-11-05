const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const geo = require('../assets/ganguram-postal-geometry.js');
const R = 6371.0088, rad = Math.PI / 180;
const square = (x0,y0,x1,y1) => [[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
const polygon = (...rings) => ({type:'Polygon',coordinates:rings});
const kmDegrees = km => km / R / rad;
function dom(html = '') {
  return new JSDOM(html, {url:'https://ganguram.test', runScripts:'outside-only'});
}
function load(w, file) { w.eval(fs.readFileSync('assets/'+file+'.js','utf8')); }
function setup(d = dom()) {
  const w = d.window;
  w.GanguramZoneConfig = {origin:'22.586852842169446,88.37350202482604'};
  ['ganguram-postal-geometry','ganguram-postal-boundaries','ganguram-zone-resolver'].forEach(f=>load(w,f));
  return w;
}
test('circle intersection includes polygon edges whose vertices are all outside', () => {
  const g = polygon(square(kmDegrees(19),kmDegrees(-10),kmDegrees(30),kmDegrees(10)));
  assert.ok(g.coordinates[0].every(p=>geo.distance([0,0],p)>20));
  assert.ok(geo.distanceToGeometry([0,0],g)<20);
});
test('containing circle, outside circle, holes, multipolygon and tangent', () => {
  assert.equal(geo.distanceToGeometry([0,0],polygon(square(-1,-1,1,1))),0);
  assert.ok(geo.distanceToGeometry([0,0],polygon(square(1,1,2,2)))>20);
  assert.ok(geo.distanceToGeometry([0,0],polygon(square(-2,-2,2,2),square(-1,-1,1,1)))>20);
  assert.equal(geo.distanceToGeometry([0,0],{type:'MultiPolygon',coordinates:[[square(2,2,3,3)],[square(-.1,-.1,.1,.1)]]}),0);
  const tangent = polygon(square(kmDegrees(20),-.1,.5,.1));
  assert.ok(Math.abs(geo.distanceToGeometry([0,0],tangent)-20)<1e-8);
});
test('actual dataset classifies 219 whole postal areas as Kolkata, with no quick-commerce zone', () => {
  const d=dom(),w=setup(d), report=JSON.parse(fs.readFileSync('docs/postal-boundary-result.json'));
  let count=0;
  for(const pin of w.GanguramPostalBoundaries.nationalPins.split(',')) {
    const r=w.GanguramZone.classifyPincode(pin);
    if(r.zone==='kolkata') count++;
    assert.ok(['kolkata','pan_india'].includes(r.zone));
  }
  assert.equal(count,219); assert.equal(count,report.kolkata.length);
  assert.equal(w.GanguramZone.classifyPincode('110001').zone,'pan_india');
  assert.equal(w.GanguramZone.classifyPincode('700006').zone,'kolkata');
  d.window.close();
});
test('full intersecting postcode qualifies; adjacent outside postcode does not chain-expand', () => {
  const d=dom(),w=setup(d);
  w.GanguramZoneConfig={origin:'0,0'};
  w.GanguramPostalBoundaries={version:1,centre:[0,0],coverageKm:40,nationalPins:'100001,100002',geometries:{
    '100001':polygon(square(kmDegrees(19),-.01,kmDegrees(30),.01)),
    '100002':polygon(square(kmDegrees(30),-.01,kmDegrees(35),.01))
  }};
  assert.equal(w.GanguramZone.classifyPincode('100001').zone,'kolkata');
  assert.equal(w.GanguramZone.classifyPincode('100002').zone,'pan_india');
  // An outlet move must be synchronised with the ShipZip export first.
  w.GanguramZoneConfig.origin='0,0.1';
  assert.equal(w.GanguramZone.classifyPincode('100002').reason,'boundary_data_unavailable');
  w.GanguramPostalBoundaries={...w.GanguramPostalBoundaries,centre:[0.1,0]};
  assert.equal(w.GanguramZone.classifyPincode('100002').zone,'kolkata');
  d.window.close();
});
test('invalid PIN, missing geometry asset and out-of-coverage origin fail closed', () => {
  const d=dom(),w=setup(d);
  for(const p of ['999999','7000067','700006oops','','000000']) assert.equal(w.GanguramZone.classifyPincode(p).isServiceable,false);
  w.GanguramZoneConfig={origin:'28.6,77.2'};
  assert.equal(w.GanguramZone.classifyPincode('700006').reason,'boundary_data_unavailable');
  w.GanguramPostalBoundaries=null;
  assert.equal(w.GanguramZone.classifyPincode('110001').isServiceable,false);
  d.window.close();
});
test('stored legacy zone never overrides geographic classification, and express uses confirmed distance', () => {
  const d=dom(),w=setup(d);
  w.localStorage.setItem('ganguram.deliveryLocation', JSON.stringify({pincode:'700006',zone:'quick_commerce'}));
  assert.equal(w.GanguramZone.getSelectedDeliveryLocation().zone,'kolkata');
  load(w,'ganguram-shipping-estimate');
  w.GanguramDistance={getForPincode:()=>({confirmed:true,distanceKm:9})};
  assert.equal(w.GanguramZone.getSelectedDeliveryLocation().isQuickCommerce,true);
  w.GanguramDistance.getForPincode=()=>({confirmed:true,distanceKm:25});
  assert.equal(w.GanguramZone.getSelectedDeliveryLocation().zone,'kolkata');
  assert.equal(w.GanguramZone.getSelectedDeliveryLocation().isQuickCommerce,false);
  d.window.close();
});
test('long road distance and sampled Google bounds never reclassify Kolkata as PAN India', () => {
  const d=dom(),w=setup(d);load(w,'ganguram-shipping-estimate');
  const se=w.GanguramShippingEstimate;
  for(const ctx of [{isAddress:true,distanceKm:35},{isAddress:false,areaRange:{minKm:25,maxKm:40}},{}]) {
    const r=se.resolveDeliveryState({...ctx,zone:'kolkata',panIndiaEligibleCart:false});
    assert.equal(r.mode,'local');assert.equal(r.panIndia,null);
  }
  assert.equal(se.resolveDeliveryState({zone:'pan_india',isAddress:true,distanceKm:5}).mode,'pan_india');
  assert.equal(se.resolveDeliveryState({zone:'kolkata',isAddress:true,distanceKm:35}).standard.maxPrice,150);
  d.window.close();
});
test('tariffs are scoped to postal zone; manual overrides and state names cannot change it', () => {
  const d=dom(),w=setup(d);
  w.GanguramDeliveryRulesConfig={rules:[
    {name:'local',zone:'kolkata',state:'West Bengal',priority:10,deliveryCharge:4000},
    {name:'local band',zone:'kolkata',distanceMinKm:0,distanceMaxKm:5,priority:100,deliveryCharge:5000},
    {name:'remote',zone:'pan_india',priority:10},
    {name:'obsolete exact',zone:'pan_india',pincode:'700006',priority:999}
  ]};load(w,'ganguram-delivery-rules');
  const dr=w.GanguramDeliveryRules;
  assert.equal(dr.resolve({pincode:'700006',zone:'kolkata'},{distanceKm:30}).rule.name,'local');
  assert.equal(dr.resolve({pincode:'700006',zone:'kolkata'},{distanceKm:3}).rule.name,'local band');
  assert.equal(dr.resolve({pincode:'721101',zone:'pan_india',state:'West Bengal'},{distanceKm:3}).rule.name,'remote');
  d.window.close();
});
test('search filters before rendering, keyboard skips hidden products, changing PIN re-filters cached HTML', () => {
  const d=dom('<search-form><input data-js-search-input><div data-js-search-results></div></search-form>'),w=setup(d);
  w.KROWN={settings:{predictive_search_enabled:'false'}};
  load(w,'ganguram-product-zone-filter');load(w,'component-predictive-search');
  w.GanguramZone.setSelectedPincode('110001');
  const form=w.document.querySelector('search-form');
  form.renderSearchResults(`<div data-js-search-results-holder><div data-js-search-item data-ganguram-product-card data-ganguram-kolkata="true"><a href="/products/rosogolla-5pcs">Rosogolla 5pcs</a></div><div data-js-search-item data-ganguram-product-card data-ganguram-pan-india="true"><a href="/products/tin-rosogolla">Tin Rosogolla</a></div></div>`);
  assert.equal(form.results.length,1);assert.match(form.results[0].textContent,/Tin/);
  assert.equal(form.querySelector('[data-ganguram-kolkata]').hidden,true);
  form.navigateThrough('DOWN');assert.equal(form.a11yIndex,0);
  w.GanguramZone.setSelectedPincode('700006');
  assert.equal(form.results.length,1);assert.equal(form.results[0].textContent,'Rosogolla 5pcs');
  form.clearSearchResults();assert.doesNotThrow(()=>form.navigateThrough('DOWN'));
  d.window.close();
});
test('direct product URL blocks purchase for PAN India, restores on Kolkata and protects replacement forms', async () => {
  const d=dom('<body class="template-product"><product-page data-ganguram-product-availability data-ganguram-kolkata="true"><form action="/cart/add"><button>Add</button></form></product-page></body>'),w=setup(d);
  load(w,'ganguram-product-zone-filter');load(w,'ganguram-product-availability');
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  w.GanguramZone.setSelectedPincode('110001');
  assert.equal(w.document.body.classList.contains('ganguram-product-unavailable'),true);
  assert.match(w.document.querySelector('[data-ganguram-pa-msg]').textContent,/110001/);
  let form=w.document.querySelector('form');
  let submit=new w.Event('submit',{bubbles:true,cancelable:true});form.dispatchEvent(submit);assert.equal(submit.defaultPrevented,true);
  form.outerHTML='<form action="/cart/add"><button>Replacement variant</button></form>';
  submit=new w.Event('submit',{bubbles:true,cancelable:true});w.document.querySelector('form').dispatchEvent(submit);assert.equal(submit.defaultPrevented,true);
  w.GanguramZone.setSelectedPincode('700006');
  assert.equal(w.document.body.classList.contains('ganguram-product-unavailable'),false);
  assert.equal(w.document.querySelector('[data-ganguram-pa-msg]'),null);
  d.window.close();
});
