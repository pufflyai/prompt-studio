import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    schedulerTickMs: 10_000,
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

    const service = createPluginService({
      repoService: {
        listByProject: async (projectId: string) => [{ path: projectRepos[projectId]! }],
      },
      listProjectIds: async () => Object.keys(projectRepos),
      filesRoot: "",
      storageRoot: createTempRepo(),
      ensureWorkspace: noopWorkspace,
      schedulerTickMs: 25,
    });
    services.push(service);

    await waitFor(() => {
      const runs = (globalThis as Record<string, unknown>)[sigilKey] as Set<string>;
      return runs.has("project-a") && runs.has("project-b");
    }, 5_000);
  });
});
