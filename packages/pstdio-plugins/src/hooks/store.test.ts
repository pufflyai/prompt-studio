import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PstdioClient } from "@pstdio/sdk/client";
import { createPluginRuntimeStore, type ScheduleChangeEvent } from "./store";

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
  });

  test("caches runtime per project", async () => {
    const repoPath = createTempDir();
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

  test("notifies onScheduleChange when project with schedules is loaded", async () => {
    const repoPath = createTempDir();
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "scheduled.ts"),
      `export default {
        schedules: [{
          name: "daily-sync",
          cron: "0 9 * * *",
          trigger: async () => {},
        }],
      };`,
    );

    const events: ScheduleChangeEvent[] = [];

    const store = createPluginRuntimeStore({
      resolveRepoPath: async () => repoPath,
      createClient: stubClient,
      onScheduleChange: (event) => events.push(event),
    });

    await store.getForProject("project-1");

    expect(events).toHaveLength(1);
    expect(events[0]!.projectId).toBe("project-1");
    expect(events[0]!.entries).toHaveLength(1);
    expect(events[0]!.entries[0]!.compositeKey).toBe("scheduled/daily-sync");
  });

  test("notifies onScheduleChange with empty entries on invalidate", async () => {
    const repoPath = createTempDir();
    const events: ScheduleChangeEvent[] = [];

    const store = createPluginRuntimeStore({
      resolveRepoPath: async () => repoPath,
      createClient: stubClient,
      onScheduleChange: (event) => events.push(event),
    });

    await store.getForProject("project-1");
    store.invalidate("project-1");

    const invalidateEvent = events.find((e) => e.entries.length === 0);
    expect(invalidateEvent).toBeDefined();
    expect(invalidateEvent!.projectId).toBe("project-1");
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
});
