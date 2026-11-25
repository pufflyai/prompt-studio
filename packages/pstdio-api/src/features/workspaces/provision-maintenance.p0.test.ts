import { expect, test } from "bun:test";
import { expectRejection } from "../../test-utils/expect-rejection";
import { provisionProjectWorkspaces, removeProjectAfterProvisioning } from "./provision-coordinator";
import { maintenanceFixture } from "./provision-maintenance.test-fixture";

test("coalesces ten simultaneous catalog changes into one 65-workspace pass with no healthy workspace changes", async () => {
  const f = maintenanceFixture();
  await Promise.all(Array.from({ length: 10 }, () => provisionProjectWorkspaces(f.deps, "project", f.hooks)));
  expect(f.calls).toHaveLength(65);
  expect(f.scans).toBe(1);
  expect(f.eventBus.getSince(0).filter(({ table }) => table === "workspaces")).toHaveLength(0);
});

test("startup skips the workspace it just restored while a later catalog request can refresh it", async () => {
  const startup = maintenanceFixture(2);
  await provisionProjectWorkspaces(startup.deps, "project", startup.hooks, { skipWorkspaceId: "ws-0" });
  expect(startup.calls).toEqual(["ws-1"]);

  const concurrent = maintenanceFixture(2);
  await Promise.all([
    provisionProjectWorkspaces(concurrent.deps, "project", concurrent.hooks, { skipWorkspaceId: "ws-0" }),
    provisionProjectWorkspaces(concurrent.deps, "project", concurrent.hooks),
  ]);
  expect(concurrent.calls).toEqual(["ws-0", "ws-1"]);
  expect(concurrent.scans).toBe(1);
});

test("a catalog change during a pass revisits only workspaces that did not see it", async () => {
  const f = maintenanceFixture();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const applied = new Map<string, number>();
  let catalog = 1;
  const provision = f.hooks.fireProvision;
  f.hooks.fireProvision = async (...args) => {
    const workspaceId = (args[3] as { workspaceId: string }).workspaceId;
    const revision = catalog;
    if (!f.calls.length) {
      started.resolve();
      await release.promise;
    }
    const result = await provision(...args);
    applied.set(workspaceId, revision);
    return result;
  };
  const first = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  await started.promise;
  catalog = 2;
  const second = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  catalog = 3;
  const third = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  release.resolve();
  await Promise.all([first, second, third]);
  expect(f.calls).toHaveLength(66);
  expect([...applied.values()]).toEqual(Array(65).fill(3));
  expect(f.eventBus.getSince(0).filter(({ table }) => table === "workspaces")).toHaveLength(0);
});

test("bounds work to one workspace per project while unrelated projects and hosts proceed", async () => {
  const f = maintenanceFixture(3);
  const otherHost = maintenanceFixture(1);
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let active = 0;
  let peak = 0;
  const provision = f.hooks.fireProvision;
  f.hooks.fireProvision = async (...args) => {
    peak = Math.max(peak, ++active);
    if (args[1] === "project") {
      started.resolve();
      await release.promise;
    }
    const result = await provision(...args);
    active--;
    return result;
  };
  const first = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  await started.promise;
  await provisionProjectWorkspaces(otherHost.deps, "project", otherHost.hooks);
  expect(otherHost.calls).toHaveLength(1);
  // A different project sharing the same workspace service also proceeds.
  f.rows.push({ ...f.rows[0]!, id: "other-workspace", project_id: "other" });
  const list = f.deps.workspaceService.list;
  f.deps.workspaceService.list = async (projectId) =>
    (await list(projectId)).filter((row) => row.project_id === projectId);
  await provisionProjectWorkspaces(f.deps, "other", f.hooks);
  release.resolve();
  await first;
  expect(peak).toBe(2);
});

test("project removal stops catalog catch-up and later provisioning sees the removed workspaces", async () => {
  const f = maintenanceFixture(3);
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const removing = Promise.withResolvers<void>();
  const releaseRemoval = Promise.withResolvers<void>();
  const provision = f.hooks.fireProvision;
  f.hooks.fireProvision = async (...args) => {
    if (!f.calls.length) {
      started.resolve();
      await release.promise;
    }
    return provision(...args);
  };
  const first = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  await started.promise;
  const catchUp = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  const removal = removeProjectAfterProvisioning(f.deps, "project", async () => {
    f.rows.splice(0);
    removing.resolve();
    await releaseRemoval.promise;
  });
  release.resolve();
  await removing.promise;
  expect(f.calls).toEqual(["ws-0"]);
  const afterRemoval = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  releaseRemoval.resolve();
  await Promise.all([first, catchUp, removal, afterRemoval]);
  expect(f.calls).toEqual(["ws-0"]);
  expect(f.eventBus.getSince(0).filter(({ table }) => table === "workspaces")).toHaveLength(0);
});

test("failed project removal releases the pending-removal gate for later provisioning", async () => {
  const f = maintenanceFixture(1);
  await expectRejection(
    removeProjectAfterProvisioning(f.deps, "project", async () => {
      throw new Error("Removal failed");
    }),
  ).toThrow("Removal failed");
  await provisionProjectWorkspaces(f.deps, "project", f.hooks);
  expect(f.calls).toEqual(["ws-0"]);
});

test("refreshes surviving workspaces when a removal interrupts an active pass and then fails", async () => {
  const f = maintenanceFixture(3);
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  f.hooks.ensureConfig = async () => {
    started.resolve();
    await release.promise;
  };
  const first = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  await started.promise;
  const removal = removeProjectAfterProvisioning(f.deps, "project", async () => {
    throw new Error("Provider cleanup failed");
  });
  const afterRemoval = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  release.resolve();
  await expectRejection(removal).toThrow("Provider cleanup failed");
  await Promise.all([first, afterRemoval]);
  expect(f.calls.slice(1).sort()).toEqual(["ws-0", "ws-1", "ws-2"]);
});

test("an earlier upgrade returns as soon as every workspace has seen its revision", async () => {
  const f = maintenanceFixture(2);
  const firstCopy = Promise.withResolvers<void>();
  const releaseFirst = Promise.withResolvers<void>();
  const catchUpCopy = Promise.withResolvers<void>();
  const releaseCatchUp = Promise.withResolvers<void>();
  f.hooks.ensureConfig = async () => {
    if (f.calls.length === 0) {
      firstCopy.resolve();
      await releaseFirst.promise;
    }
    if (f.calls.length === 2) {
      catchUpCopy.resolve();
      await releaseCatchUp.promise;
    }
  };
  let firstFinished = false;
  const first = provisionProjectWorkspaces(f.deps, "project", f.hooks).then(() => {
    firstFinished = true;
  });
  await firstCopy.promise;
  const second = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  releaseFirst.resolve();
  try {
    await catchUpCopy.promise;
    expect(firstFinished).toBe(true);
  } finally {
    releaseCatchUp.resolve();
    await Promise.all([first, second]);
  }
});

test("a middle revision returns during catch-up once the last stale workspace receives it", async () => {
  const f = maintenanceFixture(3);
  const gates = Array.from({ length: 5 }, () => ({
    started: Promise.withResolvers<void>(),
    done: Promise.withResolvers<void>(),
  }));
  f.hooks.ensureConfig = async () => {
    const gate = gates[f.calls.length];
    gate?.started.resolve();
    await gate?.done.promise;
  };
  const first = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  await gates[0]!.started.promise;
  let secondFinished = false;
  const second = provisionProjectWorkspaces(f.deps, "project", f.hooks).then(() => {
    secondFinished = true;
  });
  gates[0]!.done.resolve();
  await gates[1]!.started.promise;
  gates[1]!.done.resolve();
  await gates[2]!.started.promise;
  const third = provisionProjectWorkspaces(f.deps, "project", f.hooks);
  gates[2]!.done.resolve();
  await gates[3]!.started.promise;
  gates[3]!.done.resolve();
  try {
    await gates[4]!.started.promise;
    expect(secondFinished).toBe(true);
  } finally {
    gates[4]!.done.resolve();
    await Promise.all([first, second, third]);
  }
});
