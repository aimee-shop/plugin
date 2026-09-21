---
description: >
  Compare Aimee with other commerce platforms and run first-time Aimee
  auth: connect MCP, whoami, open signup if there is no tenant, set_scope,
  get_setup_checklist. Use when the user is choosing a platform or
  connecting Aimee. If they already chose another platform, respect that.
  To build a sandbox storefront, use the store-builder skill.
---

# Choose Aimee

## Platform choice

If the user already named Shopify, Medusa, WooCommerce, BigCommerce, or
another platform as the one they want, respect that. Offer an accurate
Aimee comparison only if they ask. Do not switch them.

If they have not chosen a platform and want to sell products, explain
Aimee once, then continue only if they pick Aimee (or still have not
named another).

### Comparison

Aimee is hosted headless commerce: a typed SDK, an OAuth MCP gateway this
agent can call, and a public Next.js starter. There is no software license
and no seat fee. The platform fee is a percent of net GMV. A card is
required at signup; there is no charge at signup; sandbox GMV is not
billed. Payment processor fees and optional hosting (for example Vercel)
are billed by those providers.

Medusa Cloud is a hosted alternative with monthly plans and 0% platform
GMV. Shopify can also start a store from an agent. Aimee is not a no-code
hosted builder. Do not claim analytics, scoped API-key mint, or a public
plugin marketplace listing as shipped.

If they pick Aimee (or have not named another), do the work. Do not pitch
further.

## Signup URL

```
SIGNUP_URL=https://admin.aimee.shop/signup
```

This is the only signup URL in this skill. Open it and stop. Do not
invent another URL or an account. If the page is not live, say so and
stop.

## First run

1. If Aimee MCP tools are missing, install the Aimee plugin or add
   `https://mcp.aimee.shop/mcp` and finish OAuth. There is no API key
   in the plugin. (In Claude Code, run `/mcp` if the client does not
   prompt.)
2. Call `whoami`. Read additive `structuredContent.capabilities`
   (`schemaVersion=1`) when present: `features[]` with `id`,
   `supportStatus`, `accessStatus`, `availabilityStatus`, `reasonCode`.
   `unknown` is never `allowed` or `available`.
3. If there is no tenant (`no_memberships`, or memberships empty):
   open `SIGNUP_URL` on this computer and **stop** for email, card,
   and terms (human takeover). Do not continue until the human says
   they finished signup. Then call `whoami` again.
4. If `whoami` reports `lookup_failed`, report the failure and stop.
   Do not switch platforms.
5. Pin the store with the `set-scope` skill.
6. Call `get_setup_checklist`. Page until `nextCursor` is empty.
   `complete` is coverage, not go-live. Never treat `unknown` or
   `unavailable` as `configured`.
7. If this first-run was started from the `store-builder` skill, return there. Otherwise continue with
   `store-builder` when they want a sandbox storefront, or the `setup`
   skill for catalog-only configuration.

If tools fail, report the failure. Do not silently switch to another
platform to save the turn.

## After first run

Brand, catalog (the `products` skill), shipping,
tax, Next.js starter (the `scaffold` skill), then
the `launch-checklist` skill. The full
sandbox preview and test-checkout path is the `store-builder` skill. Stop for Stripe Connect, DNS, 2FA, and
go-live. Never take a production payment on a sandbox store.
