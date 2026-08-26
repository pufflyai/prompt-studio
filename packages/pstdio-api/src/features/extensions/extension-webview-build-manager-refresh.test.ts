import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
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

const writeTwoWebviewExtension = (root: string) => {
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
      views: [
        { id: "first", title: "first", body: { kind: "webview", entry: { kind: "package-asset", path: "./src/first.tsx", baseUrl: import.meta.url } } },
        { id: "second", title: "second", body: { kind: "webview", entry: { kind: "package-asset", path: "./src/second.tsx", baseUrl: import.meta.url } } },
      ],
    };`,
  );
};

const writeManagedBuildOutput = (input: { outdir: string }) => {
  mkdirSync(input.outdir, { recursive: true });
};

describe("createExtensionWebviewBuildManager refresh scheduling", () => {
  test("builds an extension's webviews concurrently rather than one at a time", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-parallel-test-"));
    const sourcePath = join(root, "extension");
    writeTwoWebviewExtension(sourcePath);

    let concurrent = 0;
    let maxConcurrent = 0;
    let arrived = 0;
    let releaseAllArrived: () => void = () => {};
    const allArrived = new Promise<void>((resolve) => {
      releaseAllArrived = resolve;
    });

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        arrived++;
        if (arrived === 2) releaseAllArrived();
        // Serial builds never let `arrived` reach 2, so fall back after a short wait.
        await Promise.race([allArrived, Bun.sleep(200)]);
        concurrent--;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();
      expect(maxConcurrent).toBe(2);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports each successful rebuild without waiting for other managed webviews", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-success-barrier-test-"));
    const sourcePath = join(root, "extension");
    writeTwoWebviewExtension(sourcePath);
    const successes: string[] = [];
    let firstStarted: () => void = () => {};
    let secondStarted: () => void = () => {};
    let releaseFirst: () => void = () => {};
    let releaseSecond: () => void = () => {};
    const firstBuildStarted = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const secondBuildStarted = new Promise<void>((resolve) => {
      secondStarted = resolve;
    });
    const firstBuildReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondBuildReleased = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async (_installName, webviewId) => {
        successes.push(webviewId);
      },
      buildWebview: async (input) => {
        const { entryPath } = input;
        if (entryPath.endsWith("first.tsx")) {
          firstStarted();
          await firstBuildReleased;
        } else {
          secondStarted();
          await secondBuildReleased;
        }
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const refresh = manager.refresh();
      await Promise.all([firstBuildStarted, secondBuildStarted]);

      releaseFirst();
      await Bun.sleep(10);

      expect(successes).toEqual(["pstdio.lab.view.first"]);

      releaseSecond();
      await refresh;

      expect(successes.sort()).toEqual(["pstdio.lab.view.first", "pstdio.lab.view.second"]);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("createExtensionWebviewBuildManager refresh serialization", () => {
  test("serializes overlapping refreshes so unchanged webviews are not rebuilt", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-refresh-race-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath);
    let runCount = 0;
    let unblockBuild: () => void = () => {};
    const buildUnblocked = new Promise<void>((resolve) => {
      unblockBuild = resolve;
    });

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        runCount++;
        await buildUnblocked;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const firstRefresh = manager.refresh();
      await waitFor(() => runCount === 1, "Timed out waiting for first refresh build.");

      const secondRefresh = manager.refresh();
      await Bun.sleep(10);
      unblockBuild();
      await Promise.all([firstRefresh, secondRefresh]);

      expect(runCount).toBe(1);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not report success for an obsolete build when newer build inputs are queued", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-obsolete-build-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath);
    const successes: string[] = [];
    let sourceHash = "hash-1";
    let runCount = 0;
    let releaseFirst: () => void = () => {};
    let releaseSecond: () => void = () => {};
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondReleased = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: sourceHash, source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async (_installName, webviewId) => {
        successes.push(webviewId);
      },
      buildWebview: async (input) => {
        runCount++;
        if (runCount === 1) await firstReleased;
        else await secondReleased;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const firstRefresh = manager.refresh();
      await waitFor(() => runCount === 1, "Timed out waiting for first refresh build.");

      writeFileSync(join(sourcePath, "src/main.tsx"), "console.log('updated webview');");
      sourceHash = "hash-2";
      const secondRefresh = manager.refresh();
      releaseFirst();
      await waitFor(() => runCount === 2, "Timed out waiting for second refresh build.");

      expect(successes).toEqual([]);

      releaseSecond();
      await Promise.all([firstRefresh, secondRefresh]);

      expect(successes).toEqual(["pstdio.lab.view.labPage"]);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("drops build results that finish after dispose", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-refresh-dispose-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath);
    const reports: string[] = [];
    let runCount = 0;
    let unblockBuild: () => void = () => {};
    const buildUnblocked = new Promise<void>((resolve) => {
      unblockBuild = resolve;
    });

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {
        reports.push("failure");
      },
      reportBuildSuccess: async () => {
        reports.push("success");
      },
      buildWebview: async (input) => {
        runCount++;
        await buildUnblocked;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const refresh = manager.refresh();
      await waitFor(() => runCount === 1, "Timed out waiting for build.");

      manager.dispose();
      unblockBuild();
      await refresh;

      expect(reports).toEqual([]);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
