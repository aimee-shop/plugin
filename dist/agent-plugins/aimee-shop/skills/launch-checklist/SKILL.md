---
name: launch-checklist
description: Validate store readiness before going live - checks products, shipping, taxes, and configuration
---

# Aimee Launch Readiness Checklist

You are helping the user verify their Aimee store is ready to launch. Work
through the checklist using the MCP `use_sdk` tool for live reads and
`get_setup_checklist` / `search_knowledge` for guidance.

Sandbox preview and test checkout belong in the `store-builder` skill. This skill is the **separate** go-live handoff.

## Authentication

The MCP server authenticates over OAuth on first use; the agent client
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

## Process

1. **Anchor the checklist**
   - Page `get_setup_checklist` until `nextCursor` is empty.
   - Use structured fields: `schemaVersion`, `catalogVersion`, `live`,
     `complete`, `checkedAt`, `scope`, `coverage`, `items[]` (`id`,
     `requirementLevel`, `status`, `reasonCode`, `guideUrl`,
     `adminRoute`, `nextAction`), `total`.
   - `complete` is report coverage, not go-live or a successful checkout.
   - Never treat `unknown` or `unavailable` as `configured`.
   - These reason codes are not a launch pass: `CHECKOUT_NOT_PROBED`,
     `PAYMENT_API_UNSUPPORTED`, `GO_LIVE_UNKNOWN`, `NO_SAFE_READ`,
     `STATIC_FALLBACK`, `SDK_NOT_ENABLED`.
   - If `live=false` or `AUTH_*` / `SCOPE_*`, repair that before treating
     any required item as configured.

2. **Inspect the store** (read-only `use_sdk` calls when available)
   - Products: `products.list` -- are there products, each with pricing?
   - Shipping: list shipping zones/rates -- at least one zone configured?
   - Taxes: list tax rates -- configured for the selling regions?
   - Store config: `stores.getDefault` or `stores.getByCode` -- name,
     currency, locale set? There is no `stores.get`.
   - If `use_sdk` is unavailable, say so and walk the checklist from
     `get_setup_checklist` plus `search_knowledge` (or the docs host from
     `whoami`).

3. **Report**
   - Present results as a clear pass/fail/unknown checklist.
   - For each failure, explain what is missing, cite `reasonCode` /
     `nextAction` when present, and offer to fix it.

4. **Fix gaps**
   - No products -> the `products` skill (product +
     variant SKU + `pricing.variantPrices.create`)
   - No shipping -> guide zone setup, create via `use_sdk` when available
   - No taxes -> explain options, create rates via `use_sdk` when available

5. **Final steps**
   - A sandbox test checkout (if not already done) is a storefront action,
     not an MCP payment probe. Public SDK 0.0.2 has no payments namespace.
   - Stripe Connect, DNS, 2FA, and production promotion stay **human**.
     Do not auto-promote. Never take a production payment on a sandbox store.
   - Use `search_knowledge` with a deployment query for go-live guides, or
     the docs host from `whoami` if the knowledge tool is offline.

## Tips

- Remind users about SEO: product meta titles and descriptions.
- For a deeper automated pass, you may delegate to `aimee-launch-auditor`
  when that agent exists in this client. If it does not, run this skill
  yourself.
