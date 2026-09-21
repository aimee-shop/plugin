---
name: products
description: Bulk product creation workflow
---

# Bulk Product Creation

Create multiple products in batch on a Aimee store via the MCP `use_sdk` tool.

## Authentication

The Aimee MCP server authenticates over OAuth on first use; the agent client
prompts in the browser (in Claude Code, run `/mcp` if not prompted).

Call `whoami` first to confirm connection, scopes, and memberships. If
`whoami` lists multiple memberships and there is no clear default, ask the
user which tenant to work in before any `use_sdk` call. Multi-membership
with no default fails closed with a candidate list (it does not silently
pick the System tenant).

Set a project default with `AIMEE_TENANT` (UUID or slug) and optional
`AIMEE_STORE` (UUID only) as environment variables for the MCP connection
(in Claude Code: the project's `.claude/settings.json` `env` block; `.env`
files are not auto-read). Or pass `tenant` / `store` on each `use_sdk`
call. Precedence: tool arg > header > default membership. Empty header
values are treated as unset.

`use_sdk` may be unavailable on some deployments. If it is offline, stop and
tell the user writes are not available through MCP; point them at the admin
UI and the docs host from `whoami` rather than inventing another write path.

## Steps

### 1. Gather products

Ask the user for their product list. For each product collect:

- **Name** (required)
- **Slug** (required, unique URL slug)
- **SKU** (required, unique; goes on the variant, not the product)
- **Price** (required; confirm the live `CreateVariantPriceDto` shape)
- **productType**: `good` | `service` | `digital` (default `good`)
- **Description** (optional)
- **currencyCode** for the price (store default if known)

Accept products as a list, table, CSV, or one at a time. Confirm field
names with `get_sdk_method` / `get_type_definition` for `CreateProductDto`,
`CreateProductVariantDto`, and `CreateVariantPriceDto` before writing.

### 2. Validate

Before creating, verify:

- Name and slug present; slugs unique in the batch
- SKUs unique in the batch
- Price present
- No duplicate names

Present a summary for confirmation.

### 3. Create

For each product, three writes (each `use_sdk` write confirms):

1. `products.create` with `name`, `slug`, optional `description` and
   `productType`. Do not send SKU or price on this DTO.
2. `variants.createForProduct` with the new product id and `sku`.
3. `pricing.variantPrices.create` with `variantId`, `amount`, and
   `currencyCode`.

Report progress:

- Created: name (SKU)
- Failed: name -- reason (which step)

### 4. Summary

After processing, show total created vs failed, then call `use_sdk` with
`products.list` to confirm they appear in the store. Re-page
`get_setup_checklist` and check `catalog-products` status. `EMPTY` means
keep creating; `unknown` is not success.
