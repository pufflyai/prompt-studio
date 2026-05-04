import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestCronDriver } from "pstdio-scheduler/testing";
import { createPluginService } from "./plugin-service";

const noopWorkspace = async () => {};

let tempDirs: string[] = [];
let services: Array<{ dispose: () => Promise<void> }> = [];

const createTempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-plugin-svc-scheduler-catchup-"));
  tempDirs.push(dir);
  return dir;
};

const waitFor = async (condition: () => Promise<boolean> | boolean, timeoutMs = 2_000) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await condition()) return;
    await Bun.sleep(25);
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
};

afterEach(async () => {
  await Promise.all(services.map((service) => service.dispose()));
  services = [];

  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("createPluginService scheduler catchup", () => {
  test("restart in same minute is idempotent when watermark already matches now minute", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "catchup.ts"),
      [
        "const state = globalThis.__scheduleCatchupState;",
        "export default {",
        "  schedules: [{",
        '    name: "heartbeat",',
        '    cron: "* * * * *",',
        "    handler(ctx) {",
        "      state.scheduledFor.push(ctx.scheduledFor);",
        "    },",
        "  }],",
        "};",
      ].join("\n"),
    );

    const state = { scheduledFor: [] as string[] };
    (globalThis as Record<string, unknown>).__scheduleCatchupState = state;

    const storageRoot = createTempRepo();
    const now = new Date("2026-04-20T09:00:10.000Z");
    const currentMinute = new Date("2026-04-20T09:00:00.000Z");
    const watermarkKey = "project-1/catchup/heartbeat";
    writeFileSync(
      join(storageRoot, "plugin-schedule-watermarks.json"),
      `${JSON.stringify({ [watermarkKey]: Math.floor(currentMinute.getTime() / 60_000) }, null, 2)}\n`,
      "utf8",
    );

    const cron = createTestCronDriver();
    const service = createPluginService({
      repoService: { listByProject: async () => [{ path: repo }] },
      listProjectIds: async () => ["project-1"],
      filesRoot: "",
      storageRoot,
      ensureWorkspace: noopWorkspace,
      now: () => now,
      cron: cron.factory,
    });
    services.push(service);

    await Bun.sleep(150);
    expect(state.scheduledFor).toEqual([]);
  });

  test("startup catchup finds most recent missed tick for sparse schedules", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "monthly.ts"),
      [
        "const state = globalThis.__scheduleSparseCatchupState;",
        "export default {",
        "  schedules: [{",
        '    name: "monthly",',
        '    cron: "0 0 1 * *",',
        "    handler(ctx) {",
        "      state.scheduledFor.push(ctx.scheduledFor);",
        "    },",
        "  }],",
        "};",
      ].join("\n"),
    );

    const state = { scheduledFor: [] as string[] };
    (globalThis as Record<string, unknown>).__scheduleSparseCatchupState = state;

    const storageRoot = createTempRepo();
    const watermarkKey = "project-1/monthly/monthly";
    const lastAttempted = new Date("2026-02-01T00:00:00.000Z");
    writeFileSync(
      join(storageRoot, "plugin-schedule-watermarks.json"),
      `${JSON.stringify({ [watermarkKey]: Math.floor(lastAttempted.getTime() / 60_000) }, null, 2)}\n`,
      "utf8",
    );

    const now = new Date("2026-04-20T09:00:00.000Z");
    const cron = createTestCronDriver();
    const service = createPluginService({
      repoService: { listByProject: async () => [{ path: repo }] },
      listProjectIds: async () => ["project-1"],
      filesRoot: "",
      storageRoot,
      ensureWorkspace: noopWorkspace,
      now: () => now,
      cron: cron.factory,
    });
    services.push(service);

    await waitFor(() => state.scheduledFor.length > 0);
    expect(state.scheduledFor).toContain("2026-04-01T00:00:00.000Z");
  });

  test("watermark file persists newest attempted minute under rapid consecutive runs", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "rapid.ts"),
      [
        "const state = globalThis.__scheduleRapidState;",
        "export default {",
        "  schedules: [{",
        '    name: "rapid",',
        '    cron: "* * * * *",',
        "    handler(ctx) {",
        "      state.scheduledFor.push(ctx.scheduledFor);",
        "    },",
        "  }],",
        "};",
      ].join("\n"),
    );

    const state = { scheduledFor: [] as string[] };
    (globalThis as Record<string, unknown>).__scheduleRapidState = state;

    const storageRoot = createTempRepo();
    const base = new Date("2026-04-20T09:00:00.000Z").getTime();
    let now = base;
    const cron = createTestCronDriver();

    const service = createPluginService({
      repoService: { listByProject: async () => [{ path: repo }] },
      listProjectIds: async () => ["project-1"],
      filesRoot: "",
      storageRoot,
      ensureWorkspace: noopWorkspace,
      now: () => new Date(now),
      cron: cron.factory,
    });
    services.push(service);

    await waitFor(() => cron.size() === 1);
    void cron.fireAll();
    await waitFor(() => state.scheduledFor.length >= 1);

    now = base + 60_000;
    void cron.fireAll();
    await waitFor(() => state.scheduledFor.length >= 2);

    now = base + 120_000;
    void cron.fireAll();
    await waitFor(() => state.scheduledFor.length >= 3);

    await service.dispose();
    services = services.filter((entry) => entry !== service);

    const watermarkPath = join(storageRoot, "plugin-schedule-watermarks.json");
    const raw = await Bun.file(watermarkPath).text();
    const parsed = JSON.parse(raw) as Record<string, number>;
    expect(parsed["project-1/rapid/rapid"]).toBe(Math.floor((base + 120_000) / 60_000));
  });
});

describe("createPluginService scheduler project isolation", () => {
  test("project load failure does not block healthy project schedules", async () => {
    const healthyRepo = createTempRepo();
    const healthyPlugins = join(healthyRepo, ".pstdio", "plugins");
    mkdirSync(healthyPlugins, { recursive: true });
    writeFileSync(
      join(healthyPlugins, "healthy.ts"),
      [
        "const state = globalThis.__scheduleIsolationState;",
        "export default {",
        "  schedules: [{",
        '    name: "heartbeat",',
        '    cron: "* * * * *",',
        "    handler() { state.starts += 1; },",
        "  }],",
        "};",
      ].join("\n"),
    );

    const brokenRepo = createTempRepo();
    const brokenPlugins = join(brokenRepo, ".pstdio", "plugins");
    mkdirSync(brokenPlugins, { recursive: true });
    writeFileSync(
      join(brokenPlugins, "broken.ts"),
      [
        "export default {",
        "  schedules: [{",
        '    name: "broken",',
        '    cron: "0 0 0 * * *",',
        "    handler() {},",
        "  }],",
        "};",
      ].join("\n"),
    );

    const state = { starts: 0 };
    (globalThis as Record<string, unknown>).__scheduleIsolationState = state;

    const projectRepos: Record<string, string> = {
      healthy: healthyRepo,
      broken: brokenRepo,
    };

    const cron = createTestCronDriver();
    const service = createPluginService({
      repoService: { listByProject: async (projectId) => [{ path: projectRepos[projectId]! }] },
      listProjectIds: async () => ["healthy", "broken"],
      filesRoot: "",
      storageRoot: createTempRepo(),
      ensureWorkspace: noopWorkspace,
      now: () => new Date("2026-04-20T09:00:00.000Z"),
      cron: cron.factory,
    });
    services.push(service);

    await waitFor(() => cron.size() >= 1);
    void cron.fireAll();
    await waitFor(() => state.starts > 0);
    expect(state.starts).toBeGreaterThan(0);
  });

  test("repeated broken project failures do not starve healthy project across ticks", async () => {
    const healthyRepo = createTempRepo();
    const healthyPlugins = join(healthyRepo, ".pstdio", "plugins");
    mkdirSync(healthyPlugins, { recursive: true });
    writeFileSync(
      join(healthyPlugins, "healthy.ts"),
      [
        "const state = globalThis.__scheduleIsolationMultiTickState;",
        "export default {",
        "  schedules: [{",
        '    name: "heartbeat",',
        '    cron: "* * * * *",',
        "    handler(ctx) { state.minutes.push(ctx.scheduledFor); },",
        "  }],",
        "};",
      ].join("\n"),
    );

    const brokenRepo = createTempRepo();
    const brokenPlugins = join(brokenRepo, ".pstdio", "plugins");
    mkdirSync(brokenPlugins, { recursive: true });
    writeFileSync(
      join(brokenPlugins, "broken.ts"),
      [
        "export default {",
        "  schedules: [{",
        '    name: "broken",',
        '    cron: "0 0 0 * * *",',
        "    handler() {},",
        "  }],",
        "};",
      ].join("\n"),
    );

    const state = { minutes: [] as string[] };
    (globalThis as Record<string, unknown>).__scheduleIsolationMultiTickState = state;

    const projectRepos: Record<string, string> = {
      healthy: healthyRepo,
      broken: brokenRepo,
    };

    const base = new Date("2026-04-20T09:00:00.000Z").getTime();
    let now = base;
    const cron = createTestCronDriver();

    const service = createPluginService({
      repoService: { listByProject: async (projectId) => [{ path: projectRepos[projectId]! }] },
      listProjectIds: async () => ["healthy", "broken"],
      filesRoot: "",
      storageRoot: createTempRepo(),
      ensureWorkspace: noopWorkspace,
      now: () => new Date(now),
      cron: cron.factory,
    });
    services.push(service);

    await waitFor(() => cron.size() >= 1);
    void cron.fireAll();
    await waitFor(() => state.minutes.length >= 1);

    now = base + 60_000;
    void cron.fireAll();
    await waitFor(() => state.minutes.length >= 2);

    now = base + 120_000;
    void cron.fireAll();
    await waitFor(() => state.minutes.length >= 3);

    expect(state.minutes).toEqual(["2026-04-20T09:00:00.000Z", "2026-04-20T09:01:00.000Z", "2026-04-20T09:02:00.000Z"]);
  });
});
