import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createPluginService } from "./plugin-service";

const noopWorkspace = async () => {};

let tempDirs: string[] = [];

const createTempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-plugin-svc-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

const makePluginService = (repoService: { listByProject: (projectId: string) => Promise<{ path: string }[]> }) =>
  createPluginService({
    repoService,
    filesRoot: "",
    storageRoot: createTempRepo(),
    ensureWorkspace: noopWorkspace,
  });

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

    const service = makePluginService(repoService);
    const runtime = await service.getForProject("no-repo");

    const result = await runtime.hooks.firePre("preTicketCreation" as never, {} as never);
    expect(result.rejected).toBe(false);
    expect(runtime.actions.list()).toEqual([]);
  });

  test("scheduler is null when PSTDIO_PLUGIN_SCHEDULER_ENABLED is not set", () => {
    const original = process.env.PSTDIO_PLUGIN_SCHEDULER_ENABLED;
    try {
      delete process.env.PSTDIO_PLUGIN_SCHEDULER_ENABLED;

      const service = createPluginService({
        repoService: { listByProject: async () => [] },
        filesRoot: "",
        storageRoot: createTempRepo(),
        ensureWorkspace: noopWorkspace,
      });

      expect(service.scheduler).toBeNull();
    } finally {
      process.env.PSTDIO_PLUGIN_SCHEDULER_ENABLED = original;
    }
  });

  test("scheduler is created when PSTDIO_PLUGIN_SCHEDULER_ENABLED is true", () => {
    const original = process.env.PSTDIO_PLUGIN_SCHEDULER_ENABLED;
    try {
      process.env.PSTDIO_PLUGIN_SCHEDULER_ENABLED = "true";

      const service = createPluginService({
        repoService: { listByProject: async () => [] },
        filesRoot: "",
        storageRoot: createTempRepo(),
        ensureWorkspace: noopWorkspace,
      });

      expect(service.scheduler).toBeDefined();
      expect(service.scheduler).not.toBeNull();

      service.scheduler?.stop();
    } finally {
      process.env.PSTDIO_PLUGIN_SCHEDULER_ENABLED = original;
    }
  });

  test("invalid schedule config in one project does not block another project", async () => {
    const goodRepo = createTempRepo();
    const goodPluginsDir = join(goodRepo, ".pstdio", "plugins");
    mkdirSync(goodPluginsDir, { recursive: true });
    writeFileSync(
      join(goodPluginsDir, "valid.ts"),
      `export default { schedules: [{ name: "sync", cron: "0 9 * * *", trigger: async () => {} }] };`,
    );

    const badRepo = createTempRepo();
    const badPluginsDir = join(badRepo, ".pstdio", "plugins");
    mkdirSync(badPluginsDir, { recursive: true });
    writeFileSync(
      join(badPluginsDir, "invalid.ts"),
      `export default { schedules: [{ name: "broken", cron: "bad cron", trigger: async () => {} }] };`,
    );

    const repos: Record<string, string> = { good: goodRepo, bad: badRepo };

    const service = makePluginService({
      listByProject: async (projectId) => {
        const path = repos[projectId];
        return path ? [{ path }] : [];
      },
    });

    // Bad project fails its own load
    await expect(service.getForProject("bad")).rejects.toThrow(/broken.*invalid/);

    // Good project still loads successfully
    const goodRuntime = await service.getForProject("good");
    expect(goodRuntime.schedules.list()).toHaveLength(1);
    expect(goodRuntime.schedules.list()[0]!.compositeKey).toBe("valid/sync");
  });
});
