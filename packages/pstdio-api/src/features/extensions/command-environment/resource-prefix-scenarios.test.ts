import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createResourcesApi } from "./resources";

const createHarness = async () => {
  const root = mkdtempSync(join(tmpdir(), "resource-prefix-scenarios-"));
  const app = await createTestApp();

  const writeSource = (name: string, prefix: unknown) => {
    const sourcePath = join(root, name);
    mkdirSync(sourcePath, { recursive: true });
    const manifest = {
      name,
      publisher: "example",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    };
    writeFileSync(join(sourcePath, "package.json"), JSON.stringify(manifest));
    writeFileSync(
      join(sourcePath, "extension.ts"),
      `export default { resourceKinds: [{id: ${JSON.stringify(name)}, ref: {kind:"resource-kind",id:${JSON.stringify(name)}}, prefix: ${JSON.stringify(prefix)}}] };`,
    );
    return { manifest, sourcePath };
  };

  const install = (projectId: string, name: string, prefix: unknown) => {
    const { manifest, sourcePath } = writeSource(name, prefix);
    return app.deps.extensionService.enableInstalledSourceForProject({
      projectId,
      sourcePath,
      sourceKind: "local_path",
      name,
      installName: name,
      extensionId: `example.${name}`,
      displayName: name,
      manifest,
    });
  };

  const allocate = (projectId: string, name: string) =>
    createResourcesApi(app.deps, { projectId, extensionId: `example.${name}` }).allocate({ kind: name });

  return {
    allocate,
    app,
    install,
    close: async () => {
      await app.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
};

test("a project whose derived shorthand collides with a reserved prefix can still allocate", async () => {
  const harness = await createHarness();
  try {
    const project = await harness.app.deps.projectService.create({ name: "Work Space" });
    expect(project.shorthand).not.toBe("WS");
    await harness.install(project.id, "planner", { $prefix: "project" });

    const allocated = await harness.allocate(project.id, "planner");

    expect(allocated.shorthand).toBe(`${project.shorthand}-1`);
  } finally {
    await harness.close();
  }
});

test("a project whose name has no letters can still allocate", async () => {
  const harness = await createHarness();
  try {
    const project = await harness.app.deps.projectService.create({ name: "2026" });
    await harness.install(project.id, "planner", { $prefix: "project" });

    const allocated = await harness.allocate(project.id, "planner");

    expect(allocated.shorthand).toBe(`${project.shorthand}-1`);
  } finally {
    await harness.close();
  }
});

test("a rejected install leaves no installed source or project instance behind", async () => {
  const harness = await createHarness();
  try {
    const project = await harness.app.deps.projectService.create({ name: "Prompt Studio" });
    await harness.install(project.id, "reports", "RP");

    await expect(harness.install(project.id, "conflict", "RP")).rejects.toThrow("example.reports");

    expect(await harness.app.deps.extensionService.getInstalledSource("conflict")).toBeFalsy();
    const instances = await harness.app.deps.extensionService.listProjectExtensionInstances(project.id);
    expect(instances.map((record) => record.installedSource.extension_id)).not.toContain("example.conflict");
  } finally {
    await harness.close();
  }
});
