import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { WatchDirectory } from "pstdio-extensions";
import { git } from "pstdio-wt";
import { watchWorkspaceDiffFiles } from "./workspace-diff-filesystem";

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-diff-hints-"));
  await git(root, ["init"]);
  const gitRoot = resolve(root, await git(root, ["rev-parse", "--git-dir"]));
  const listeners = new Map<string, Parameters<WatchDirectory>[1]>();
  let changes = 0;
  const watch: WatchDirectory = (path, listener) => {
    listeners.set(path, listener);
    return { close: () => listeners.delete(path) };
  };
  const owner = await watchWorkspaceDiffFiles(root, () => changes++, watch, false);
  return {
    root,
    gitRoot,
    listeners,
    changes: () => changes,
    close: async () => {
      owner.close();
      await rm(root, { recursive: true, force: true });
    },
  };
};

test("temporary Git lock files do not invalidate accepted totals before a committed metadata change", async () => {
  const current = await fixture();
  try {
    await writeFile(join(current.gitRoot, "index.lock"), "unfinished index");
    current.listeners.get(current.gitRoot)!("rename", "index.lock");
    current.listeners.get(join(current.gitRoot, "refs", "heads"))!("change", "main.lock");
    await Bun.sleep(150);
    expect(current.changes()).toBe(0);
    current.listeners.get(current.gitRoot)!("rename", "index");
    await Bun.sleep(150);
    expect(current.changes()).toBe(1);
  } finally {
    await current.close();
  }
});

test("a working file named with a lock suffix remains a workspace change", async () => {
  const current = await fixture();
  try {
    await writeFile(join(current.root, "data.lock"), "tracked or untracked data");
    current.listeners.get(current.root)!("rename", "data.lock");
    await Bun.sleep(150);
    expect(current.changes()).toBe(1);
  } finally {
    await current.close();
  }
});

test("an unnamed Git metadata event still invalidates conservatively", async () => {
  const current = await fixture();
  try {
    current.listeners.get(current.gitRoot)!("rename", null);
    await Bun.sleep(150);
    expect(current.changes()).toBe(1);
  } finally {
    await current.close();
  }
});
