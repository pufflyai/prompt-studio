import { afterEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { existsSync, watch as fsWatch, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createArtifactMount, resolveArtifactMountRoot, type WatchDirectory } from "pstdio-extensions";
import { watchArtifactMount } from "./mount-watcher";
import { createArtifactMountWriteLedger } from "./write-ledger";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

const waitFor = async (check: () => boolean, timeoutMs = 3_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for a mount change");
    await Bun.sleep(10);
  }
};

// One handle per folder with no recursion: the Linux strategy, on every platform.
const watchOneFolder: WatchDirectory = (path, listener, onError) => {
  const watcher = fsWatch(path, listener);
  watcher.on("error", onError);
  return watcher;
};

const startWatch = async (
  options: {
    initialFiles?: Record<string, string>;
    initialFolders?: string[];
    maxFolders?: number;
    onFolderLimit?: () => void;
    watch?: WatchDirectory;
    watchRoot?: WatchDirectory;
    platform?: NodeJS.Platform;
  } = {},
) => {
  const { initialFiles = {}, initialFolders = [], ...watchOptions } = options;
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-mount-watch-"));
  const location = { repoRoot, extensionId: "pstdio.dashboards", mountPath: "boards" };
  const root = resolveArtifactMountRoot(location);
  mkdirSync(root, { recursive: true });
  for (const folder of initialFolders) mkdirSync(join(root, folder), { recursive: true });
  for (const [file, text] of Object.entries(initialFiles)) writeFileSync(join(root, file), text);
  const ledger = createArtifactMountWriteLedger();
  const changes: string[][] = [];
  const watcher = watchArtifactMount({
    root,
    ledger,
    onChange: (paths) => changes.push(paths),
    onError: (error) => {
      throw error;
    },
    onFolderLimit: () => {},
    ...watchOptions,
  });
  cleanups.push(() => {
    watcher.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });
  // macOS FSEvents drops changes made right after a stream starts.
  await Bun.sleep(100);
  return { changes, mount: createArtifactMount({ ...location, onWrite: ledger.record }), root };
};

test("one watcher cannot suppress another watcher's folder-only notification", async () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-independent-mount-watches-"));
  const location = { repoRoot, extensionId: "pstdio.dashboards", mountPath: "boards" };
  const root = resolveArtifactMountRoot(location);
  const ledger = createArtifactMountWriteLedger(() => 0);
  const mount = createArtifactMount({ ...location, onWrite: ledger.record });
  await mount.writeText("sales/first.json", "{}");

  const openWatch = () => {
    const changes: string[][] = [];
    let tree = (_event: string, _path: string) => {};
    let flat = (_event: string, _path: string) => {};
    const watch = watchArtifactMount({
      root,
      ledger,
      onChange: (paths) => changes.push(paths),
      onError: (error) => {
        throw error;
      },
      onFolderLimit: () => {},
      watch: (path, listener) => {
        if (path === root) tree = listener;
        return { close: () => {} };
      },
      watchRoot: (_path, listener) => {
        flat = listener;
        return { close: () => {} };
      },
    });
    return {
      changes,
      tree: (event: string, path: string) => tree(event, path),
      flat: (event: string, path: string) => flat(event, path),
      close: watch.close,
    };
  };
  const relay = openWatch();
  const view = openWatch();
  cleanups.push(() => {
    relay.close();
    view.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  writeFileSync(join(root, "sales", "first.json"), "external");
  relay.tree("change", "sales/first.json");
  await waitFor(() => relay.changes.length === 1);
  expect(relay.changes).toEqual([["sales/first.json"]]);

  view.flat("rename", "sales");
  await waitFor(() => view.changes.length === 1);
  expect(view.changes).toEqual([["sales"]]);

  relay.flat("rename", "sales");
  await Bun.sleep(1_050);
  expect(relay.changes).toEqual([["sales/first.json"]]);
});

test.each([
  ["opening", true],
  ["walking", true],
  ["opening", false],
  ["walking", false],
])("closes startup handles when %s fails (error callback throws: %s)", async (stage, rethrow) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-watch-startup-"));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "subfolder"));
  const failure = new Error("cannot start flat watcher");
  const changes: string[][] = [];
  const closed: string[] = [];
  let limited = false;
  let flatOpened = false;
  let watcher: ReturnType<typeof watchArtifactMount> | undefined;
  cleanups.push(() => watcher?.close());
  const readDirectory = fs.readdirSync;
  const read = spyOn(fs, "readdirSync").mockImplementation((...args) => {
    if (flatOpened && args[0] === root) throw failure;
    return Reflect.apply(readDirectory, fs, args);
  });
  try {
    expect(
      () =>
        (watcher = watchArtifactMount({
          root,
          ledger: createArtifactMountWriteLedger(),
          onChange: (paths) => changes.push(paths),
          onError: (error) => {
            if (rethrow) throw error;
          },
          onFolderLimit: () => {
            limited = true;
          },
          maxFolders: 1,
          watch: () => ({ close: () => closed.push("tree") }),
          watchRoot: () => {
            if (stage === "opening") throw failure;
            flatOpened = true;
            return { close: () => closed.push("flat") };
          },
        })),
    ).toThrow(failure);
  } finally {
    read.mockRestore();
  }
  expect(limited).toBe(true);
  expect(closed.sort()).toEqual(stage === "opening" ? ["tree"] : ["flat", "tree"]);
  await Bun.sleep(250);
  expect(changes).toEqual([]);
});

describe("watchArtifactMount", () => {
  test.each(["darwin", "linux", "win32"] as const)("uses the default root watch policy for %s", async (platform) => {
    const nativeWatch = fs.watch;
    const watches = spyOn(fs, "watch").mockImplementation(nativeWatch);
    try {
      const { root } = await startWatch(platform === process.platform ? {} : { platform });
      const recursive = process.platform === "darwin" || process.platform === "win32";
      const registrations: unknown[] = watches.mock.calls.map(([path, options]) => [path, options]);
      const expected = [[root, { recursive }]];
      if (platform === "darwin") expected.push([root, { recursive: false }]);
      expect(registrations).toEqual(expected);
    } finally {
      watches.mockRestore();
    }
  });

  test("reports replaced manifests when the tree watch delivers no notification", async () => {
    const { changes, root } = await startWatch({
      initialFiles: { "manifest.json": '{"version":1}' },
      watch: () => ({ close: () => {} }),
      watchRoot: watchOneFolder,
    });
    writeFileSync(join(root, ".manifest.new"), '{"version":2}');
    renameSync(join(root, ".manifest.new"), join(root, "manifest.json"));
    await waitFor(() => changes.length > 0);
    expect(changes[0]).toContain("manifest.json");
  });

  test("drops staggered echoes from both watches and reports a subsequent direct edit", async () => {
    let emitTree: (event: string, file: string) => void = () => {};
    let emitRoot: (event: string, file: string) => void = () => {};
    const { changes, mount, root } = await startWatch({
      watch: (_path, listener) => {
        emitTree = listener;
        return { close: () => {} };
      },
      watchRoot: (_path, listener) => {
        emitRoot = listener;
        return { close: () => {} };
      },
    });

    await mount.writeText("manifest.json", "{}");
    emitRoot("rename", "manifest.json");
    await Bun.sleep(250);
    expect(changes).toEqual([]);
    emitTree("rename", "manifest.json");
    await Bun.sleep(250);
    expect(changes).toEqual([]);

    writeFileSync(join(root, "manifest.json"), '{"version":2}');
    emitRoot("change", "manifest.json");
    await waitFor(() => changes.length > 0);
    expect(changes).toEqual([["manifest.json"]]);
  });

  test("reports one change with every path of a burst of direct edits", async () => {
    const { changes, root } = await startWatch();

    writeFileSync(join(root, "q4.json"), "{}");
    mkdirSync(join(root, "sales"));
    writeFileSync(join(root, "sales", "q3.json"), "{}");

    await waitFor(() => changes.length > 0);
    await Bun.sleep(400);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual(expect.arrayContaining(["q4.json", "sales/q3.json"]));
    expect(changes[0]).toEqual([...new Set(changes[0])].sort());
  });

  test("does not report writes made through the mount API", async () => {
    const { changes, mount, root } = await startWatch();

    await mount.writeText("sales/q3.json", "{}");
    await mount.writeText("q4.json", "{}");
    await mount.delete("q4.json");
    await Bun.sleep(500);
    expect(changes).toEqual([]);

    writeFileSync(join(root, "sales", "q3.json"), '{"total":3}');
    await waitFor(() => changes.length > 0);
    expect(changes).toEqual([["sales/q3.json"]]);
  });

  test("ignores a folder reported as changed because an entry inside it changed", async () => {
    // Windows reports the parent folder too. The fake handle replays that pattern on every platform.
    let emit: (eventType: string, filename: string) => void = () => {};
    const { changes, root } = await startWatch({
      watch: (path, listener) => {
        if (!path.includes("sales")) emit = listener;
        return { close: () => {} };
      },
    });
    mkdirSync(join(root, "sales"));
    writeFileSync(join(root, "sales", "q3.json"), "{}");

    emit("change", "sales");
    emit("change", join("sales", "q3.json"));
    await waitFor(() => changes.length > 0);

    expect(changes).toEqual([["sales/q3.json"]]);
  });

  test("reports at most one change per second while edits continue", async () => {
    const { changes, root } = await startWatch();

    const startedAt = Date.now();
    while (Date.now() - startedAt < 1_500) {
      writeFileSync(join(root, "live.json"), String(Date.now()));
      await Bun.sleep(50);
    }
    await Bun.sleep(1_100);

    expect(changes.length).toBeGreaterThanOrEqual(2);
    expect(changes.length).toBeLessThanOrEqual(3);
  });

  test("reports files written into a new folder before its watch starts", async () => {
    const { changes, root } = await startWatch({ watch: watchOneFolder });

    // Both writes land before the root handle reports the new folder.
    mkdirSync(join(root, "note-2"));
    writeFileSync(join(root, "note-2", "content.md"), "# Two");

    await waitFor(() => changes.flat().includes("note-2/content.md"));
  });

  test("keeps reporting after the mount folder is removed and created again", async () => {
    const { changes, root } = await startWatch({ watch: watchOneFolder });

    rmSync(root, { recursive: true });
    await Bun.sleep(300);
    mkdirSync(root, { recursive: true });

    // The burst that brings the folder back asks for a full reload. Later edits report paths again.
    const deadline = Date.now() + 5_000;
    while (!changes.flat().includes("y.json")) {
      if (Date.now() > deadline) throw new Error("The mount stopped reporting changes");
      writeFileSync(join(root, "y.json"), String(Date.now()));
      await Bun.sleep(300);
    }
    expect(changes).toContainEqual([]);
  });

  test("does not create a removed mount folder again", async () => {
    const { root } = await startWatch({ watch: watchOneFolder });

    rmSync(root, { recursive: true });
    await Bun.sleep(1_500);

    expect(existsSync(root)).toBe(false);
  });

  test("keeps running when a folder is replaced by a file", async () => {
    const { changes, mount, root } = await startWatch({ watch: watchOneFolder });
    await mount.writeText("drafts/x.md", "x");
    await Bun.sleep(400);

    rmSync(join(root, "drafts"), { recursive: true });
    writeFileSync(join(root, "drafts"), "now a file");

    await waitFor(() => changes.flat().includes("drafts"));
  });

  test("reloads when folder change events reach the watch limit", async () => {
    let emit: ((eventType: string, filename: string) => void) | undefined;
    let limits = 0;
    const { changes, root } = await startWatch({
      maxFolders: 2,
      onFolderLimit: () => limits++,
      watch: (_path, listener) => {
        emit ??= listener;
        return { close: () => {} };
      },
    });

    // Folder change events can discover new watches without reporting a changed file.
    for (const name of ["a", "b", "c"]) {
      mkdirSync(join(root, name));
      emit?.("change", name);
    }

    await waitFor(() => changes.length > 0);
    expect(limits).toBe(1);
    expect(changes).toEqual([[]]);
  });

  test("asks listeners to reload everything once the folder limit is reached", async () => {
    let limits = 0;
    const { changes, root } = await startWatch({
      initialFolders: ["a", "b", "c"],
      maxFolders: 2,
      onFolderLimit: () => limits++,
      watch: watchOneFolder,
    });

    await waitFor(() => limits === 1 && changes.some((paths) => paths.length === 0));
    const changesAtLimit = changes.length;
    // The root stays watched even when child folders exceed the limit.
    writeFileSync(join(root, "x.json"), "{}");
    await waitFor(() => changes.length > changesAtLimit);

    expect(changes.slice(changesAtLimit)).toEqual([[]]);
    expect(limits).toBe(1);
  });

  test("asks listeners to reload everything after more than 200 paths", async () => {
    // A fake handle sends one burst of events, however fast the disk writes them.
    let emit: (eventType: string, filename: string) => void = () => {};
    const { changes } = await startWatch({
      watch: (_path, listener) => {
        emit = listener;
        return { close: () => {} };
      },
    });

    for (let index = 0; index < 201; index += 1) emit("rename", `${index}.json`);

    await waitFor(() => changes.length > 0);
    expect(changes).toEqual([[]]);
  });
});
