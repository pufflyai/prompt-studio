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
});
