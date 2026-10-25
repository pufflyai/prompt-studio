import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { writeExtension, writeManagedBuildOutput } from "./test-utils/webview-build-fixture";

describe("createExtensionWebviewBuildManager refresh scheduling", () => {
  test("builds an extension's webviews concurrently rather than one at a time", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-parallel-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { first: "src/first.tsx", second: "src/second.tsx" });

    let concurrent = 0;
    let maxConcurrent = 0;
    let arrived = 0;
    let releaseAllArrived: () => void = () => {};
    const allArrived = new Promise<void>((resolve) => {
      releaseAllArrived = resolve;
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
      reportBuildSuccess: async () => {
        return "reported";
      },
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
      await manager.ensure("installed-lab");
      expect(maxConcurrent).toBe(2);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports each successful rebuild without waiting for other managed webviews", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-success-barrier-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { first: "src/first.tsx", second: "src/second.tsx" });
    const successes: string[] = [];
    const firstReported = Promise.withResolvers<void>();
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
        successes.push(webviewId);
        if (webviewId === "pstdio.lab.view.first") firstReported.resolve();
        return "reported";
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
      const refresh = manager.ensure("installed-lab");
      await Promise.all([firstBuildStarted, secondBuildStarted]);

      releaseFirst();
      await firstReported.promise;

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
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    let runCount = 0;
    const buildStarted = Promise.withResolvers<void>();
    let unblockBuild: () => void = () => {};
    const buildUnblocked = new Promise<void>((resolve) => {
      unblockBuild = resolve;
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
      reportBuildSuccess: async () => {
        return "reported";
      },
      buildWebview: async (input) => {
        runCount++;
        buildStarted.resolve();
        await buildUnblocked;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const firstRefresh = manager.ensure("installed-lab");
      await buildStarted.promise;

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
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const successes: string[] = [];
    let sourceHash = "hash-1";
    let runCount = 0;
    const firstStarted = Promise.withResolvers<void>();
    const secondStarted = Promise.withResolvers<void>();
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
      reportBuildSuccess: async (_installedExtensionId, webviewId) => {
        successes.push(webviewId);
        return "reported";
      },
      buildWebview: async (input) => {
        runCount++;
        if (runCount === 1) {
          firstStarted.resolve();
          await firstReleased;
        } else {
          secondStarted.resolve();
          await secondReleased;
        }
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const firstRefresh = manager.ensure("installed-lab");
      await firstStarted.promise;

      writeFileSync(join(sourcePath, "src/main.tsx"), "console.log('updated webview');");
      sourceHash = "hash-2";
      const secondRefresh = manager.refresh();
      releaseFirst();
      await secondStarted.promise;

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
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const reports: string[] = [];
    const buildStarted = Promise.withResolvers<void>();
    let unblockBuild: () => void = () => {};
    const buildUnblocked = new Promise<void>((resolve) => {
      unblockBuild = resolve;
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
        reports.push("failure");
        return "reported";
      },
      reportBuildSuccess: async () => {
        reports.push("success");
        return "reported";
      },
      buildWebview: async (input) => {
        buildStarted.resolve();
        await buildUnblocked;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const refresh = manager.ensure("installed-lab");
      await buildStarted.promise;

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
