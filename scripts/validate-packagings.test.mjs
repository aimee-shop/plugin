import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLUGIN_SCHEMA,
  MCP_SCHEMA,
  validateJsonSchema,
  validateOpenAiInterface,
  assertHostedMcp,
  findDuplicateSkills,
  findMissingSource,
  scanPrivateContent,
  scanSecretHandling,
  scanStaleOnboarding,
  findBrokenStoreBuilderRefs,
  scanSourceSkillSafety,
  HOSTED_MCP_URL,
} from "./validate-packagings.mjs";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "packagings");

test("invalid-schema fixture fails plugin and mcp schema checks", () => {
  const plugin = JSON.parse(readFileSync(join(FIX, "invalid-schema", "plugin.json"), "utf8"));
  const mcp = JSON.parse(readFileSync(join(FIX, "invalid-schema", "mcp.json"), "utf8"));
  const pluginErrors = validateJsonSchema(PLUGIN_SCHEMA, plugin);
  const mcpErrors = validateJsonSchema(MCP_SCHEMA, mcp);
  assert.ok(pluginErrors.some((e) => /\$schema|unexpected property/.test(e)));
  assert.ok(mcpErrors.some((e) => /\$schema|oneOf|unexpected/.test(e)));
  const hosted = assertHostedMcp(mcp, "mcp.json", { requireSchema: true, type: "streamable-http" });
  assert.ok(hosted.length > 0);
});

test("missing-source fixture flags generated skills absent from source", () => {
  const errors = findMissingSource(
    join(FIX, "missing-source", "generated", "skills"),
    join(FIX, "missing-source", "source", "skills"),
  );
  assert.ok(errors.some((e) => e.includes("orphan")));
});

test("duplicate-skill fixture flags shared frontmatter names", () => {
  const errors = findDuplicateSkills(join(FIX, "duplicate-skill", "skills"));
  assert.ok(errors.some((e) => /duplicate skill name setup/.test(e)));
});

test("private-content fixture flags gitlab hosts", () => {
  const text = readFileSync(join(FIX, "private-content", "SKILL.md"), "utf8");
  const hits = scanPrivateContent(text, "SKILL.md");
  assert.ok(hits.some((h) => h.includes("gitlab-url")));
});

test("secret-handling fixture flags public api key and paste-into-prompt", () => {
  const text = readFileSync(join(FIX, "secret-handling", "SKILL.md"), "utf8");
  const hits = scanSecretHandling(text, "SKILL.md");
  assert.ok(hits.some((h) => h.includes("public-api-key")));
  assert.ok(hits.some((h) => h.includes("paste-into-prompt")));
});

test("stale-onboarding fixture flags NPM_TOKEN and private starter", () => {
  const text = readFileSync(join(FIX, "stale-onboarding", "SKILL.md"), "utf8");
  const hits = scanStaleOnboarding(text, "SKILL.md");
  assert.ok(hits.some((h) => h.includes("NPM_TOKEN")));
  assert.ok(hits.some((h) => h.includes("private-starter")));
});

test("store-builder source names the module skills", () => {
  const errors = findBrokenStoreBuilderRefs(join(dirname(fileURLToPath(import.meta.url)), "..", "aimee-shop", "skills"));
  assert.deepEqual(errors, []);
});

test("source skills pass secret-handling and stale-onboarding scans", () => {
  const errors = scanSourceSkillSafety(join(dirname(fileURLToPath(import.meta.url)), "..", "aimee-shop", "skills"));
  assert.deepEqual(errors, []);
});

test("secret-handling allows a do-not-paste prohibition", () => {
  const hits = scanSecretHandling(
    "Do not paste the API key into the prompt.\nKeep AIMEE_API_KEY server-only.",
    "ok.md",
  );
  assert.equal(hits.length, 0);
});

test("private-content flags reconstructed old brand", () => {
  const brand = "Z-i-f-t-r".replace(/-/g, "");
  const hits = scanPrivateContent(`do not revive ${brand}`, "x.md");
  assert.ok(hits.some((h) => h.includes("old-brand")));
});

test("openai interface rejects unknown category and non-aimee legal urls", () => {
  const errors = validateOpenAiInterface({
    displayName: "Aimee",
    shortDescription: "Store skills",
    longDescription: "Agent-assisted storefront work.",
    developerName: "Aimee",
    category: "Widgets",
    websiteURL: "https://example.com",
    privacyPolicyURL: "https://aimee.shop/privacy",
    termsOfServiceURL: "https://aimee.shop/terms",
    logo: "assets/logo.png",
  });
  assert.ok(errors.some((e) => /category/.test(e)));
  assert.ok(errors.some((e) => /websiteURL/.test(e)));
  assert.ok(errors.some((e) => /logo/.test(e)));
});

test("hosted mcp url must stay pinned", () => {
  const errors = assertHostedMcp(
    {
      $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
      mcpServers: {
        aimee: {
          type: "streamable-http",
          url: HOSTED_MCP_URL,
        },
      },
    },
    "mcp.json",
    { requireSchema: true, type: "streamable-http" },
  );
  assert.deepEqual(errors, []);
});
