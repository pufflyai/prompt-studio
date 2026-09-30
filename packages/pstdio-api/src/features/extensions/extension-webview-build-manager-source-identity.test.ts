import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";

const writeExtension = (root: string) => {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "font-editor",
      version: "1.0.0",
      displayName: "Font Editor",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(root, "src", "main.tsx"), "console.log('webview');");
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      views: [{
        id: "page",
        title: "Page",
        body: { kind: "webview", entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: import.meta.url } },
      }],
    };`,
  );
};

describe("createExtensionWebviewBuildManager source identity", () => {
  test("keeps separate builds for installed sources that share an install name", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-source-identity-"));
    const cacheRoot = join(root, "cache");
    const rows = ["workspace-copy", "project-copy"].map((id) => {
      const sourcePath = join(root, id, "font-editor");
      writeExtension(sourcePath);
      return { id, install_name: "font-editor", source_hash: "hash-1", source_path: sourcePath };
    });
    const builtEntries: string[] = [];
    const successes: string[] = [];

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => rows,
      reportBuildFailure: async () => {},
      reportBuildSuccess: async (installedExtensionId) => {
        successes.push(installedExtensionId);
      },
      buildWebview: async (input) => {
        builtEntries.push(input.entryPath);
        mkdirSync(input.outdir, { recursive: true });
        writeFileSync(join(input.outdir, "module.js"), input.entryPath);
        return { success: true, details: "" };
      },
      webviewCacheRoot: cacheRoot,
    });

    try {
      await Promise.all(rows.map((row) => manager.ensure(row.id, "pstdio.font-editor.view.page")));
      await manager.refresh();

      expect(builtEntries).toHaveLength(2);
      expect([...successes].sort()).toEqual(["project-copy", "workspace-copy"]);
      for (const row of rows) {
        const modulePath = join(cacheRoot, row.id, "pstdio.font-editor.view.page", "dist", "module.js");
        expect(readFileSync(modulePath, "utf8")).toContain(join(row.id, "font-editor"));
      }
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("removes build folders that no installed source owns", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-orphan-builds-"));
    const cacheRoot = join(root, "cache");
    const sourcePath = join(root, "project-copy", "font-editor");
    writeExtension(sourcePath);
    const orphan = join(cacheRoot, "font-editor", "pstdio.font-editor.view.page", "dist");
    mkdirSync(orphan, { recursive: true });

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { id: "project-copy", install_name: "font-editor", source_hash: "hash-1", source_path: sourcePath },
      ],
      reportBuildFailure: async () => {},
      reportBuildSuccess: async () => {},
      buildWebview: async (input) => {
        mkdirSync(input.outdir, { recursive: true });
        return { success: true, details: "" };
      },
      webviewCacheRoot: cacheRoot,
    });

    try {
      await manager.ensure("project-copy", "pstdio.font-editor.view.page");
      await manager.refresh();

      expect(existsSync(join(cacheRoot, "font-editor"))).toBe(false);
      expect(existsSync(join(cacheRoot, "project-copy", "pstdio.font-editor.view.page", "dist"))).toBe(true);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
