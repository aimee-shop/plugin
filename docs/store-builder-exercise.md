# store-builder journey exercise (plugin 0.0.2)

Fixed brief: new user, sandbox store, five products, branded storefront
preview, successful test checkout.

Recorded 2026-09-18 against local source of this repo. No paid extra
accounts. No live charges. No real customer email. No unattended promotion.

## Clients

### Claude Code 2.1.276 (local marketplace)

- Marketplace `aimee` already pointed at this checkout
  (`/Users/tomschofield/dev/aimee/plugin`).
- Before: installed `aimee@aimee` **0.5.2** (stale cache).
- `claude plugin marketplace update aimee` then
  `claude plugin update aimee@aimee` -> **0.0.2**.
- Cache `~/.claude/plugins/cache/aimee/aimee/0.0.2` includes
  `skills/store-builder`. Scaffold has the public
  `aimee-shop/storefront-starter` v0.1.0 tarball and no npm access token.

### Codex CLI 0.154.0 (OpenAI adapter pack)

- Marketplace `aimee` -> `./dist/openai`.
- Before: `aimee@aimee` **0.0.1**.
- `codex plugin add aimee@aimee` -> **0.0.2** at
  `~/.codex/plugins/cache/aimee/aimee/0.0.2`.
- MCP URL `https://mcp.aimee.shop/mcp` (`streamable-http`). Slash skill
  refs stripped. `store-builder` present.

## Public env probes (same day)

- Starter tarball `v0.1.0` 302 to codeload; extract dir
  `storefront-starter-0.1.0`.
- `npm ci` with `NPM_TOKEN` unset: `@aimee.shop/sdk@0.0.2` +
  `@aimee.shop/blocks@0.0.2`; `sdk-platform` not a dependency. ~7s.
- `npx tsc --noEmit` on that install: pass.
- `.env.example`: `AIMEE_API_KEY` is not `NEXT_PUBLIC_`.
- `https://mcp.aimee.shop/health` 200; unauthenticated `/mcp` 401.
- `admin.aimee.shop` and `docs.aimee.shop`: DNS NXDOMAIN from this
  environment.
- Declared GitHub plugin mirror `github.com/Aimee/aimee-claude-plugin`:
  anonymous 404. That was the 2026-09-18 measurement. Canonical public
  source is now `github.com/aimee-shop/plugin` (plugin#3).

## Journey result

- Time to local package/typecheck of the public starter: under 2 minutes
  (download + `npm ci` + `tsc`).
- Human takeovers hit: signup page not live (canonical
  `https://admin.aimee.shop/signup` does not resolve). OAuth/`whoami` not
  completed (no standing public MCP session in this run; `/mcp` is 401
  unauthenticated).
- Five products, branding, local `next dev` preview, and sandbox test
  checkout were **not** executed: they need a provisioned sandbox tenant,
  human card/terms, and a storefront key set. Gates were not weakened.
- Secret exposure: inspected git-facing skill copy and starter
  `.env.example`; no instruction to paste keys into prompts; no
  `NEXT_PUBLIC_AIMEE_API_KEY`.

## Gates (this issue, not a new ticket)

- Canonical signup/docs hosts.
- Public GitHub plugin source (plugin#3 / mirror).
- Standing production MCP OAuth (infrastructure#33 / DEP-40).
- Human credential copy from admin until scoped mint ships.

Do not treat this merge as a completed public cold-user journey.
