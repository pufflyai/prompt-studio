import { expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WatchDirectory } from "pstdio-extensions";
import { git } from "pstdio-wt";
import { watchWorkspaceFiles } from "./workspace-files-observation";

test("an ordinary HEAD file does not start Git discovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-files-plain-head-"));
  await writeFile(join(root, "HEAD"), "ordinary text");
  const spawn = spyOn(Bun, "spawn");
  let observation: Awaited<ReturnType<typeof watchWorkspaceFiles>> | undefined;
  try {
    observation = await watchWorkspaceFiles(
      root,
      () => {},
      () => ({ close() {} }),
      false,
    );
    expect(spawn).not.toHaveBeenCalled();
  } finally {
    spawn.mockRestore();
    observation?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Git ignore decorations refresh on index and exclude changes without watching object storage", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-files-git-watch-"));
  await git(root, ["init"]);
  const listeners = new Map<string, Parameters<WatchDirectory>[1]>();
  let hint = Promise.withResolvers<void>();
  const closed = new Set<string>();
  const observation = await watchWorkspaceFiles(
    root,
    () => hint.resolve(),
    (path, listener) => {
      listeners.set(path, listener);
      return {
        close: () => {
          closed.add(path);
        },
      };
    },
    false,
  );
  try {
    expect(listeners.has(join(root, ".git"))).toBe(true);
    expect(listeners.has(join(root, ".git/objects"))).toBe(false);
    listeners.get(join(root, ".git"))!("rename", "index");
    await hint.promise;
    hint = Promise.withResolvers<void>();
    listeners.get(join(root, ".git/info"))!("change", "exclude");
    await hint.promise;
  } finally {
    observation.close();
    expect(closed.size).toBe(listeners.size);
    await rm(root, { recursive: true, force: true });
  }
});

test.each([
  "nested folder",
  "symbolic link",
  "Git directory file",
  "Git environment",
])("file explorers retain ignore changes for a %s", async (kind) => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), "pstdio-files-git-context-")));
  const repository = join(temporary, "repository");
  await mkdir(repository);
  await git(repository, ["init"]);
  const metadata = join(repository, ".git");
  const root = join(temporary, "presented");
  const previousGitDirectory = process.env.GIT_DIR;
  const previousWorkTree = process.env.GIT_WORK_TREE;
  if (kind === "nested folder") {
    await mkdir(join(repository, "nested"));
    await symlink(join(repository, "nested"), root, process.platform === "win32" ? "junction" : "dir");
  } else if (kind === "symbolic link") {
    await symlink(repository, root, process.platform === "win32" ? "junction" : "dir");
  } else {
    await mkdir(root);
    if (kind === "Git directory file") await writeFile(join(root, ".git"), `gitdir: ${metadata}\n`);
    else {
      process.env.GIT_DIR = metadata;
      process.env.GIT_WORK_TREE = root;
    }
  }
  const listeners = new Map<string, Parameters<WatchDirectory>[1]>();
  const changed = Promise.withResolvers<void>();
  let observation: Awaited<ReturnType<typeof watchWorkspaceFiles>> | undefined;
  try {
    observation = await watchWorkspaceFiles(
      root,
      () => changed.resolve(),
      (path, listener) => {
        listeners.set(path, listener);
        return { close() {} };
      },
      false,
    );
    const physicalListeners = new Map(
      await Promise.all([...listeners].map(async ([path, listener]) => [await realpath(path), listener] as const)),
    );
    expect(physicalListeners.has(metadata)).toBe(true);
    expect(physicalListeners.has(join(metadata, "objects"))).toBe(false);
    physicalListeners.get(join(metadata, "info"))!("change", "exclude");
    await changed.promise;
  } finally {
    observation?.close();
    if (previousGitDirectory === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previousGitDirectory;
    if (previousWorkTree === undefined) delete process.env.GIT_WORK_TREE;
    else process.env.GIT_WORK_TREE = previousWorkTree;
    await rm(temporary, { recursive: true, force: true });
  }
});

test.each([
  false,
  true,
])("file explorers own recovery only for a coverage gap (directory limit: %s)", async (limited) => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-files-recovery-"));
  if (limited) await Promise.all(Array.from({ length: 2_001 }, (_, index) => mkdir(join(root, `folder-${index}`))));
  const originalInterval = globalThis.setInterval;
  const recovery: (() => void)[] = [];
  globalThis.setInterval = ((handler: () => void, milliseconds?: number) => {
    if (milliseconds === 30_000) recovery.push(handler);
    return originalInterval(handler, milliseconds);
  }) as typeof setInterval;
  let failWatch!: Parameters<WatchDirectory>[2];
  let closed = 0;
  let watches = 0;
  let hints = 0;
  let hint = Promise.withResolvers<void>();
  const observation = await watchWorkspaceFiles(
    root,
    () => {
      hints++;
      hint.resolve();
    },
    (_path, _listener, error) => {
      watches++;
      failWatch = error;
      return {
        close() {
          closed++;
        },
      };
    },
  );
  try {
    expect(recovery).toHaveLength(limited ? 1 : 0);
    expect(watches).toBeLessThanOrEqual(2_000);
    failWatch(new Error("Watch lost"));
    failWatch(new Error("Still lost"));
    expect(recovery).toHaveLength(1);
    await hint.promise;
    expect(hints).toBe(1);
    hint = Promise.withResolvers<void>();
    recovery[0]();
    await hint.promise;
    expect(hints).toBe(2);
    observation.close();
    observation.close();
    recovery[0]();
    expect(closed).toBe(watches);
    expect(hints).toBe(2);
  } finally {
    observation.close();
    globalThis.setInterval = originalInterval;
    await rm(root, { recursive: true, force: true });
  }
});
