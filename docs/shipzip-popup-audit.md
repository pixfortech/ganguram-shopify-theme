# Phase 2.1c — ShipZip Popup Audit (audit-only)

**Question:** Should the "Delivering to…" header widget delegate pincode entry to
ShipZip's existing popup instead of keeping its own form?

**Answer / decision: NO-GO (no code change).** There is **no ShipZip popup in the
4.0 draft to trigger**, and — importantly — even on live 2.3.2 the *header* pincode
popup was the **theme's own modal**, not an app feature. Keep the custom widget as
the header pincode entry + display + sync layer. Revisit only after the
zipLogic/SBZ apps are re-embedded on the draft (a Phase 2.0 prerequisite).

This phase changes no code. Findings only.

---

## 1. Is a ShipZip popup available in the 4.0 draft?

**No.** Verified on `local-4x-migration` HEAD:

| Check | Result |
|---|---|
| ShipZip/zipLogic/SBZ/cirkle code in theme (`*.liquid/js/json/css`) | **none** (only our own files' comments mention "SBZ compatibility") |
| `config/settings_data.json` → `current.blocks` (app embeds) | **0 blocks** |
| `shopify://apps…` app-embed references anywhere | **0** |
| App snippets (`snippets/`) | only `delivery-location-widget.liquid`, `zone-resolver.liquid` (ours) |
| App proxy / app JS (`/a/zipLogic`, `cirkleinc`, `sbzstag`, `csShippingAppV3`) | **none** |

The clean 4.0 theme carries **no** ShipZip/zipLogic/SBZ code and **no** enabled app
embed. (Confirms the Phase 2.0 finding: the whole pincode stack lived only in
2.3.2.)

## 2. How is it loaded? — N/A in 4.0

In **2.3.2** it loaded via **theme snippets** + an app embed:
- `snippets/zipLogic.liquid` — product-page availability form (cookies + `/a/zipLogic` proxy + `shop.metafields.zipLogic.*`).
- `snippets/SbzShippingAppCode.liquid` — SBZ checkout gating / date-slot (`content_for_header contains 'sbzstag'`, `sbz.cirkleinc.com/...csShippingAppV3.js`).

**None of these snippets or embeds exist in 4.0**, so nothing loads today.

## 3. Is a ShipZip popup currently visible/triggerable on the draft? — No

There is no app popup, no app embed, and no app-injected script in the 4.0 theme.
The only pincode UI on the draft is **our** "Delivering to…" widget (PR #17/#19).

## 4. How would one open a ShipZip popup programmatically? — There isn't one

Key correction to the premise: **ShipZip/zipLogic/SBZ never provided a *header*
pincode-entry popup.** On 2.3.2:
- The header pincode entry was the **theme's own modal** — input `#zipp_code` in
  `sections/header.liquid` (custom theme code, with hardcoded zone lists).
- `zipLogic` provided an **inline form on product pages** (not a global header popup).
- `SBZ` provided **checkout-side** date/slot + gating; it only *read* the theme's
  `#zipp_code` value and `localStorage["Zipcode"]`.

So there is no global "open ShipZip popup" function, app event, app block, or
trigger selector to hook — not in 4.0, and not as an app feature in 2.3.2 either.

## 5. Where does ShipZip store the selected pincode?

When the apps are present (2.3.2 reference):
- **zipLogic → cookies:** `zipCodeVal`, `zipCodeStatus`, `zipIs` (PB/CB/NA/global), `availProds*`, `availColls*`; dataset from `/a/zipLogic?action=getZipCodes`.
- **SBZ + theme → `localStorage["Zipcode"]`** (the durable resolved pincode).
- Theme also used `sessionStorage["ZipAdd"]` transiently.

In **4.0 today**, none of these apps run, so the only writer of
`localStorage["Zipcode"]` is **`GanguramZone`** (our resolver).

## 6. Can it sync with `GanguramZone`?

**Yes — through `localStorage["Zipcode"]`.** That is exactly why Phase 2.1a kept
that key as a contract. When zipLogic/SBZ are re-embedded:
- `GanguramZone.setSelectedPincode()` already writes `localStorage["Zipcode"]`, so
  the apps will **consume** the pincode our widget captures (one-way:
  widget → apps).
- There is **no documented app→theme callback/event** to push app-side changes
  back. If the apps ever set the pincode themselves, we'd sync the other way by
  listening to the `storage` event for `"Zipcode"` and calling
  `GanguramZone.setSelectedPincode()` — a tiny, safe future hook (not needed yet,
  since today the widget is the only writer).

## 7. Do SBZ and zipLogic conflict or cooperate?

They **cooperate via the pincode**, on different stores: zipLogic uses **cookies**
for product/collection availability; SBZ uses **`localStorage["Zipcode"]`** for
checkout gating + date/slot. They don't fight over one key. The risk is **state
drift** (cookie vs localStorage vs our snapshot) if multiple writers exist — which
is exactly why we centralise on `GanguramZone` + the `Zipcode` key.

## 8. What should the custom widget become?

**Remain as-is** (entry + display + sync). It must **not** be converted to
trigger-only/display-only or removed, because:
- there is no ShipZip popup to delegate to in 4.0;
- it is currently the **only** pincode entry mechanism on the draft;
- it already does the right minimal job: capture pincode, show zone, mirror
  `localStorage["Zipcode"]`. It does **not** duplicate serviceability/MOV/checkout
  validation (the apps own those).

## 9. How would the header display update after a ShipZip selection?

Today: N/A (no ShipZip popup). For the future, in priority order of safety:
1. **`storage` event** on `"Zipcode"` → `GanguramZone.setSelectedPincode()` (clean, event-driven; works across tabs).
2. Manual sync through `GanguramZone` if we ever add a "change via app" entry point.
3. (Avoid) DOM observation / polling after popup close — fragile; only if 1–2 are impossible.

## 10. Does using ShipZip preserve serviceability / MOV / checkout / date-slot / availability?

- **Today:** N/A — those rules are not present in the 4.0 draft (the apps aren't
  embedded). Our widget deliberately does **not** implement them.
- **Once the apps are re-embedded:** zipLogic preserves **product/collection
  availability**; SBZ preserves **MOV, checkout gating, delivery date/slot**. Our
  widget preserves all of them **by not interfering** — it only writes the pincode
  the apps consume. No duplicate validation, no checkout logic in the theme.

---

## Recommendation for Phase 2.1d

1. **Keep the custom "Delivering to…" widget** as the header pincode entry +
   display, reading/writing only via `GanguramZone`. No conversion, no removal.
2. **Prerequisite (admin task, not theme code):** re-install / enable the
   **zipLogic** and **SBZ** app embeds on the 4.0 draft (flagged in Phase 2.0).
   This is what actually brings back serviceability / MOV / checkout / date-slot /
   availability.
3. **After the apps are embedded, re-audit** (Phase 2.1d): confirm they read
   `localStorage["Zipcode"]`; if needed, add the tiny **one-way `storage`-event
   listener** so the header reflects any app-side pincode change. Still no
   duplicate validation.
4. Do **not** proceed to resolver-driven product/menu/search filtering (Phase 2.3)
   until the app state is confirmed live on the draft.

## GO / NO-GO

- ⛔ **NO-GO** — do not convert the widget into a "ShipZip popup trigger." There is
  no ShipZip popup in the 4.0 draft (and no app-provided header popup ever existed
  to trigger). Building toward a non-existent popup would strand the only working
  pincode entry.
- ✅ **GO** — keep the custom widget as the entry/display/sync layer; treat
  **re-embedding the apps** as the real unblock for ShipZip behaviour; then do the
  small sync hook in 2.1d if required.

*Audit only — no code changed. Theme facts verified on `local-4x-migration`; app
references verified absent; 2.3.2 behaviour cited from `v2.3.2-pre4x`.*
