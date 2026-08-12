import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionSourceWatcher } from "./extension-source-watcher";

class FakeWatcher {
  closed = false;

  close() {
    this.closed = true;
  }
}

describe("createExtensionSourceWatcher source identity", () => {
  test("keeps the watcher registration when files change inside the same source directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-extension-watcher-identity-test-"));
    const sourcePath = join(root, "watched");
    mkdirSync(sourcePath, { recursive: true });
    const watchers: FakeWatcher[] = [];
    const reloaded: string[] = [];

    const watcher = await createExtensionSourceWatcher({
      listInstalledSources: async () => [{ install_name: "watched", source_path: sourcePath }],
      reloadInstalledSource: async (path) => {
        reloaded.push(path);
      },
      watch: () => {
        const fake = new FakeWatcher();
        watchers.push(fake);
        return fake;
      },
    });

    try {
      writeFileSync(join(sourcePath, "bun.lock"), "updated\n");
      await watcher.refresh();

      expect(watchers).toHaveLength(1);
      expect(watchers[0]?.closed).toBe(false);
      expect(reloaded).toEqual([]);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
