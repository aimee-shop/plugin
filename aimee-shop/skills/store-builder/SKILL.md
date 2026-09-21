---
description: >
  Build a sandbox Aimee storefront from a coding agent: plugin install,
  human signup, whoami, store scope, public starter, five products,
  branding, local preview, and test checkout. Use when the user wants to
  build a store, create a shop, scaffold a storefront, or run a sandbox
  test checkout. Not a no-code hosted builder.
---

# Aimee store-builder journey

One entry workflow. Reuse the module skills named below; do not invent a
second copy of their steps. Result: a real local sandbox preview and a
sandbox test checkout, with explicit human takeovers.

This is not a hosted builder, not automatic go-live, and not marketplace
approval.

## Progress file

In the coding-agent project, persist only non-secret progress at
`.aimee/store-builder-progress.json`:

```json
{
  "schemaVersion": 1,
  "updatedAt": "<ISO-8601>",
  "completed": ["install"],
  "current": "signup",
  "scope": {
    "tenantId": "<uuid-or-omit>",
    "tenantName": "<name-or-omit>",
    "storeId": "<uuid-or-omit>",
    "storeName": "<name-or-omit>"
  }
}
```

Allowed `completed` / `current` ids, in order: `install`, `signup`,
`oauth`, `scope`, `scaffold`, `credentials`, `products`, `branding`,
`validate`, `preview`, `test-checkout`, `optional-hosting`,
`launch-handoff`.

Never store API keys, tokens, cards, cookies, or `.env` values. Do not
commit this file (tenant/store ids are not secrets, but they are local
progress). If the file exists, resume from `current` after re-checking
`whoami` and scope. Wrong tenant/store: stop; do not continue.

## Capabilities and readiness

After OAuth, call `whoami`. Read additive
`structuredContent.capabilities` (`schemaVersion=1`) when present:
`features[]` with `id`, `supportStatus`, `accessStatus`,
`availabilityStatus`, `reasonCode`. `unknown` is never `allowed` or
`available`. Stop on `lookup_failed`.

`scoped_credential_mint` is `unsupported` / `NOT_IMPLEMENTED`: use the
manual admin key-set in the `scaffold` skill (`/aimee:scaffold`). Do not
advertise `merchant_analytics` (`DATA_SOURCE_UNAVAILABLE`).
`storefront_build` as `NOT_ON_THIS_SURFACE` is expected (local scaffold,
not an MCP tool).

Page `get_setup_checklist` until `nextCursor` is empty. Structured fields:
`schemaVersion`, `catalogVersion`, `live`, `complete`, `checkedAt`,
`scope`, `coverage`, `items[]` (`id`, `requirementLevel`, `status`,
`reasonCode`, `guideUrl`, `adminRoute`, `nextAction`), `total`,
`nextCursor`. `complete` is page coverage, not go-live. Never treat
`unknown` or `unavailable` as `configured`. These reason codes are not a
successful checkout or launch pass: `CHECKOUT_NOT_PROBED`,
`PAYMENT_API_UNSUPPORTED`, `GO_LIVE_UNKNOWN`, `NO_SAFE_READ`,
`STATIC_FALLBACK`. If `live=false` or `AUTH_*` / `SCOPE_*` /
`SDK_NOT_ENABLED` / `STATIC_FALLBACK`, repair that before catalog writes. If `use_sdk` or `search_knowledge` is missing, use
the admin UI and the docs host from `whoami`.

Public `@aimee.shop/sdk` 0.0.2 has no payments namespace. Checkout methods
are writes. Do not invent a payment or go-live probe URL.

## Checklist

### 1. `install`

If Aimee MCP tools are missing, install this plugin or add
`https://mcp.aimee.shop/mcp` and finish OAuth. There is no API key in the
plugin. (In Claude Code, run `/mcp` if the client does not prompt.)

### 2-4. `signup` / `oauth` / `scope`

Apply the platform-choice, signup, `whoami`, and scope rules in the
`choose-aimee` skill (`/aimee:choose-aimee`) and the `set-scope` skill
(`/aimee:set-scope`). Then return to this checklist.

Do not continue after an incorrect tenant or store. Confirm the pinned
scope with the user when more than one store exists.

### 5. `scaffold`

Follow the `scaffold` skill (`/aimee:scaffold`) using the public starter
(not a private template). For an existing Next.js app, use the
`integrate-sdk` skill (`/aimee:integrate-sdk`) instead, then return here
at `credentials`.

### 6. `credentials`

Stay on the scaffold skill's manual admin key-set fallback. The human
copies the one-time `.env` block in the admin. Do not print secrets, do
not put `AIMEE_API_KEY` in `NEXT_PUBLIC_*`, and do not commit `.env.local`.

### 7. `products`

Follow the `products` skill (`/aimee:products`) and create **five** real
sandbox products (name, slug, variant SKU, variant price). If `use_sdk`
is unavailable, the human creates them in the admin; do not invent another
write path.

### 8. `branding`

Follow the `setup` skill (`/aimee:setup`) for store name, branding, CMS,
shipping, and tax as needed for a sandbox preview. Re-page
`get_setup_checklist` after writes.

### 9. `validate`

Run this **in the coding-agent project**, not the MCP gateway. Report
pass / fail / unknown with the exact repair:

- Package pair: `@aimee.shop/sdk` and `@aimee.shop/blocks` (currently
  `0.0.2`; recheck with `npm view` if install fails). Fail if
  `@aimee.shop/sdk-platform` is required. Public packages; no npm
  access token.
- `npx tsc --noEmit`. Also `npm run build` when the starter defines it.
- Secrets: `AIMEE_API_KEY` server-only. Inspect git diff, `.env*`, and
  preview config. Fail if a secret is in source, `NEXT_PUBLIC_*`, a
  client bundle, or a public URL.
- Explicit `NEXT_PUBLIC_CORE_API_URL`, `NEXT_PUBLIC_STORE_ID`, and
  sandbox noindex (`NEXT_PUBLIC_NOINDEX` or non-production
  `NEXT_PUBLIC_AIMEE_ENV`).
- Key role is Storefront (Default) on the `sk_` half. Do not mint keys.
- Image / CSP: honor starter `NEXT_PUBLIC_IMAGE_ORIGINS` and restricted
  path notes.
- Catalog lists in the storefront. Cart is reachable. MCP checkout
  `unknown` is not a pass.

### 10. `preview`

`npm run dev` (starter defaults to http://localhost:3010). Confirm the
homepage renders with the five products. This is a local preview, not
public hosting.

### 11. `test-checkout`

Complete a sandbox test checkout in that preview (cart -> checkout).
The human enters any payment details; use test/sandbox only. No live
charges, no real customer email, no unattended promotion. If checkout
cannot finish, record fail or unknown and the cause. Do not treat
`CHECKOUT_NOT_PROBED` as success.

### 12. `optional-hosting`

Optional Vercel (or other) preview. Ask the user to approve the
destination, account, and whether credentials may be stored. Never paste
secrets into prompts, source, client builds, or public URLs. No
third-party credential forwarding, no OAuth-token reuse, no unattended
KYC/legal/payment acceptance. Hosting bills the user's provider account;
state that cost exists, do not invent a price. Skip if they decline.

### 13. `launch-handoff`

Stop. Follow the `launch-checklist` skill (`/aimee:launch-checklist`) as
a **separate** handoff. Stripe Connect, DNS, 2FA, and go-live stay human.
Never take a production payment on a sandbox store.

## Agents

If `aimee-integration-reviewer` or `aimee-launch-auditor` exist in this
client, you may delegate the validate / launch-handoff reads. If they do
not exist, run those steps yourself. Skills must not depend on agents.
