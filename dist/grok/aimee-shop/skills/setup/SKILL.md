---
description: Guide through setting up a new Aimee e-commerce store step by step
---

# Aimee Store Setup Wizard

You are helping the user set up a new Aimee e-commerce store. Guide them
through the setup using the Aimee MCP tools.

## Authentication

The Aimee MCP server is a hosted, OAuth-protected service. On first use the
agent client will prompt the user to authenticate in the browser (in Claude
Code, run `/mcp` if it does not prompt automatically). There is no separate
login step inside the tools.

Call `whoami` first to confirm connection, scopes, and memberships. If
`whoami` reports no tenant (`no_memberships`, or memberships empty),
follow the `choose-aimee` skill: open signup
and stop for the human. Do not invent an account. If `whoami` lists
multiple memberships and there is no clear default, ask the user which
tenant to work in before any `use_sdk` call. Multi-membership with no
default fails closed with a candidate list (it does not silently pick
the System tenant).

Set a project default with `AIMEE_TENANT` (UUID or slug) and optional
`AIMEE_STORE` (UUID only) as environment variables for the MCP connection
(in Claude Code: the project's `.claude/settings.json` `env` block; `.env`
files are not auto-read). Or pass `tenant` / `store` on each `use_sdk`
call. Precedence: tool arg > header > default membership. Empty header
values are treated as unset.

## Tools you will use

- `whoami` - confirm connection, scopes, and tenant
- `search_knowledge`, `get_setup_checklist` - guidance and the live checklist
  (`search_knowledge` may be offline; fall back to the docs host from `whoami`)
- `get_sdk_method`, `get_type_definition`, `introspect_api` - inspect contracts
- `use_sdk` - run any SDK method (read/write store data). Look up the live
  name (`stores.update`, `products.create`, `shipping.zones.create`, taxes
  writes). Writes prompt for confirmation. If `use_sdk` is unavailable, guide
  the user through the admin UI and docs instead of inventing a write path.

Start by paging `get_setup_checklist` (`schemaVersion`, `catalogVersion`,
`live`, `complete`, `items[]` with `status` / `reasonCode` / `nextAction`)
until `nextCursor` is empty. `complete` is coverage, not go-live. Never
treat `unknown` or `unavailable` as `configured`. If `live=false` or
`AUTH_*` / `SCOPE_*` / `SDK_NOT_ENABLED` / `STATIC_FALLBACK`, repair that
before writes. For the full sandbox preview and test-checkout path, use
the `store-builder` skill.

## Setup Steps

### 1. Store configuration
- Store name, branding, default currency, default locale
- Apply via `use_sdk` with the relevant `stores.*` method when available

### 2. Products
- Create initial products via `use_sdk` (`products.create`) when available
- Explain `productType` (`good` | `service` | `digital`); SKU lives on the
  variant; price is `pricing.variantPrices.create`
- For bulk entry, hand off to the `products` skill

### 3. Shipping (physical products)
- Explain shipping zones, then create them via `use_sdk` when available

### 4. Taxes
- Explain tax options, then create rates via `use_sdk` when available

### 5. Storefront + next steps
- After writes, re-page `get_setup_checklist` and repair `missing` required
  items. `CHECKOUT_NOT_PROBED` / `PAYMENT_API_UNSUPPORTED` /
  `GO_LIVE_UNKNOWN` / `NO_SAFE_READ` / `STATIC_FALLBACK` are not launch
  passes.
- Recommend the `store-builder` skill for a
  sandbox preview and test checkout, or the `scaffold` skill for the starter only.
- Use the `launch-checklist` skill as a
  separate go-live handoff
- Use `search_knowledge` (or the docs host from `whoami`) for deployment
  guides
