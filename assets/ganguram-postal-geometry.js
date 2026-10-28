/* Spherical distances in km; GeoJSON coordinates are [longitude, latitude].
 * A postal area qualifies if its filled polygon intersects the ORIGINAL circle.
 * Holes and every part of a MultiPolygon are respected. No neighbour expansion.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GanguramPostalGeometry = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var R = 6371.0088, DEG = Math.PI / 180;
  function vector(p) {
    var a = p[0] * DEG, b = p[1] * DEG;
    return [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)];
  }
  function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
  function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function angle(a, b) { return Math.atan2(norm(cross(a, b)), dot(a, b)); }
  function distance(a, b) { return angle(vector(a), vector(b)) * R; }
  function segmentDistance(p, a, b) {
    var av = vector(a), bv = vector(b), pv = vector(p);
    var n = cross(av, bv), n2 = dot(n, n), ab = angle(av, bv);
    var best = Math.min(angle(pv, av), angle(pv, bv));
    if (n2 < 1e-24) return best * R;
    var t = dot(pv, n) / n2;
    var q = [pv[0]-t*n[0], pv[1]-t*n[1], pv[2]-t*n[2]], len = norm(q);
    if (len < 1e-12) return best * R;
    q = q.map(function (v) { return v / len; });
    if (angle(av, q) + angle(q, bv) <= ab + 1e-10) best = Math.min(best, angle(pv, q));
    return best * R;
  }
  // GeoJSON linear-ring containment. India has no antimeridian-crossing rings.
  function inRing(p, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i], b = ring[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside = !inside;
    }
    return inside;
  }
  function polygonDistance(p, rings) {
    if (inRing(p, rings[0]) && !rings.slice(1).some(function (r) { return inRing(p, r); })) return 0;
    var min = Infinity;
    rings.forEach(function (ring) {
      for (var i = 1; i < ring.length; i++) min = Math.min(min, segmentDistance(p, ring[i-1], ring[i]));
    });
    return min;
  }
  function distanceToGeometry(p, geometry) {
    if (!geometry || !Array.isArray(geometry.coordinates)) throw new Error('Missing postal geometry');
    var polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : null;
    if (!polygons || !polygons.length) throw new Error('Unsupported postal geometry');
    return Math.min.apply(null, polygons.map(function (rings) { return polygonDistance(p, rings); }));
  }
  return { distance: distance, distanceToGeometry: distanceToGeometry };
});
