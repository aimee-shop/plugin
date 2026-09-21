---
description: >
  Interactively set working scope (organization + store) for use_sdk via
  set_scope. Use when the user asks to pick a tenant/store, switch stores
  mid-session, or pin scope by friendly name (for example by running
  /set-scope or /aimee:set-scope in clients with slash commands).
arguments: org store
---

# Set working scope (interactive)

Pin the MCP working scope so every `use_sdk` call is labeled and scoped without
passing tenant/store on each call.

## Prerequisites

- Aimee MCP connected (OAuth). If tools are missing, reconnect the server
  (in Claude Code, run `/mcp`).
- Prefer project header `X-Aimee-Tenant` (or `AIMEE_TENANT`) for a default org.
  **Leave `X-Aimee-Store` / `AIMEE_STORE` unset** so mid-session store pins from
  this skill apply. A store header overrides the pin.

## Arguments (optional fast path)

- `org` (optional): organization name, slug, or id
- `store` (optional): store name, code, UUID, or `all`

Example: the skill invoked with arguments `Acme "Acme Store"` or `Acme all`
(a user may type these as `/set-scope Acme all` in clients with slash
commands).

### When both org and store are provided

Call `set_scope` once with `tenant` = org and `store` = store. Echo the returned
scope one-liner. Do **not** prompt. If the tool cannot resolve a name, report
the error and fall back to the interactive flow below.

### When only one of org or store is provided

Use the given value and prompt only for the missing side (enumerate via
`set_scope` with no arguments if needed).

### When neither is provided

Use the interactive flow below. Auto-select when there is only one org or only
one store; wait for the user only when multiple candidates exist.

## Interactive flow

1. Call `set_scope` with **no arguments** (use `whoami` first only if auth
   is unclear).
2. **Organization**
   - If multiple organizations are listed: present a numbered multi-choice list
     (name + slug/id). Wait for the user to pick one.
   - If only one organization: use it without asking.
3. **Store**
   - Use the stores listed under the chosen org from `set_scope` output
     (name, code, UUID).
   - If multiple stores: present them **plus "All stores"** and wait for a pick.
   - If only one store: select it (brief confirm optional).
   - If enumeration was **denied** (not empty): say so clearly; do not claim
     the user has zero stores. Ask for an explicit UUID only if needed.
   - If truly empty: say none enumerated; still allow explicit UUID if the
     user has one.
4. Call `set_scope` with:
   - `tenant`: chosen org id or slug
   - `store`: chosen store UUID, unique code/name, or `"all"`
5. Echo the returned scope one-liner (e.g. `scope: Acme / Acme Store`).
   Soft notes about tenant headers are expected; do **not** tell the user the
   pin failed when only the tenant header is set.

## Rules

- Never invent store UUIDs.
- Never call `stores.list` for scope setup (org-level `stores:read` gate).
  If enumeration is denied or empty, ask the user for an explicit store UUID
  or fix membership enumeration.
- To clear: `set_scope` with `clear: true`.
- To switch later: run this skill again or call `set_scope` with new
  tenant/store.

## Tools

- `set_scope` -- inspect candidates, pin, clear
- `whoami` -- connection / memberships if needed
- `use_sdk` -- after pin, scoped reads/writes use the pin automatically
