import { expect, test } from "bun:test";
import { provisionProjectWorkspaces } from "./provision-coordinator";
import { maintenanceFixture } from "./provision-maintenance.test-fixture";

test("coalesces ten simultaneous catalog changes into one 65-workspace pass with no healthy workspace changes", async () => {
  const f = maintenanceFixture();
  await Promise.all(Array.from({ length: 10 }, () => provisionProjectWorkspaces(f.deps, "project", f.hooks)));
  expect(f.calls).toHaveLength(65);
  expect(f.scans).toBe(1);
  expect(f.eventBus.getSince(0).filter(({ table }) => table === "workspaces")).toHaveLength(0);
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
