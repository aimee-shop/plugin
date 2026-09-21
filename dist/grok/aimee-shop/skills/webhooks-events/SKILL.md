---
description: Guide event subscriptions, webhook intake (HMAC), trigger types, and suspension semantics
---

# Webhooks and Events

Help the user design event-driven integration with Aimee apps and workflows:
subscriptions, webhook intake, trigger taxonomy, and suspend behavior.

## Tools

- `whoami` first if auth/tenant is unclear. Multiple memberships with no
  default fail closed -- ask the user, then set `AIMEE_TENANT` (UUID or slug)
  / optional `AIMEE_STORE` (UUID only) as environment variables for the MCP
  connection (in Claude Code: the project's `.claude/settings.json` `env`
  block; `.env` files are not auto-read), or pass `tenant` / `store` on each
  `use_sdk` call
- `search_knowledge` for current event catalogs and webhook docs (fall back to
  https://docs.aimee.shop if offline)
- `introspect_api` when exploring domain APIs related to subscribed resources

## Trigger types (platform taxonomy)

Supported **trigger** types:

- **event** -- platform domain event
- **schedule** -- cron/cadence based
- **webhook** -- external HTTPS callback into the platform
- **manual** -- operator- or API-initiated run

**Daemon is not a trigger.** "Daemon" only describes deployment metadata for
a long-lived worker process. Do not invent a daemon trigger type in manifests
or designs.

Trigger, runtime, and deployment mode are independent axes. A webhook-triggered
flow may still run as Aimee orchestration with connector activities on a
versioned task queue.

## Event subscriptions

Manifests declare events with:

- event type and schema version
- delivery schema
- required permission
- optional filter schema
- ordering key when needed
- replay support and retention class

At install/activation the platform materializes **EventSubscription** records
from the granted permissions and declared events. Runtime tokens only include
**granted** permissions, not every permission in a newer manifest.

When designing outbound deliveries to a merchant or partner URL, destinations
must be declared (HTTPS origin/path policy, purpose, data classification).
Hosted functions have no undeclared network access.

## Webhook intake

Inbound provider webhooks:

- Are scoped to tenant and, where applicable, installation
  (e.g. provider-specific paths under `/webhooks/...`).
- **Must verify authenticity** (HMAC or provider-equivalent signature) before
  processing. Reject missing/invalid signatures; never process first and
  verify later.
- Should acknowledge quickly; long provider work belongs in async operations /
  workflows, not the HTTP request thread.
- Feed **normalized** platform events; connector workers stay activity-only
  (see the `connector-dev` skill).

Outbound Aimee-to-merchant webhooks (when the product surface exposes them)
should likewise use HMAC (or signed request) verification on the receiver and
treat delivery as at-least-once.

## Schedules

Schedule declarations include handler/operation, default cadence and bounds,
timezone support, overlap/catchup/jitter defaults, and max concurrent
invocations. Suspend (below) pauses schedules without deleting their
configuration.

## Suspension semantics

When an installation is **suspended**:

- Schedules and deliveries **pause**
- Runtime tokens are **disabled**
- Configuration, mappings, and history are **kept**
- Provider credentials are **not** deleted unless the merchant requests
  revocation

**Resume** re-enables tokens and schedules according to the active
AppVersion and current configuration.

**Uninstall** is stronger: stop deliveries, drain or cancel in-flight work
per policy, revoke tokens/OAuth grants, deactivate subscriptions and extension
mounts, deregister provider webhooks, then mark uninstalled while retaining
audit/sync history for the retention period.

## Design checklist for the user

1. List each trigger as event | schedule | webhook | manual (no daemon).
2. For each webhook: signature scheme, secret storage, failure/retry behavior.
3. For each subscription: permission required, filter, and whether replay is
   supported.
4. Document suspend vs uninstall behavior for operators.
5. Cross-link connector activities that consume webhook-normalized events
   (the `connector-dev` skill) and app install
   activation (the `build-app` skill).

## Deliverable

Produce a short events design section: trigger table, webhook verification
notes, subscription list, and suspend/uninstall effects. Offer
`app-integration-reviewer` for a constraints pass.
