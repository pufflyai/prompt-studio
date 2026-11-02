import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspaceCapacityService } from "./workspace-capacity-service";

test("workspace limits survive service recreation and stay on their device", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-capacity-"));
  let drains = 0;
  const device = (id: string) =>
    createWorkspaceCapacityService({
      path: join(root, id, "capacity.json"),
      deviceId: id,
      activeWorkspaceIds: async () => ["active-workspace"],
      onCapacityAvailable: async () => {
        drains++;
      },
    });
  try {
    expect(await device("one").get()).toMatchObject({ deviceId: "one", activeCount: 1, limit: null });
    await device("one").update({ limit: 1 });
    expect(drains).toBe(1);
    expect(await device("one").get()).toMatchObject({ limit: 1 });
    expect(await device("two").get()).toMatchObject({ limit: null });
    expect(await device("one").hasCapacity("active-workspace")).toBe(true);
    expect(await device("one").hasCapacity("new-workspace")).toBe(false);
    for (const limit of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
      await expect(device("one").update({ limit })).rejects.toThrow();
    }
    expect(await device("one").get()).toMatchObject({ limit: 1 });
    await device("one").update({ limit: null });
    expect(await device("one").hasCapacity("new-workspace")).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
