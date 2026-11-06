import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import { openPublishedCatalog } from "../publication/catalog";
import { createStorageApi } from "./storage";

test("declared extension logs preserve owner scopes and publication write permission", async () => {
  const root = await mkdtemp(join(tmpdir(), "extension-logs-"));
  const previous = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const app = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  try {
    const source = join(root, "extension");
    await mkdir(source);
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name: "logs",
        publisher: "example",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(
      join(source, "extension.ts"),
      'export default { storage: {logs:["comments", {name:"runs",writer:"device",keep:{days:30}}]} };',
    );
    const context = async (name: string) => {
      const project = await app.deps.projectService.create({ name });
      const enabled = await app.deps.extensionService.enableInstalledSourceForProject({
        projectId: project.id,
        displayName: "Logs",
        extensionId: "example.logs",
        installName: "logs",
        name: "logs",
        version: "1.0.0",
        manifest: {},
        sourceKind: "local_path",
        sourcePath: source,
      });
      return {
        project,
        api: createStorageApi(app.deps, {
          projectId: project.id,
          extensionId: "example.logs",
          extensionInstanceId: enabled.instance.id,
        }),
      };
    };
    const first = await context("First log project");
    const second = await context("Second log project");
    const comments = first.api.log("comments", {
      scope: { type: "resource", resource: { type: "ticket", id: "card" } },
    });
    await comments.append({ text: "saved offline" }, { id: "comment" });
    expect((await comments.read({ after: 0 })).entries.map((entry) => entry.id)).toEqual(["comment"]);
    expect((await first.api.log("comments").read({ after: 0 })).entries).toEqual([]);
    expect((await second.api.log("comments").read({ after: 0 })).entries).toEqual([]);
    await expect(first.api.log("undeclared").read({ after: 0 })).rejects.toThrow("not declared");
    const asset = await app.deps.assetTransferService.stage(
      { workbenchId: first.project.id, extensionId: "pstdio.published-extensions" },
      crypto.randomUUID(),
      new Blob(["new source"]),
    );
    await (await openPublishedCatalog(app.deps, first.project.id)).select(
      { extensionId: "example.logs", revision: asset.sha256, version: "2.0.0", enabled: true },
      asset,
    );
    await expect(comments.append("old writer")).rejects.toThrow("Update");
    expect((await comments.read({ after: 0 })).entries).toHaveLength(1);
  } finally {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = previous;
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
