import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

  test("does not overlap reloads when changes arrive during a running reload", async () => {
    const sourcePath = join(root, "watched");
    mkdirSync(sourcePath, { recursive: true });
    const watchers: FakeWatcher[] = [];
    let activeReloads = 0;
    let maxActiveReloads = 0;
    let reloadCount = 0;
    let releaseFirstReload: () => void = () => {};
    const firstReloadReleased = new Promise<void>((resolve) => {
      releaseFirstReload = resolve;
    });

    const watcher = await createExtensionSourceWatcher({
      debounceMs: 5,
      listInstalledSources: async () => [{ install_name: "watched", source_path: sourcePath }],
      reloadInstalledSource: async () => {
        reloadCount++;
        activeReloads++;
        maxActiveReloads = Math.max(maxActiveReloads, activeReloads);
        if (reloadCount === 1) await firstReloadReleased;
        activeReloads--;
      },
      watch: (_path, listener) => {
        const fake = new FakeWatcher(listener);
        watchers.push(fake);
        return fake;
      },
    });

    try {
      watchers[0]?.listener("change", "extension.ts");
      await delay(15);

      watchers[0]?.listener("change", "bun.lock");
      await delay(15);

      expect(reloadCount).toBe(1);
      expect(maxActiveReloads).toBe(1);

      releaseFirstReload();
      await delay(15);

      expect(reloadCount).toBe(2);
      expect(maxActiveReloads).toBe(1);
    } finally {
      releaseFirstReload();
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("briefly debounces changed sources by default", async () => {
    const sourcePath = join(root, "watched");
    mkdirSync(sourcePath, { recursive: true });
    const watchers: FakeWatcher[] = [];
    const reloaded: string[] = [];

    const watcher = await createExtensionSourceWatcher({
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
      await delay(50);
      expect(reloaded).toEqual([]);

      await delay(150);
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

  test("rebinds and reloads a source directory replaced in place by a forced install", async () => {
    const sourcePath = join(root, "watched");
    mkdirSync(sourcePath, { recursive: true });
    writeFileSync(join(sourcePath, "extension.ts"), "export default { version: 1 };\n");
    const watchers: FakeWatcher[] = [];
    const reloaded: string[] = [];

    const watcher = await createExtensionSourceWatcher({
      listInstalledSources: async () => [{ install_name: "watched", source_path: sourcePath }],
      reloadInstalledSource: async (path) => {
        reloaded.push(path);
      },
      watch: (_path, listener) => {
        const fake = new FakeWatcher(listener);
        watchers.push(fake);
        return fake;
      },
    });

    try {
      rmSync(sourcePath, { recursive: true, force: true });
      mkdirSync(sourcePath, { recursive: true });
      writeFileSync(join(sourcePath, "extension.ts"), "export default { version: 2 };\n");

      await watcher.refresh();

      expect(watchers).toHaveLength(2);
      expect(watchers[0]?.closed).toBe(true);
      expect(watchers[1]?.closed).toBe(false);
      expect(reloaded).toEqual([sourcePath]);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("routes watcher errors to onError instead of crashing the process", async () => {
    const sourcePath = join(root, "watched");
    mkdirSync(sourcePath, { recursive: true });
    const errors: unknown[] = [];
    let triggerError: ((error: unknown) => void) | undefined;

    const watcher = await createExtensionSourceWatcher({
      listInstalledSources: async () => [{ install_name: "watched", source_path: sourcePath }],
      reloadInstalledSource: async () => {},
      onError: (error) => errors.push(error),
      watch: (_path, listener, onError) => {
        triggerError = onError;
        return new FakeWatcher(listener);
      },
    });

    try {
      // A dangling symlink inside an extension's node_modules surfaces as an fs
      // watch 'error'. It must reach onError, not bubble up as an unhandled throw.
      const boom = new Error("ENOENT: dangling symlink");
      expect(() => triggerError?.(boom)).not.toThrow();
      expect(errors).toEqual([boom]);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("createExtensionSourceWatcher registrations", () => {
  test("reloads for dependency availability changes without watching inside packages", async () => {
    const sourcePath = join(root, "watched");
    const nodeModulesPath = join(sourcePath, "node_modules");
    mkdirSync(nodeModulesPath, { recursive: true });
    const watchersByPath = new Map<string, FakeWatcher>();
    const reloaded: string[] = [];

    const watcher = await createExtensionSourceWatcher({
      debounceMs: 5,
      listInstalledSources: async () => [{ install_name: "watched", source_path: sourcePath }],
      reloadInstalledSource: async (path) => {
        reloaded.push(path);
      },
      watch: (path, listener) => {
        const fake = new FakeWatcher(listener);
        watchersByPath.set(path, fake);
        return fake;
      },
    });

    try {
      mkdirSync(join(nodeModulesPath, "react"));
      watchersByPath.get(nodeModulesPath)?.listener("rename", "react");
      await delay(15);

      expect(reloaded).toEqual([sourcePath]);
      expect(watchersByPath.has(join(nodeModulesPath, "react"))).toBe(false);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("registers per-directory watchers and never descends into node_modules, ignored, or symlinked directories", async () => {
    const sourcePath = join(root, "watched");
    mkdirSync(join(sourcePath, "src", "nested"), { recursive: true });
    mkdirSync(join(sourcePath, "dist"), { recursive: true });
    mkdirSync(join(sourcePath, ".git"), { recursive: true });
    mkdirSync(join(sourcePath, "node_modules", "lucide-react", "dist", "esm"), { recursive: true });
    mkdirSync(join(root, "outside", "deep"), { recursive: true });
    symlinkSync(join(root, "outside"), join(sourcePath, "linked"));
    writeFileSync(join(sourcePath, ".gitignore"), "dist/\n");

    const watchedPaths: string[] = [];
    const watcher = await createExtensionSourceWatcher({
      listInstalledSources: async () => [{ install_name: "watched", source_path: sourcePath }],
      reloadInstalledSource: async () => {},
      watch: (path, listener) => {
        watchedPaths.push(path);
        return new FakeWatcher(listener);
      },
    });

    try {
      expect(watchedPaths.sort()).toEqual(
        [
          sourcePath,
          join(sourcePath, "node_modules"),
          join(sourcePath, "src"),
          join(sourcePath, "src", "nested"),
        ].sort(),
      );
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("maps nested directory events against the extension root ignore rules", async () => {
    const sourcePath = join(root, "watched");
    mkdirSync(join(sourcePath, "src"), { recursive: true });
    writeFileSync(join(sourcePath, ".gitignore"), "*.log\n");
    const watchersByPath = new Map<string, FakeWatcher>();
    const reloaded: string[] = [];

    const watcher = await createExtensionSourceWatcher({
      debounceMs: 5,
      listInstalledSources: async () => [{ install_name: "watched", source_path: sourcePath }],
      reloadInstalledSource: async (path) => {
        reloaded.push(path);
      },
      watch: (path, listener) => {
        const fake = new FakeWatcher(listener);
        watchersByPath.set(path, fake);
        return fake;
      },
    });

    try {
      const srcWatcher = watchersByPath.get(join(sourcePath, "src"));
      srcWatcher?.listener("change", "debug.log");
      await delay(15);
      expect(reloaded).toEqual([]);

      srcWatcher?.listener("change", "main.ts");
      await delay(15);
      expect(reloaded).toEqual([sourcePath]);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("starts watching directories created after registration", async () => {
    const sourcePath = join(root, "watched");
    mkdirSync(join(sourcePath, "src"), { recursive: true });
    const watchedPaths: string[] = [];
    const watchersByPath = new Map<string, FakeWatcher>();

    const watcher = await createExtensionSourceWatcher({
      debounceMs: 5,
      listInstalledSources: async () => [{ install_name: "watched", source_path: sourcePath }],
      reloadInstalledSource: async () => {},
      watch: (path, listener) => {
        const fake = new FakeWatcher(listener);
        watchedPaths.push(path);
        watchersByPath.set(path, fake);
        return fake;
      },
    });

    try {
      mkdirSync(join(sourcePath, "src", "added"), { recursive: true });
      watchersByPath.get(join(sourcePath, "src"))?.listener("rename", "added");

      expect(watchedPaths).toContain(join(sourcePath, "src", "added"));
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

  test("refreshes only the requested source registration", async () => {
    const firstPath = join(root, "repo-a", "shared");
    const secondPath = join(root, "repo-b", "shared");
    mkdirSync(firstPath, { recursive: true });
    mkdirSync(secondPath, { recursive: true });
    const rows = [
      { install_name: "first", source_path: firstPath },
      { install_name: "second", source_path: secondPath },
    ];
    const reloaded: string[] = [];

    const watcher = await createExtensionSourceWatcher({
      listInstalledSources: async () => rows,
      reloadInstalledSource: async (sourcePath) => {
        reloaded.push(sourcePath);
      },
      watch: (_path, listener) => new FakeWatcher(listener),
    });

    try {
      rmSync(firstPath, { recursive: true });
      rmSync(secondPath, { recursive: true });
      mkdirSync(firstPath, { recursive: true });
      mkdirSync(secondPath, { recursive: true });

      await (watcher.refresh as (sourcePath?: string) => Promise<void>)(firstPath);

      expect(reloaded).toEqual([firstPath]);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
