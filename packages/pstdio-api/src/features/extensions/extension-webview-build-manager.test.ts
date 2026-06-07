import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createExtensionWebviewBuildManager,
  resolveManagedWebviewBuildCommand,
} from "./extension-webview-build-manager";

const writeExtension = (root: string, entries: Record<string, string>) => {
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
  for (const entry of Object.values(entries)) {
    if (entry.endsWith(".html")) writeFileSync(join(root, entry), "<!doctype html><p>static</p>");
    else writeFileSync(join(root, entry), "console.log('webview');");
  }

  const routes = Object.entries(entries)
    .map(
      ([key, path]) => `${key}: {
        path: "${key}",
        label: "${key}",
        webview: { entry: { kind: "package-asset", path: "./${path}", baseUrl: import.meta.url } },
      }`,
    )
    .join(",");

  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      routes: { ${routes} },
    };`,
  );
};

const writeManagedBuildOutput = (args: readonly string[]) => {
  const outdir = args[args.indexOf("--outdir") + 1];
  if (outdir) mkdirSync(outdir, { recursive: true });
};

describe("resolveManagedWebviewBuildCommand", () => {
  test("uses the compiled pstdio binary as Bun in packaged mode", () => {
    const resolved = resolveManagedWebviewBuildCommand({
      args: ["build", "/extension/src/main.tsx", "--outdir", "/cache/dist"],
      bunCacheDir: "/tmp/pstdio-bun-cache",
      env: {},
      isPackaged: true,
      processExecPath: "/Applications/Prompt Studio.app/pstdio",
    });

    expect(resolved.file).toBe("/Applications/Prompt Studio.app/pstdio");
    expect(resolved.args).toEqual(["build", "/extension/src/main.tsx", "--outdir", "/cache/dist"]);
    expect(resolved.env.BUN_BE_BUN).toBe("1");
    expect(resolved.env.BUN_INSTALL_CACHE_DIR).toBe("/tmp/pstdio-bun-cache");
  });
});

describe("createExtensionWebviewBuildManager", () => {
  test("builds source webviews into cache with a one-shot build", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-manager-test-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const runCommands: { file: string; args: string[]; cwd: string }[] = [];
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
      runCommand: async (file, args, options) => {
        runCommands.push({ file, args: [...args], cwd: options.cwd });
        writeManagedBuildOutput(args);
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      webviewCacheRoot: cacheRoot,
    });

    try {
      await manager.refresh();
      await manager.refresh();

      const distPath = join(cacheRoot, "extension-lab", "lab.labPage", "dist");
      const tailArgs = [
        "--outdir",
        distPath,
        "--target",
        "browser",
        "--format",
        "esm",
        "--entry-naming",
        "module.[ext]",
        "--asset-naming",
        "[name]-[hash].[ext]",
      ];

      expect(runCommands).toHaveLength(1);
      expect(runCommands[0]?.file).toBe("bun");
      expect(runCommands[0]?.cwd).toBe(sourcePath);
      // Bun's path resolution sometimes canonicalizes macOS `/var/...` to `/private/var/...`.
      // Match the entry path tail rather than the full prefix.
      expect(runCommands[0]?.args[0]).toBe("build");
      expect(runCommands[0]?.args[1]).toMatch(/\/src\/main\.tsx$/);
      expect(runCommands[0]?.args.slice(2)).toEqual([
        "--outdir",
        expect.stringMatching(/\/dist\.staging-[^/]+$/),
        ...tailArgs.slice(2),
      ]);

      expect(successes).toEqual([{ installName: "extension-lab", webviewId: "lab.labPage" }]);
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
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      runCommand: async () => {
        runCommands.push({});
        return { exitCode: 0, stderr: "", stdout: "" };
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
  test("rebuilds when source hash changes and tracks multiple webviews independently", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-restart-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { first: "src/first.tsx", second: "src/second.tsx" });
    const runCommands: string[][] = [];
    let sourceHash = "hash-1";

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: sourceHash, source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      runCommand: async (_file, args) => {
        runCommands.push([...args]);
        writeManagedBuildOutput(args);
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();
      await manager.refresh();
      expect(runCommands).toHaveLength(2);

      sourceHash = "hash-2";
      await manager.refresh();

      expect(runCommands).toHaveLength(4);
      expect(runCommands.every((args) => !args.includes("--watch"))).toBe(true);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports build failures when one-shot build fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-failure-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const failures: { installName: string; webviewId: string; error: unknown }[] = [];

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async (installName, webviewId, error) => {
        failures.push({ installName, webviewId, error });
      },
      reportBuildSuccess: async () => {},
      runCommand: async () => ({ exitCode: 1, stderr: "build failed", stdout: "" }),
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();

      expect(failures).toHaveLength(1);
      expect(failures[0]?.installName).toBe("extension-lab");
      expect(failures[0]?.webviewId).toBe("lab.labPage");
      expect(String(failures[0]?.error)).toContain("build failed");
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports command errors as build failures", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-command-error-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const failures: { installName: string; webviewId: string; error: unknown }[] = [];
    const managerErrors: unknown[] = [];

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      onError: (error) => {
        managerErrors.push(error);
      },
      reportBuildFailure: async (installName, webviewId, error) => {
        failures.push({ installName, webviewId, error });
      },
      reportBuildSuccess: async () => {},
      runCommand: async () => {
        throw Object.assign(new Error("ENFILE: file table overflow"), { code: "ENFILE" });
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();

      expect(managerErrors).toEqual([]);
      expect(failures).toHaveLength(1);
      expect(failures[0]?.installName).toBe("extension-lab");
      expect(failures[0]?.webviewId).toBe("lab.labPage");
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
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async (_installName, webviewId) => {
        successes.push(webviewId);
      },
      runCommand: async (_file, args) => {
        await buildUnblocked;
        writeManagedBuildOutput(args);
        return { exitCode: 0, stderr: "", stdout: "" };
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
