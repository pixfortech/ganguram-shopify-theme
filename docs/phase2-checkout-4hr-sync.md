# Phase 2 — keeping the checkout 4HR method in sync with the cart

## The problem
The cart can correctly hide **4 Hours Delivery** (outside the time window, outside the radius,
mixed cart, below MOV). But **checkout still shows "4 hours delivery ₹10"** alongside "Standard
Delivery ₹100".

This is expected and **cannot be fixed in the theme alone.** The cart UI is theme JavaScript;
the checkout shipping methods come from **ShipZip / Shopify carrier rates**, which the theme
cannot add to or remove from. Hiding 4HR in the cart does **not** hide the ShipZip checkout rate.

## What the theme already does (the handoff)
When 4HR is unavailable, `ganguram-delivery-method-choice.js` writes these **cart attributes**
(visible on the order and via `/cart.js`):

```
ganguram_preferred_delivery_method = STD
ganguram_preferred_delivery_label  = Standard Delivery
Delivery Method                    = Standard Delivery
```

(When 4HR *is* chosen and available it writes `4HR` / `4 hours delivery`; PAN India → `PAN_INDIA`.)

Confirm on a live cart with `GanguramDeliveryMethodChoice.inspectCartAttributes()` or
`GanguramDeliveryMethodChoice.debugState().attributesSent`.

So checkout has everything it needs to hide the non-selected method — it just needs a checkout-side
rule to act on it.

## How to actually hide 4HR at checkout (pick ONE)

### Option 1 — ShipZip time-window rule on the 4HR rate (simplest if supported)
If your ShipZip / Shipzy plan supports **time-of-day availability** on a shipping rate, set the
**4 hours delivery** rate to the **same window as the theme** so the two never disagree:

| Setting | Value (must match `Ganguram4HourConfig`) |
|---|---|
| Active hours | **09:00 – 18:00** |
| Timezone | **Asia/Kolkata** |
| Active days | same days as the theme (`ganguram_4h_days`) |
| Service area / radius | the **Quick Commerce** pincode set (the 4HR radius) |
| Item eligibility | Quick Commerce only |
| Minimum order | your MOV, if applicable |

Outside those hours ShipZip won't offer the 4HR rate, matching the cart.

### Option 2 — Shopify Delivery Customization Function (works on cart attributes)
If ShipZip **cannot** hide a rate on time/attributes, use a **Shopify Delivery Customization
Function** (Shopify Functions, available on all plans for delivery customizations). It runs at
checkout and can **hide** delivery options. Have it **hide any method whose title is "4 hours
delivery" when** `cart.attribute["ganguram_preferred_delivery_method"] != "4HR"`.

Pseudologic:
```
hideFourHour = cart.attributes["ganguram_preferred_delivery_method"] != "4HR"
if hideFourHour: hide deliveryOption where option.title contains "4 hours"
```
Because the theme already writes `STD` whenever 4HR is unavailable (time/radius/QC/MOV), this keeps
the cart and checkout perfectly in sync without the Function needing to re-implement the time window.

> ⚠️ Do **not** rely on the theme to hide the checkout rate — it structurally cannot. Use Option 1
> or Option 2. The theme's job is to (a) hide 4HR in the cart and (b) write the
> `ganguram_preferred_delivery_method` attribute the checkout rule reads.

## Why a Function (not theme code) is the right place
Theme JS runs on the storefront/cart, not in Shopify's checkout. Only a carrier service (ShipZip)
or a Delivery Customization Function can change which shipping methods appear at checkout. This is a
Shopify platform boundary, not a limitation we can code around in Liquid/JS.
