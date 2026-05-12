import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createExtensionWebviewBuildManager,
  resolveManagedWebviewBuildCommand,
} from "./extension-webview-build-manager";

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

  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

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
  test("builds source webviews into cache and starts watch processes", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-build-manager-test-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath, { labPage: "src/main.tsx" });
    const child = new FakeChildProcess();
    const runCommands: { file: string; args: string[]; cwd: string }[] = [];
    const spawned: { file: string; args: string[]; cwd: string }[] = [];
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
        return { exitCode: 0, stderr: "", stdout: "" };
      },
      spawn: (file, args, options) => {
        spawned.push({ file, args: [...args], cwd: options.cwd });
        return child;
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
        "--no-clear-screen",
      ];

      expect(runCommands).toHaveLength(1);
      expect(runCommands[0]?.file).toBe("bun");
      expect(runCommands[0]?.cwd).toBe(sourcePath);
      // Bun's path resolution sometimes canonicalizes macOS `/var/...` to `/private/var/...`.
      // Match the entry path tail rather than the full prefix.
      expect(runCommands[0]?.args[0]).toBe("build");
      expect(runCommands[0]?.args[1]).toMatch(/extension\/src\/main\.tsx$/);
      expect(runCommands[0]?.args.slice(2)).toEqual(tailArgs);

      expect(spawned).toHaveLength(1);
      expect(spawned[0]?.args.slice(2)).toEqual([...tailArgs, "--watch"]);
      expect(successes).toEqual([{ installName: "extension-lab", webviewId: "lab.labPage" }]);
      expect(child.killed).toBe(false);
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
    const spawned: unknown[] = [];

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
      spawn: () => {
        spawned.push({});
        return new FakeChildProcess();
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();

      expect(runCommands).toEqual([]);
      expect(spawned).toEqual([]);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("restarts watched builds when source hash changes and tracks multiple webviews independently", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-restart-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath, { first: "src/first.tsx", second: "src/second.tsx" });
    const children: FakeChildProcess[] = [];
    let sourceHash = "hash-1";

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: sourceHash, source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      runCommand: async () => ({ exitCode: 0, stderr: "", stdout: "" }),
      spawn: () => {
        const child = new FakeChildProcess();
        children.push(child);
        return child;
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      await manager.refresh();
      await manager.refresh();
      expect(children).toHaveLength(2);
      expect(children.every((child) => !child.killed)).toBe(true);

      sourceHash = "hash-2";
      await manager.refresh();

      expect(children).toHaveLength(4);
      expect(children[0]?.killed).toBe(true);
      expect(children[1]?.killed).toBe(true);
      expect(children[2]?.killed).toBe(false);
      expect(children[3]?.killed).toBe(false);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("reports build failures and does not start watch when one-shot build fails", async () => {
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
      spawn: () => {
        throw new Error("watch should not start");
      },
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
});
