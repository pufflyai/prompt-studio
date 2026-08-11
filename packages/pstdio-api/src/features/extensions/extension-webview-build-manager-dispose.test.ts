import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";

const waitFor = async (predicate: () => boolean, message: string) => {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (predicate()) return;
    await Bun.sleep(5);
  }
  throw new Error(message);
};

const writeExtension = (root: string, options: { loadStartedPath?: string } = {}) => {
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
    `${options.loadStartedPath ? `await Bun.write(${JSON.stringify(options.loadStartedPath)}, "started");\nawait Bun.sleep(40);\n` : ""}export default {
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

describe("createExtensionWebviewBuildManager dispose", () => {
  test("aborts active build commands", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-refresh-abort-test-"));
    const sourcePath = join(root, "extension");
    writeExtension(sourcePath);
    let runCount = 0;
    let buildSignal: AbortSignal | undefined;

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        runCount++;
        buildSignal = input.signal;
        await Promise.race([
          new Promise<void>((resolve) => input.signal.addEventListener("abort", () => resolve(), { once: true })),
          Bun.sleep(20),
        ]);
        return { success: false, details: "aborted" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const refresh = manager.refresh();
      await waitFor(() => runCount === 1, "Timed out waiting for build.");

      manager.dispose();
      await refresh;

      expect(buildSignal?.aborted).toBe(true);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not start build commands after dispose while loading the extension source", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-load-dispose-test-"));
    const sourcePath = join(root, "extension");
    const loadStartedPath = join(root, "load-started");
    writeExtension(sourcePath, { loadStartedPath });
    let runCount = 0;

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async () => {
        runCount++;
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });

    try {
      const refresh = manager.refresh();
      await waitFor(() => existsSync(loadStartedPath), "Timed out waiting for extension load.");

      manager.dispose();
      await refresh;

      expect(runCount).toBe(0);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
