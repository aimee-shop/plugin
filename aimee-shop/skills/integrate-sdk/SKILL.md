---
description: Guide for adding @aimee.shop/sdk to an existing Next.js project
arguments: path
---

# Integrate Aimee SDK

Add the Aimee SDK to an existing Next.js project. For a new project, use
the `scaffold` skill (`/aimee:scaffold`) instead. The full sandbox
preview and test-checkout path is the `store-builder` skill
(`/aimee:store-builder`).

## MCP tenant context (when looking up methods live)

If you use MCP tools (`get_sdk_method`, `get_type_definition`, or `use_sdk`)
during integration, call `whoami` first. Multiple memberships with no default
fail closed -- ask the user which tenant to use, then set `AIMEE_TENANT`
(UUID or slug) and optional `AIMEE_STORE` (UUID only) as environment
variables for the MCP connection (in Claude Code: the project's
`.claude/settings.json` `env` block; `.env` files are not auto-read), or
pass `tenant` / `store` on each `use_sdk` call. Precedence: tool arg >
header > default membership.
These MCP env vars are separate from the storefront `AIMEE_API_KEY` below.

## Arguments

- `path` (optional): path to the Next.js project. Defaults to current directory.

## Steps

### 1. Install SDK

```bash
npm install @aimee.shop/sdk@0.0.2
```

Recheck the current published version with `npm view @aimee.shop/sdk
version` if install fails. `@aimee.shop/blocks` is optional here and
public at `0.0.2` when you need CMS rendering. `@aimee.shop/sdk-platform`
is restricted and is not required. Public packages; no npm access token.

### 2. Configure the server client

Create `lib/sdk.ts`:

```typescript
import { AimeeSDK } from '@aimee.shop/sdk';

export const sdk = new AimeeSDK({
  apiKey: process.env.AIMEE_API_KEY,
  coreApiUrl: process.env.NEXT_PUBLIC_CORE_API_URL,
  storeId: process.env.NEXT_PUBLIC_STORE_ID,
});
```

Look up the live constructor with `get_sdk_method` / `get_type_definition`
if this shape disagrees with the installed version. For customer-authenticated
client operations (cart, checkout) use the browser entry
`@aimee.shop/sdk/browser` with customer auth instead of the API key.

Public `@aimee.shop/sdk` 0.0.2 has no payments namespace. Checkout methods
are writes. Do not invent a payment or go-live probe URL.

### 3. Environment variables

```
NEXT_PUBLIC_CORE_API_URL=<core-api-url>
NEXT_PUBLIC_STORE_ID=<store-id>
AIMEE_API_KEY=<server-only-storefront-api-key>
NEXT_PUBLIC_AIMEE_PUBLISHABLE_KEY=<browser-pk-key>
```

`AIMEE_API_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`. Never
paste it into chat. The human copies it from Admin -> Settings -> API Keys
(storefront key set, "Storefront (Default)" on the `sk_` half) until scoped
mint ships.

### 4. First API call

```typescript
const products = await sdk.products.list({ limit: 10 });
```

Use the `get_sdk_method` and `get_type_definition` MCP tools to look up any SDK
method or type signature as you build.

## Verification

- `npx tsc --noEmit` to check types
- Confirm `AIMEE_API_KEY` is not in a client bundle, `NEXT_PUBLIC_*`, git, or
  a public preview URL
- Test a call in a server component or route handler
