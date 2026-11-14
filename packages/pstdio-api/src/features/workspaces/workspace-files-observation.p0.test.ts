import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WatchDirectory } from "pstdio-extensions";
import { git } from "pstdio-wt";
import { watchWorkspaceFiles } from "./workspace-files-observation";

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
