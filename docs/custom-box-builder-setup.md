# Custom Sweets Box Builder — Setup (Phase 2.12A)

Lets a customer compose a **Custom Sweets Box**: pick a column count (4/5/6), choose one sweet per slot, optionally fill the rest, see a **live total**, and add the whole box to the cart as **grouped lines**.

## Pricing is Shopify‑safe (not fake JS pricing)
Every selectable item links a **real Shopify product/variant**. The config price comes from Liquid `variant.price`, the live total is a **preview built from those real variant prices**, and add‑to‑cart adds **one real‑variant line per slot** — so Shopify computes the real price, weight and tax at checkout. The JS never invents a price.

## Data model / config approach
A theme **section** (`sections/ganguram-box-builder.liquid`) publishes `window.GanguramBoxBuilderConfig` from its **blocks**, so it is admin‑managed in the theme editor (no app code):

- **Section settings:** enable, heading/subheading, box name, allowed column counts (`4,5,6`), default columns, currency symbol, labels.
- **Item blocks** (one per option): `active`, **linked product** (real price/variant), display‑name override, **quantity label** (e.g. `x 10`), image override, sort order.

Each item resolves to:
```
{ id, variantId, displayName, qtyLabel, price (variant.price, paise), image, handle,
  available, kolkata, panIndia, quickCommerce, localDelivery (from product tags), sort }
```
The pure mapping/controller lives in `assets/ganguram-box-builder.js` (`window.GanguramBoxBuilder`).

## Admin setup required
1. Create the visible parent product **Custom Sweets Box** (tags may be `Box Builder`, `Local Delivery`, `Kolkata` — but **final eligibility comes from the selected items**, not this tag).
2. Create/choose a **real product/variant per box item** (Kaju Barfi, Mihidana Laddu, …) with its own price, weight, tax and **delivery tags** (`Kolkata` / `PAN India` / `Quick Commerce` / `Local Delivery`).
3. Add the **Custom Sweets Box** section to the parent product's template and add an **item block per option** (link the product, set the quantity label). Set allowed columns + default.

## Add‑to‑cart payload
One line per slot, each the real variant + grouping properties (underscore‑prefixed = hidden in the cart UI; surfaced by the grouping module):
```json
{ "items": [
  { "id": <variantId>, "quantity": 1, "properties": {
      "_ganguram_box_id": "box-…",           // shared group key (one per box instance)
      "_ganguram_box_parent": "Custom Sweets Box",
      "_ganguram_box_columns": "4",
      "_ganguram_box_slot": "1",
      "_ganguram_box_name": "Custom Sweets Box",
      "_ganguram_box_item": "Kaju Barfi x 10",
      "_ganguram_box_qty_label": "x 10",
      "_ganguram_box_composition": "Slot 1: Kaju Barfi x 10 · Slot 2: …"
  } }, … ] }
```

## Cart grouping behaviour
`assets/ganguram-box-cart-group.js` (loaded globally) brackets the consecutive lines sharing a `_ganguram_box_id` (stamped onto the cart line as `data-ganguram-box-id` in the cart‑form snippets) with:
- a **header** — *Custom Sweets Box · 4 Columns*,
- a **Slot N** badge per line,
- a **footer** — *Box total: ₹X* (summed from the rendered `final_line_price`) + a **Remove box** button that sets every line in the group to `0` via `/cart/update.js`.
It re‑runs on cart re‑render (disconnecting its observer while it mutates, so it never loops) and never touches non‑box lines.

## Delivery eligibility handling
Computed from the **selected items**, reusing `window.GanguramZoneRules.isProductDeliverableToZone` (the SAME rule as cart eligibility / product visibility):
- **all Quick Commerce + quick‑commerce pincode →** 4‑hour allowed.
- **all Local Delivery →** local Standard.
- **all PAN India →** PAN India.
- **any local‑only item →** box not PAN‑India‑eligible (that item isn't deliverable to a PAN India pincode → box blocked).
- **any item unavailable for the selected pincode →** add‑to‑cart is disabled with a clear message.
No pincode selected → never blocks (resolved later by cart eligibility).

### Validation messages
- *Please select items for all columns.*
- *This item is currently unavailable. Please choose another item.*
- *This box is not available for the selected pincode.*
- *Your box price has changed. Please review before adding to cart.* (copy provided; the guarantee is that checkout always uses the real variant price.)

## Guardrails
No change to **ShipZip rates, the `4HR`/`STD` service codes, the delivery‑estimate logic, the pincode resolver, MOV, or the date‑picker attributes.** The only cart‑eligibility‑adjacent change is the cart‑form stamping `data-ganguram-box-id` (+ price/slot) to support grouped box lines safely. Theme variables only (no hardcoded colours); mobile‑first; accessible selects/buttons. ShipZip remains the final checkout rate.
