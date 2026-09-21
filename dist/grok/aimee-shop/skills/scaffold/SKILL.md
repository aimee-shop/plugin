---
description: Scaffold a new Aimee storefront from the official public starter template
arguments: path
---

# Scaffold an Aimee Storefront

Create a new storefront project from the public Aimee storefront starter
(Next.js + `@aimee.shop/sdk` + `@aimee.shop/blocks`). This runs locally
using your own shell and file tools -- it does not need the MCP server.

For an existing Next.js app, use the `integrate-sdk` skill instead.

## Arguments

- `path` (optional): target directory for the new project. Defaults to
  `./aimee-storefront`.

## Steps

### 1. Download the public starter

Recheck the current published tag if this URL 404s. URL of record:

```
https://github.com/aimee-shop/storefront-starter
https://github.com/aimee-shop/storefront-starter/archive/refs/tags/v0.1.0.tar.gz
```

Prefer the versioned tarball (no git history, no GitLab CI):

```bash
curl -fsSL https://github.com/aimee-shop/storefront-starter/archive/refs/tags/v0.1.0.tar.gz | tar -xz
mv storefront-starter-0.1.0 <path>
```

Or anonymous clone of the tagged template, then drop git metadata:

```bash
git clone --depth 1 --branch v0.1.0 https://github.com/aimee-shop/storefront-starter.git <path>
rm -rf <path>/.git
```

Do not ask for an onboarding token or a private repository URL. If the
public artifact is unreachable, say so and stop.

### 2. Drop the starter's project .mcp.json if it collides

Check `<path>/.mcp.json`. If it declares a `"aimee"` server, delete it --
the plugin already provides that server for this session, and the two would
collide:

```bash
rm -f <path>/.mcp.json
```

(The starter ships this file so a standalone clone, without the plugin
installed, still gets Aimee MCP tools. Leave it in place if it declares
anything other than `"aimee"`, or does not exist.)

### 3. Initialize git and install

```bash
cd <path>
git init
npm ci || npm install
```

`@aimee.shop/sdk` and `@aimee.shop/blocks` are public (currently `0.0.2`;
recheck with `npm view` if install fails). `@aimee.shop/sdk-platform` is
restricted and is **not** a required install. Public packages; no npm
access token.

### 4. Configure environment

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

Required for local preview (see the starter `.env.example` for the rest):

- `NEXT_PUBLIC_CORE_API_URL` - explicit Core API origin for this store.
  Use `search_knowledge` or the docs host from `whoami` if the user is
  unsure. Do not guess a private hostname.
- `NEXT_PUBLIC_STORE_ID` - the store id from the pinned scope.
- `AIMEE_API_KEY` - server-only storefront secret (`sk_`). Never prefix
  with `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_AIMEE_PUBLISHABLE_KEY` - browser `pk_test_` / `pk_live_`
  key. Never reuse `AIMEE_API_KEY` here.

Sandbox previews should set `NEXT_PUBLIC_NOINDEX=true` (or a
non-production `NEXT_PUBLIC_AIMEE_ENV`) so crawlers stay off.

**Manual admin key-set (required until scoped mint ships):** the human
opens Admin -> Settings -> API Keys -> Create storefront key set, assigns
"Storefront (Default)" to the `sk_` half, and copies the one-time `.env`
block into `.env.local` themselves. Do not print the secret, do not paste
it into chat, and do not commit `.env.local`.

### 5. Verify

```bash
npm run dev    # starter defaults to http://localhost:3010
npx tsc --noEmit
```

Confirm the homepage renders. For the full sandbox journey (five products,
test checkout, optional hosting), return to the `store-builder` skill. Catalog-only setup is the `setup` skill or the `products` skill.
