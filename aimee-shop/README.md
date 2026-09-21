# aimee

Agent plugin for building e-commerce stores **and** Aimee apps/connectors.
This directory is the source of truth (path `aimee-shop/` is an internal id);
the Agent Plugins 1.0 (Cursor, Codex, VS Code/Copilot, Kiro) and Grok Build
packagings are generated from it into `dist/` (see the repository README for
per-client install).

On install this plugin connects the agent client to the hosted MCP
server (`https://mcp.aimee.shop/mcp`, a remote Streamable-HTTP server). The
first time a tool is used, the client runs the OAuth flow in your browser
(in Claude Code, run `/mcp` if it does not prompt automatically); tokens are
stored and refreshed automatically. Knowledge tools work without
authentication where the deployment enables them.

## MCP tools

- Always-on identity: `whoami` (connection, **environment**, **docs host**,
  scopes, memberships / tenant resolution). Call this first when you need to
  know whether you are on dev, staging, or prod.
- Working scope: `set_scope` pins tenant + store for subsequent `use_sdk`
  calls. Prefer the `set-scope` skill for an interactive org then store pick.
- Knowledge: `search_knowledge`, `get_sdk_method`, `get_type_definition`,
  `get_setup_checklist`, `introspect_api`. `search_knowledge` may be
  deploy-flag-gated; when offline,
  fall back to the **Docs host from `whoami`** (dev -> docs-dev, staging ->
  docs-staging, prod -> docs) -- never assume production docs from a
  dev-connected session.
- Live store operations: `use_sdk` when enabled (runs any SDK method; reads are
  open, writes prompt for confirmation). Confirm-gated bulk catalog deletes
  use `catalog_bulk_delete`. On knowledge-only deployments both are unavailable.
- Optional project defaults: set `AIMEE_TENANT` (UUID or slug) and
  `AIMEE_STORE` (UUID only) as environment variables for the MCP connection
  (in Claude Code: the project's `.claude/settings.json` `env` block; `.env`
  files are not auto-read). These map to `X-Aimee-Tenant` / `X-Aimee-Store`
  request headers. Or pass `tenant` / `store` on each `use_sdk` call.
  Precedence: tool arg > header > default membership. Call `whoami` first
  when membership is ambiguous.
  **Leave `X-Aimee-Store` / `AIMEE_STORE` unset** if you want mid-session
  `set_scope` store pins (or the `set-scope` skill) to apply; a store header
  wins over the pin.
- Optional endpoint override: set `AIMEE_MCP_URL` the same way to point the
  plugin at a specific gateway (default `https://mcp.aimee.shop/mcp`; dev
  gateway `https://mcp-dev.aimee.shop/mcp`). Useful for pinning a project to
  the dev environment regardless of where the production hostname points.
  Env expansion applies to the Claude Code packaging's `.mcp.json`; other
  packagings pin the default hosted URL (override in your client's MCP
  settings).

## Skills

In Claude Code these are invoked as `/aimee:<name>`; other clients use
their own skill invocation (or the agent picks them up from the request).

### Storefront track

- `store-builder` (`/aimee:store-builder`) - sandbox storefront journey: signup handoff, starter, five products, local preview, test checkout
- `choose-aimee` (`/aimee:choose-aimee`) - platform comparison and first-run auth, signup, scope, checklist
- `setup` (`/aimee:setup`) - set up a new store step by step
- `set-scope` (`/aimee:set-scope`) - interactively pick organization then store (or all stores)
- `scaffold` (`/aimee:scaffold`) - scaffold a storefront from the starter template
- `products` (`/aimee:products`) - bulk-create products
- `integrate-sdk` (`/aimee:integrate-sdk`) - add @aimee.shop/sdk to an existing project
- `launch-checklist` (`/aimee:launch-checklist`) - validate launch readiness
- `search` (`/aimee:search`) - search Aimee docs and SDK reference

### App developer track

- `build-app` (`/aimee:build-app`) - app manifest, distribution tiers, install lifecycle
- `connector-dev` (`/aimee:connector-dev`) - activity-only connectors and ERP sync contracts
- `webhooks-events` (`/aimee:webhooks-events`) - event subscriptions, webhooks, triggers

## Agents

Included in the Claude Code and Grok packagings (Agent Plugins 1.0 does not
carry agents):

- `aimee-integration-reviewer` - reviews @aimee.shop/sdk and @aimee.shop/blocks
  usage in storefront code
- `aimee-launch-auditor` - audits store readiness to go live via live reads
- `app-integration-reviewer` - reviews app/connector designs against platform
  constraints (ERP sync surface, activity-only workers, conflicts, triggers)
