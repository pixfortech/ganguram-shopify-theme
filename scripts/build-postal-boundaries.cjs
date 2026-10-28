// node scripts/build-postal-boundaries.cjs /path/to/Datagov_Pincode_Boundaries.geojson
// Reproducible extraction, NOT a manually maintained delivery pincode allowlist.
const fs = require('node:fs');
const crypto = require('node:crypto');
const geo = require('../assets/ganguram-postal-geometry.js');
const source = fs.readFileSync(process.argv[2]);
const collection = JSON.parse(source);
const settingsText = fs.readFileSync(process.argv[3] || 'config/settings_data.json', 'utf8').replace(/^\/\*[\s\S]*?\*\//, '');
const settings = JSON.parse(settingsText).current;
const latLng = settings.ganguram_outlet_origin.split(',').map(Number);
if (latLng.length !== 2 || !latLng.every(Number.isFinite)) throw Error('Configure numeric outlet latitude,longitude');
const origin = [latLng[1], latLng[0]], coverageKm = 40;
const groups = {};
if (collection.type !== 'FeatureCollection' || collection.features.length < 19000) throw Error('Incomplete national boundary dataset');
for (const f of collection.features) {
  const pin = String(f.properties.Pincode || '').trim();
  if (!/^[1-9][0-9]{5}$/.test(pin)) throw Error('Invalid source PIN');
  if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) throw Error('Non-polygon source');
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const rings of polygons) {
    if (!rings.length) throw Error('Empty polygon');
    for (const ring of rings) {
      if (ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1))) throw Error('Unclosed ring');
      if (ring.some(p => p.length < 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) throw Error('Invalid coordinate');
    }
  }
  (groups[pin] ||= []).push(...polygons);
}
const geometries = {}, report = [];
for (const pin of Object.keys(groups).sort()) {
  const geometry = {type: 'MultiPolygon', coordinates: groups[pin]};
  const km = geo.distanceToGeometry(origin, geometry);
  // Keep ALL parts of each PIN. This matters for disjoint postal areas.
  if (km <= coverageKm) geometries[pin] = geometry;
  if (km <= 20 + 1e-6) report.push({pincode: pin, nearestBoundaryKm: +km.toFixed(6)});
}
const data = {
  version: 1, radiusKm: 20, coverageKm, centre: origin,
  source: 'Department of Posts, All India Pincode Boundary Geo JSON (May 2025)',
  sourceURL: 'https://www.data.gov.in/catalog/all-india-pincode-boundary-geo-json',
  downloadURL: 'https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/postal/boundaries/Datagov_Pincode_Boundaries.geojson',
  licence: 'GODL-India', sourceSHA256: crypto.createHash('sha256').update(source).digest('hex'),
  // National reference index distinguishes an outside PIN from an invalid one.
  nationalPins: Object.keys(groups).sort().join(','), geometries
};
fs.writeFileSync('assets/ganguram-postal-boundaries.js', '/* Generated postal reference data. See docs/postal-boundary-delivery.md. */\nwindow.GanguramPostalBoundaries=' + JSON.stringify(data) + ';\n');
fs.writeFileSync('docs/postal-boundary-result.json', JSON.stringify({origin, radiusKm:20, sourceSHA256:data.sourceSHA256, kolkata:report}, null, 2) + '\n');
fs.writeFileSync('docs/shipzip-kolkata-postcodes.txt', report.map(r => r.pincode).join(',') + '\n');
console.log(JSON.stringify({nationalPins:Object.keys(groups).length, regionalPolygons:Object.keys(geometries).length, kolkataPins:report.length, assetBytes:fs.statSync('assets/ganguram-postal-boundaries.js').size}));
