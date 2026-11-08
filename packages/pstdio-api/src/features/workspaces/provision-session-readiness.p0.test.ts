import { expect, test } from "bun:test";
import { createWorkspaceSessionService } from "../../services/workspace-session-service";
import { watchSessionQueueReadiness } from "../sessions/session-queue-readiness";
import { provisionProjectWorkspaces } from "./provision-coordinator";
import { maintenanceFixture } from "./provision-maintenance.test-fixture";
import { waitForWorkspaceReady } from "./wait-for-ready";
import { workspaceSessionReadiness } from "./workspace-session-readiness";

const sessionFixture = () => {
  const f = maintenanceFixture(1);
  const workspaceSessionService = createWorkspaceSessionService({
    eventBus: f.eventBus,
    maintenance: f.deps.workspaceService.maintenance,
    workspaceSessionsDBService: { getWorkspaceBySessionId: async () => ({ ...f.rows[0]! }) } as never,
  });
  return { ...f, workspaceSessionService };
};

test("maintenance keeps session launch gated and wakes a queued session without publishing fake workspace lifecycle changes", async () => {
  const f = sessionFixture();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  f.hooks.ensureConfig = async () => {
    started.resolve();
    await release.promise;
  };
  let queued = true;
  let launches = 0;
  const stop = watchSessionQueueReadiness(f.deps, async () => {
    const workspace = await f.workspaceSessionService.getWorkspaceBySessionId("session");
    if (queued && workspaceSessionReadiness(workspace).kind === "ready") {
      queued = false;
      launches++;
    }
  });
  try {
    const maintenance = provisionProjectWorkspaces(f.deps, "project", f.hooks);
    await started.promise;
    expect(f.rows[0]?.initializing).toBe(false);
    expect((await f.workspaceSessionService.getWorkspaceBySessionId("session"))?.initializing).toBe(true);
    const launch = waitForWorkspaceReady(f, "session", { pollMs: 1 });
    expect(launches).toBe(0);
    release.resolve();
    await maintenance;
    expect((await launch)?.initializing).toBe(false);
    await stop();
    expect(launches).toBe(1);
    expect(f.eventBus.getSince(0).filter(({ table }) => table === "workspaces")).toEqual([]);
  } finally {
    release.resolve();
    await stop();
  }
});

test("maintenance publishes real failures and recovery, retaining queued work until retry succeeds", async () => {
  const f = sessionFixture();
  let failing = true;
  let launched = false;
  f.hooks.fireProvision = async () => {
    if (failing) throw new Error("Skill copy failed");
    return { delivered: 1 };
  };
  const stop = watchSessionQueueReadiness(f.deps, async () => {
    const workspace = await f.workspaceSessionService.getWorkspaceBySessionId("session");
    if (workspaceSessionReadiness(workspace).kind === "ready") launched = true;
  });
  try {
    await provisionProjectWorkspaces(f.deps, "project", f.hooks);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(launched).toBe(false);
    expect(f.rows[0]?.setup_error).toBe("Skill copy failed");
    failing = false;
    await provisionProjectWorkspaces(f.deps, "project", f.hooks);
    await stop();
    expect(launched).toBe(true);
    expect(f.rows[0]?.setup_error).toBeNull();
    expect(f.eventBus.getSince(0).filter(({ table }) => table === "workspaces")).toHaveLength(2);
  } finally {
    await stop();
  }
});

test("interrupted maintenance keeps restart session recovery gated until the recorded workspace is repaired", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createWorkspaceMaintenance } = await import("../../services/workspace-maintenance");
  const directory = await mkdtemp(join(tmpdir(), "workspace-maintenance-recovery-"));
  try {
    const interrupted = createWorkspaceMaintenance(directory);
    await expect(
      interrupted.run("ws-0", async () => {
        throw new Error("Host interrupted before setup could settle");
      }),
    ).rejects.toThrow("Host interrupted");
    // Constructing new service instances models startup before background provisioning starts.
    const recovered = createWorkspaceMaintenance(directory);
    const f = sessionFixture();
    f.deps.workspaceService.maintenance = recovered;
    const sessions = createWorkspaceSessionService({
      eventBus: f.eventBus,
      maintenance: recovered,
      workspaceSessionsDBService: { getWorkspaceBySessionId: async () => ({ ...f.rows[0]! }) } as never,
    });
    expect(f.rows[0]?.initializing).toBe(false);
    expect((await sessions.getWorkspaceBySessionId("session"))?.initializing).toBe(true);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    f.hooks.ensureConfig = async () => {
      entered.resolve();
      await release.promise;
    };
    const recovery = provisionProjectWorkspaces(f.deps, "project", f.hooks);
    await entered.promise;
    const launch = waitForWorkspaceReady({ workspaceSessionService: sessions }, "session", { pollMs: 1 });
    expect(await recovered.isRunning("ws-0")).toBe(true);
    release.resolve();
    await recovery;
    expect((await launch)?.initializing).toBe(false);
    expect(await createWorkspaceMaintenance(directory).isRunning("ws-0")).toBe(false);
    expect(f.eventBus.getSince(0).filter(({ table }) => table === "workspaces")).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
