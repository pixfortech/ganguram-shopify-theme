# Manual verification — live URLs (paste your browser output here)

**Why this file exists:** the five URLs below are classified **LIVE_UNVERIFIED — blocked by Claude environment network egress, not proven missing or broken.** The audit environment could not fetch `ganguram.com` (both the page fetcher and a browser-user-agent `curl` returned `Host not in allowlist: ganguram.com`). This is the Claude environment's network egress policy, **not** Shopify, bot-protection, or a missing file.

**Two ways to clear it:**
1. **Add `ganguram.com` to the environment's network egress allow-list**, then ask me to re-run the live audit; or
2. **Open each URL in a browser** (logged out / incognito; if the storefront is password-protected, log in first), copy the response into the matching block below, and send this file back. I will fold the verified results into `AI_DISCOVERY_AND_AGENTIC_STOREFRONT_AUDIT.md`.

**How to capture each one:**
- Plain-text files (`robots.txt`, `agents.md`, `llms.txt`, `llms-full.txt`) display as text — select all, copy.
- `sitemap.xml` displays as XML — copy the visible content (or `Ctrl+U` view-source).
- HTTP status: DevTools (`F12`) → **Network** → click the request → **Status**.

---

## ✅ Verification results — completed by merchant (2026-06-27)

The merchant fetched all five URLs in a browser and provided the bodies. **All returned HTTP 200 and corroborate the audit:**

| URL | Status | Result |
|---|---|---|
| `/robots.txt` | 200 | **PASS** — Shopify-default, AI-open (`User-agent: *` → `Allow: /`), **no AI bot blocked**, `Sitemap:` present, references `/agents.md` + UCP/MCP. No legacy AI-block. |
| `/agents.md` | 200 | **PASS (but generic)** — live, yet the generic Shopify default (UCP/MCP/Shop-skill/policies); no Ganguram brand/collection/delivery content → confirms the `agents.md.liquid` opportunity. |
| `/llms.txt` | 200 | **PASS** — mirrors `/agents.md`. |
| `/llms-full.txt` | 200 | **PASS** — mirrors `/agents.md`. |
| `/sitemap.xml` | 200 | **PASS** — valid index incl. `/sitemap_agentic_discovery.xml` + `/bn/` (Bengali) locale → bilingual, Shopify-managed. |

These results are folded into `AI_DISCOVERY_AND_AGENTIC_STOREFRONT_AUDIT.md` → "Live verification update (merchant-provided, 2026-06-27)". The blank worksheet below is retained for future re-verification.

---

## 1) https://ganguram.com/robots.txt
- **HTTP status:** `[ ___ ]`
- **Check:** loads as plain text; has a `Sitemap:` line; **no** `Disallow: /` under `User-agent: GPTBot` / `OAI-SearchBot` / `ChatGPT-User` / `ClaudeBot` / `PerplexityBot` / `Google-Extended` (i.e. no AI bot blocked). A stale "block all AI" section = a legacy `robots.txt.liquid` to remove.
```
[ paste robots.txt body here ]
```
- **Result (PASS / FAIL + notes):** `[ ___ ]`

---

## 2) https://ganguram.com/agents.md
- **HTTP status:** `[ ___ ]`
- **Check:** loads (200); does it describe Ganguram accurately and the **PAN-India-vs-Kolkata-only** delivery reality? A generic Shopify default = the gap `agents.md.liquid` would fix.
```
[ paste agents.md body here ]
```
- **Result (PASS / FAIL + notes):** `[ ___ ]`

---

## 3) https://ganguram.com/llms.txt
- **HTTP status:** `[ ___ ]`
- **Check:** loads (200); by default mirrors `/agents.md`; confirm content and that UCP / agent-discovery links are present.
```
[ paste llms.txt body here ]
```
- **Result (PASS / FAIL + notes):** `[ ___ ]`

---

## 4) https://ganguram.com/llms-full.txt
- **HTTP status:** `[ ___ ]`
- **Check:** loads (200); fuller variant of `/llms.txt`; same checks.
```
[ paste llms-full.txt body here ]
```
- **Result (PASS / FAIL + notes):** `[ ___ ]`

---

## 5) https://ganguram.com/sitemap.xml
- **HTTP status:** `[ ___ ]`
- **Check:** loads (200); valid sitemap **index** linking `sitemap_products_1.xml`, `sitemap_collections_1.xml`, `sitemap_pages_1.xml`, `sitemap_blogs_1.xml`.
```
[ paste sitemap.xml body here ]
```
- **Result (PASS / FAIL + notes):** `[ ___ ]`

---

## Bonus (2026 agentic endpoints — same egress block; optional but useful)

### 6) https://ganguram.com/.well-known/ucp
- **HTTP status:** `[ ___ ]` — **Check:** JSON manifest; currency **INR**, market **India**, shipping zones correct.
```
[ paste .well-known/ucp body here ]
```

### 7) https://ganguram.com/sitemap_agentic_discovery.xml
- **HTTP status:** `[ ___ ]` — **Check:** the May-2026 agentic discovery sitemap loads.
```
[ paste sitemap_agentic_discovery.xml body here ]
```

---

## 8) `<head>` duplication spot-check (view-source)
Open **view-source** (`Ctrl+U`) on the **homepage**, **one product** and **one collection**, and confirm exactly one of each (this is the only way to confirm whether the Tapita / EComposer **app embeds** inject cross-source schema — see audit §5):

| Page | one `<title>`? | one `<meta name="description">`? | one `<link rel="canonical">`? | duplicate `og:image`? | duplicate Product / Organization JSON-LD? |
|---|---|---|---|---|---|
| Homepage | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| A product | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| A collection | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

- **Notes:** `[ ___ ]`
