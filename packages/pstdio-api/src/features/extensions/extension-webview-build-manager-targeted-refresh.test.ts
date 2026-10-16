import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { extensionLoadKey } from "pstdio-extensions";
import { loadExtensionSource } from "./extension-runtime";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";

const writeExtension = (root: string) => {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      displayName: "Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(root, "src/first.tsx"), "console.log('first');");
  writeFileSync(join(root, "src/second.tsx"), "console.log('second');");
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      views: [
        { id: "first", title: "first", body: { kind: "webview", entry: { kind: "package-asset", path: "./src/first.tsx", baseUrl: import.meta.url } } },
        { id: "second", title: "second", body: { kind: "webview", entry: { kind: "package-asset", path: "./src/second.tsx", baseUrl: import.meta.url } } },
      ],
    };`,
  );
};

const writeSingleWebviewExtension = (root: string) => {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      displayName: "Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(root, "src/main.tsx"), "console.log('webview');");
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      views: [{
        id: "labPage",
        title: "labPage",
        body: { kind: "webview", entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: import.meta.url } },
      }],
    };`,
  );
};

describe("createExtensionWebviewBuildManager targeted refresh scheduling", () => {
  test("reuses the extension loaded by source validation", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-loaded-source-test-"));
    const sourcePath = join(root, "extension");
    writeSingleWebviewExtension(sourcePath);
    const loaded = await loadExtensionSource(sourcePath);
    const snapshot = { loaded, loadKey: extensionLoadKey(sourcePath) };
    let buildCount = 0;
    let loadCount = 0;

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          updated_at: "2026-10-16T00:00:00.000Z",

          id: "installed-lab",
          install_name: "extension-lab",
          source_hash: "hash-1",
          source_path: sourcePath,
        },
      ],
      loadSource: async (path) => {
        loadCount++;
        return loadExtensionSource(path);
      },
      reportBuildFailure: async () => {
        return "reported";
      },
      reportBuildSuccess: async () => {
        return "reported";
      },
      buildWebview: async (input) => {
        buildCount++;
        mkdirSync(input.outdir, { recursive: true });
        writeFileSync(join(input.outdir, "module.js"), "");
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.adopt(sourcePath, snapshot);
      expect(buildCount).toBe(1);
      expect(loadCount).toBe(0);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("starts a changed source rebuild while an unchanged sibling build is still running", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-targeted-refresh-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath);
    let firstBuildCount = 0;
    let secondBuildCount = 0;
    const firstStarted = Promise.withResolvers<void>();
    const secondStarted = Promise.withResolvers<void>();
    const firstPublished = Promise.withResolvers<void>();
    const updatedFirstStarted = Promise.withResolvers<void>();
    let releaseInitialFirst: () => void = () => {};
    let releaseUpdatedFirst: () => void = () => {};
    let releaseSecond: () => void = () => {};
    const initialFirstReleased = new Promise<void>((resolve) => {
      releaseInitialFirst = resolve;
    });
    const updatedFirstReleased = new Promise<void>((resolve) => {
      releaseUpdatedFirst = resolve;
    });
    const secondReleased = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          updated_at: "2026-10-16T00:00:00.000Z",

          id: "installed-lab",
          install_name: "extension-lab",
          source_hash: "hash-1",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async () => {
        return "reported";
      },
      reportBuildSuccess: async (_installedExtensionId, webviewId) => {
        if (webviewId === "pstdio.lab.view.first") firstPublished.resolve();
        return "reported";
      },
      buildWebview: async (input) => {
        if (input.entryPath.endsWith("first.tsx")) {
          firstBuildCount++;
          if (firstBuildCount === 1) {
            firstStarted.resolve();
            await initialFirstReleased;
          } else {
            updatedFirstStarted.resolve();
            await updatedFirstReleased;
          }
        } else {
          secondBuildCount++;
          secondStarted.resolve();
          await secondReleased;
        }
        mkdirSync(input.outdir, { recursive: true });
        writeFileSync(join(input.outdir, "module.js"), "");
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const initialRefresh = manager.ensure("installed-lab");
      await Promise.all([firstStarted.promise, secondStarted.promise]);
      releaseInitialFirst();
      await firstPublished.promise;
      expect(existsSync(join(root, "cache/installed-lab/pstdio.lab.view.first/dist"))).toBe(true);

      writeFileSync(join(sourcePath, "src/first.tsx"), "console.log('updated first');");
      const targetedRefresh = manager.refresh(sourcePath);
      await updatedFirstStarted.promise;

      expect(firstBuildCount).toBe(2);
      expect(secondBuildCount).toBe(1);
      releaseUpdatedFirst();
      await targetedRefresh;

      releaseSecond();
      await initialRefresh;
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("publishes an exact targeted build across an unrelated source registration update", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-registration-update-test-"));
    const sourcePath = join(root, "extension");
    writeSingleWebviewExtension(sourcePath);
    const successes: Array<{ sourceHash?: string | null; sourcePath: string }> = [];
    const buildStarted = Promise.withResolvers<void>();
    let sourceHash = "hash-1";
    let runCount = 0;
    let releaseBuild: () => void = () => {};
    const buildReleased = new Promise<void>((resolve) => {
      releaseBuild = resolve;
    });

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          updated_at: "2026-10-16T00:00:00.000Z",

          id: "installed-lab",
          install_name: "extension-lab",
          source_hash: sourceHash,
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async () => {
        return "reported";
      },
      reportBuildSuccess: async (_installedExtensionId, _webviewId, expectedSource) => {
        successes.push(expectedSource);
        return "reported";
      },
      buildWebview: async (input) => {
        runCount++;
        buildStarted.resolve();
        if (runCount === 1) await buildReleased;
        mkdirSync(input.outdir, { recursive: true });
        writeFileSync(join(input.outdir, "module.js"), "");
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const targetedRefresh = manager.ensure("installed-lab");
      await buildStarted.promise;

      const definitionPath = join(sourcePath, "extension.ts");
      writeFileSync(
        definitionPath,
        readFileSync(definitionPath, "utf8").replace("export default {", 'export default { description: "updated",'),
      );
      sourceHash = "hash-2";
      const registrationRefresh = manager.refresh();
      releaseBuild();
      await targetedRefresh;

      await registrationRefresh;
      expect(successes.length).toBeGreaterThan(0);
      expect(successes.every((source) => source.sourcePath === sourcePath && source.sourceHash === "hash-2")).toBe(
        true,
      );
      expect(runCount).toBe(1);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
