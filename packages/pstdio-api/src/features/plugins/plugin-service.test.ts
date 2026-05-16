import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";

import { sessionLogger } from "../../lib/logger";
import { createPluginService } from "./plugin-service";

const noopWorkspace = async () => {};

let tempDirs: string[] = [];
let services: Array<{ dispose: () => Promise<void> }> = [];

const createTempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-plugin-svc-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(services.map((service) => service.dispose()));
  services = [];

  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

const makePluginService = (
  repoService: { listByProject: (projectId: string) => Promise<{ path: string }[]> },
  listProjectIds: () => Promise<string[]> = async () => ["project-1"],
) => {
  const service = createPluginService({
    repoService,
    listProjectIds,
    filesRoot: "",
    storageRoot: createTempRepo(),
    ensureWorkspace: noopWorkspace,
  });

  services.push(service);
  return service;
};

const waitFor = async (condition: () => Promise<boolean> | boolean, timeoutMs = 2_000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await condition()) {
      return;
    }

    await Bun.sleep(25);
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
};

describe("createPluginService", () => {
  test("loads plugins for a project", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(join(pluginsDir, "test-plugin.ts"), `export default { hooks: { postSessionStart() {} } };`);

    const repoService = {
      listByProject: async () => [{ path: repo }],
    };

    const service = makePluginService(repoService);
    const runtime = await service.getForProject("project-1");

    expect(runtime.hooks).toBeDefined();
    expect(runtime.actions).toBeDefined();
  });

  test("logs post-hook rejections through the session logger", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(
      join(pluginsDir, "throwing-post-hook.ts"),
      `export default { hooks: { postAttemptStatusChange() { throw new Error("hook exploded"); } } };`,
    );
    const loggerSpy = spyOn(sessionLogger, "error").mockImplementation(() => {});

    try {
      const service = makePluginService({ listByProject: async () => [{ path: repo }] });
      const runtime = await service.getForProject("project-1");

      await runtime.hooks.firePost("postAttemptStatusChange", {} as never);

      expect(loggerSpy).toHaveBeenCalledTimes(1);
      expect(loggerSpy.mock.calls[0]?.[0]).toMatchObject({
        event: "plugin.post_hook.rejected",
        hook_name: "postAttemptStatusChange",
      });
      expect((loggerSpy.mock.calls[0]?.[0].err as Error).message).toBe("hook exploded");
    } finally {
      loggerSpy.mockRestore();
    }
  });

  test("caches per project", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(join(pluginsDir, "p.ts"), `export default { hooks: {} };`);

    const repoService = {
      listByProject: async () => [{ path: repo }],
    };

    const service = makePluginService(repoService);
    const first = await service.getForProject("project-1");
    const second = await service.getForProject("project-1");

    expect(first).toBe(second);
  });

  test("returns empty runtime when no repo found", async () => {
    const repoService = {
      listByProject: async () => [],
    };

    const service = makePluginService(repoService, async () => ["no-repo"]);
    const runtime = await service.getForProject("no-repo");

    const result = await runtime.hooks.firePre("preTicketCreation" as never, {} as never);
    expect(result.rejected).toBe(false);
    expect(runtime.actions.list()).toEqual([]);
  });

  test("runs schedules for all projects without opening them in the UI", async () => {
    const repoA = createTempRepo();
    const repoB = createTempRepo();
    const sigilKey = `__runsScheduledPluginTest_${crypto.randomUUID().replace(/-/g, "")}`;
    (globalThis as Record<string, unknown>)[sigilKey] = new Set<string>();

    // The handler pushes into a `globalThis` sigil rather than a shared module
    // array: on Linux the plugin loader falls back to Bun.build, so each
    // `import(...)` returns a freshly-bundled module with its own closure
    // state. All bundles share the same `globalThis`; that's the one
    // object we can read from both the scheduler's handler and the test.
    const createScheduledPlugin = (repoPath: string) => {
      const pluginsDir = join(repoPath, ".pstdio", "plugins");
      mkdirSync(pluginsDir, { recursive: true });
      writeFileSync(
        join(pluginsDir, "scheduled.ts"),
        `export default {
          schedules: [{
            name: "heartbeat",
            cron: "* * * * *",
            handler(ctx) {
              (globalThis)[${JSON.stringify(sigilKey)}].add(ctx.projectId);
            },
          }],
        };`,
      );
    };

    createScheduledPlugin(repoA);
    createScheduledPlugin(repoB);

    const projectRepos: Record<string, string> = {
      "project-a": repoA,
      "project-b": repoB,
    };

    const cron = createTestCronDriver();
    const service = createPluginService({
      repoService: {
        listByProject: async (projectId: string) => [{ path: projectRepos[projectId]! }],
      },
      listProjectIds: async () => Object.keys(projectRepos),
      filesRoot: "",
      storageRoot: createTempRepo(),
      ensureWorkspace: noopWorkspace,
      cron: cron.factory,
    });
    services.push(service);

    await waitFor(() => cron.size() === 2, 5_000);
    void cron.fireAll();

    await waitFor(() => {
      const runs = (globalThis as Record<string, unknown>)[sigilKey] as Set<string>;
      return runs.has("project-a") && runs.has("project-b");
    }, 5_000);
  });

  test("discovers schedules when a project is registered after startup", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(
      join(pluginsDir, "scheduled.ts"),
      `export default {
        schedules: [{
          name: "heartbeat",
          cron: "* * * * *",
          handler() {},
        }],
      };`,
    );

    const projectRepos: Record<string, string> = {};
    const cron = createTestCronDriver();
    const service = createPluginService({
      repoService: {
        listByProject: async (projectId: string) => {
          const repoPath = projectRepos[projectId];
          return repoPath ? [{ path: repoPath }] : [];
        },
      },
      listProjectIds: async () => Object.keys(projectRepos),
      filesRoot: "",
      storageRoot: createTempRepo(),
      ensureWorkspace: noopWorkspace,
      cron: cron.factory,
    });
    services.push(service);

    await Bun.sleep(100);
    expect(cron.size()).toBe(0);

    projectRepos["project-1"] = repo;
    await service.refresh();

    await waitFor(() => cron.size() === 1, 5_000);
  });
});
