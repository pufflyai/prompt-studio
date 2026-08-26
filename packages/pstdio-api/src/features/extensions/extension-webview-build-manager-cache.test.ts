import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { EXTENSION_INSTALLING_MARKER } from "./install-extension-source";

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
        title: "Lab",
        body: { kind: "webview", entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: import.meta.url } },
      }],
    };`,
  );
};

const writeExtensionWithIndependentWebviews = (root: string) => {
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
  writeFileSync(join(root, "src/main.tsx"), "console.log('main');");
  writeFileSync(join(root, "src/faulty.tsx"), "console.log('faulty');");
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      views: [
        { id: "labPage", title: "Lab", body: { kind: "webview", entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: import.meta.url } } },
        { id: "faultyPage", title: "Faulty", body: { kind: "webview", entry: { kind: "package-asset", path: "./src/faulty.tsx", baseUrl: import.meta.url } } },
      ],
    };`,
  );
};

describe("createExtensionWebviewBuildManager cache recovery", () => {
  test("rebuilds an unchanged webview when its published bundle is missing", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-cache-recovery-test-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    const distPath = join(cacheRoot, "extension-lab", "pstdio.lab.view.labPage", "dist");
    writeExtension(sourcePath);
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
        writeFileSync(join(input.outdir, "module.js"), "console.log('webview');");
        return { success: true, details: "" };
      },
      webviewCacheRoot: cacheRoot,
    });

    try {
      await manager.refresh();
      rmSync(distPath, { recursive: true, force: true });

      await manager.refresh();

      expect(buildCount).toBe(2);
      expect(existsSync(join(distPath, "module.js"))).toBe(true);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("publishes a valid webview when another webview in the extension fails to build", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-independent-build-test-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    const successes: string[] = [];
    const failures: string[] = [];
    writeExtensionWithIndependentWebviews(sourcePath);

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async (_installName, webviewId) => {
        failures.push(webviewId);
      },
      reportBuildSuccess: async (_installName, webviewId) => {
        successes.push(webviewId);
      },
      buildWebview: async (input) => {
        if (input.entryPath.endsWith("faulty.tsx")) return { success: false, details: "build failed" };
        mkdirSync(input.outdir, { recursive: true });
        writeFileSync(join(input.outdir, "module.js"), "console.log('main');");
        return { success: true, details: "" };
      },
      webviewCacheRoot: cacheRoot,
    });

    try {
      await manager.refresh();

      expect(failures).toEqual(["pstdio.lab.view.faultyPage"]);
      expect(successes).toEqual(["pstdio.lab.view.labPage"]);
      expect(existsSync(join(cacheRoot, "extension-lab", "pstdio.lab.view.labPage", "dist", "module.js"))).toBe(true);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("retries an unchanged webview after its runtime dependencies become available", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-dependency-recovery-test-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    writeExtension(sourcePath);
    writeFileSync(
      join(sourcePath, "package.json"),
      JSON.stringify({
        name: "lab",
        version: "1.0.0",
        displayName: "Lab",
        publisher: "pstdio",
        main: "./extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
        dependencies: { react: "^19.0.0" },
      }),
    );
    let buildCount = 0;

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        buildCount++;
        if (!existsSync(join(sourcePath, "node_modules", "react"))) {
          return { success: false, details: "Could not resolve react" };
        }
        mkdirSync(input.outdir, { recursive: true });
        writeFileSync(join(input.outdir, "module.js"), "console.log('webview');");
        return { success: true, details: "" };
      },
      webviewCacheRoot: cacheRoot,
    });

    try {
      await manager.refresh();
      mkdirSync(join(sourcePath, "node_modules", "react"), { recursive: true });

      await manager.refresh();

      expect(buildCount).toBe(1);
      expect(existsSync(join(cacheRoot, "extension-lab", "pstdio.lab.view.labPage", "dist", "module.js"))).toBe(true);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("retries a build interrupted by an in-place extension replacement", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-install-recovery-test-"));
    const sourcePath = join(root, "extension");
    const cacheRoot = join(root, "cache");
    const markerPath = join(sourcePath, EXTENSION_INSTALLING_MARKER);
    const failures: string[] = [];
    writeExtension(sourcePath);
    let buildCount = 0;

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { install_name: "extension-lab", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async (_installName, webviewId) => {
        failures.push(webviewId);
      },
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        buildCount++;
        if (buildCount === 1) {
          writeFileSync(markerPath, "");
          return { success: false, details: "source changed during build" };
        }
        mkdirSync(input.outdir, { recursive: true });
        writeFileSync(join(input.outdir, "module.js"), "console.log('webview');");
        return { success: true, details: "" };
      },
      webviewCacheRoot: cacheRoot,
    });

    try {
      await manager.refresh();
      rmSync(markerPath);
      await manager.refresh();

      expect(buildCount).toBe(2);
      expect(failures).toEqual([]);
      expect(existsSync(join(cacheRoot, "extension-lab", "pstdio.lab.view.labPage", "dist", "module.js"))).toBe(true);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
