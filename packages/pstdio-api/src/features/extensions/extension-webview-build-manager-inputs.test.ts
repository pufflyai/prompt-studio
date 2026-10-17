import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { writeDependency, writeExtension, writeManagedBuildOutput } from "./test-utils/webview-build-fixture";

describe("createExtensionWebviewBuildManager invalidation", () => {
  test("retries a failed build after its entry source changes without a persisted hash update", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-source-edit-retry-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    let runCount = 0;

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          updated_at: "2026-10-16T00:00:00.000Z",

          id: "installed-lab",
          install_name: "extension-lab",
          source_hash: "unchanged-hash",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async () => {
        return "reported";
      },
      reportBuildSuccess: async () => {
        return "reported";
      },
      buildWebview: async () => {
        runCount++;
        return { success: false, details: "build failed" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.ensure("installed-lab");
      await manager.refresh();
      expect(runCount).toBe(1);

      writeFileSync(join(sourcePath, "src", "main.tsx"), "console.log('fixed webview');");
      await manager.refresh();

      expect(runCount).toBe(2);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("waits for declared dependencies and rebuilds once they are installed", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-dependency-recovery-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "src/main.tsx" }, { dependencies: { "webview-dep": "^1.0.0" } });
    writeFileSync(join(sourcePath, "src", "main.tsx"), 'import "webview-dep";\n');
    const failures: string[] = [];
    let runCount = 0;

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          updated_at: "2026-10-16T00:00:00.000Z",

          id: "installed-lab",
          install_name: "extension-lab",
          source_hash: "unchanged-hash",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async (_installedExtensionId, _webviewId, error) => {
        failures.push(String(error));
        return "reported";
      },
      reportBuildSuccess: async () => {
        return "reported";
      },
      buildWebview: async (input) => {
        runCount++;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.ensure("installed-lab");
      await manager.refresh();

      expect(runCount).toBe(0);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain("webview-dep");
      expect(failures[0]).toContain("bun install");

      writeDependency(sourcePath, "webview-dep", "1.0.0");
      await manager.refresh();

      expect(runCount).toBe(1);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("invalidates builds for manifest and imported dependency changes but not lockfile-only changes", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-input-invalidation-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "src/main.tsx" }, { dependencies: { "webview-dep": "^1.0.0" } });
    writeFileSync(join(sourcePath, "src", "main.tsx"), 'import "webview-dep";\n');
    writeDependency(sourcePath, "webview-dep", "1.0.0");
    let runCount = 0;

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          updated_at: "2026-10-16T00:00:00.000Z",

          id: "installed-lab",
          install_name: "extension-lab",
          source_hash: "unchanged-hash",
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
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.ensure("installed-lab");
      await manager.refresh();
      expect(runCount).toBe(1);

      writeExtension(
        sourcePath,
        { labPage: "src/main.tsx" },
        { dependencies: { "webview-dep": "^1.0.0" }, version: "1.0.1" },
      );
      writeFileSync(join(sourcePath, "src", "main.tsx"), 'import "webview-dep";\n');
      await manager.refresh();
      expect(runCount).toBe(2);

      writeFileSync(join(sourcePath, "bun.lock"), "lockfile revision one");
      await manager.refresh();
      expect(runCount).toBe(2);

      writeDependency(sourcePath, "webview-dep", "2.0.0");
      await manager.refresh();
      expect(runCount).toBe(3);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("createExtensionWebviewBuildManager resilience", () => {
  test("retries an unchanged source after a transient source load failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-source-load-retry-test-"));
    const sourcePath = join(root, "extension");
    mkdirSync(sourcePath, { recursive: true });
    const managerErrors: unknown[] = [];
    let runCount = 0;

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
      onError: (error) => {
        managerErrors.push(error);
      },
      reportBuildFailure: async () => {
        return "reported";
      },
      reportBuildSuccess: async () => {
        return "reported";
      },
      buildWebview: async (input) => {
        runCount++;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.ensure("installed-lab");
      writeExtension(sourcePath, { labPage: "src/main.tsx" });
      await manager.refresh();

      expect(managerErrors).toHaveLength(1);
      expect(runCount).toBe(1);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports command errors as build failures", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-command-error-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const failures: {
      installedExtensionId: string;
      webviewId: string;
      error: unknown;
    }[] = [];
    const managerErrors: unknown[] = [];

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
      onError: (error) => {
        managerErrors.push(error);
      },
      reportBuildFailure: async (installedExtensionId, webviewId, error) => {
        failures.push({ installedExtensionId, webviewId, error });
        return "reported";
      },
      reportBuildSuccess: async () => {
        return "reported";
      },
      buildWebview: async () => {
        throw Object.assign(new Error("ENFILE: file table overflow"), {
          code: "ENFILE",
        });
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.ensure("installed-lab");

      expect(managerErrors).toEqual([]);
      expect(failures).toHaveLength(1);
      expect(failures[0]?.installedExtensionId).toBe("installed-lab");
      expect(failures[0]?.webviewId).toBe("pstdio.lab.view.labPage");
      expect(String(failures[0]?.error)).toContain("ENFILE");
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not report build success after dispose", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-dispose-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const successes: string[] = [];
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
      reportBuildSuccess: async (_installedExtensionId, webviewId) => {
        successes.push(webviewId);
        return "reported";
      },
      buildWebview: async (input) => {
        await buildUnblocked;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const refresh = manager.ensure("installed-lab");
      manager.dispose();
      unblockBuild();
      await refresh;

      expect(successes).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
