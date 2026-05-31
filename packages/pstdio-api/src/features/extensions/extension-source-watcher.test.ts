import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionSourceWatcher } from "./extension-source-watcher";

type Listener = (eventType: string, filename: string | Buffer | null) => void;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class FakeWatcher {
  closed = false;
  listener: Listener;

  constructor(listener: Listener) {
    this.listener = listener;
  }

  close() {
    this.closed = true;
  }
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "pstdio-extension-watcher-test-"));
});

describe("createExtensionSourceWatcher", () => {
  test("filters watched events through the extension .gitignore", async () => {
    const sourcePath = join(root, "watched");
    mkdirSync(sourcePath, { recursive: true });
    writeFileSync(join(sourcePath, ".gitignore"), "dist/\nnode_modules/\n");
    const watchers: FakeWatcher[] = [];
    const reloaded: string[] = [];

    const watcher = await createExtensionSourceWatcher({
      debounceMs: 5,
      listInstalledSources: async () => [{ install_name: "watched", source_path: sourcePath }],
      reloadInstalledSource: async (installName) => {
        reloaded.push(installName);
      },
      watch: (_path, listener) => {
        const fake = new FakeWatcher(listener);
        watchers.push(fake);
        return fake;
      },
    });

    try {
      watchers[0]?.listener("change", "dist/lab-page.html");
      watchers[0]?.listener("change", ".git/HEAD");
      await delay(15);
      expect(reloaded).toEqual([]);

      watchers[0]?.listener("change", "templates/ticket.md");
      await delay(15);
      expect(reloaded).toEqual([sourcePath]);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("debounces multiple changes for one installed extension", async () => {
    const sourcePath = join(root, "watched");
    mkdirSync(sourcePath, { recursive: true });
    const watchers: FakeWatcher[] = [];
    const reloaded: string[] = [];

    const watcher = await createExtensionSourceWatcher({
      debounceMs: 10,
      listInstalledSources: async () => [{ install_name: "watched", source_path: sourcePath }],
      reloadInstalledSource: async (installName) => {
        reloaded.push(installName);
      },
      watch: (_path, listener) => {
        const fake = new FakeWatcher(listener);
        watchers.push(fake);
        return fake;
      },
    });

    try {
      watchers[0]?.listener("change", "extension.ts");
      watchers[0]?.listener("change", "templates/ticket.md");
      watchers[0]?.listener("rename", "templates/proposal.md");
      await delay(25);

      expect(reloaded).toEqual([sourcePath]);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("refreshes watcher registrations for added or changed installed sources", async () => {
    const firstPath = join(root, "first");
    const secondPath = join(root, "second");
    mkdirSync(firstPath, { recursive: true });
    mkdirSync(secondPath, { recursive: true });
    let rows = [{ install_name: "watched", source_path: firstPath }];
    const watchers: FakeWatcher[] = [];

    const watcher = await createExtensionSourceWatcher({
      listInstalledSources: async () => rows,
      reloadInstalledSource: async () => {},
      watch: (_path, listener) => {
        const fake = new FakeWatcher(listener);
        watchers.push(fake);
        return fake;
      },
    });

    try {
      rows = [{ install_name: "watched", source_path: secondPath }];
      await watcher.refresh();

      expect(watchers).toHaveLength(2);
      expect(watchers[0]?.closed).toBe(true);
      expect(watchers[1]?.closed).toBe(false);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("watches duplicate install names by source path", async () => {
    const firstPath = join(root, "repo-a", "shared");
    const secondPath = join(root, "repo-b", "shared");
    mkdirSync(firstPath, { recursive: true });
    mkdirSync(secondPath, { recursive: true });
    const watchers: FakeWatcher[] = [];
    const reloaded: string[] = [];

    const watcher = await createExtensionSourceWatcher({
      debounceMs: 5,
      listInstalledSources: async () => [
        { install_name: "shared", source_path: firstPath },
        { install_name: "shared", source_path: secondPath },
      ],
      reloadInstalledSource: async (sourcePath) => {
        reloaded.push(sourcePath);
      },
      watch: (_path, listener) => {
        const fake = new FakeWatcher(listener);
        watchers.push(fake);
        return fake;
      },
    });

    try {
      expect(watchers).toHaveLength(2);

      watchers[0]?.listener("change", "extension.ts");
      watchers[1]?.listener("change", "extension.ts");
      await delay(15);

      expect(reloaded.sort()).toEqual([firstPath, secondPath].sort());
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
