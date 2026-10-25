import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createResourcesApi } from "./resources";

test("resource links use the enabled owner after replacing an extension source", async () => {
  const root = mkdtempSync(join(tmpdir(), "resource-owner-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Resource owner" });
    const install = async (folder: string) => {
      const sourcePath = join(root, folder);
      mkdirSync(sourcePath);
      const manifest = {
        name: "notes",
        publisher: "example",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      };
      writeFileSync(join(sourcePath, "package.json"), JSON.stringify(manifest));
      writeFileSync(
        join(sourcePath, "extension.ts"),
        'export default {resourceKinds:[{id:"item",ref:{kind:"resource-kind",id:"item"}}]};',
      );
      return app.deps.extensionService.enableInstalledSourceForProject({
        projectId: project.id,
        sourcePath,
        sourceKind: "local_path",
        name: "notes",
        installName: "notes",
        extensionId: "example.notes",
        displayName: "Notes",
        manifest,
      });
    };
    const original = await install("original");
    const replacement = await install("replacement");
    const records = await app.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(records.find(({ instance }) => instance.id === original.instance.id)?.instance.enabled).toBe(false);
    expect(records.find(({ instance }) => instance.id === replacement.instance.id)?.instance.enabled).toBe(true);
    const api = createResourcesApi(app.deps, { projectId: project.id, extensionId: "example.notes" });
    const source = { type: "item", id: "source" };
    await api.addAnchors(source, [{ type: "item", id: "target", role: "context" }]);
    expect((await api.listAnchors({ resource: source })).items).toHaveLength(1);
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("resource links name an undeclared kind instead of calling its owner ambiguous", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Undeclared kind" });
    const api = createResourcesApi(app.deps, { projectId: project.id, extensionId: "example.caller" });
    const source = { type: "project", id: project.id };
    await expect(api.addAnchors(source, [{ type: "missing-kind", id: "target", role: "context" }])).rejects.toThrow(
      /no enabled extension declares resource kind "missing-kind"/i,
    );
  } finally {
    await app.close();
  }
});
