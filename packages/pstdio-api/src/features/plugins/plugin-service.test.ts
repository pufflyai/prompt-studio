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

describe("createPluginService", () => {
  test("loads plugins and registers hooks for a project", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(join(pluginsDir, "test-plugin.ts"), `export default { hooks: { postSessionStart() {} } };`);

    const repoService = {
      listByProject: async () => [{ path: repo }],
    };

    const service = createPluginService({ repoService, ensureWorkspace: noopWorkspace });
    const { dispatcher, registry } = await service.getForProject("project-1");

    expect(registry.getHookHandlers("postSessionStart")).toHaveLength(1);
    expect(dispatcher).toBeDefined();
  });

  test("caches per project", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(join(pluginsDir, "p.ts"), `export default { hooks: {} };`);

    const repoService = {
      listByProject: async () => [{ path: repo }],
    };

    const service = createPluginService({ repoService, ensureWorkspace: noopWorkspace });
    const first = await service.getForProject("project-1");
    const second = await service.getForProject("project-1");

    expect(first.dispatcher).toBe(second.dispatcher);
  });

  test("returns empty dispatcher when no repo found", async () => {
    const repoService = {
      listByProject: async () => [],
    };

    const service = createPluginService({ repoService, ensureWorkspace: noopWorkspace });
    const { dispatcher, registry } = await service.getForProject("no-repo");

    // Should not throw, just have empty handlers
    const result = await dispatcher.firePreHook("preTicketCreation", {});
    expect(result.rejected).toBe(false);
    expect(registry.getActions()).toEqual([]);
  });
});
