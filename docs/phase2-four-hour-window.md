# Phase 2 — 4HR time-window visibility & checkout method sync

Hide the **4 Hours Delivery** option in the cart whenever it is outside the configured
delivery window, and keep the persisted checkout method in sync. **No change** to ShipZip
rates, the `4HR`/`STD` service codes, the distance slabs, address/pincode prefill, the
Custom Box Builder, or custom discounts.

## Single source of truth — `window.GanguramFourHour`
New `assets/ganguram-four-hour-window.js`. The cart date picker, the persisted checkout
method and the delivery panel all consult **one** evaluator, so the drawer, the cart page
and the order handoff can never disagree. **4 Hours is available only when ALL hold:**

1. **enabled** — `Ganguram4HourConfig.enabled` (Theme settings → *Ganguram — 4 Hours Delivery* → Enable)
2. **inside the time window** — current time in the configured timezone is within `start`..`end`
3. **inside the 4HR radius** — the `quick_commerce` zone (the same basis ShipZip + the cart handoff use)
4. **every cart item is Quick Commerce eligible**
5. **the cart meets the minimum order value** — only *if* a delivery rule sets one (else N/A)

PAN India never qualifies. `evaluate()` returns `{ enabled, withinTime, currentKolkataTime,
windowStart, windowEnd, withinRadius, cartAllQuickCommerce, movRequired, movMet, visible,
hiddenReason }`. `hiddenReason` is the **first** failing condition, ordered so `outside_time`
is reported only when the cart would otherwise qualify — that is exactly when the
"available between …" message shows.

### Outside the window, the cart now
- **hides the 4 Hours toggle** in the date picker (drawer + page) and the **"4 Hours available"**
  chip / "· 4 Hours: ₹X" estimate in the delivery panel;
- **does not persist 4HR** — `ganguram-delivery-method-choice.js` derives `STD` instead, so an
  open cart that had 4HR selected **auto-switches to Standard** (Standard requires a date);
- shows a small note where the toggle was: **“4 hours delivery is available between 9:00 AM and 6:00 PM.”**
  (`[data-gdd-fourhour-window]`, text built from the configured window so it always matches).

A 30-second watcher fires `ganguram:four-hour-window-changed` when the window opens/closes, so
a cart left open re-evaluates at the boundary (the date picker, method choice and panel listen).

## Config
`snippets/ganguram-4hour-delivery-config.liquid` (`window.Ganguram4HourConfig`, from theme settings):
- `start` (a.k.a. `fourHour.startTime`) — default **`09:00`**
- `end` (a.k.a. `fourHour.endTime`) — default **`18:00`**
- `timezone` (`fourHour.timezone`) — default **`Asia/Kolkata`**
- `enabled`, optional `days`, and `messages.cartTimeWindow` (`"4 hours delivery is available between __START__ and __END__."`)

The evaluator reads `startTime`/`endTime` if present, else `start`/`end`, so both spellings work.

> ⚠️ The cart 4 Hours option now also respects the **Enable** toggle. If *Ganguram — 4 Hours
> Delivery → Enable* is **off**, 4 Hours will not show in the cart either. Turn it on (and set the
> 9:00–18:00 window) for the cart option to appear.

## Date rules (unchanged, re-confirmed)
- **Standard / STD → a date is required** (the date picker softly blocks checkout until one is chosen).
- **4HR → no date / no calendar** (express; clears `Delivery-Date`/`Delivery-Time`).
- **PAN India → no date / no calendar** (the local date picker doesn't render for PAN India).

## Diagnostics
```js
GanguramFourHour.debugState();
// currentKolkataTime, isWithinFourHourTimeWindow, isWithinFourHourRadius,
// cartAllQuickCommerce, finalFourHourVisible, hiddenReason (+ enabled, movRequired/Met, window)
GanguramDeliveryMethodChoice.debugState();  // fourHourVisibleNow, fourHourHiddenReason, currentKolkataTime
GanguramDeliveryProgress.debugState();      // fourHour {…}, plus the MOV-bar movSource (below)
```

## Cart progress (MOV) bar — why it may be invisible, and the fix
The MOV bar renders **only when `st.mov != null`**, and `mov` comes solely from a resolved
`ganguram_delivery_rule` metaobject's **Minimum order value**. So a hidden bar almost always
means the matched rule has **no MOV** (or no rule matches the pincode) — not a markup/CSS bug
(the Phase 1 bordered track is correct, but CSS can't show an element the JS keeps `hidden`).

`GanguramDeliveryProgress.debugState()` now reports **`movSource`**: `'rule'` (from the metaobject),
`'fallback'` (the display-only fallback below), or `'none'` (no MOV anywhere → bar hidden). Use it
to see the real reason.

Two ways to get a visible bar:
1. **Set a Minimum order value on the matching `ganguram_delivery_rule`** (the proper place — it
   also drives the soft below-minimum checkout guard). `movSource: 'rule'`.
2. **`GanguramDeliveryProgressConfig.fallbackMov`** (paise; default `0` = off) in
   `snippets/ganguram-delivery-progress-config.liquid` — a **display-only** fallback that renders the
   bar + "x / y minimum order" summary when the rule omits a MOV. It **never blocks checkout** and
   **never changes the MOV/rate formula**. `movSource: 'fallback'`.

## Tests (DOM-shim, `/tmp`)
- `test-four-hour-window` (41): the 7 scenarios — inside time + eligible → visible; outside time →
  hidden + reason `outside_time` + message; PAN India → no 4HR; non-QC cart → no 4HR; outside radius
  → no 4HR; disabled / below-MOV reasons; **method-choice auto-switches to STD outside the window**;
  **date-picker drawer + page match** (toggle hidden + same message); debugState fields; fail-safe.
- `test-mov-bar` (16): rule-has-no-MOV → bar hidden + `movSource:'none'`; `fallbackMov` → bar shows,
  display-only, **not blocked**; real rule MOV → bar shows **and** blocks below it.
- `four-hour-test`, `datepicker-test`, `test-method-choice`, `mov-test`, `test-cart-estimate`,
  `test-delivery-state` all still pass; the battery's 15 pre-existing failures are unchanged.

> Not claimed "done" from unit tests — please deploy and verify on the storefront: a 4HR-eligible
> cart inside vs outside the window (toggle hides + message + auto-STD), PAN India and mixed carts,
> and the `debugState()` calls. Set a rule MOV (or `fallbackMov`) and confirm the progress bar shows.
