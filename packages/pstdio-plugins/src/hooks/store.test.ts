import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PstdioClient } from "@pstdio/sdk/client";
import { createPluginRuntimeStore } from "./store";

let tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-store-test-"));
  tempDirs.push(dir);
  return dir;
};

const stubClient = () => ({}) as PstdioClient;

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("createPluginRuntimeStore", () => {
  test("returns empty runtime when repo path resolves to null", async () => {
    const store = createPluginRuntimeStore({
      resolveRepoPath: async () => null,
      createClient: stubClient,
    });

    const runtime = await store.getForProject("project-1");
    expect(runtime.repoPath).toBeNull();
    expect(runtime.actions.list()).toEqual([]);
    expect(runtime.schedules.list()).toEqual([]);
  });

  test("caches runtime per project", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(join(pluginsDir, "cached-plugin.ts"), `export default { hooks: {} };`);
    let resolveCount = 0;

    const store = createPluginRuntimeStore({
      resolveRepoPath: async () => {
        resolveCount++;
        return repoPath;
      },
      createClient: stubClient,
    });

    const first = await store.getForProject("project-1");
    const second = await store.getForProject("project-1");
    expect(first).toBe(second);
    expect(resolveCount).toBe(1);
  });

  test("shares concurrent loads for the same project", async () => {
    const repoPath = createTempDir();
    const loadStarted = Promise.withResolvers<void>();
    const unblockLoad = Promise.withResolvers<void>();
    let resolveCount = 0;

    const store = createPluginRuntimeStore({
      resolveRepoPath: async () => {
        resolveCount++;
        loadStarted.resolve();
        await unblockLoad.promise;
        return repoPath;
      },
      createClient: stubClient,
    });

    const firstLoad = store.getForProject("project-1");
    await loadStarted.promise;
    const secondLoad = store.getForProject("project-1");

    unblockLoad.resolve();
    const [first, second] = await Promise.all([firstLoad, secondLoad]);

    expect(first).toBe(second);
    expect(resolveCount).toBe(1);
  });

  test("invalidate clears the cache for a project", async () => {
    const repoPath = createTempDir();
    let resolveCount = 0;

    const store = createPluginRuntimeStore({
      resolveRepoPath: async () => {
        resolveCount++;
        return repoPath;
      },
      createClient: stubClient,
    });

    await store.getForProject("project-1");
    store.invalidate("project-1");
    await store.getForProject("project-1");
    expect(resolveCount).toBe(2);
  });

  test("dispose clears all caches", async () => {
    const repoPath = createTempDir();
    let resolveCount = 0;

    const store = createPluginRuntimeStore({
      resolveRepoPath: async () => {
        resolveCount++;
        return repoPath;
      },
      createClient: stubClient,
    });

    await store.getForProject("project-1");
    await store.getForProject("project-2");
    store.dispose();

    await store.getForProject("project-1");
    expect(resolveCount).toBe(3);
  });

  test("loads plugins from resolved repo path", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "my-plugin.ts"),
      `export default {
        hooks: {
          preTicketCreation: () => ({ reject: true, reason: "nope" }),
        },
      };`,
    );

    const store = createPluginRuntimeStore({
      resolveRepoPath: async () => repoPath,
      createClient: stubClient,
    });

    const runtime = await store.getForProject("project-1");
    const result = await runtime.hooks.firePre("preTicketCreation", {} as never);
    expect(result.rejected).toBe(true);
  });

  test("reloads when plugins are added after an empty runtime load", async () => {
    const repoPath = createTempDir();
    mkdirSync(join(repoPath, ".pstdio"), { recursive: true });

    const store = createPluginRuntimeStore({
      resolveRepoPath: async () => repoPath,
      createClient: stubClient,
    });

    const emptyRuntime = await store.getForProject("project-1");
    expect(emptyRuntime.actions.list()).toEqual([]);

    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(
      join(pluginsDir, "late-plugin.ts"),
      `export default {
        actions: [
          { key: "late", label: "Late action", targetType: "ticket", trigger() {} },
        ],
      };`,
    );

    const runtime = await store.getForProject("project-1");
    expect(runtime.actions.list().some((action) => action.key === "late-plugin/late")).toBe(true);
  });
});
