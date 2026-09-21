---
description: Guide building a Aimee app -- manifest, distribution tiers, install lifecycle, and app principal
---

# Build a Aimee App

Help the user design or implement a Aimee app (extension, remote service, or
trusted connector packaging). Teach the public contracts only. Do not invent
endpoints or MCP tools that are not on the live gateway surface.

## Authentication and tools

- OAuth on first use; the agent client prompts in the browser (in Claude
  Code, run `/mcp` if not prompted). Call `whoami` first to confirm
  connection, scopes, and memberships. If multiple memberships and no
  clear default, ask the user which tenant to use before any `use_sdk` call.
  Multi-membership with no default fails closed with a candidate list.
  Set `AIMEE_TENANT` (UUID or slug) and optional `AIMEE_STORE` (UUID only)
  as environment variables for the MCP connection (in Claude Code: the
  project's `.claude/settings.json` `env` block; `.env` files are not
  auto-read), or pass `tenant` / `store` per call. Precedence: tool arg >
  header > default membership.
- Use `search_knowledge` for docs and current guidance. If it is unavailable,
  fall back to https://docs.aimee.shop.
- Use `introspect_api` / `get_sdk_method` / `get_type_definition` when looking
  up Core API or SDK contracts related to permissions the app will request.
- There is no dedicated "create app" MCP write tool. Produce a **manifest
  draft and install plan in the workspace only**. Before stating exact HTTP
  routes or surface kind enums as hard contracts, verify with
  `search_knowledge` or `introspect_api` (or docs.aimee.shop). Treat the
  `/v1/apps` family below as design guidance aligned with the app platform
  docs -- not a substitute for live docs if they differ.

## Distribution tiers

Three tiers share one domain model (App, AppVersion, AppInstallation):

1. **Tier 1 -- Official Aimee library**
   - Platform-owned apps (e.g. reference ERP connectors).
   - Manifests are published by signed CI; signatures are verified against a
     publisher trust registry.
2. **Tier 2 -- Tenant-private apps (primary on-ramp for builders)**
   - `ownerType=tenant`, `distribution=tenant-private`.
   - Publish is unsigned for tenant apps by design.
   - Runtimes: **remote HTTPS** (self-hosted, signed request protocol) or
     Aimee-hosted functions (quarantined runner). Tenant remote apps never
     run on Aimee Temporal task queues.
3. **Tier 3 -- Community marketplace**
   - Deferred. Public distribution and marketplace listing are separate
     future enablements; do not design as if marketplace APIs exist today.

## Canonical domain concepts

- **App**: stable developer-owned identity (`slug`, display metadata,
  `ownerType`, `distribution`, status). Slug is immutable after the first
  AppVersion is published.
- **AppVersion**: immutable release artifact once published (manifest
  snapshot, checksums/signatures, semantic version, compatibility). Any
  change requires a new version. Draft versions are mutable; published
  versions are not.
- **AppInstallation**: merchant grant pinned to an explicit AppVersion
  (tenant-wide or store-scoped uniqueness rules apply).
- **AppInstallSession**: resumable install wizard state machine.

## Manifest v1 (required top-level fields)

When drafting a manifest, require a validated schema -- empty placeholders
are invalid. Cover:

- `schemaVersion`
- app slug, display metadata, version, developer metadata
- `distribution`
- `surfaces` (each with stable id, runtime contract, entrypoint, requested
  permissions, config schema, health, maturity)
- `permissions` (exact Aimee permission strings + reason; **no wildcards**,
  no admin meta-permissions, no global scope by default)
- `authSchemes` (typed credential schemas; write-only secret fields;
  connection-test operation)
- `configSchema`
- `events`, `schedules`, `operations`
- `extensions`, `discovery`, `destinations`, `health`, `compatibility`

Surface kinds commonly discussed in platform docs include `remote-service`,
`trusted-connector-worker`, `hosted-functions`, admin iframe / storefront
package surfaces, and certified partner workers. Confirm the live allowed
set with `search_knowledge` before locking a design to a specific kind.

Capability maturity: experimental | preview | generally-available |
deprecated. Do not mark GA without conformance.

For connector-specific rules (activity-only workers, ERP write surface),
hand off to the `connector-dev` skill. For
events, webhooks, and triggers, hand off to the `webhooks-events` skill.

## Resumable install lifecycle

Installation is asynchronous and resumable. Session states:

`draft` -> `scope` -> `credentials` -> `verification` -> `discovery` ->
`configuration` -> `mappings-rules` -> `review` -> `activating` ->
`complete`

Terminal / error states: `error`, `expired`.

Rules to enforce in guidance:

- Every transition is tenant/store scoped, idempotent, validated against the
  pinned AppVersion, and auditable.
- Secrets never return on GET; only write-once credential posts.
- Verification and discovery run as background operations -- HTTP requests
  must not block on long provider timeouts.
- **Activation** is an AppOperation that returns **HTTP 202** with a pollable
  operation resource. Activation provisions the AppInstallation, optional
  Integration child, app principal, subscriptions, schedules, extension
  mounts, and provider webhooks where declared.
- Failed activation must not leave orphaned active keys, roles, schedules,
  or subscriptions.

Public install/catalog API family (design guidance -- verify before coding
clients): install sessions with credential / verify / discover / preview /
activate steps; installation suspend / resume / uninstall / upgrade /
rollback; app and version create / validate / publish / revoke under
`/v1/apps`. Mutating calls typically accept `Idempotency-Key`. Prefer
`search_knowledge` for the current OpenAPI shapes.

## App principal and identity

- **Tenant-private apps**: reuse the platform API-key primitive. Each key is
  bound to one AppInstallation, tenant (and optional store), and a
  **least-privilege app role** built from the granted permission keys only.
  Shown once at creation; rotatable and revocable.
- **Public apps**: authorization-code OAuth with PKCE; short-lived access
  tokens; rotating refresh; revoked on uninstall.
- An app cannot use its developer-owner identity to access an installation's
  merchant data.

## Upgrade and suspend

- Installations always pin an explicit AppVersion.
- Upgrades: dry-run, show permission/behavior diffs, merchant approval for
  new scopes, then atomic switch. Published versions are never mutated.
- Suspend: pauses schedules and deliveries, disables runtime tokens, keeps
  configuration/mappings/history. Credentials stay unless the merchant
  revokes them.
- Uninstall: drain, revoke tokens, deactivate subscriptions/mounts,
  deregister webhooks, retain audit/sync history per retention policy.

## Deliverable for this skill

Produce, in the user's workspace:

1. A draft manifest JSON (or outline) for their app
2. The install session step plan and required merchant grants
3. Permission list with least-privilege rationale
4. Next skill: `connector-dev` if they are
   building ERP sync, or `webhooks-events`
   for event intake

Run `app-integration-reviewer` before they treat the design as ready.
