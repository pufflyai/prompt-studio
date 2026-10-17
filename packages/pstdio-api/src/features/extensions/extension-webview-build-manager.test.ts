import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { writeExtension, writeManagedBuildOutput } from "./test-utils/webview-build-fixture";

describe("createExtensionWebviewBuildManager", () => {
  test("builds source webviews into cache with a one-shot build", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-manager-test-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const builds: { entryPath: string; outdir: string }[] = [];
    const successes: { installedExtensionId: string; webviewId: string }[] = [];

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
      reportBuildSuccess: async (installedExtensionId, webviewId) => {
        successes.push({ installedExtensionId, webviewId });
        return "reported";
      },
      buildWebview: async (input) => {
        builds.push({ entryPath: input.entryPath, outdir: input.outdir });
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: cacheRoot,
    });

    try {
      await manager.ensure("installed-lab");
      await manager.refresh();

      const distPath = join(cacheRoot, "installed-lab", "pstdio.lab.view.labPage", "dist");
      expect(builds).toHaveLength(1);
      // Bun's path resolution sometimes canonicalizes macOS `/var/...` to `/private/var/...`.
      // Match the entry path tail rather than the full prefix.
      expect(builds[0]?.entryPath).toMatch(/[\\/]src[\\/]main\.tsx$/);
      expect(builds[0]?.outdir).toMatch(/[\\/]dist\.staging-[^\\/]+$/);
      expect(existsSync(distPath)).toBe(true);

      expect(successes).toEqual([{ installedExtensionId: "installed-lab", webviewId: "pstdio.lab.view.labPage" }]);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not build static html webviews", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-static-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "static.html" });
    const runCommands: unknown[] = [];

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
      buildWebview: async () => {
        runCommands.push({});
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.ensure("installed-lab");

      expect(runCommands).toEqual([]);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("createExtensionWebviewBuildManager lifecycle", () => {
  test("rebuilds only the webview whose build inputs changed", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-restart-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, {
      first: "src/first.tsx",
      second: "src/second.tsx",
    });
    const builtEntries: string[] = [];
    let sourceHash = "hash-1";

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
      reportBuildSuccess: async () => {
        return "reported";
      },
      buildWebview: async (input) => {
        builtEntries.push(input.entryPath);
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.ensure("installed-lab");
      await manager.refresh();
      expect(builtEntries).toHaveLength(2);

      writeFileSync(join(sourcePath, "src/first.tsx"), "console.log('updated first webview');");
      sourceHash = "hash-2";
      await manager.refresh();

      expect(builtEntries).toHaveLength(3);
      expect(builtEntries.filter((entry) => entry.endsWith("first.tsx"))).toHaveLength(2);
      expect(builtEntries.filter((entry) => entry.endsWith("second.tsx"))).toHaveLength(1);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports build failures when one-shot build fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-failure-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const failures: {
      installedExtensionId: string;
      webviewId: string;
      error: unknown;
    }[] = [];

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
      reportBuildFailure: async (installedExtensionId, webviewId, error) => {
        failures.push({ installedExtensionId, webviewId, error });
        return "reported";
      },
      reportBuildSuccess: async () => {
        return "reported";
      },
      buildWebview: async () => ({ success: false, details: "build failed" }),
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.ensure("installed-lab");

      expect(failures).toHaveLength(1);
      expect(failures[0]?.installedExtensionId).toBe("installed-lab");
      expect(failures[0]?.webviewId).toBe("pstdio.lab.view.labPage");
      expect(String(failures[0]?.error)).toContain("build failed");
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not retry a failed unchanged source until its build inputs change", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-backoff-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const failures: string[] = [];
    let sourceHash = "hash-1";
    let runCount = 0;

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
      reportBuildFailure: async (_installedExtensionId, webviewId) => {
        failures.push(webviewId);
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
      expect(failures).toEqual(["pstdio.lab.view.labPage"]);

      writeFileSync(join(sourcePath, "src/main.tsx"), "console.log('fixed webview');");
      sourceHash = "hash-2";
      await manager.refresh();

      expect(runCount).toBe(2);
      expect(failures).toEqual(["pstdio.lab.view.labPage", "pstdio.lab.view.labPage"]);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
