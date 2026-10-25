import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, watch as fsWatch, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createDirectoryTreeWatcher, type WatchDirectory } from "./directory-tree-watcher";

const roots: string[] = [];
const createRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-tree-watcher-"));
  roots.push(root);
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const waitFor = async (check: () => boolean, timeoutMs = 2000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for a watch event");
    await Bun.sleep(10);
  }
};

// One handle per folder with no recursion: the Linux strategy, on every platform.
const watchOneFolder = (watched: string[]): WatchDirectory => {
  return (path, listener, onError) => {
    watched.push(path);
    const watcher = fsWatch(path, listener);
    watcher.on("error", onError);
    return watcher;
  };
};

describe("createDirectoryTreeWatcher", () => {
  test("reports file changes in folders created after the watch started", async () => {
    const root = createRoot();
    const paths: string[] = [];
    const tree = createDirectoryTreeWatcher({
      root,
      onEvent: (_eventType, path) => paths.push(path),
      onError: (error) => {
        throw error;
      },
    });

    try {
      // macOS FSEvents drops changes made right after a stream starts.
      await Bun.sleep(100);
      mkdirSync(join(root, "boards"));
      await waitFor(() => paths.includes(join(root, "boards")));
      writeFileSync(join(root, "boards", "x.json"), "{}");
      await waitFor(() => paths.includes(join(root, "boards", "x.json")));
    } finally {
      tree.close();
    }
  });

  test("watches one handle per folder without entering skipped or linked folders", async () => {
    const root = createRoot();
    const outside = createRoot();
    mkdirSync(join(root, "notes", "a"), { recursive: true });
    mkdirSync(join(root, ".git"));
    mkdirSync(join(outside, "deep"));
    symlinkSync(outside, join(root, "linked"), "junction");
    const watched: string[] = [];
    const paths: string[] = [];
    const tree = createDirectoryTreeWatcher({
      root,
      onEvent: (_eventType, path) => paths.push(path),
      onError: (error) => {
        throw error;
      },
      skipDirectory: (path) => basename(path) === ".git",
      watch: watchOneFolder(watched),
    });

    try {
      expect(watched.sort()).toEqual([root, join(root, "notes"), join(root, "notes", "a")].sort());

      // macOS backs each folder handle with an FSEvents stream, which drops changes right after it starts.
      await Bun.sleep(100);
      mkdirSync(join(root, "notes", "b"));
      await waitFor(() => watched.includes(join(root, "notes", "b")));
      await Bun.sleep(100);
      writeFileSync(join(root, "notes", "b", "content.md"), "# B");
      await waitFor(() => paths.includes(join(root, "notes", "b", "content.md")));
    } finally {
      tree.close();
    }
  });

  test("stops adding folder handles at the limit and reports it once", async () => {
    const root = createRoot();
    for (const name of ["a", "b", "c"]) mkdirSync(join(root, name));
    const watched: string[] = [];
    let limits = 0;
    const tree = createDirectoryTreeWatcher({
      root,
      maxDirectories: 2,
      onDirectoryLimit: () => limits++,
      onEvent: () => {},
      onError: (error) => {
        throw error;
      },
      watch: watchOneFolder(watched),
    });

    try {
      expect(watched).toHaveLength(2);
      expect(limits).toBe(1);
      mkdirSync(join(root, "d"));
      await Bun.sleep(50);
      expect(watched).toHaveLength(2);
      expect(limits).toBe(1);
    } finally {
      tree.close();
    }
  });

  test("closes every handle", () => {
    const root = createRoot();
    mkdirSync(join(root, "a"));
    const closed: string[] = [];
    const tree = createDirectoryTreeWatcher({
      root,
      onEvent: () => {},
      onError: () => {},
      watch: (path) => ({ close: () => closed.push(path) }),
    });

    tree.close();
    expect(closed.sort()).toEqual([root, join(root, "a")].sort());
  });
});

// The Linux strategy, which every platform uses when a watch function is injected.
describe("createDirectoryTreeWatcher with one handle per folder", () => {
  test("reports what a new folder already holds when its handle starts", async () => {
    const root = createRoot();
    const paths: string[] = [];
    const tree = createDirectoryTreeWatcher({
      root,
      onEvent: (_eventType, path) => paths.push(path),
      onError: (error) => {
        throw error;
      },
      watch: watchOneFolder([]),
    });

    try {
      await Bun.sleep(100);
      // Both writes land before the root handle reports the new folder, so the folder's own
      // handle never sees the file.
      mkdirSync(join(root, "note-2"));
      writeFileSync(join(root, "note-2", "content.md"), "# Two");
      await waitFor(() => paths.includes(join(root, "note-2", "content.md")));
    } finally {
      tree.close();
    }
  });

  test("watches a folder again after it is removed and created again", async () => {
    const root = createRoot();
    mkdirSync(join(root, "note"));
    const paths: string[] = [];
    const tree = createDirectoryTreeWatcher({
      root,
      onEvent: (_eventType, path) => paths.push(path),
      onError: (error) => {
        throw error;
      },
      watch: watchOneFolder([]),
    });

    try {
      await Bun.sleep(100);
      rmSync(join(root, "note"), { recursive: true });
      await waitFor(() => paths.includes(join(root, "note")));
      mkdirSync(join(root, "note"));
      await Bun.sleep(100);
      writeFileSync(join(root, "note", "b.md"), "b");
      await waitFor(() => paths.includes(join(root, "note", "b.md")));
      expect(paths).not.toContain(join(root, "note", "note"));
    } finally {
      tree.close();
    }
  });

  test("keeps watching when a folder is replaced by a file", async () => {
    const root = createRoot();
    mkdirSync(join(root, "drafts"));
    writeFileSync(join(root, "drafts", "x.md"), "x");
    const paths: string[] = [];
    const errors: unknown[] = [];
    const tree = createDirectoryTreeWatcher({
      root,
      onEvent: (_eventType, path) => paths.push(path),
      onError: (error) => errors.push(error),
      watch: watchOneFolder([]),
    });

    try {
      await Bun.sleep(100);
      rmSync(join(root, "drafts"), { recursive: true });
      writeFileSync(join(root, "drafts"), "now a file");
      await Bun.sleep(100);
      writeFileSync(join(root, "after.md"), "after");
      await waitFor(() => paths.includes(join(root, "after.md")));
      expect(errors).toEqual([]);
    } finally {
      tree.close();
    }
  });

  test("keeps watching a folder after an entry with the folder's own name is removed", async () => {
    const root = createRoot();
    mkdirSync(join(root, "notes"));
    writeFileSync(join(root, basename(root)), "same name as the root");
    writeFileSync(join(root, "notes", "notes"), "same name as its folder");
    const paths: string[] = [];
    const tree = createDirectoryTreeWatcher({
      root,
      onEvent: (_eventType, path) => paths.push(path),
      onError: (error) => {
        throw error;
      },
      watch: watchOneFolder([]),
    });

    try {
      await Bun.sleep(100);
      rmSync(join(root, basename(root)));
      rmSync(join(root, "notes", "notes"));
      await waitFor(() => paths.includes(join(root, "notes", "notes")));
      writeFileSync(join(root, "notes", "c.json"), "{}");
      writeFileSync(join(root, "d.json"), "{}");
      await waitFor(() => paths.includes(join(root, "notes", "c.json")) && paths.includes(join(root, "d.json")));
    } finally {
      tree.close();
    }
  });

  test("watches the root again when it comes back after a removal", async () => {
    const root = createRoot();
    const paths: string[] = [];
    const tree = createDirectoryTreeWatcher({
      root,
      onEvent: (_eventType, path) => paths.push(path),
      onError: (error) => {
        throw error;
      },
      watch: watchOneFolder([]),
    });

    try {
      await Bun.sleep(100);
      rmSync(root, { recursive: true });
      await Bun.sleep(300);
      expect(existsSync(root)).toBe(false);
      mkdirSync(root);
      writeFileSync(join(root, "back.json"), "{}");
      await waitFor(() => paths.includes(join(root, "back.json")), 3_000);
    } finally {
      tree.close();
    }
  });

  test("watches the root again when it is replaced at once", async () => {
    const root = createRoot();
    const paths: string[] = [];
    const tree = createDirectoryTreeWatcher({
      root,
      onEvent: (_eventType, path) => paths.push(path),
      onError: (error) => {
        throw error;
      },
      watch: watchOneFolder([]),
    });

    try {
      await Bun.sleep(100);
      rmSync(root, { recursive: true });
      mkdirSync(root);
      writeFileSync(join(root, "first.json"), "{}");
      await waitFor(() => paths.includes(join(root, "first.json")), 3_000);
      await Bun.sleep(100);
      writeFileSync(join(root, "second.json"), "{}");
      await waitFor(() => paths.includes(join(root, "second.json")));
    } finally {
      tree.close();
    }
  });
});
