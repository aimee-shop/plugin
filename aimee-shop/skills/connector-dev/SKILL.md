---
description: Guide building a Aimee connector -- activity-only workers, ERP sync write surface, conflicts (NetSuite example)
---

# Connector Development

Help the user design a Aimee **trusted connector** or ERP integration worker.
Use NetSuite as the worked example. Ground every contract claim in live docs
via MCP; do not invent endpoints.

## Tools

- `whoami` first if auth/tenant is unclear. Multiple memberships with no
  default fail closed -- ask the user, then set `AIMEE_TENANT` (UUID or slug)
  / optional `AIMEE_STORE` (UUID only) as environment variables for the MCP
  connection (in Claude Code: the project's `.claude/settings.json` `env`
  block; `.env` files are not auto-read), or pass `tenant` / `store` on each
  `use_sdk` call
- `search_knowledge` for app platform and ERP sync docs (fall back to
  https://docs.aimee.shop if offline)
- `introspect_api`, `get_sdk_method`, `get_type_definition` for Core API / SDK
  shapes related to products, orders, inventory, pricing
- No MCP write path for connector deploy. Produce a **connector spec**
  (manifest grants, queue name, activity list, sync contracts) in the workspace.

Prerequisite concepts: the `build-app` skill (`/aimee:build-app`) for
manifests and install lifecycle. Events/webhooks: the `webhooks-events`
skill (`/aimee:webhooks-events`).

## Non-negotiable architecture

1. **Connectors are activity-only workers.**
   - They run on versioned task queues (e.g. `netsuite-v1`).
   - They **never define workflows**. Aimee-owned orchestration owns workflow
     definitions; the connector only implements activities the platform
     schedules.
2. **External systems never call Core API as the merchant.**
   - Provider events enter through the platform webhook / intake path, are
     normalized, and platform workflows perform business writes.
3. **The only machine-write surface in Core API for connector-driven writes**
   is the ERP sync family (permissions are connector-only, not human preset
   roles):

| Endpoint | Permission |
|----------|------------|
| `POST /v1/inventory/sync/erp` | `inventory:erp-sync` |
| `POST /v1/pricing/sync/erp` | `pricing:erp-sync` |
| `POST /v1/orders/sync/erp` | `orders:erp-sync` |
| `POST /v1/products/sync/erp` | `products:erp-sync` |

Auth: installation **app principal** (`x-api-key`) holding only the keys listed
on the connector manifest. Flag any design that uses a human admin key or
service-wide super-admin for business writes.

## Products / pricing / orders response shape

Idempotent upsert/patch semantics. Response shape:

```json
{ "<entity>Id": "...", "action": "created" | "updated" | "noop" }
```

## Inventory batch contract

```
POST /v1/inventory/sync/erp
{
  "storeId": "<uuid optional; body preferred over store header>",
  "items": [
    {
      "locationId": "<Aimee InventoryLocation UUID>",
      "variantId": "<Aimee variant UUID>",
      "quantityOnHand": 0,
      "transactionId": "<optional idempotency key>"
    }
  ]
}
```

Rules:

- Batch size **1..50** items (chunk larger pulls).
- Core API accepts **only Aimee location and variant UUIDs**. Provider location
  IDs are resolved via EntityMapping **before** the sync call (mapping
  ownership is on the platform/orchestration side, not inside Core API).
- When `transactionId` is present, replay is a ledger no-op (at-least-once
  safe). Without it, retries may double-write adjustments -- callers that need
  ledger idempotency **must** send `transactionId`.
- HTTP 200 with partial failures is intentional:
  `{ itemsUpdated, itemsFailed, failures?: [{ variantId, locationId, reason }] }`
  with safe reason codes only.

## Orders contract (critical)

- Orders are born only via **checkout**. `/orders/sync/erp` **never creates**
  an order. Unknown order -> **404**; record a sync failure / conflict.
- NetSuite (and similar ERPs) are **non-authoritative for orders** by default.
- The endpoint accepts **operational subresources only**: fulfillment
  execution status, tracking, provider IDs, `erpOrderId` -- not general
  business field rewrites.
- Authority and conflict policy run in orchestration **before** dispatch;
  Core API validates shape, not ownership policy.

## Conflict model

**Last-write-wins is forbidden.**

Every synchronized record tracks (or references):

- Aimee entity id + revision
- provider record type + internal id
- stable external id
- last source system + source revision / modified timestamp
- last synchronized content hash when applicable

On conflict: emit a **SyncConflict** (both revisions, safe diff summary,
authority policy, status, resolution) for **merchant resolution**. Do not
silently overwrite.

EntityMapping is the authoritative cross-system mapping store; denormalized
provider ids on domain entities (e.g. order `erpOrderId`) are convenience
only and written through the sync surface.

## NetSuite worked example

Walk the user through a minimal NetSuite 1.0-style plan:

1. **Manifest**: surface `trusted-connector-worker`, task queue `netsuite-v1`,
   permission grants limited to the `*:erp-sync` keys actually needed (e.g.
   inventory-only connectors grant only `inventory:erp-sync`).
2. **Auth scheme**: OAuth 1.0 token-based compound credential (account id,
   consumer key/secret, token id/secret) with write-only secrets and a
   connection-test operation.
3. **Discovery** (read-only, async): subsidiaries, locations, item fields,
   currencies, etc. -- snapshots feed mappings, not live Core API writes.
4. **Activities only**: fetch inventory, map locations, push inventory batches
   via `POST /v1/inventory/sync/erp` with mapped Aimee UUIDs + transaction ids.
5. **Orders path**: platform receives SDF/webhook intake, normalizes, runs
   Aimee workflows; connector activities supply provider data but do not
   invent checkout orders.
6. **Authority**: default profiles declare who wins per entity/direction;
   conflicts surface to the merchant UI, never last-write-wins.

## Deliverable

Write a connector design doc in the workspace covering:

- Queue name and major version
- Activity inventory (names + inputs/outputs sketch)
- Manifest permission grants with rationale
- Entity/direction matrix (inventory / products / orders / pricing)
- Conflict and idempotency strategy
- Explicit "out of bounds" list (no workflow defs, no direct product create
  outside sync/erp, no human admin keys for machine writes)

Then run the `app-integration-reviewer` agent against the design and any code.
