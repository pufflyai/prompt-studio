import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, watch as fsWatch, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  options: { maxFolders?: number; onFolderLimit?: () => void; watch?: WatchDirectory } = {},
) => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-mount-watch-"));
  const location = { repoRoot, name: "dashboards", mountPath: "boards" };
  const root = resolveArtifactMountRoot(location);
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
    ...options,
  });
  cleanups.push(() => {
    watcher.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });
  // macOS FSEvents drops changes made right after a stream starts.
  await Bun.sleep(100);
  return { changes, mount: createArtifactMount({ ...location, onWrite: ledger.record }), root };
};

describe("watchArtifactMount", () => {
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

  test("asks listeners to reload everything once the folder limit is reached", async () => {
    let limits = 0;
    const { changes, root } = await startWatch({
      maxFolders: 2,
      onFolderLimit: () => limits++,
      watch: watchOneFolder,
    });

    for (const name of ["a", "b", "c"]) mkdirSync(join(root, name));
    await waitFor(() => changes.length > 0);
    writeFileSync(join(root, "a", "x.json"), "{}");
    await waitFor(() => changes.length > 1);

    expect(changes).toEqual([[], []]);
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
