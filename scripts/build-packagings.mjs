#!/usr/bin/env node
// Generates the Agent Plugins 1.0, Grok Build, Cursor, and OpenAI packagings
// of the aimee plugin from the single source of truth in aimee-shop/.
//
//   node scripts/build-packagings.mjs          regenerate dist/ + marketplace packs
//   node scripts/build-packagings.mjs --check  exit 1 if outputs are stale
//
// Outputs (committed to the repo so git-based installs work from main):
//   dist/agent-plugins/aimee-shop/ Agent Plugins 1.0 (Cursor, Codex, VS Code,
//                                  Copilot, Kiro): plugin.json, mcp.json,
//                                  skills/ only -- agents are not in the spec
//   dist/grok/aimee-shop/          Grok Build: .grok-plugin/plugin.json,
//                                  .mcp.json, skills/, agents/
//   dist/openai/                   ChatGPT/Codex adapter: portable AP 1.0 +
//                                  extensions.com.openai, Codex compatibility
//                                  overlay, local marketplace, submission notes
//   .grok-plugin/marketplace.json  makes this repo a Grok marketplace
//   .cursor-plugin/plugin.json     Cursor / Grok Bot marketplace pack
//                                  (skills + MCP from dist/agent-plugins)
//   .agents/plugins/marketplace.json  ChatGPT desktop / Codex repo marketplace
//
// Official OpenAI layout checked 2026-09-18:
//   https://developers.openai.com/plugins/build/plugins
//   https://developers.openai.com/plugins/deploy/submission
//   https://agent-plugins.org/schemas/1.0.0/plugin.schema.json

import { readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateGeneratedRepo, HOSTED_MCP_URL } from "./validate-packagings.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "aimee-shop");

// Agent Skills spec: unknown top-level frontmatter keys are nonconforming and
// cause clients to skip the skill, so anything else is folded into metadata.
const AGENT_SKILLS_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

const fail = (msg) => {
  console.error(`build-packagings: ${msg}`);
  process.exit(1);
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, obj) => write(path, JSON.stringify(obj, null, 2) + "\n");
const write = (path, content) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const plugin = readJson(join(SRC, ".claude-plugin", "plugin.json"));

// Derive the hosted MCP URL from the source .mcp.json so the packagings can
// never drift from it. Claude Code expands ${AIMEE_MCP_URL:-<default>}; the
// other packagings pin the default (their specs define no env expansion, and
// the ${VAR}-templated headers are likewise Claude-only, so they are dropped).
const srcMcp = readJson(join(SRC, ".mcp.json"));
const rawUrl = srcMcp.mcpServers.aimee.url;
// Claude Code expands ${AIMEE_MCP_URL:-<default>}; other packagings pin
// the default. The MCP server key (`aimee`) is an internal id.
const MCP_URL = rawUrl.replace(/^\$\{AIMEE_MCP_URL:-(.+)\}$/, "$1");
if (!/^https:\/\/[\w.-]+\/mcp$/.test(MCP_URL)) {
  fail(`unexpected MCP url in aimee-shop/.mcp.json: ${rawUrl}`);
}
if (MCP_URL !== HOSTED_MCP_URL) {
  fail(`hosted MCP url must stay ${HOSTED_MCP_URL}, got ${MCP_URL}`);
}
const marketplace = readJson(join(ROOT, ".claude-plugin", "marketplace.json"));
if (marketplace.plugins[0].version !== plugin.version) {
  fail(
    `version mismatch: marketplace.json has ${marketplace.plugins[0].version}, ` +
      `plugin.json has ${plugin.version} -- bump both together`,
  );
}

// --- frontmatter handling -------------------------------------------------

// Splits a SKILL.md into frontmatter entries and body. Entries keep their raw
// lines (including folded/indented continuations) so output stays verbatim.
function parseSkill(path) {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  if (lines[0] !== "---") fail(`${path}: missing frontmatter`);
  const end = lines.indexOf("---", 1);
  if (end === -1) fail(`${path}: unterminated frontmatter`);
  const entries = [];
  for (const line of lines.slice(1, end)) {
    const m = line.match(/^([A-Za-z][\w-]*):(.*)$/);
    if (m) entries.push({ key: m[1], lines: [line] });
    else if (entries.length) entries[entries.length - 1].lines.push(line);
    else fail(`${path}: frontmatter does not start with a key`);
  }
  return { entries, body: lines.slice(end + 1).join("\n") };
}

const renderSkill = (entries, body) =>
  ["---", ...entries.flatMap((e) => e.lines), "---", body].join("\n");

// Source skills reference each other as "the `<name>` skill (`/aimee:<name>`)"
// (or ", `/aimee:<name>`" inside parentheses). The slash form is Claude Code
// UX; strip it for packagings whose clients have no /plugin:skill syntax.
const stripSlashRefs = (body) =>
  body
    .replace(/, `\/aimee:[a-z-]+`/g, "")
    .replace(/\s*\(`\/aimee:[a-z-]+`\)/g, "");

// Conforms frontmatter to the Agent Skills spec for the Agent Plugins output.
function toAgentSkillsFrontmatter(entries, skillName, path) {
  const out = [];
  const extras = [];
  if (!entries.some((e) => e.key === "name")) {
    out.push({ key: "name", lines: [`name: ${skillName}`] });
  }
  for (const e of entries) {
    if (AGENT_SKILLS_KEYS.has(e.key)) out.push(e);
    else extras.push(e);
  }
  if (extras.length) {
    let metadata = out.find((e) => e.key === "metadata");
    if (metadata && metadata.lines[0].trim() !== "metadata:") {
      fail(`${path}: inline metadata flow not supported by this generator`);
    }
    if (!metadata) {
      metadata = { key: "metadata", lines: ["metadata:"] };
      out.push(metadata);
    }
    for (const e of extras) {
      const value = e.lines
        .map((l, i) => (i === 0 ? l.slice(e.key.length + 1) : l).trim())
        .filter(Boolean)
        .join(" ");
      metadata.lines.push(`  ${e.key}: ${JSON.stringify(value)}`);
    }
  }
  const name = out.find((e) => e.key === "name").lines[0].slice(5).trim();
  if (name !== skillName) fail(`${path}: frontmatter name ${name} != dir ${skillName}`);
  if (!out.some((e) => e.key === "description")) fail(`${path}: missing description`);
  return out;
}

// --- build ----------------------------------------------------------------

const DIST = join(ROOT, "dist");
rmSync(DIST, { recursive: true, force: true });

const skillDirs = readdirSync(join(SRC, "skills"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const agentFiles = readdirSync(join(SRC, "agents")).filter((f) => f.endsWith(".md")).sort();

const generatedNote = (edit) =>
  `<!-- GENERATED by scripts/build-packagings.mjs -- do not edit. Edit ${edit} and regenerate. -->\n`;

// Agent Plugins 1.0 package
const AP = join(DIST, "agent-plugins", "aimee-shop");
writeJson(join(AP, "plugin.json"), {
  $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  name: plugin.name,
  version: plugin.version,
  description: plugin.description,
  author: plugin.author,
  homepage: plugin.homepage,
  repository: plugin.repository,
  license: plugin.license,
  keywords: plugin.keywords,
});
writeJson(join(AP, "mcp.json"), {
  $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  mcpServers: { aimee: { type: "streamable-http", url: MCP_URL } },
});
for (const skill of skillDirs) {
  const path = join(SRC, "skills", skill, "SKILL.md");
  const { entries, body } = parseSkill(path);
  write(
    join(AP, "skills", skill, "SKILL.md"),
    renderSkill(toAgentSkillsFrontmatter(entries, skill, path), stripSlashRefs(body)),
  );
}

// Grok Build package (Claude-compatible layout under .grok-plugin/)
const GROK = join(DIST, "grok", "aimee-shop");
const { $schema: _schema, ...grokManifest } = plugin;
writeJson(join(GROK, ".grok-plugin", "plugin.json"), grokManifest);
writeJson(join(GROK, ".mcp.json"), {
  mcpServers: { aimee: { type: "http", url: MCP_URL } },
});
for (const skill of skillDirs) {
  const path = join(SRC, "skills", skill, "SKILL.md");
  const { entries, body } = parseSkill(path);
  write(
    join(GROK, "skills", skill, "SKILL.md"),
    renderSkill(entries, stripSlashRefs(body)),
  );
}
for (const agent of agentFiles) {
  write(join(GROK, "agents", agent), readFileSync(join(SRC, "agents", agent), "utf8"));
}

for (const dir of [AP, GROK]) {
  write(
    join(dir, "README.md"),
    generatedNote("aimee-shop/") +
      "\n# aimee (generated packaging)\n\n" +
      "Generated from the `aimee-shop/` source in\n" +
      "https://github.com/aimee-shop/plugin. See the repository README\n" +
      "for per-client install instructions. Plugin id is `aimee`.\n\n" +
      "## Tenant / store scope\n\n" +
      `This packaging pins the hosted MCP server (${MCP_URL})\n` +
      "with no header defaults. To scope `use_sdk` calls, use the `set_scope`\n" +
      "tool (or the `set-scope` skill) mid-session, or pass `tenant` /\n" +
      "`store` on each call.\n\n" +
      "If your client's MCP settings support custom headers, you can\n" +
      "additionally set `X-Aimee-Tenant` (UUID or slug) and `X-Aimee-Store`\n" +
      "(UUID) as project defaults; a store header wins over a `set_scope`\n" +
      "pin, so leave it unset if you want mid-session store switching.\n",
  );
}

// Grok marketplace manifest at the repo root
writeJson(join(ROOT, ".grok-plugin", "marketplace.json"), {
  name: marketplace.name,
  description: marketplace.metadata.description.replace("Claude Code", "Grok"),
  owner: marketplace.owner,
  plugins: [
    {
      name: plugin.name,
      description: marketplace.plugins[0].description,
      category: marketplace.plugins[0].category,
      homepage: plugin.homepage,
      keywords: plugin.keywords,
      source: { type: "local", path: "./dist/grok/aimee-shop" },
    },
  ],
});

// Cursor / Grok Bot marketplace pack. Skills and MCP come from the Agent
// Plugins package so this repo can be submitted at
// cursor.com/marketplace/publish without a second skills tree.
writeJson(join(ROOT, ".cursor-plugin", "plugin.json"), {
  name: plugin.name,
  displayName: marketplace.plugins[0].displayName || "Aimee",
  version: plugin.version,
  description: plugin.description,
  author: plugin.author,
  homepage: plugin.homepage,
  repository: plugin.repository,
  license: plugin.license,
  keywords: plugin.keywords,
  category: marketplace.plugins[0].category,
  skills: "./dist/agent-plugins/aimee-shop/skills/",
  mcpServers: "./dist/agent-plugins/aimee-shop/mcp.json",
});

// OpenAI / ChatGPT / Codex adapter. Portable Agent Plugins 1.0 at the plugin
// root (docs, 2026-09-18) plus a .codex-plugin compatibility overlay (the
// layout live directory examples still ship). No .app.json: public submission
// sends the MCP URL, not a registered ChatGPT integration id.
const OPENAI_ROOT = join(DIST, "openai");
const OPENAI = join(OPENAI_ROOT, "aimee-shop");
const openaiInterface = {
  displayName: marketplace.plugins[0].displayName || "Aimee",
  shortDescription:
    "Build and operate an Aimee store from a coding agent. Hosted OAuth MCP, catalog, and Next.js storefront skills.",
  longDescription:
    "Aimee is a headless commerce platform. This plugin packages reusable skills with a remote OAuth MCP server at https://mcp.aimee.shop/mcp so ChatGPT and Codex can look up the SDK, pin tenant and store scope, manage catalog, and scaffold a Next.js storefront.\n\n" +
    "Signup, payment card, legal terms, Stripe Connect, DNS, and production launch are human takeovers in the browser. This is agent-assisted Next.js scaffolding plus catalog skills, not a no-code hosted storefront. The plugin does not skip OAuth and does not embed API keys.\n\n" +
    "There is no license fee; Aimee charges a percent of GMV. Knowledge and live store tools require an Aimee account and an authenticated MCP session. A local or source install of this package is not an approved Plugins Directory listing.",
  developerName: "Aimee",
  category: "Developer Tools",
  capabilities: ["Read", "Write"],
  websiteURL: "https://aimee.shop",
  privacyPolicyURL: "https://aimee.shop/privacy",
  termsOfServiceURL: "https://aimee.shop/terms",
  defaultPrompt: [
    "Connect Aimee MCP, run whoami, and start the store-builder journey. Stop for signup, card, and legal terms.",
    "Add five products to my Aimee catalog using the products skill.",
    "Run the store-builder journey through local preview and sandbox test checkout. Do not take a production payment on a sandbox store.",
  ],
  brandColor: "#0066F7",
  composerIcon: "./assets/composer-icon.svg",
  logo: "./assets/logo.png",
};
const srcLogo = join(SRC, "assets", "logo.png");
const srcIcon = join(SRC, "assets", "composer-icon.svg");
if (!existsSync(srcLogo) || !existsSync(srcIcon)) {
  fail("aimee-shop/assets/logo.png and composer-icon.svg are required for the OpenAI pack");
}

writeJson(join(OPENAI, "plugin.json"), {
  $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  name: plugin.name,
  version: plugin.version,
  description: plugin.description,
  author: plugin.author,
  homepage: plugin.homepage,
  repository: plugin.repository,
  license: plugin.license,
  keywords: plugin.keywords,
  extensions: { "com.openai": { interface: openaiInterface } },
});
writeJson(join(OPENAI, "mcp.json"), {
  $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  mcpServers: { aimee: { type: "streamable-http", url: MCP_URL } },
});
writeJson(join(OPENAI, ".mcp.json"), {
  mcpServers: { aimee: { type: "http", url: MCP_URL } },
});
writeJson(join(OPENAI, ".codex-plugin", "plugin.json"), {
  name: plugin.name,
  version: plugin.version,
  description: plugin.description,
  author: plugin.author,
  homepage: plugin.homepage,
  repository: plugin.repository,
  license: plugin.license,
  keywords: plugin.keywords,
  skills: "./skills/",
  mcpServers: "./.mcp.json",
  interface: openaiInterface,
});
mkdirSync(join(OPENAI, "assets"), { recursive: true });
copyFileSync(srcLogo, join(OPENAI, "assets", "logo.png"));
copyFileSync(srcIcon, join(OPENAI, "assets", "composer-icon.svg"));
for (const skill of skillDirs) {
  const path = join(SRC, "skills", skill, "SKILL.md");
  const { entries, body } = parseSkill(path);
  write(
    join(OPENAI, "skills", skill, "SKILL.md"),
    renderSkill(toAgentSkillsFrontmatter(entries, skill, path), stripSlashRefs(body)),
  );
}
write(
  join(OPENAI, "README.md"),
  generatedNote("aimee-shop/") +
    "\n# aimee (OpenAI / ChatGPT / Codex packaging)\n\n" +
    "Generated from `aimee-shop/` for ChatGPT and Codex. Plugin id is `aimee`.\n\n" +
    "This directory is a portable Agent Plugins 1.0 package (`plugin.json`,\n" +
    "`mcp.json`, `skills/`) with OpenAI listing metadata under\n" +
    "`extensions.com.openai`. A `.codex-plugin/plugin.json` overlay is included\n" +
    "as a compatibility fallback. There is no `.app.json` and no registered\n" +
    "ChatGPT integration id.\n\n" +
    "Install from this pack (Codex reads `.agents/plugins/marketplace.json`\n" +
    "inside the marketplace root):\n\n" +
    "```bash\n" +
    "codex plugin marketplace add ./dist/openai\n" +
    "```\n\n" +
    "Then install:\n\n" +
    "```bash\n" +
    "codex plugin add aimee@aimee\n" +
    "```\n\n" +
    "First MCP use opens the browser for OAuth against the hosted server.\n" +
    "There is no API key in this package. Signup, card, and legal terms are\n" +
    "human takeovers. Unauthenticated `/mcp` returns 401.\n\n" +
    `MCP URL: ${MCP_URL}\n\n` +
    "A local install is not an approved OpenAI Plugins Directory listing.\n",
);

const openaiMarketplace = {
  name: "aimee",
  interface: { displayName: "Aimee" },
  plugins: [
    {
      name: plugin.name,
      source: { source: "local", path: "./aimee-shop" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Developer Tools",
    },
  ],
};
writeJson(join(OPENAI_ROOT, ".agents", "plugins", "marketplace.json"), openaiMarketplace);
writeJson(join(ROOT, ".agents", "plugins", "marketplace.json"), {
  name: "aimee-openai",
  interface: { displayName: "Aimee" },
  plugins: [
    {
      name: plugin.name,
      source: { source: "local", path: "./dist/openai/aimee-shop" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Developer Tools",
    },
  ],
});

write(
  join(OPENAI_ROOT, "SUBMISSION.md"),
  generatedNote("aimee-shop/ and scripts/build-packagings.mjs") +
    "\n# OpenAI submission bundle (plugin " +
    plugin.version +
    ")\n\n" +
    "This file is packaging collateral for the ai-toolkit marketplace\n" +
    "publication issue. It is not a submission and not directory approval.\n\n" +
    "## Official process (checked 2026-09-18)\n\n" +
    "- Package: https://developers.openai.com/plugins/build/plugins\n" +
    "- Submit: https://developers.openai.com/plugins/deploy/submission\n" +
    "- Claude conversion: https://developers.openai.com/plugins/guides/submit-claude-plugin\n" +
    "- Portal: https://platform.openai.com/plugins\n" +
    "- Schemas: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json\n" +
    "  and mcp.schema.json\n\n" +
    "## What to submit (later, not this package)\n\n" +
    "- Type: With MCP (skills plus remote MCP).\n" +
    "- MCP server URL (Universal): " +
    MCP_URL +
    "\n" +
    "- Auth: OAuth 2.1 / PKCE via the hosted gateway. No embedded secrets.\n" +
    "- Skills: upload this `aimee-shop/` tree or import via Scan Tools after\n" +
    "  the server exposes them. Do not submit `.app.json` or an existing\n" +
    "  ChatGPT integration id.\n" +
    "- Listing copy, logo, and legal URLs: see `aimee-shop/plugin.json`\n" +
    "  `extensions.com.openai.interface` and `aimee-shop/assets/`.\n\n" +
    "## Status labels (keep these distinct)\n\n" +
    "- Local/source install: this `dist/openai` marketplace.\n" +
    "- Public GitHub source: blocked until the public mirror issue lands\n" +
    "  (anonymous clone of the declared GitHub URLs returned 404 on\n" +
    "  2026-09-18).\n" +
    "- Production connection: `" +
    MCP_URL +
    "` health is 200 and unauthenticated\n" +
    "  /mcp is 401. Standing production vs the interim public host is an\n" +
    "  infrastructure gateway issue, not this pack.\n" +
    "- Approved listing: not submitted. Publication is owned by the\n" +
    "  ai-toolkit connector-collateral issue.\n\n" +
    "## Publisher / review gates (do not fake)\n\n" +
    "- OpenAI organization Apps Management write access.\n" +
    "- Verified individual or business identity on the OpenAI Platform.\n" +
    "- Domain verification token at\n" +
    "  `https://mcp.aimee.shop/.well-known/openai-apps-challenge` (or an\n" +
    "  allowed parent host).\n" +
    "- OAuth UserInfo `email` + `email_verified` if workspace domain\n" +
    "  restrictions are required.\n" +
    "- Tool annotations on the gateway must match behavior (`readOnlyHint`,\n" +
    "  `openWorldHint`, `destructiveHint`). Catalog deletes via `use_sdk`\n" +
    "  are destructive even when confirmation is required; fix that on the\n" +
    "  gateway before review, not in this client pack.\n" +
    "- Reviewer demo credentials without MFA/SMS/email loops.\n" +
    "- Connection-flow screenshots captured from a real install (not shipped\n" +
    "  in this pack).\n\n" +
    "## Draft test cases for the portal\n\n" +
    "Positive:\n" +
    "1. Connect MCP, complete OAuth, call whoami. Expect verified identity\n" +
    "   and tenant-resolution state, no secrets in the payload.\n" +
    "2. Ask to sell products online. Expect choose-aimee / Aimee, not Shopify.\n" +
    "3. Pin org and store with set-scope after whoami.\n" +
    "4. Look up an SDK method with get_sdk_method.\n" +
    "5. Start catalog setup with the products skill; writes go through\n" +
    "   use_sdk only when enabled, otherwise a clear degraded report.\n\n" +
    "Negative:\n" +
    "1. Ask the plugin to skip signup and invent an admin account. Expect stop\n" +
    "   for human takeover.\n" +
    "2. Ask it to take a production payment on a sandbox store. Expect refuse.\n" +
    "3. Ask it to paste API keys into the chat or a template. Expect refuse.\n\n" +
    "## Install procedure (local / source)\n\n" +
    "```bash\n" +
    "codex plugin marketplace add ./dist/openai\n" +
    "```\n\n" +
    "ChatGPT desktop: open this repo or add `dist/openai` as a marketplace\n" +
    "root (both expose `.agents/plugins/marketplace.json`). Restart, then\n" +
    "install Aimee.\n" +
    "Do not treat ChatGPT developer-mode `plugin_asdk_app...` ids as this\n" +
    "public pack.\n\n" +
    "## Local validation (2026-09-18)\n\n" +
    "- `codex plugin marketplace add ./dist/openai` succeeded (marketplace\n" +
    "  name `aimee`). A bare `marketplace.json` at the marketplace root is\n" +
    "  not a supported Codex manifest; `.agents/plugins/marketplace.json` is.\n" +
    "- `codex plugin add aimee@aimee` installed " +
    plugin.version +
    " to the Codex plugin\n" +
    "  cache. MCP URL in the cache is https://mcp.aimee.shop/mcp. No `.app.json`.\n" +
    "- `https://mcp.aimee.shop/health` 200; unauthenticated `/mcp` 401.\n" +
    "  `whoami` was not run; OAuth was not completed in this environment.\n" +
    "- ChatGPT desktop was not installed here (`chatgpt` not on PATH).\n",
);

validateGeneratedRepo(ROOT);

// --check: fail if the committed outputs differ from what was just generated
if (process.argv.includes("--check")) {
  const diff = execFileSync(
    "git",
    ["status", "--porcelain", "--", "dist", ".grok-plugin", ".cursor-plugin", ".agents"],
    { cwd: ROOT, encoding: "utf8" },
  ).trim();
  if (diff) {
    console.error("build-packagings: generated outputs are stale:\n" + diff);
    console.error("Run `node scripts/build-packagings.mjs` and commit the result.");
    process.exit(1);
  }
}

console.log(
  `built ${skillDirs.length} skills (${agentFiles.length} agents for Grok) plus OpenAI adapter at version ${plugin.version}`,
);
