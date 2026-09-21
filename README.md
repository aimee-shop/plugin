# Aimee Agent Plugin

Official Aimee plugin (`aimee`) for AI coding agents.
One skills source ships to every supported client:

- Claude Code (plugin marketplace in this repo)
- Cursor Marketplace / Grok Bot (`.cursor-plugin/plugin.json`)
- Agent Plugins 1.0 clients: Cursor, Codex CLI, VS Code / GitHub Copilot,
  Kiro (`dist/agent-plugins/aimee-shop`)
- ChatGPT / Codex OpenAI adapter (`dist/openai/`, local marketplace)
- Grok Build (`dist/grok/aimee-shop`, marketplace manifest in this repo)

The plugin gives the agent everything it needs to build and operate an Aimee
e-commerce store **and** to design apps and connectors on the Aimee app
platform:

- The hosted MCP server (connected automatically over HTTPS):
  `whoami`, knowledge search (`search_knowledge`), SDK method lookup, API
  introspection, and live store operations (`use_sdk` when enabled)
- Storefront skills: `store-builder`, `choose-aimee`, `setup`, `set-scope`,
  `scaffold`, `products`, `integrate-sdk`, `launch-checklist`, `search`
- App developer skills: `build-app`, `connector-dev`, `webhooks-events`
- Agents (Claude Code and Grok packagings only; Agent Plugins 1.0 does not
  carry agents): `aimee-integration-reviewer`, `aimee-launch-auditor`,
  `app-integration-reviewer`

## Install

### Claude Code

```bash
claude plugin marketplace add aimee-shop/plugin
claude plugin install aimee@aimee
```

### ChatGPT and Codex (OpenAI adapter)

Use the generated OpenAI pack, not the Claude Code source tree.
Codex requires `.agents/plugins/marketplace.json` inside the marketplace
root (a bare `marketplace.json` is not a supported manifest).

```bash
# from a clone of this repository
codex plugin marketplace add ./dist/openai
codex plugin add aimee@aimee
```

Adding the repository root also works; it loads `.agents/plugins/marketplace.json`
which points at `dist/openai/aimee-shop`.

Or install from Codex `/plugins` or ChatGPT desktop Plugins Directory.
First MCP use opens the browser for OAuth. There is no API key in the
plugin. `whoami` requires that OAuth session; unauthenticated `/mcp` is 401.

ChatGPT desktop can also read `.agents/plugins/marketplace.json` in a
checkout of this repo (restart the app after adding it). Do not add a
ChatGPT developer-mode `plugin_asdk_app...` id to this pack; public
submission uses the hosted MCP URL directly.

The portable Agent Plugins package without OpenAI listing metadata remains
at `dist/agent-plugins/aimee-shop`.

Public Git source is https://github.com/aimee-shop/plugin. Clone it, then
add `./dist/openai` or the repository root as above.

This pack is not an approved OpenAI Plugins Directory listing.

### Cursor and Grok Bot

Grok Bot plugins are Cursor marketplace plugins. This repository ships a
Cursor pack at `.cursor-plugin/plugin.json` (skills and MCP pointer from
`dist/agent-plugins/aimee-shop`).

Install from the Cursor Marketplace / Grok Bot Settings -> Plugins once
the listing is live, or add the repository through Customize (Plugins)
or a team marketplace. The Agent Plugins 1.0 package is at
`dist/agent-plugins/aimee-shop` (root `plugin.json`).

The hosted MCP URL is `https://mcp.aimee.shop/mcp` (OAuth; no API key).
**Grok Bot templates do not copy custom MCP URLs.** A Bot shared as a
template must tell copies to install this plugin (or add that MCP URL)
on first run.

To try it: ask the agent to build an online store. It should run the
`store-builder` journey, connect Aimee MCP, run `whoami`, and respect a
platform the user already chose.

### VS Code / GitHub Copilot

Run the "Chat: Install Plugin From Source" command with this repository's
URL, or add the repository under the `chat.plugins.marketplaces` setting.
The package path is `dist/agent-plugins/aimee-shop`.

### Kiro

Copy the skill directories from `dist/agent-plugins/aimee-shop/skills/` into
`.kiro/skills/` (project) or `~/.kiro/skills/` (user), and add the MCP
server from `dist/agent-plugins/aimee-shop/mcp.json` to your Kiro MCP config.

### Grok Build

This repository is also a Grok plugin marketplace
(`.grok-plugin/marketplace.json`). Add it as a marketplace source in Grok
(Grok also reads Claude Code marketplaces directly), then:

```
grok plugin install aimee --trust
```

### Authentication (all clients)

The first time an Aimee MCP tool is used, your client opens the browser for
OAuth (in Claude Code, run `/mcp` if it does not prompt). Tokens are stored
and refreshed automatically. The hosted `/mcp` endpoint requires
authentication; unauthenticated calls return 401. There are no anonymous
knowledge tools on this endpoint.

Requirements:

- An Aimee account for auth and live store operations
- Signup, payment card, and legal terms are human takeovers in the browser
- For the `scaffold` and `integrate-sdk` skills only: follow the skill's
  current package-install steps; `scaffold` uses the public GitHub starter
  (`aimee-shop/storefront-starter`, tag `v0.1.0`)

## Status

Current version is **0.0.3**. Aimee public versions start at 0.0.1; 0.0.2
adds the store-builder journey; 0.0.3 publishes the public GitHub source
and SoClean install steps. If a client still has a 0.5.x Aimee pack
cached, reinstall; 0.0.x is not an older 0.5 release.

Keep these four states distinct. Packaging is not marketplace approval.

- Local / source install: clone this repo and add `dist/openai` (Codex /
  ChatGPT) or the Claude / Cursor / Grok packagings documented above.
- Public GitHub source: `https://github.com/aimee-shop/plugin`. Claude Code
  install is `claude plugin marketplace add aimee-shop/plugin` then
  `claude plugin install aimee@aimee`.
- Production connection: `https://mcp.aimee.shop/health` returns 200;
  unauthenticated `https://mcp.aimee.shop/mcp` returns 401. Health 200 is
  not standing-production proof. OAuth metadata on that host currently
  names `mcp-dev.aimee.shop` (the public host is backed by the preview
  gateway). Do not claim standing production.
- Approved OpenAI directory listing: not submitted. Cursor / Grok Bot
  marketplace listing is separate and not implied by this repo.

Canonical docs host `https://docs.aimee.shop` did not resolve as of
2026-09-18; do not treat it as a working public docs URL until DNS is
live. Site, privacy, and terms: `https://aimee.shop`,
`https://aimee.shop/privacy`, `https://aimee.shop/terms`.

All packagings connect to the hosted MCP gateway at
`https://mcp.aimee.shop/mcp`.

## Internal / preview gateway

Public installs use `https://mcp.aimee.shop/mcp`. The preview gateway at
`https://mcp-dev.aimee.shop/mcp` remains available for internal engineering.

To point a client at the preview host instead of that URL, add an HTTP
MCP server in your client's own MCP settings (this overrides or supplements
the plugin pointer depending on how you name the server):

```json
{
  "mcpServers": {
    "aimee-dev": {
      "type": "http",
      "url": "https://mcp-dev.aimee.shop/mcp"
    }
  }
}
```

Use a distinct server name such as `aimee-dev` if you still need the
plugin `aimee` server. Alternatively, clone this
repository locally, set the packaging's MCP config to the preview URL, and
install from the local path. There is no separate public marketplace entry
for the preview host.

## Docs and support

- Documentation: https://docs.aimee.shop
- Support: support@aimee.shop
- SoClean developer install: [docs/soclean-install.md](docs/soclean-install.md)
- Internal dogfood script (contributors): [docs/dogfood-test.md](docs/dogfood-test.md)

## What's in this repo

```
.claude-plugin/marketplace.json   -- Claude Code marketplace (slug: aimee, plugin: aimee)
.grok-plugin/marketplace.json     -- Grok marketplace manifest (generated)
.cursor-plugin/plugin.json        -- Cursor / Grok Bot marketplace pack (generated)
.agents/plugins/marketplace.json  -- ChatGPT desktop / Codex repo marketplace (generated)
aimee-shop/                       -- SOURCE OF TRUTH for all packagings
  .claude-plugin/plugin.json      -- plugin manifest
  .mcp.json                       -- remote pointer to the hosted MCP server
  skills/                         -- guided skills (storefront + app developer)
  agents/                         -- review and audit agents
  assets/                         -- listing logo and composer icon
scripts/build-packagings.mjs      -- generates dist/ + marketplace packs from aimee-shop/
scripts/publish-github.sh         -- publish canonical main to the public GitHub repo
dist/agent-plugins/aimee-shop/    -- GENERATED Agent Plugins 1.0 package
dist/grok/aimee-shop/             -- GENERATED Grok Build package
dist/openai/                      -- GENERATED ChatGPT/Codex adapter + submission notes
docs/                             -- SoClean install, contributor dogfood
```

Edit skills and agents only under `aimee-shop/`, then run
`node scripts/build-packagings.mjs` and commit the regenerated outputs. CI
fails if the generated packagings are stale.

There is no local runtime to install -- every packaging points at the hosted
MCP server over HTTPS and the client handles OAuth.

## Release

Publish the public GitHub repository only from a clean checkout of canonical
main, after that pipeline is green:

```bash
scripts/publish-github.sh
```

`scripts/publish-github.sh --check` runs the same checks and does not push.
The script uses the existing GitHub SSH login. It refuses a dirty tree, a
commit that is not `origin/main`, and a non-fast-forward update.

This GitHub repository is the public publish target. Issues are disabled.
Questions and bug reports: support@aimee.shop.
