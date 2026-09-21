#!/usr/bin/env node
// Schema, source, duplicate-skill, and private-content checks for generated
// packagings. No npm dependencies -- JSON Schema 2020-12 subset only.
//
//   node scripts/validate-packagings.mjs           validate this repo
//   node --test scripts/validate-packagings.test.mjs

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = dirname(HERE);

export const PLUGIN_SCHEMA = JSON.parse(
  readFileSync(join(HERE, "schemas", "plugin.schema.json"), "utf8"),
);
export const MCP_SCHEMA = JSON.parse(
  readFileSync(join(HERE, "schemas", "mcp.schema.json"), "utf8"),
);

export const OPENAI_CATEGORIES = new Set([
  "Productivity",
  "Creativity",
  "Developer Tools",
  "Business & Operations",
  "Data & Analytics",
  "Communication",
  "Education & Research",
  "Security",
  "Finance",
  "Healthcare",
  "Travel",
  "Entertainment",
  "Other",
]);

export const HOSTED_MCP_URL = "https://mcp.aimee.shop/mcp";

const TEXT_EXT = new Set([
  ".md",
  ".json",
  ".mjs",
  ".js",
  ".yml",
  ".yaml",
  ".txt",
  ".svg",
  ".html",
  ".toml",
  ".csv",
]);

const SKIP_DIR_NAMES = new Set([".git", "node_modules", "fixtures"]);

const oldBrand = "Z-i-f-t-r".replace(/-/g, "");
const oldPrefix = "z-s-2".replace(/-/g, "");

const PRIVATE_PATTERNS = [
  { name: "gitlab-url", re: /gitlab\.com/i },
  { name: "old-brand", re: new RegExp(oldBrand, "i") },
  { name: "old-prefix", re: new RegExp(`\\b${oldPrefix}\\b`, "i") },
  { name: "legacy-public-host", re: /\baimee\.ai\b/i },
  { name: "aws-account", re: /\b\d{12}\.dkr\.ecr\b/ },
  { name: "cognito", re: /cognito-idp\./i },
  { name: "bearer-token", re: /\bBearer\s+[A-Za-z0-9._\-]+/ },
  { name: "openai-key", re: /\bsk-[A-Za-z0-9]{10,}\b/ },
];

export function fail(errors) {
  const list = Array.isArray(errors) ? errors : [errors];
  const err = new Error(list.join("\n"));
  err.errors = list;
  throw err;
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function resolveRef(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`unsupported $ref ${ref}`);
  const parts = ref.slice(2).split("/");
  let cur = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) {
      throw new Error(`unresolved $ref ${ref}`);
    }
    cur = cur[p];
  }
  return cur;
}

export function validateJsonSchema(schema, data, rootSchema = schema, path = "$") {
  const errors = [];
  if (schema.$ref) {
    return validateJsonSchema(resolveRef(rootSchema, schema.$ref), data, rootSchema, path);
  }
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(
      (s) => validateJsonSchema(s, data, rootSchema, path).length === 0,
    );
    if (matches.length === 0) errors.push(`${path}: no oneOf branch matched`);
    return errors;
  }
  if (schema.const !== undefined && data !== schema.const) {
    errors.push(`${path}: expected ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path}: ${JSON.stringify(data)} not in enum`);
  }
  if (schema.not) {
    if (validateJsonSchema(schema.not, data, rootSchema, path).length === 0) {
      errors.push(`${path}: matched a forbidden schema`);
    }
  }
  if (schema.type && typeOf(data) !== schema.type) {
    errors.push(`${path}: expected ${schema.type}, got ${typeOf(data)}`);
    return errors;
  }
  if (typeof data === "string") {
    if (schema.minLength != null && data.length < schema.minLength) {
      errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength != null && data.length > schema.maxLength) {
      errors.push(`${path}: longer than maxLength ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: does not match pattern`);
    }
  }
  if (schema.type === "object" && data && typeof data === "object") {
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        errors.push(`${path}: missing required ${key}`);
      }
    }
    const props = schema.properties || {};
    for (const [key, value] of Object.entries(data)) {
      if (props[key]) {
        errors.push(...validateJsonSchema(props[key], value, rootSchema, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property ${key}`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        errors.push(
          ...validateJsonSchema(
            schema.additionalProperties,
            value,
            rootSchema,
            `${path}.${key}`,
          ),
        );
      }
    }
    if (schema.propertyNames) {
      for (const key of Object.keys(data)) {
        errors.push(
          ...validateJsonSchema(schema.propertyNames, key, rootSchema, `${path} propertyName ${key}`),
        );
      }
    }
  }
  if (schema.type === "array" && Array.isArray(data) && schema.items) {
    data.forEach((item, i) => {
      errors.push(...validateJsonSchema(schema.items, item, rootSchema, `${path}[${i}]`));
    });
  }
  return errors;
}

export function validateOpenAiInterface(iface, path = "interface") {
  const errors = [];
  if (!iface || typeof iface !== "object") {
    return [`${path}: missing object`];
  }
  const required = [
    "displayName",
    "shortDescription",
    "longDescription",
    "developerName",
    "category",
    "websiteURL",
    "privacyPolicyURL",
    "termsOfServiceURL",
    "logo",
  ];
  for (const key of required) {
    if (typeof iface[key] !== "string" || !iface[key].trim()) {
      errors.push(`${path}.${key}: required non-empty string`);
    }
  }
  if (iface.category && !OPENAI_CATEGORIES.has(iface.category)) {
    errors.push(`${path}.category: unknown ${iface.category}`);
  }
  if (iface.longDescription && iface.longDescription.length > 4000) {
    errors.push(`${path}.longDescription: longer than 4000 characters`);
  }
  for (const urlKey of ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    if (iface[urlKey] && !/^https:\/\/aimee\.shop(\/|$)/.test(iface[urlKey])) {
      errors.push(`${path}.${urlKey}: must be an https://aimee.shop URL`);
    }
  }
  for (const assetKey of ["logo", "composerIcon"]) {
    if (iface[assetKey] && !iface[assetKey].startsWith("./")) {
      errors.push(`${path}.${assetKey}: path must start with ./`);
    }
  }
  if (iface.capabilities) {
    if (!Array.isArray(iface.capabilities) || iface.capabilities.length > 20) {
      errors.push(`${path}.capabilities: must be a string list of at most 20`);
    }
  }
  const banned = ["hosted store from chat", "browser-only", "no-code builder", "directory approved"];
  const blob = `${iface.shortDescription || ""} ${iface.longDescription || ""}`.toLowerCase();
  for (const phrase of banned) {
    if (blob.includes(phrase)) errors.push(`${path}: claims ${phrase}`);
  }
  return errors;
}

export function assertHostedMcp(config, path, { requireSchema = false, type } = {}) {
  const errors = [];
  if (!config || typeof config !== "object") return [`${path}: missing mcp config`];
  if (requireSchema) {
    errors.push(...validateJsonSchema(MCP_SCHEMA, config));
  }
  const server = config.mcpServers && config.mcpServers.aimee;
  if (!server) {
    errors.push(`${path}: missing mcpServers.aimee`);
    return errors;
  }
  if (type && server.type !== type) errors.push(`${path}: type must be ${type}`);
  if (server.url !== HOSTED_MCP_URL) errors.push(`${path}: url must be ${HOSTED_MCP_URL}`);
  if (server.headers) errors.push(`${path}: generated MCP config must not set headers`);
  if (server.oauth) errors.push(`${path}: must not embed oauth client credentials`);
  if (String(server.url).includes("${")) errors.push(`${path}: must not use env expansion`);
  return errors;
}

export function parseSkillFrontmatter(text, path) {
  const lines = text.split("\n");
  if (lines[0] !== "---") fail(`${path}: missing frontmatter`);
  const end = lines.indexOf("---", 1);
  if (end === -1) fail(`${path}: unterminated frontmatter`);
  const fields = {};
  for (const line of lines.slice(1, end)) {
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m && !(m[1] in fields)) fields[m[1]] = m[2].trim();
  }
  return fields;
}

export function collectSkillDirs(skillsRoot) {
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function findDuplicateSkills(skillsRoot) {
  const errors = [];
  const dirs = collectSkillDirs(skillsRoot);
  const names = new Map();
  for (const dir of dirs) {
    const path = join(skillsRoot, dir, "SKILL.md");
    if (!existsSync(path)) {
      errors.push(`${path}: missing SKILL.md`);
      continue;
    }
    const fields = parseSkillFrontmatter(readFileSync(path, "utf8"), path);
    const name = fields.name || dir;
    if (!names.has(name)) names.set(name, []);
    names.get(name).push(dir);
  }
  for (const [name, list] of names) {
    if (list.length > 1) errors.push(`duplicate skill name ${name}: ${list.join(", ")}`);
  }
  return errors;
}

export function findMissingSource(generatedSkillsRoot, sourceSkillsRoot) {
  const errors = [];
  const source = new Set(collectSkillDirs(sourceSkillsRoot));
  for (const dir of collectSkillDirs(generatedSkillsRoot)) {
    if (!source.has(dir)) {
      errors.push(`${generatedSkillsRoot}: skill ${dir} is not in source ${sourceSkillsRoot}`);
    }
  }
  return errors;
}

export function scanPrivateContent(text, path) {
  const hits = [];
  for (const { name, re } of PRIVATE_PATTERNS) {
    if (re.test(text)) hits.push(`${path}: private-content ${name}`);
  }
  return hits;
}

export const STORE_BUILDER_MODULE_SKILLS = [
  "choose-aimee",
  "setup",
  "scaffold",
  "integrate-sdk",
  "launch-checklist",
  "products",
  "set-scope",
];

export function scanSecretHandling(text, path) {
  const hits = [];
  if (/\bNEXT_PUBLIC_AIMEE_API_KEY\b/.test(text)) {
    hits.push(`${path}: secret-handling public-api-key`);
  }
  if (
    /paste (the |your |this )?(api key|AIMEE_API_KEY|secret|token) into (chat|the prompt|prompts)/i.test(text) &&
    !/\b(do not|don't|never)\b[^\n]{0,40}paste /i.test(text)
  ) {
    hits.push(`${path}: secret-handling paste-into-prompt`);
  }
  return hits;
}

export function scanStaleOnboarding(text, path) {
  const hits = [];
  if (/\bNPM_TOKEN\b/.test(text)) hits.push(`${path}: stale-onboarding NPM_TOKEN`);
  if (/onboarding-provided|onboarding materials|starter-repo-url/i.test(text)) {
    hits.push(`${path}: stale-onboarding private-starter`);
  }
  return hits;
}

export function findBrokenStoreBuilderRefs(sourceSkillsRoot) {
  const path = join(sourceSkillsRoot, "store-builder", "SKILL.md");
  if (!existsSync(path)) return [`${path}: missing store-builder skill`];
  const text = readFileSync(path, "utf8");
  const errors = [];
  for (const name of STORE_BUILDER_MODULE_SKILLS) {
    const re = new RegExp(`the\\s+\`${name}\` skill`);
    if (!re.test(text)) {
      errors.push(`${path}: missing module skill ref ${name}`);
    }
  }
  return errors;
}

export function scanSourceSkillSafety(sourceSkillsRoot) {
  const errors = [];
  errors.push(...findBrokenStoreBuilderRefs(sourceSkillsRoot));
  for (const dir of collectSkillDirs(sourceSkillsRoot)) {
    const path = join(sourceSkillsRoot, dir, "SKILL.md");
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    errors.push(...scanSecretHandling(text, path));
    if (dir === "scaffold" || dir === "integrate-sdk" || dir === "store-builder") {
      errors.push(...scanStaleOnboarding(text, path));
    }
  }
  return errors;
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".") && ent.isDirectory() && ent.name !== ".claude-plugin" && ent.name !== ".codex-plugin" && ent.name !== ".grok-plugin" && ent.name !== ".cursor-plugin" && ent.name !== ".agents" && ent.name !== ".mcp.json") {
      if (ent.name === ".git") continue;
    }
    if (SKIP_DIR_NAMES.has(ent.name)) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

export function scanTreePrivateContent(root, extraSkip = []) {
  const errors = [];
  const skipAbs = extraSkip.map((p) => join(root, p));
  for (const file of walkFiles(root)) {
    if (skipAbs.some((s) => file === s || file.startsWith(s + "/"))) continue;
    if (!TEXT_EXT.has(extname(file).toLowerCase()) && !file.endsWith("SKILL.md")) continue;
    const rel = relative(root, file);
    if (rel.startsWith("scripts/fixtures/")) continue;
    const text = readFileSync(file, "utf8");
    errors.push(...scanPrivateContent(text, rel));
  }
  return errors;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function mustExist(path, errors) {
  if (!existsSync(path)) errors.push(`missing ${path}`);
  return existsSync(path);
}

export function validateOpenAiPack(openaiRoot, sourceSkillsRoot) {
  const errors = [];
  const pluginPath = join(openaiRoot, "plugin.json");
  const mcpPath = join(openaiRoot, "mcp.json");
  const compatPath = join(openaiRoot, ".codex-plugin", "plugin.json");
  const compatMcpPath = join(openaiRoot, ".mcp.json");
  if (!mustExist(pluginPath, errors) || !mustExist(mcpPath, errors)) return errors;
  const plugin = readJson(pluginPath);
  errors.push(...validateJsonSchema(PLUGIN_SCHEMA, plugin));
  if (plugin.extensions?.["com.openai"]?.apps) {
    errors.push(`${pluginPath}: must not declare apps / registered ChatGPT integration ids`);
  }
  errors.push(...validateOpenAiInterface(plugin.extensions?.["com.openai"]?.interface, `${pluginPath} extensions.com.openai.interface`));
  errors.push(...assertHostedMcp(readJson(mcpPath), mcpPath, { requireSchema: true, type: "streamable-http" }));
  if (mustExist(compatPath, errors)) {
    const compat = readJson(compatPath);
    if (compat.apps) errors.push(`${compatPath}: must not declare apps`);
    errors.push(...validateOpenAiInterface(compat.interface, `${compatPath} interface`));
    if (compat.skills !== "./skills/") errors.push(`${compatPath}: skills must be ./skills/`);
    if (compat.mcpServers !== "./.mcp.json") errors.push(`${compatPath}: mcpServers must be ./.mcp.json`);
  }
  if (mustExist(compatMcpPath, errors)) {
    errors.push(...assertHostedMcp(readJson(compatMcpPath), compatMcpPath, { type: "http" }));
  }
  if (existsSync(join(openaiRoot, ".app.json"))) {
    errors.push(`${openaiRoot}: must not ship .app.json`);
  }
  const logo = join(openaiRoot, "assets", "logo.png");
  const icon = join(openaiRoot, "assets", "composer-icon.svg");
  if (!mustExist(logo, errors) || statSync(logo).size < 1000) errors.push(`${logo}: missing or empty`);
  if (!mustExist(icon, errors)) errors.push(`${icon}: missing`);
  errors.push(...findMissingSource(join(openaiRoot, "skills"), sourceSkillsRoot));
  errors.push(...findDuplicateSkills(join(openaiRoot, "skills")));
  errors.push(...findDuplicateSkills(sourceSkillsRoot));
  return errors;
}

export function validateGeneratedRepo(root = DEFAULT_ROOT) {
  const errors = [];
  const sourceSkills = join(root, "aimee-shop", "skills");
  errors.push(...findDuplicateSkills(sourceSkills));
  errors.push(...scanSourceSkillSafety(sourceSkills));

  const ap = join(root, "dist", "agent-plugins", "aimee-shop");
  const apPlugin = join(ap, "plugin.json");
  const apMcp = join(ap, "mcp.json");
  if (mustExist(apPlugin, errors)) errors.push(...validateJsonSchema(PLUGIN_SCHEMA, readJson(apPlugin)));
  if (mustExist(apMcp, errors)) {
    errors.push(...assertHostedMcp(readJson(apMcp), apMcp, { requireSchema: true, type: "streamable-http" }));
  }
  errors.push(...findMissingSource(join(ap, "skills"), sourceSkills));
  errors.push(...findDuplicateSkills(join(ap, "skills")));

  const grokMcp = join(root, "dist", "grok", "aimee-shop", ".mcp.json");
  if (mustExist(grokMcp, errors)) {
    errors.push(...assertHostedMcp(readJson(grokMcp), grokMcp, { type: "http" }));
  }
  errors.push(...findMissingSource(join(root, "dist", "grok", "aimee-shop", "skills"), sourceSkills));

  const openai = join(root, "dist", "openai", "aimee-shop");
  errors.push(...validateOpenAiPack(openai, sourceSkills));

  const marketplace = join(root, "dist", "openai", ".agents", "plugins", "marketplace.json");
  if (mustExist(marketplace, errors)) {
    const m = readJson(marketplace);
    const entry = m.plugins?.[0];
    if (m.name !== "aimee") errors.push(`${marketplace}: name must be aimee`);
    if (entry?.source?.path !== "./aimee-shop") {
      errors.push(`${marketplace}: plugin path must be ./aimee-shop`);
    }
    if (entry?.policy?.authentication !== "ON_INSTALL") {
      errors.push(`${marketplace}: authentication must be ON_INSTALL`);
    }
    if (entry?.category !== "Developer Tools") {
      errors.push(`${marketplace}: category must be Developer Tools`);
    }
  }

  errors.push(
    ...scanTreePrivateContent(root, [
      "scripts",
      "CLAUDE.md",
      "docs",
    ]),
  );

  if (errors.length) fail(errors);
  return { ok: true, checks: errors.length };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  try {
    validateGeneratedRepo();
    console.log("validate-packagings: ok");
  } catch (err) {
    console.error("validate-packagings: failed");
    console.error(err.message);
    process.exit(1);
  }
}
