import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createStorageApi } from "./storage";

test("runtime storage returns to project scope with the same durable migration version", async () => {
  const root = mkdtempSync(join(tmpdir(), "storage-migration-scope-"));
  const app = await createTestApp();
  try {
    const source = join(root, "source");
    mkdirSync(source);
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({
        name: "scope",
        publisher: "test",
        version: "1.0.0",
        main: "./extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    writeFileSync(join(source, "extension.ts"), "export default {};");
    const project = await app.deps.projectService.create({ name: "Storage scopes" });
    const { instance, installedSource } = await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath: source,
      extensionId: "test.scope",
      name: "scope",
      installName: "scope",
      displayName: "Scope",
      manifest: { name: "scope" },
    });
    const storage = createStorageApi(app.deps, {
      extensionInstanceId: instance.id,
      extensionId: installedSource.extension_id,
      projectId: project.id,
    });
    await storage.set("value", "project");
    const resource = storage.scope({ type: "resource", resource: { type: "note", id: "one" } });
    await resource.set("value", "resource");
    expect(await resource.scope({ type: "project" }).get<string>("value")).toBe("project");
    await storage.migrate(1, async (previous) => {
      expect(previous).toBe(0);
    });
    await resource.migrate(1, async (previous) => {
      expect(previous).toBe(0);
    });
    await resource.scope({ type: "project" }).migrate(1, async () => {
      throw new Error("Wrong scope");
    });
    await storage.migrate(Number.MAX_SAFE_INTEGER, async (previous) => {
      expect(previous).toBe(1);
    });
    await storage.migrate(Number.MAX_SAFE_INTEGER, async () => {
      throw new Error("Version did not round trip");
    });
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
