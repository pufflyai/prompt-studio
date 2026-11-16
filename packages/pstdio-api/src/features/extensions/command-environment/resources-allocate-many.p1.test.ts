import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createResourcesApi } from "./resources";

test("an extension numbers many resources of its own kind in one call", async () => {
  const root = mkdtempSync(join(tmpdir(), "resource-allocate-many-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Bulk numbering" });
    const sourcePath = join(root, "items");
    mkdirSync(sourcePath, { recursive: true });
    const manifest = {
      name: "items",
      publisher: "example",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    };
    writeFileSync(join(sourcePath, "package.json"), JSON.stringify(manifest));
    writeFileSync(
      join(sourcePath, "extension.ts"),
      `export default { resourceKinds: [{id: "item", ref: {kind:"resource-kind",id:"item"}, prefix: "IT"}] };`,
    );
    await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath,
      sourceKind: "local_path",
      name: "items",
      installName: "items",
      extensionId: "example.items",
      displayName: "items",
      manifest,
    });
    const resources = createResourcesApi(app.deps, { projectId: project.id, extensionId: "example.items" });

    const first = await resources.allocate({ kind: "item" });
    const batch = await resources.allocateMany({ kind: "item", count: 3, idPrefix: "it" });

    expect(first.shorthand).toBe("IT-1");
    expect(batch.map((item) => item.shorthand)).toEqual(["IT-2", "IT-3", "IT-4"]);
    expect(batch.every((item) => /^it_[0-9A-Za-z]{22}$/.test(item.id))).toBe(true);
    expect(
      (await resources.identityMany({ kind: "item", ids: batch.map((item) => item.id) })).map(
        (item) => item?.shorthand,
      ),
    ).toEqual(["IT-2", "IT-3", "IT-4"]);
    expect((await resources.allocate({ kind: "item" })).shorthand).toBe("IT-5");
    await expect(resources.allocateMany({ kind: "item", count: 101 })).rejects.toThrow("1 to 100");
    await expect(resources.allocateMany({ kind: "other", count: 2 })).rejects.toThrow("no allocation prefix");
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
