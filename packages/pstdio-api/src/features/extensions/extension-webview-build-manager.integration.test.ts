import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";

type Listener = (...args: unknown[]) => void;

class FakeChildProcess {
  listeners = new Map<string, Listener[]>();

  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  kill() {
    return true;
  }
}

describe("createExtensionWebviewBuildManager dependency resolution", () => {
  test("builds copied first-party webviews whose workspace dependency links moved with the extension", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-webview-copied-core-test-"));
    const sourceSourcePath = resolve(import.meta.dir, "../../../../../extensions/pstdio-core-project-repos");
    const sourcePath = join(root, "repo", ".pstdio", "extensions", "pstdio-core-project-repos");
    const cacheRoot = join(root, "cache");
    const failures: unknown[] = [];
    cpSync(sourceSourcePath, sourcePath, { recursive: true });

    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        {
          install_name: "pstdio-core-project-repos",
          source_hash: "hash-1",
          source_path: sourcePath,
        },
      ],
      reportBuildFailure: async (_installName, _webviewId, error) => {
        failures.push(error);
      },
      reportBuildSuccess: async () => {},
      spawn: () => new FakeChildProcess(),
      webviewCacheRoot: cacheRoot,
    });

    try {
      await manager.refresh();

      expect(failures).toEqual([]);
      expect(
        existsSync(
          join(cacheRoot, "pstdio-core-project-repos", "pstdio-core-project-repos.projectFiles", "dist", "module.js"),
        ),
      ).toBe(true);
    } finally {
      manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
