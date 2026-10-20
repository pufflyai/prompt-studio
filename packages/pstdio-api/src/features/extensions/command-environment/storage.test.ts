import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createStorageApi } from "./storage";

test("host storage exposes document groups, verified assets, legacy access, and isolated workbench scopes", async () => {
  const root = await mkdtemp(join(tmpdir(), "storage-context-"));
  const previousHome = process.env.PSTDIO_HOME;
  const previousDefaults = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const handle = await createTestApp({ storageRoot: join(root, "storage") });
  try {
    const sourcePath = join(root, "example");
    await mkdir(sourcePath);
    await writeFile(
      join(sourcePath, "package.json"),
      JSON.stringify({
        name: "example",
        publisher: "example",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(join(sourcePath, "extension.ts"), "export default {};");
    const context = async (name: string) => {
      const project = await handle.deps.projectService.create({ name });
      const enabled = await handle.deps.extensionService.enableInstalledSourceForProject({
        projectId: project.id,
        displayName: "Example",
        extensionId: "example.example",
        installName: "example",
        name: "example",
        manifest: { id: "example.example" },
        sourceKind: "local_path",
        sourcePath,
      });
      return createStorageApi(handle.deps, {
        projectId: project.id,
        extensionInstanceId: enabled.instance.id,
        extensionId: enabled.installedSource.extension_id,
      });
    };
    const [first, other] = await Promise.all([context("First"), context("Other")]);
    await first.set("setting", "old API");
    const observed = await first.records.read(first.records.id("setting"));
    expect(observed.value).toBe("old API");
    const asset = await first.assets.stage({
      operationId: "asset",
      source: new Blob(["verified"], { type: "text/plain" }),
    });
    const group = {
      operationId: "save",
      edits: [
        { recordId: first.records.id("setting"), expectedRevision: observed.revision, replace: "new API", asset },
      ],
    };
    expect((await first.records.commit(group)).status).toBe("saved-locally");
    expect(await first.get<string>("setting")).toBe("new API");
    expect((await other.records.read(other.records.id("setting"))).exists).toBe(false);
    const missing = { ...asset, sha256: "0".repeat(64) };
    await expect(
      first.records.commit({
        operationId: "incomplete",
        edits: [
          {
            recordId: first.records.id("partial"),
            expectedRevision: (await first.records.read(first.records.id("partial"))).revision,
            asset: missing,
          },
        ],
      }),
    ).rejects.toThrow();
    expect((await first.records.read(first.records.id("partial"))).exists).toBe(false);
    expect(
      (
        await first.records.commit({
          operationId: "open-caller",
          edits: [{ recordId: first.records.id("setting"), expectedRevision: observed.revision, replace: "retained" }],
        })
      ).status,
    ).toBe("saved-locally");
    expect(await first.get<string>("setting")).toBe("retained");
    const scoped = first.scope({ type: "resource", resource: { type: "example.note", id: "note" } });
    await scoped.set("setting", "scoped");
    expect((await scoped.records.read(scoped.records.id("setting"))).value).toBe("scoped");
    const projectAgain = scoped.scope({ type: "project" });
    expect(projectAgain.records.id("setting")).toBe(first.records.id("setting"));
    expect((await projectAgain.records.read(projectAgain.records.id("setting"))).value).toBe("retained");
  } finally {
    await handle.close();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    if (previousDefaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaults;
    await rm(root, { recursive: true, force: true });
  }
});
