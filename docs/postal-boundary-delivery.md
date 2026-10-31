# Geographic Kolkata delivery boundary

The original 20 km circle is centred on the theme's `ganguram_outlet_origin`
(currently latitude 22.586852842169446, longitude 88.37350202482604). A PIN belongs
entirely to **Kolkata** when any part of its filled postal polygon intersects that
circle. Touching the circle counts. The boundary never expands recursively to
neighbouring PINs. Distances use a sphere of radius 6371.0088 km. Google road
distance, bounding boxes, postcode centroids and prefixes do not decide the zone.

`GanguramZone` is the shared classifier for product cards, predictive search,
product pages and cart metadata. Every selected local PIN has `zone: kolkata`;
the old `quick_commerce` zone and handwritten lists are removed. Four-hour
availability is a separate flag requiring a confirmed address distance within
the existing configured express limit, plus the existing cart/time/MOV gates.

## Data and reproducibility

The Department of Posts published *All India Pincode Boundary Geo JSON* in
May 2025: https://www.data.gov.in/catalog/all-india-pincode-boundary-geo-json.
Its release is documented by https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2131707.
Licence: Government Open Data License – India (GODL-India).

The official catalog currently returns “No Result Found”. The downloaded copy is
the `datagov_pincodes` layer distributed by bharatlas/india-geodata:
https://bharatlas.com/view/datagov_pincodes.
Its provenance identifies data.gov.in, 19,312 postal polygons, May 2025. The exact
download URL and SHA-256 are embedded in the generated asset. These are published
postal coverage geometries, not a guarantee of surveyed property boundaries.

Rebuild from the downloaded national GeoJSON, from the repository root:

```
node scripts/build-postal-boundaries.cjs /path/to/Datagov_Pincode_Boundaries.geojson
npm test
```

The generator groups every polygon component by PIN, keeps the entire geometry
of any PIN within 40 km of the extraction centre, and retains a national reference
index. The browser calculates intersection with the original 20 km circle at
runtime, using the actual outlet setting. A changed outlet requires a rebuild
and ShipZip synchronization; an origin mismatch greater than one metre fails
closed instead of allowing the storefront and checkout to disagree. The national source hash and
computed result are in `postal-boundary-result.json`; the latter is an audit
report, not an input allowlist. No customer information is sent to the data host.

Current result: 219 Kolkata PINs, replacing the old 153-entry list (67 added,
one missing from the source). **700098 is absent from this polygon dataset**.
The UI asks customers with a missing PIN to contact the store; it does not call
their PIN invalid or guess PAN India. A newer, complete polygon source is needed
to resolve missing PINs without a manual exception. Refresh the dataset when
India Post publishes corrections/new PINs; rebuild and review the resulting diff.

## Storefront and checkout responsibilities

Predictive product rows are filtered before insertion and removed from keyboard
navigation. Cached search results are re-filtered when the PIN changes. Direct
product pages hide buy buttons and show the unavailable-delivery message for
ineligible products; replaced variant forms remain guarded. Local Delivery tags
are handled consistently with cards.

Delivery-rule matching is scoped to the geographic zone. Neither an exact PIN,
prefix, descriptive state, nor a road-distance slab can switch Kolkata to PAN
India. Prices inside existing distance slabs are retained. The user approved
INR 150 for included Kolkata PINs with driving routes beyond 20 km. Four-hour service requires confirmed
address distance rather than the removed express PIN list.

Theme controls and cart attributes are not server-side checkout enforcement.
ShipZip owns final delivery availability/rates and uses the generated 219-PIN
export in `shipzip-kolkata-postcodes.txt`. A checkout address change
must be revalidated against its actual PIN; browser cart attributes alone cannot
be trusted as proof of delivery eligibility.

Saved ShipZip rules in India zone 13013:

- Standard Delivery 46381: include generated PINs; minimum order INR 300;
  original distance tiers 50/70/100/150; base fallback INR 150; distance <=20
  eligibility condition removed. Existing Quick Commerce rate-removal modifier retained.
- 4 hours delivery 69326: include generated PINs; retain all original product,
  09:00-18:00 time, INR 300 minimum and <=20 km driving-distance conditions.
- West Bengal Shipping 46383: replace 942 manual inclusions with generated
  Kolkata exclusions; require ALL products to have the exact PAN India tag;
  preserve weight-based prices and West Bengal state restriction.
- National Shipping 46382 already requires ALL products tagged PAN India and
  applies outside West Bengal; unchanged.
- Delivery-date locations Beadon Street 38735 (enabled), Core Kolkata 79353,
  South Kolkata 79354 and Suburbs 79355 (disabled) now include the same generated
  table. Their schedules, conditions and enabled states were preserved. Inactive
  Ganguram 38736 had no PIN list and remains unchanged. Shipping/Order Date has
  no enabled postcode condition.

An active hourly Codex follow-up checks origin and boundary data changes, following
`postal-boundary-refresh.md`. This is a scheduled check, not an instantaneous
Shopify webhook, and needs the local app/session and authenticated services to run.

## Validation and rollback

`npm test` covers geometry, holes/multipart polygons, tangent/edge intersection,
non-recursive expansion, all 19,312 reference PINs, source failures, changed store
coordinates, persisted old zones, independent road distance, tariff scoping,
search keyboard navigation and direct/re-rendered product forms.

Before upload, the live theme was backed up separately. Deployment changes only
the listed assets/snippets and `sections/main-product.liquid`; it must not replace
`config/settings_data.json`, homepage templates or the scheduled rollout.

Deployed to live theme 152900763839 on 2026-10-28. All 10 automated tests passed.
Theme Check on the full live-derived theme reports the same pre-existing 1 error
and 48 warnings as the backup; no additions. Preview and live UI verified Rosogolla hidden
for 110001 and purchasable for intersecting PIN 700145. All 15 deployed files were
read back and matched the tested files byte-for-byte. No real order was placed.
