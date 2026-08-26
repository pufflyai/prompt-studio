import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";

const writeExtension = (
  root: string,
  entries: Record<string, string>,
  options: { dependencies?: Record<string, string>; version?: string } = {},
) => {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lab",
      version: options.version ?? "1.0.0",
      displayName: "Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
      dependencies: options.dependencies,
    }),
  );
  for (const entry of Object.values(entries)) {
    if (entry.endsWith(".html")) writeFileSync(join(root, entry), "<!doctype html><p>static</p>");
    else writeFileSync(join(root, entry), "console.log('webview');");
  }

  const views = Object.entries(entries)
    .map(
      ([key, path]) => `{
        id: "${key}",
        title: "${key}",
        body: { kind: "webview", entry: { kind: "package-asset", path: "./${path}", baseUrl: import.meta.url } },
      }`,
    )
    .join(",");

  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      views: [${views}],
    };`,
  );
};

const writeDependency = (root: string, name: string, version: string) => {
  const dependencyPath = join(root, "node_modules", name);
  mkdirSync(dependencyPath, { recursive: true });
  writeFileSync(join(dependencyPath, "package.json"), JSON.stringify({ name, version }));
};

const writeManagedBuildOutput = (input: { outdir: string }) => {
  mkdirSync(input.outdir, { recursive: true });
};

describe("createExtensionWebviewBuildManager", () => {
  test("builds source webviews into cache with a one-shot build", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-manager-test-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const builds: { entryPath: string; outdir: string }[] = [];
    const successes: { installName: string; webviewId: string }[] = [];

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          install_name: "extension-lab",
          source_hash: "hash-1",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async (installName, webviewId) => {
        successes.push({ installName, webviewId });
      },
      buildWebview: async (input) => {
        builds.push({ entryPath: input.entryPath, outdir: input.outdir });
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: cacheRoot,
    });

    try {
      await manager.refresh();
      await manager.refresh();

      const distPath = join(cacheRoot, "extension-lab", "pstdio.lab.view.labPage", "dist");
      expect(builds).toHaveLength(1);
      // Bun's path resolution sometimes canonicalizes macOS `/var/...` to `/private/var/...`.
      // Match the entry path tail rather than the full prefix.
      expect(builds[0]?.entryPath).toMatch(/\/src\/main\.tsx$/);
      expect(builds[0]?.outdir).toMatch(/\/dist\.staging-[^/]+$/);
      expect(existsSync(distPath)).toBe(true);

      expect(successes).toEqual([{ installName: "extension-lab", webviewId: "pstdio.lab.view.labPage" }]);
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
          install_name: "extension-lab",
          source_hash: "hash-1",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async () => {
        runCommands.push({});
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();

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
          install_name: "extension-lab",
          source_hash: sourceHash,
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        builtEntries.push(input.entryPath);
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();
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
      installName: string;
      webviewId: string;
      error: unknown;
    }[] = [];

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          install_name: "extension-lab",
          source_hash: "hash-1",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async (installName, webviewId, error) => {
        failures.push({ installName, webviewId, error });
      },
      reportBuildSuccess: async () => {},
      buildWebview: async () => ({ success: false, details: "build failed" }),
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();

      expect(failures).toHaveLength(1);
      expect(failures[0]?.installName).toBe("extension-lab");
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
          install_name: "extension-lab",
          source_hash: sourceHash,
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async (_installName, webviewId) => {
        failures.push(webviewId);
      },
      reportBuildSuccess: async () => {},
      buildWebview: async () => {
        runCount++;
        return { success: false, details: "build failed" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();
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

describe("createExtensionWebviewBuildManager invalidation", () => {
  test("retries a failed build after its entry source changes without a persisted hash update", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-source-edit-retry-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    let runCount = 0;

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          install_name: "extension-lab",
          source_hash: "unchanged-hash",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async () => {
        runCount++;
        return { success: false, details: "build failed" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();
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
          install_name: "extension-lab",
          source_hash: "unchanged-hash",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async (_installName, _webviewId, error) => {
        failures.push(String(error));
      },
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        runCount++;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();
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
          install_name: "extension-lab",
          source_hash: "unchanged-hash",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        runCount++;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();
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
          install_name: "extension-lab",
          source_hash: "hash-1",
          source_path: sourcePath,
        },
      ],
      onError: (error) => {
        managerErrors.push(error);
      },
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        runCount++;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();
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
      installName: string;
      webviewId: string;
      error: unknown;
    }[] = [];
    const managerErrors: unknown[] = [];

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          install_name: "extension-lab",
          source_hash: "hash-1",
          source_path: sourcePath,
        },
      ],
      onError: (error) => {
        managerErrors.push(error);
      },
      reportBuildFailure: async (installName, webviewId, error) => {
        failures.push({ installName, webviewId, error });
      },
      reportBuildSuccess: async () => {},
      buildWebview: async () => {
        throw Object.assign(new Error("ENFILE: file table overflow"), {
          code: "ENFILE",
        });
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();

      expect(managerErrors).toEqual([]);
      expect(failures).toHaveLength(1);
      expect(failures[0]?.installName).toBe("extension-lab");
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
          install_name: "extension-lab",
          source_hash: "hash-1",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async (_installName, webviewId) => {
        successes.push(webviewId);
      },
      buildWebview: async (input) => {
        await buildUnblocked;
        writeManagedBuildOutput(input);
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const refresh = manager.refresh();
      manager.dispose();
      unblockBuild();
      await refresh;

      expect(successes).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
