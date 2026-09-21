---
name: search
description: Search Aimee documentation, SDK reference, and API docs
metadata:
  arguments: "query"
---

# Aimee Documentation Search

Search the Aimee documentation and SDK reference for: "$ARGUMENTS"

## Process

1. **Resolve environment (once per session if unknown)**
   - Call `whoami` and note the `Environment`, `Docs host`, and
     `search_knowledge: enabled|disabled` lines.
   - If `whoami` is unavailable, derive the docs host from the connected MCP
     server / `AIMEE_MCP_URL`:
     - `mcp-dev.aimee.shop` -> `https://docs-dev.aimee.shop`
     - `mcp-staging.aimee.shop` -> `https://docs-staging.aimee.shop`
     - `mcp.aimee.shop` (prod) -> `https://docs.aimee.shop`
   - Never default to production docs when the session is bound to dev or staging.

2. **Search knowledge**
   - Use the `search_knowledge` MCP tool with the user's query.
   - Results are citation-carrying chunks from hybrid retrieval.
   - If `search_knowledge` is unavailable (or reports disabled), fall back to
     the **Docs host from step 1** (not a hardcoded prod URL) and tell the user
     the knowledge tool is offline on this deployment.

3. **Present Results**
   - Show the most relevant documentation pages
   - Include SDK methods if applicable
   - Include type definitions if relevant

4. **Provide Context**
   - Summarize the key information from the results
   - If searching for an SDK method, use `get_sdk_method` for details
   - If searching for a type, use `get_type_definition` for the full definition

5. **Offer Next Steps**
   - Suggest related topics to explore
   - Offer to help implement what they're looking for

## Available Search Tools

- `search_knowledge` - Search documentation, SDK reference, and API docs
  (may be disabled when `MCP_ENABLE_SEARCH_KNOWLEDGE` is off; fall back to the
  env-derived Docs host from `whoami`)
- `get_sdk_method` - Get detailed info for a specific SDK method (e.g., "products.create")
- `get_type_definition` - Get TypeScript type definition (e.g., "Product", "CreateProductDto")
- `introspect_api` - Explore API endpoints for a domain (e.g., "products", "orders")
- `whoami` - Confirm auth, environment, docs host, scopes, and memberships.
  Multiple memberships with no default fail closed; set `AIMEE_TENANT` /
  `AIMEE_STORE` as environment variables for the MCP connection if needed
  (in Claude Code: the project's `.claude/settings.json` `env` block; `.env`
  files are not auto-read), or run the `set-scope` skill
