# Cart delivery choice → checkout (hide non-selected methods) — Phase 2.12H

**Goal:** the customer chooses the delivery method **once in the cart**; checkout then shows **only that method**, so Shopify effectively auto‑selects it and there is no "choose twice" hassle.

**Why this is split in two:** theme JS **cannot** auto‑select a Shopify checkout shipping method (checkout is Shopify‑hosted; theme assets don't run there). The supported workaround is:

1. **Theme** saves the chosen method as a **cart attribute** (this PR).
2. A **Delivery Customization** at checkout — a **Shipzy rule** (no code) **or** a **Shopify Delivery Customization Function** — reads that attribute and **hides every non‑selected method**.

This repo ships step 1 + this guide for step 2. Step 2 (the Shipzy rule, or the Function) is configured/deployed outside the theme.

---

## 1. The cart‑attribute contract (what the theme writes)

`assets/ganguram-delivery-method-choice.js` mirrors the chosen method into two cart attributes:

| Attribute | Values |
|---|---|
| `ganguram_preferred_delivery_method` | `STD` · `4HR` · `PAN_INDIA` · *(empty = no selection)* |
| `ganguram_preferred_delivery_label` | `Standard Delivery` · `4 hours delivery` · `PAN India Shipping` · *(empty)* |

The label is configurable in `snippets/ganguram-delivery-method-choice-config.liquid` — **set it to your exact ShipZip rate names** so the Delivery Customization can match on the label if needed.

**How the method is derived** (no second selector — it reuses the existing cart UI, so the two can never disagree):

| Selected pincode zone | Date‑picker toggle | → method |
|---|---|---|
| local (Kolkata / quick‑commerce) | Standard (default) | `STD` |
| local + **all items Quick Commerce** + quick‑commerce zone | **4 Hours** | `4HR` |
| PAN India | *(no local picker)* | `PAN_INDIA` |
| not serviceable / blocked / no pincode | — | *(cleared — empty)* |

The choice for local Standard‑vs‑4 Hours is the customer's click on the existing date‑picker **Standard / 4 Hours** toggle.

## 2. Checkout behaviour the attribute should drive

| `ganguram_preferred_delivery_method` | Show | Hide |
|---|---|---|
| `STD` | Standard Delivery (date required) | 4 hours delivery · PAN India Shipping |
| `4HR` | 4 hours delivery (no date) | Standard Delivery · PAN India Shipping |
| `PAN_INDIA` | PAN India Shipping (no local date) | Standard Delivery · 4 hours delivery |
| *(empty / absent)* | **everything** — do **not** over‑hide | *(nothing — fall back to ShipZip)* |

## 3. Date requirement (already handled by the theme)

- **STD** → the local date picker still **requires a date** before checkout (unchanged).
- **4HR / PAN India** → the theme **clears** the `Delivery-Date` / `Delivery-Time` cart attributes so a stale local date can't ride along, and the date picker shows no date requirement.

If the choice becomes invalid because the pincode/cart changed, the theme re‑derives and re‑persists, and shows a soft **"please review your delivery method"** notice (never blocks checkout).

---

## 4. Step 2, option A — Shipzy Delivery Customization rule (no code)

**First, confirm Shipzy can read cart/order attributes.** In the Shipzy (Shipping Rates / Delivery Customization) app, open a customization/rule and look at the available **condition** types for something like **"Cart attribute"**, **"Order attribute"**, **"Note attribute"**, or **"Cart custom attribute"**. Shopify exposes cart attributes to delivery‑customization functions as order/cart attributes, and most rate apps surface them as a condition.

**If the condition exists**, create rules keyed on `ganguram_preferred_delivery_method` (match the rate names to your exact ShipZip titles):

| Rule | Condition | Action |
|---|---|---|
| A | attribute `ganguram_preferred_delivery_method` **is** `STD` | **Hide** `4 hours delivery`, **Hide** `PAN India Shipping` |
| B | attribute … **is** `4HR` | **Hide** `Standard Delivery`, **Hide** `PAN India Shipping` |
| C | attribute … **is** `PAN_INDIA` | **Hide** `Standard Delivery`, **Hide** `4 hours delivery` |

No rule matches when the attribute is empty → **nothing is hidden** → ShipZip's normal rates show (requirement 4 — no over‑hiding). No custom app needed.

> Keep the ShipZip **rate amounts, the `4HR`/`STD` service codes, and the distance tiers unchanged** — these rules only **hide** options, they never change a rate.

## 5. Step 2, option B — Shopify Delivery Customization Function (if Shipzy can't)

If Shipzy **cannot** read cart attributes in its conditions, build a small **Delivery Customization Function** (a Shopify Function, deployed from a Shopify **app**, not from this theme). It is intentionally **not** in this repo yet (pending the Shipzy check). Spec to implement:

- **Extension:** `delivery customization` (target `purchase.delivery-customization.run`), created with `shopify app generate extension`.
- **Input query** (`run.graphql`): read the cart attribute + each delivery option's title/handle.
  ```graphql
  query RunInput {
    cart {
      attribute(key: "ganguram_preferred_delivery_method") { value }
      deliveryGroups {
        deliveryOptions { handle title }
      }
    }
  }
  ```
- **Logic** (`run` — pseudocode):
  ```js
  const preferred = input.cart.attribute?.value; // "STD" | "4HR" | "PAN_INDIA" | null
  if (!preferred) return { operations: [] };      // requirement 4: hide nothing
  const KEEP = {
    STD:       t => /standard/i.test(t),
    "4HR":     t => /4\s*hour|four\s*hour/i.test(t),
    PAN_INDIA: t => /pan\s*india|^shipping$/i.test(t),
  }[preferred];
  const operations = [];
  for (const g of input.cart.deliveryGroups)
    for (const o of g.deliveryOptions)
      if (!KEEP(o.title)) operations.push({ hide: { deliveryOptionHandle: o.handle } });
  return { operations };
  ```
  Match the `KEEP` patterns to your exact ShipZip rate titles. Empty attribute → `{ operations: [] }` (no hiding).
- **Deploy:** `shopify app deploy`, then in Admin → Settings → Shipping and delivery → **Delivery customizations**, add the function.

The theme already writes the attribute the function reads, so no theme change is needed to switch from Shipzy rules to the Function.

---

## 6. Cart ↔ checkout consistency & guardrails

- **One chooser.** The method comes from the existing date‑picker toggle + zone, so the cart never shows two competing selectors. The cart attribute is what checkout reads, so they can't disagree.
- **Reset on change.** A pincode/cart change re‑derives the method; an invalidated choice is reset (and, when it changes, the review notice appears).
- **Fail‑open.** Any Ajax error is silent; nothing is blocked. With no attribute, checkout is **not** over‑hidden.
- **No change to:** ShipZip rate amounts, the `4HR`/`STD` service codes, the distance slabs, product eligibility, the pincode resolver, MOV, the unavailable‑items modal, the Custom Box Builder, or any date‑picker attribute **names** (the date keys are **read** from the date‑picker config, never renamed). `settings_data.json` untouched.

## 7. Diagnostics

`window.GanguramDeliveryMethodChoice.debugState()` (console, cart page) → the selected zone, `cartAllQuickCommerce`, the `datePickerType`, the derived `preferredMethod` + `preferredLabel`, and the exact `attributesSent`. `getPreferred()` returns `{ code, label }`.
