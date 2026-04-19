import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginService } from "./plugin-service";

const noopWorkspace = async () => {};

let tempDirs: string[] = [];
let services: Array<{ dispose: () => Promise<void> }> = [];

const createTempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-plugin-svc-scheduler-"));
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

describe("createPluginService scheduler overlap", () => {
  test("keeps schedule active after a run spans multiple ticks", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "long-running.ts"),
      [
        "const state = globalThis.__scheduleTestState;",
        "export default {",
        "  schedules: [{",
        '    name: "heartbeat",',
        '    cron: "* * * * *",',
        "    timeoutMs: 100,",
        "    async handler() {",
        "      state.starts += 1;",
        "      await state.blocker.promise;",
        "      state.completions += 1;",
        "      state.blocker = Promise.withResolvers();",
        "    },",
        "  }],",
        "};",
      ].join("\n"),
    );

    const state = {
      starts: 0,
      completions: 0,
      blocker: Promise.withResolvers<void>(),
    };
    (globalThis as Record<string, unknown>).__scheduleTestState = state;

    const baseTime = new Date("2026-04-20T09:00:00.000Z").getTime();
    let now = baseTime;

    const service = createPluginService({
      repoService: { listByProject: async () => [{ path: repo }] },
      listProjectIds: async () => ["project-1"],
      filesRoot: "",
      storageRoot: createTempRepo(),
      ensureWorkspace: noopWorkspace,
      schedulerTickMs: 20,
      now: () => new Date(now),
    });
    services.push(service);

    await waitFor(() => state.starts === 1);

    now = baseTime + 60_000;
    await Bun.sleep(80);
    expect(state.starts).toBe(1);

    state.blocker.resolve();
    await waitFor(() => state.completions === 1);

    now = baseTime + 120_000;
    await waitFor(() => state.starts === 2);
    state.blocker.resolve();
  });

  test("does not run overlap after timeout while original handler is still running", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "timeout.ts"),
      [
        "const state = globalThis.__scheduleTimeoutState;",
        "export default {",
        "  schedules: [{",
        '    name: "slow",',
        '    cron: "* * * * *",',
        "    timeoutMs: 40,",
        "    async handler() {",
        "      state.starts += 1;",
        "      await state.blocker.promise;",
        "      state.completions += 1;",
        "      state.blocker = Promise.withResolvers();",
        "    },",
        "  }],",
        "};",
      ].join("\n"),
    );

    const state = {
      starts: 0,
      completions: 0,
      blocker: Promise.withResolvers<void>(),
    };
    (globalThis as Record<string, unknown>).__scheduleTimeoutState = state;

    const baseTime = new Date("2026-04-20T09:00:00.000Z").getTime();
    let now = baseTime;

    const service = createPluginService({
      repoService: { listByProject: async () => [{ path: repo }] },
      listProjectIds: async () => ["project-1"],
      filesRoot: "",
      storageRoot: createTempRepo(),
      ensureWorkspace: noopWorkspace,
      schedulerTickMs: 20,
      now: () => new Date(now),
    });
    services.push(service);

    await waitFor(() => state.starts === 1);
    await Bun.sleep(80);

    now = baseTime + 60_000;
    await Bun.sleep(80);
    expect(state.starts).toBe(1);

    state.blocker.resolve();
    await waitFor(() => state.completions === 1);

    now = baseTime + 120_000;
    await waitFor(() => state.starts === 2);
  });
});

describe("createPluginService scheduler lifecycle", () => {
  test("keeps in-flight run alive across invalidate and schedules next run after completion", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "invalidate.ts"),
      [
        "const state = globalThis.__scheduleInvalidateState;",
        "export default {",
        "  schedules: [{",
        '    name: "reload-safe",',
        '    cron: "* * * * *",',
        "    timeoutMs: 100,",
        "    async handler() {",
        "      state.starts += 1;",
        "      await state.blocker.promise;",
        "      state.completions += 1;",
        "      state.blocker = Promise.withResolvers();",
        "    },",
        "  }],",
        "};",
      ].join("\n"),
    );

    const state = {
      starts: 0,
      completions: 0,
      blocker: Promise.withResolvers<void>(),
    };
    (globalThis as Record<string, unknown>).__scheduleInvalidateState = state;

    const baseTime = new Date("2026-04-20T09:00:00.000Z").getTime();
    let now = baseTime;

    const service = createPluginService({
      repoService: { listByProject: async () => [{ path: repo }] },
      listProjectIds: async () => ["project-1"],
      filesRoot: "",
      storageRoot: createTempRepo(),
      ensureWorkspace: noopWorkspace,
      schedulerTickMs: 20,
      now: () => new Date(now),
    });
    services.push(service);

    await waitFor(() => state.starts === 1);
    service.invalidate("project-1");
    now = baseTime + 60_000;
    await Bun.sleep(80);
    expect(state.starts).toBe(1);

    state.blocker.resolve();
    await waitFor(() => state.completions === 1);

    now = baseTime + 120_000;
    await waitFor(() => state.starts === 2);
    state.blocker.resolve();
  });

  test("dispose waits only until timeout for in-flight schedules", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });

    writeFileSync(
      join(pluginsDir, "shutdown.ts"),
      [
        "const state = globalThis.__scheduleShutdownState;",
        "export default {",
        "  schedules: [{",
        '    name: "shutdown",',
        '    cron: "* * * * *",',
        "    timeoutMs: 50,",
        "    async handler() {",
        "      state.starts += 1;",
        "      await state.blocker.promise;",
        "    },",
        "  }],",
        "};",
      ].join("\n"),
    );

    const state = {
      starts: 0,
      blocker: Promise.withResolvers<void>(),
    };
    (globalThis as Record<string, unknown>).__scheduleShutdownState = state;

    const service = createPluginService({
      repoService: { listByProject: async () => [{ path: repo }] },
      listProjectIds: async () => ["project-1"],
      filesRoot: "",
      storageRoot: createTempRepo(),
      ensureWorkspace: noopWorkspace,
      schedulerTickMs: 20,
    });

    await waitFor(() => state.starts === 1);

    const started = Date.now();
    await service.dispose();
    const duration = Date.now() - started;

    expect(duration).toBeGreaterThanOrEqual(20);
    expect(duration).toBeLessThan(500);
  });
});
