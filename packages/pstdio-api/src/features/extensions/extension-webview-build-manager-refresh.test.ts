import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";

type Listener = (...args: unknown[]) => void;

class FakeChildProcess {
  killed = false;
  listeners = new Map<string, Listener[]>();

  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  kill() {
    this.killed = true;
    return true;
  }
}

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
      engines: { pstdio: "^1.0.0" },
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
      engines: { pstdio: "^1.0.0" },
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
      runCommand: async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        arrived++;
        if (arrived === 2) releaseAllArrived();
        // Serial builds never let `arrived` reach 2, so fall back after a short wait.
        await Promise.race([allArrived, Bun.sleep(200)]);
        concurrent--;
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      spawn: () => new FakeChildProcess(),
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

  test("serializes overlapping refreshes so watched builds are not leaked", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-refresh-race-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath);
    const children: FakeChildProcess[] = [];
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
      runCommand: async () => {
        runCount++;
        await buildUnblocked;
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      spawn: () => {
        const child = new FakeChildProcess();
        children.push(child);
        return child;
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
      expect(children).toHaveLength(1);

      manager.dispose();

      expect(children.every((child) => child.killed)).toBe(true);
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
    const children: FakeChildProcess[] = [];
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
      runCommand: async () => {
        runCount++;
        await buildUnblocked;
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      spawn: () => {
        const child = new FakeChildProcess();
        children.push(child);
        return child;
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
      expect(children).toEqual([]);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
