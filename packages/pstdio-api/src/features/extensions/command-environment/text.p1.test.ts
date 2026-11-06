import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { openPublishedCatalog } from "../publication/catalog";
import { createStorageApi } from "./storage";

test("the declared text facade saves through record authority and respects publication write access", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-text-"));
  const previous = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const app = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  try {
    const source = join(root, "extension");
    await mkdir(source);
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name: "notes",
        publisher: "example",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(
      join(source, "extension.ts"),
      'export default { storage: {records:{text:[{prefix:"note",fields:["/body"]}]}} };',
    );
    const project = await app.deps.projectService.create({ name: "Text project" });
    const enabled = await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      displayName: "Notes",
      extensionId: "example.notes",
      installName: "notes",
      name: "notes",
      version: "1.0.0",
      manifest: {},
      sourceKind: "local_path",
      sourcePath: source,
    });
    const storage = createStorageApi(app.deps, {
      projectId: project.id,
      extensionId: "example.notes",
      extensionInstanceId: enabled.instance.id,
    });
    await storage.records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: { body: "ab" } }] });
    const text = storage.text("note", "/body");
    const outcome = await text.edit([{ kind: "text.insert", index: 1, text: "X" }]);
    expect(outcome.state).toBe("saved-locally");
    expect((await storage.records.read("note")).value).toEqual({ body: "aXb" });
    await expect(
      storage.text("note", "/undeclared").edit([{ kind: "text.insert", index: 0, text: "x" }]),
    ).rejects.toThrow("declared");
    const asset = await app.deps.assetTransferService.stage(
      { workbenchId: project.id, extensionId: "pstdio.published-extensions" },
      crypto.randomUUID(),
      new Blob(["new source"]),
    );
    await (await openPublishedCatalog(app.deps, project.id)).select(
      { extensionId: "example.notes", revision: asset.sha256, version: "2.0.0", enabled: true },
      asset,
    );
    await expect(text.edit([{ kind: "text.insert", index: 0, text: "stale" }])).rejects.toThrow("Update");
    expect((await storage.records.read("note")).value).toEqual({ body: "aXb" });
  } finally {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = previous;
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
