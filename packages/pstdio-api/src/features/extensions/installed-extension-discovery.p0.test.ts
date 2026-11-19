import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { writeExtension } from "./default-extensions-test-fixtures";
import { hashExtensionSource, loadExtensionSource } from "./extension-runtime";
import { syncInstalledExtensionsForProject } from "./installed-extension-sync";

test("checks independent installed sources while another source read is pending", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-installed-source-admission-"));
  for (const name of ["a-paused", "b-ready", "c-ready"]) writeExtension(join(root, name), name);
  const firstStarted = Promise.withResolvers<void>();
  const releaseFirst = Promise.withResolvers<void>();
  const started: string[] = [];
  const registered: string[] = [];
  const pending = syncInstalledExtensionsForProject({
    extensionsRoot: root,
    projectId: "project-1",
    extensionService: {
      syncInstalledSourceForProject: async (input) => {
        registered.push(input.installName);
        return {};
      },
    },
    loadExtension: async (path) => {
      const name = basename(path);
      started.push(name);
      if (name === "a-paused") {
        firstStarted.resolve();
        await releaseFirst.promise;
      }
      return loadExtensionSource(path, { accepted: true });
    },
  });
  try {
    await firstStarted.promise;
    await Bun.sleep(0);
    expect(started).toContain("b-ready");
    expect(registered).toEqual([]);
    releaseFirst.resolve();
    expect((await pending).map((entry) => entry.installName)).toEqual(["a-paused", "b-ready", "c-ready"]);
    expect(registered).toEqual(["a-paused", "b-ready", "c-ready"]);
  } finally {
    releaseFirst.resolve();
    await pending;
    rmSync(root, { recursive: true, force: true });
  }
});

test("failed discovery drains an admitted read before returning to source cleanup", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-installed-source-drain-"));
  for (const name of ["a-fails", "b-pending", "c-unstarted"]) writeExtension(join(root, name), name);
  const secondStarted = Promise.withResolvers<void>();
  const hashFailed = Promise.withResolvers<void>();
  const releaseSecond = Promise.withResolvers<void>();
  const failure = new Error("Source hash failed");
  const started: string[] = [];
  const registered: string[] = [];
  let settled = false;
  const pending = syncInstalledExtensionsForProject({
    extensionsRoot: root,
    projectId: "project-1",
    extensionService: {
      syncInstalledSourceForProject: async (input) => {
        registered.push(input.installName);
        return {};
      },
    },
    loadExtension: async (path) => {
      started.push(basename(path));
      if (basename(path) === "b-pending") {
        secondStarted.resolve();
        await releaseSecond.promise;
      }
      return loadExtensionSource(path, { accepted: true });
    },
    hashExtension: (path) => {
      if (basename(path) === "a-fails") {
        hashFailed.resolve();
        throw failure;
      }
      return hashExtensionSource(path);
    },
  }).then(
    () => {
      settled = true;
      return null;
    },
    (error: unknown) => {
      settled = true;
      return error;
    },
  );
  try {
    await secondStarted.promise;
    await hashFailed.promise;
    await Bun.sleep(0);
    expect(settled).toBe(false);
    expect(registered).toEqual([]);
    releaseSecond.resolve();
    expect(await pending).toBe(failure);
    expect(started).not.toContain("c-unstarted");
  } finally {
    releaseSecond.resolve();
    await pending;
    rmSync(root, { recursive: true, force: true });
  }
});

test("failed discovery preserves the first source error in listing order", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-installed-source-errors-"));
  for (const name of ["a-ready", "b-first-error", "c-later-error"]) writeExtension(join(root, name), name);
  const laterFailed = Promise.withResolvers<void>();
  const releaseFirst = Promise.withResolvers<void>();
  const firstFailure = new Error("First source failed");
  const laterFailure = new Error("Later source failed");
  const pending = syncInstalledExtensionsForProject({
    extensionsRoot: root,
    projectId: "project-1",
    extensionService: { syncInstalledSourceForProject: async () => ({}) },
    loadExtension: async (path) => {
      if (basename(path) === "b-first-error") await releaseFirst.promise;
      return loadExtensionSource(path, { accepted: true });
    },
    hashExtension: (path) => {
      if (basename(path) === "b-first-error") throw firstFailure;
      if (basename(path) === "c-later-error") {
        laterFailed.resolve();
        throw laterFailure;
      }
      return hashExtensionSource(path);
    },
  }).catch((error: unknown) => error);
  try {
    await laterFailed.promise;
    releaseFirst.resolve();
    expect(await pending).toBe(firstFailure);
  } finally {
    releaseFirst.resolve();
    await pending;
    rmSync(root, { recursive: true, force: true });
  }
});
