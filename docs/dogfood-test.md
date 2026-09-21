# aimee dogfood test (0.0.3)

Internal readiness script for the Claude plugin. Run against a clean Claude
Code profile when possible. Record every failure or gap and open a follow-up
(support@aimee.shop for public channel, or your team's issue tracker).

`search_knowledge` and `use_sdk` may be flag-gated on a given gateway
deployment. Mark those steps **degraded** and continue; do not block the whole
run on write-path availability.

## 1. Clean install and auth

1. Remove any prior aimee / aimee marketplace/plugin if present.
2. Install:

```bash
claude plugin marketplace add aimee-shop/plugin
claude plugin install aimee@aimee
```

3. Confirm cache serves **0.0.3** and that both
   `aimee-shop/.claude-plugin/plugin.json` and
   `.claude-plugin/marketplace.json` report the same version.
4. Trigger OAuth (any tool or `/mcp`).
5. Call `whoami` -- expect verified identity, scopes, and tenant resolution
   state. Fail the run if OAuth or `whoami` cannot complete.

## 2. Storefront track

| Step | Action | Pass criteria |
|------|--------|----------------|
| 2.0 | `/aimee:store-builder` on "build me a store" | Entry journey; respects a user-selected other platform; signup stop; public starter; no npm token; progress file has no secrets |
| 2.0b | `/aimee:choose-aimee` when choosing a platform | Accurate fee/capability comparison; `whoami`; signup stop if no tenant; then set_scope + checklist |
| 2.1 | `/aimee:search` with a products query | Uses `search_knowledge` (or docs fallback); never the retired docs-search tool name |
| 2.2 | `/aimee:scaffold` into a temp dir | Public `v0.1.0` tarball or clone; colliding project `.mcp.json` dropped; env guide shown; no npm token |
| 2.3 | `/aimee:integrate-sdk` on a sample Next app | Install + client setup steps; SDK lookups via `get_sdk_method` / types |
| 2.4 | `/aimee:products` against a dev tenant | Creates products via `use_sdk` **or** clearly reports use_sdk offline |
| 2.5 | `/aimee:launch-checklist` | Checklist anchored; pass/fail report; degrades if live reads offline |
| 2.6 | Optional: invoke `aimee-launch-auditor` | Read-only audit; no writes |

## 3. App developer track

| Step | Action | Pass criteria |
|------|--------|----------------|
| 3.1 | `/aimee:build-app` for a fictional tenant-private app | Manifest outline, install session states, least-privilege permissions, `/v1/apps` contract references only |
| 3.2 | `/aimee:connector-dev` NetSuite-style inventory connector | Activity-only, queue name, only `POST /v1/*/sync/erp`, batch <=50 + transactionId, no last-write-wins |
| 3.3 | `/aimee:webhooks-events` for the same app | Triggers are event/schedule/webhook/manual only; HMAC; suspend semantics |
| 3.4 | Run `app-integration-reviewer` on the produced specs | Findings reference real constraints; ready/not-ready verdict |

Produce a **minimal test connector spec** as the main artifact (markdown in the
workspace): manifest grants, task queue, activity list, inventory sync body
example, conflict policy. Live connector deploy is out of scope for this
dogfood.

## 4. Negative checks

- Grep the plugin checkout (or installed cache) for the retired docs-search
  tool name (`search_` + `docs`) -- must be empty.
- Confirm no skill instructs calling a non-existent MCP tool name.
- Confirm client-facing files do not embed private infrastructure hostnames
  beyond documented `mcp.aimee.shop` / `mcp-dev.aimee.shop` / `docs.aimee.shop`.

## 5. OpenAI local pack (optional)

Not a directory listing check. From a clone of this repo:

```bash
codex plugin marketplace add ./dist/openai
codex plugin add aimee@aimee
```

Confirm Codex lists `aimee` from that marketplace at **0.0.3**, MCP URL is
`https://mcp.aimee.shop/mcp`, and first tool use prompts OAuth. Call `whoami`
only after OAuth completes. If ChatGPT desktop or OAuth is unavailable, record
that environment gap; do not treat it as pack failure.

## 6. Close-out

For each gap:

1. Severity (blocking / non-blocking)
2. Repro steps
3. Owner suggestion (plugin content vs gateway vs docs)
4. Follow-up ticket or support@aimee.shop note

The 0.0.2 two-client record is `docs/store-builder-exercise.md`. Public
signup/docs/MCP OAuth gates stay on that record; do not treat a green pack
build as a completed cold-user journey.

Sign-off when sections 1-3 complete (degraded write steps allowed if labeled)
and section 4 is clean. Section 5 is optional and may be labeled skipped.
