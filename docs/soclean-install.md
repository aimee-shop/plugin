# SoClean: install the Aimee plugin

Short setup for SoClean developers. Public source:
https://github.com/aimee-shop/plugin

The hosted MCP at `https://mcp.aimee.shop/mcp` currently serves the
preview (dev) environment. OAuth metadata on that host names
`mcp-dev.aimee.shop`. This is not standing production.

## Prerequisites

- Claude Code CLI (current)
- An Aimee login that can see the SoClean org and store
- Do not add a project `.mcp.json` that declares an `aimee` server. That
  collides with this plugin. The SoClean storefront repo relies on the
  plugin, not a project MCP file.

## Install

```bash
claude plugin marketplace add aimee-shop/plugin
claude plugin install aimee@aimee
```

Confirm the cache is `aimee@aimee` **0.0.6**:
`~/.claude/plugins/cache/aimee/aimee/0.0.6`.

## Connect and pick the store

1. In Claude Code, run `/mcp`, select `aimee`, then Authenticate.
2. Sign in with your Aimee login in the browser.
3. Call `whoami`. You should see your identity, scopes, and tenant
   resolution. If `whoami` fails, stop and write support@aimee.shop.
4. Run `/aimee:set-scope` and pick the SoClean organization, then the
   SoClean store.

## First read-only check

Ask: "Using Aimee `whoami` only, what account and store am I connected
to? Do not write."

You should get identity and scope back. No catalog writes in this step.

## Update

```bash
claude plugin marketplace update aimee
claude plugin update aimee@aimee
```

If the version does not change, remove the marketplace and reinstall
from `aimee-shop/plugin`. Cached packs stay silent when the version
number is unchanged.

## Help

support@aimee.shop
