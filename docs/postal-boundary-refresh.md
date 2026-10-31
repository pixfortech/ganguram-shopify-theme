# Refresh procedure

Store: e569b1.myshopify.com; Shopify admin alias: ganguramonline.
Current live theme at installation: 152900763839. Discover current live theme
before future updates. Do not replace the theme, settings or homepage templates.

The user authorized automatic regeneration whenever the outlet or polygon source
changes. Codex heartbeat `refresh-ganguram-delivery-boundary` checks hourly.
Unchanged runs remain quiet; failures and meaningful changes are reported.

1. Pull the current live `config/settings_data.json` into a new temporary folder.
   Read only `current.ganguram_outlet_origin`; never print API keys or other settings.
   Compare coordinates against `docs/postal-boundary-result.json`.
2. Check the source recorded in the generated asset. Prefer the Department of
   Posts catalog when available; the currently used bharatlas mirror is linked in
   `postal-boundary-delivery.md`. Download to a temporary file and compare SHA-256.
   A metadata change alone is not proof of a new polygon dataset. Never use
   geocoder centroids, bounding boxes or road distance as postal boundaries.
3. If unchanged, stop. If changed, preserve the previous data, calculated export,
   affected live theme files and all affected ShipZip rate/date configurations.
4. Run from the repository root:

   `node scripts/build-postal-boundaries.cjs <national-geojson> <fresh-settings-json>`

   The optional settings argument avoids changing the source theme configuration.
   Validate complete polygon data, source provenance and coordinate ranges. Review
   additions/removals against the origin change. Failures or unexplained large
   changes must not replace working production data. Missing PINs stay unknown.
5. Run geometry/resolver/search/product tests. Some integration fixtures pin the
   initial 219 result and Kolkata/Delhi examples; if legitimate source changes alter
   those baselines, review independently calculated results before updating fixtures.
6. In ShipZip India zone 13013, synchronize the exact generated comma-separated
   export in `#zip_codes`: Standard 46381 Include; express 69326 Include; WB
   Shipping 46383 Exclude. Preserve all other rate settings documented in
   `postal-boundary-delivery.md`. Reopen and verify each saved value byte-for-byte
   after trimming whitespace. Do not send private checkout/customer data to a new service.
   Also synchronize the Include PIN lists in Delivery/Pickup Date locations:
   Beadon Street 38735, Core Kolkata 79353, South Kolkata 79354, Suburbs 79355.
   Preserve their enabled states and schedules; 38735 is enabled, the others are
   disabled at installation. Leave empty inactive Ganguram 38736 unchanged.
7. Upload only `assets/ganguram-postal-boundaries.js` to the current live theme
   using Shopify CLI with `--only`, `--allow-live`, `--nodelete`. Verify its hash
   and origin, and representative included/excluded PINs. The storefront rejects
   an origin mismatch over one metre until this synchronized data is deployed.
8. If synchronization fails partway, restore already changed ShipZip lists and
   data from this run's backup; report the precise blocker. Save the new audit
   result and export in Git after success. Preserve scheduled rollouts and tracking.

The app has no polygon-based rate condition, so its PIN table is a generated
integration artifact, not a manually maintained delivery policy. Updating a live
origin and external app rules is not transactional: keep the update window
short and verify the complete set before reporting success.
