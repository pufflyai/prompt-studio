import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createDb, createInstalledExtensionSourcesDBService } from "pstdio-db";
import { reloadInstalledSourceBySourcePath } from "./extension-reload";

const cleanup: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

const writeExtension = (root: string, enginesPstdio = `^${EXTENSION_API_VERSION}`) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "reload-state",
      version: "1.0.0",
      displayName: "Reload State",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: enginesPstdio },
    }),
  );
  writeFileSync(join(root, "extension.ts"), "export default {};\n");
};

describe("reloadInstalledSourceBySourcePath published state", () => {
  test("does not expose loaded state or a new revision before runtime refresh completes", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-reload-pending-test-"));
    cleanup.push(() => rmSync(root, { recursive: true, force: true }));
    writeExtension(root);

    const database = await createDb({ path: ":memory:" });
    cleanup.push(database.close);
    const sources = createInstalledExtensionSourcesDBService(database.db);
    const registered = await sources.register({
      display_name: "Reload State",
      extension_id: "pstdio.reload-state",
      install_name: "reload-state-pending",
      loaded_revision: "published-revision",
      manifest_json: {},
      source_hash: "old-hash",
      source_kind: "local_path",
      source_path: root,
      source_ref: null,
      status: "loaded",
      version: "1.0.0",
    });
    let markRefreshStarted = () => {};
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    let finishRefresh = () => {};
    const refreshFinished = new Promise<void>((resolve) => {
      finishRefresh = resolve;
    });

    const reload = reloadInstalledSourceBySourcePath(
      {
        emitInstalledSource: () => {},
        installedExtensionSourcesService: sources,
        notifyInstalledSourcesChanged: async () => {
          markRefreshStarted();
          await refreshFinished;
        },
      },
      root,
    );

    await refreshStarted;
    const refreshing = await sources.get(registered.id);
    expect(refreshing).toMatchObject({
      last_error_json: null,
      loaded_revision: "published-revision",
      status: "pending",
    });

    finishRefresh();
    const result = await reload;
    expect(result.installedSource.status).toBe("loaded");
    expect(result.installedSource.loaded_revision).not.toBe("published-revision");
  });

  test("emits the state produced after runtime refresh completes", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-reload-state-test-"));
    cleanup.push(() => rmSync(root, { recursive: true, force: true }));
    writeExtension(root);

    const database = await createDb({ path: ":memory:" });
    cleanup.push(database.close);
    const sources = createInstalledExtensionSourcesDBService(database.db);
    await sources.register({
      display_name: "Reload State",
      extension_id: "pstdio.reload-state",
      install_name: "reload-state",
      manifest_json: {},
      source_hash: "old-hash",
      source_kind: "local_path",
      source_path: root,
      source_ref: null,
      status: "loaded",
      version: "1.0.0",
    });
    const emitted: unknown[] = [];

    const result = await reloadInstalledSourceBySourcePath(
      {
        emitInstalledSource: (source) => emitted.push(source),
        installedExtensionSourcesService: sources,
        notifyInstalledSourcesChanged: async (sourcePath) => {
          const source = await sources.getBySourcePath(sourcePath ?? "");
          if (!source) throw new Error("Installed source disappeared during refresh.");
          await sources.updateLoadState(source.id, { loaded_revision: "published-revision" });
        },
      },
      root,
    );

    expect(result.installedSource.loaded_revision).toBe("published-revision");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ loaded_revision: "published-revision" });
  });

  test("reports why the changed source failed validation", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-reload-incompatible-test-"));
    cleanup.push(() => rmSync(root, { recursive: true, force: true }));
    writeExtension(root, "^0.0.9");

    const database = await createDb({ path: ":memory:" });
    cleanup.push(database.close);
    const sources = createInstalledExtensionSourcesDBService(database.db);
    await sources.register({
      display_name: "Reload State",
      extension_id: "pstdio.reload-state",
      install_name: "reload-state-incompatible",
      manifest_json: {},
      source_hash: "old-hash",
      source_kind: "local_path",
      source_path: root,
      source_ref: null,
      status: "loaded",
      version: "1.0.0",
    });

    const result = await reloadInstalledSourceBySourcePath(
      {
        emitInstalledSource: () => {},
        installedExtensionSourcesService: sources,
        notifyInstalledSourcesChanged: async () => {},
      },
      root,
    );

    expect(result.installedSource.status).toBe("error");
    expect(result.installedSource.last_error_json).toMatchObject({
      code: "extension_manifest_unsupported_api_version",
      message: expect.stringContaining(`add "^${EXTENSION_API_VERSION}" to engines.pstdio`),
    });
  });
});
