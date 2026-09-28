import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";
import { createTestExtensionSource } from "./test-utils/create-test-extension-source";

const disposers: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const dispose of disposers.splice(0).reverse()) await dispose();
});

test.each([
  "reload",
  "upgrade",
  "restart",
])("%s initializes an upgraded shared extension in every enabled project", async (action) => {
  const root = mkdtempSync(join(tmpdir(), "project-extension-upgrade-"));
  disposers.push(() => rmSync(root, { recursive: true, force: true }));
  const options = { databasePath: join(root, "database"), storageRoot: join(root, "storage") };
  let handle = await createTestApp(options);
  disposers.push(() => handle.close());
  const sourcePath = createTestExtensionSource({
    root,
    name: "upgrade-data",
    installName: "upgrade-data",
    displayName: "Upgrade data",
  });
  const loaded = await loadExtensionSource(sourcePath);
  const aliasPath = join(root, "source-alias");
  symlinkSync(sourcePath, aliasPath);
  const registration = {
    name: loaded.metadata.name,
    extensionId: loaded.metadata.id,
    installName: "upgrade-data",
    displayName: loaded.metadata.displayName,
    sourceKind: "local_path" as const,
    sourcePath,
    sourceHash: hashExtensionSource(sourcePath),
    manifest: loaded.manifest,
    version: "1.0.0",
  };
  const projects: Array<{ id: string; path: string; enabled: boolean }> = [];
  for (const name of ["First upgrade project", "Second upgrade project", "Disabled project"]) {
    const input = folderProjectInput({ name });
    const response = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    const enabled = name !== "Disabled project";
    projects.push({ id: project.id, path: input.initial_workspace.params.path, enabled });
    const { instance } = await handle.deps.extensionService.enableInstalledSourceForProject({
      ...registration,
      projectId: project.id,
      sourcePath: name === "Second upgrade project" ? aliasPath : sourcePath,
    });
    if (!enabled) await handle.deps.extensionService.setProjectExtensionEnabled(instance.id, false);
  }
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `export default {
    hooks: [{ id: "initialize", ref: { kind: "hook", id: "initialize" },
      event: { extensionId: "pstdio", kind: "event", id: "project.opened" },
      async run(ctx) {
        if (await ctx.storage.get("migrated")) return;
        await ctx.projectFiles.writeText("migration-result.txt", ctx.projectId);
        await ctx.storage.set("migrated", true);
      }
    }]
  };`,
  );
  if (action === "reload") {
    await handle.deps.extensionService.reloadInstalledSourceBySourcePath(sourcePath);
  } else if (action === "upgrade") {
    await handle.deps.extensionService.registerInstalledSource({
      ...registration,
      sourceHash: hashExtensionSource(sourcePath),
      version: "2.0.0",
    });
  } else {
    await handle.close();
    handle = await createTestApp(options);
    const deadline = Date.now() + 5_000;
    while (
      projects.some((project) => project.enabled && !existsSync(join(project.path, "migration-result.txt"))) &&
      Date.now() < deadline
    ) {
      await Bun.sleep(10);
    }
  }
  for (const project of projects) {
    expect(existsSync(join(project.path, "migration-result.txt"))).toBe(project.enabled);
    if (project.enabled) expect(readFileSync(join(project.path, "migration-result.txt"), "utf8")).toBe(project.id);
  }
});
