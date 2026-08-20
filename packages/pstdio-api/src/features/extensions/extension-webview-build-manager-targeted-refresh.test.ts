import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { loadExtensionSource } from "./extension-runtime";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";

const waitFor = async (predicate: () => boolean, message: string) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) return;
    await Bun.sleep(1);
  }
  throw new Error(message);
};

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
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(join(root, "src/first.tsx"), "console.log('first');");
  writeFileSync(join(root, "src/second.tsx"), "console.log('second');");
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      routes: {
        first: { path: "first", label: "first", webview: { entry: { kind: "package-asset", path: "./src/first.tsx", baseUrl: import.meta.url } } },
        second: { path: "second", label: "second", webview: { entry: { kind: "package-asset", path: "./src/second.tsx", baseUrl: import.meta.url } } },
      },
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
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(join(root, "src/main.tsx"), "console.log('webview');");
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      routes: {
        labPage: {
          path: "labPage",
          label: "labPage",
          webview: { entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: import.meta.url } },
        },
      },
    };`,
  );
};

describe("createExtensionWebviewBuildManager targeted refresh scheduling", () => {
  test("reuses the extension loaded by source validation", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-loaded-source-test-"));
    const sourcePath = join(root, "extension");
    writeSingleWebviewExtension(sourcePath);
    const loaded = await loadExtensionSource(sourcePath);
    rmSync(join(sourcePath, "extension.ts"));
    let buildCount = 0;

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        buildCount++;
        mkdirSync(input.outdir, { recursive: true });
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh(sourcePath, loaded);
      expect(buildCount).toBe(1);
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
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        if (input.entryPath.endsWith("first.tsx")) {
          firstBuildCount++;
          if (firstBuildCount === 1) await initialFirstReleased;
          else await updatedFirstReleased;
        } else {
          secondBuildCount++;
          await secondReleased;
        }
        mkdirSync(input.outdir, { recursive: true });
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const initialRefresh = manager.refresh();
      await waitFor(
        () => firstBuildCount === 1 && secondBuildCount === 1,
        "Timed out waiting for the initial webview builds.",
      );
      releaseInitialFirst();
      await waitFor(
        () => existsSync(join(root, "cache/extension-lab/lab.first/dist")),
        "First build was not published.",
      );

      writeFileSync(join(sourcePath, "src/first.tsx"), "console.log('updated first');");
      const targetedRefresh = manager.refresh(sourcePath);
      await waitFor(() => firstBuildCount === 2, "Changed webview rebuild did not start.");

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
    let sourceHash = "hash-1";
    let runCount = 0;
    let releaseBuild: () => void = () => {};
    const buildReleased = new Promise<void>((resolve) => {
      releaseBuild = resolve;
    });

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: sourceHash, source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async (_installName, _webviewId, expectedSource) => {
        successes.push(expectedSource);
      },
      buildWebview: async (input) => {
        runCount++;
        if (runCount === 1) await buildReleased;
        mkdirSync(input.outdir, { recursive: true });
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const targetedRefresh = manager.refresh(sourcePath);
      await waitFor(() => runCount === 1, "Timed out waiting for targeted build.");

      writeFileSync(join(sourcePath, "extension.ts"), "export default { routes: ;");
      sourceHash = "hash-2";
      const registrationRefresh = manager.refresh();
      releaseBuild();
      await targetedRefresh;

      expect(successes).toEqual([{ sourcePath }]);

      await registrationRefresh;
      expect(runCount).toBe(1);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
