import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestHarnessRecord, createTestHarnessRegistry } from "../harnesses/test-harness-registry";
import { agentExtensionIcons, toAgentInfo } from "./agent-info";
import type { AgentsRouteDeps } from "./deps";

test("agent metadata uses the exact registered owner and installed package SVG, not a same-ID global source", async () => {
  const root = mkdtempSync(join(tmpdir(), "agent-icons-"));
  const projectSource = join(root, "project");
  mkdirSync(join(projectSource, "assets"), { recursive: true });
  writeFileSync(join(projectSource, "assets/custom.svg"), '<svg viewBox="0 0 16 16"><path d="M1 1h10v10z"/></svg>');
  const record = createTestHarnessRecord("custom");
  record.extensionId = "external.custom-owner";
  record.sourcePath = join(projectSource, "nested/entry.ts");
  const registry = createTestHarnessRegistry([record]);
  const sources = [
    { extension_id: record.extensionId, source_path: join(root, "global"), manifest_json: { icon: "Terminal" } },
    { extension_id: record.extensionId, source_path: projectSource, manifest_json: { icon: "./assets/custom.svg" } },
  ];
  const deps = { installedExtensionSourcesService: { list: async () => sources } } as unknown as AgentsRouteDeps;
  try {
    const harness = (await registry.list())[0]!;
    const info = await toAgentInfo(harness, undefined, await agentExtensionIcons(deps));
    expect(info.extensionId).toBe("external.custom-owner");
    expect(info.icon).toBe(
      `data:image/svg+xml;base64,${Buffer.from('<svg viewBox="0 0 16 16"><path d="M1 1h10v10z"/></svg>').toString("base64")}`,
    );
    rmSync(join(projectSource, "assets/custom.svg"));
    const missing = await toAgentInfo(harness, undefined, await agentExtensionIcons(deps));
    expect(missing.icon).toBeUndefined();
    expect(missing.availability.type).toBe("INSTALLED");
  } finally {
    await registry.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});
