import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "../data/memory-storage";
import {
  ensureDefaultWorkspaceStatuses,
  reorderWorkspaceStatusDefinitions,
  setDefaultWorkspaceStatusDefinition,
  updateWorkspaceStatusDefinition,
} from "./workspace-status";

describe("workspace status definitions", () => {
  test("seeds wip as the default status", async () => {
    const storage = createMemoryStorage();

    const statuses = await ensureDefaultWorkspaceStatuses(storage);

    expect(statuses.filter((status) => status.isDefault).map((status) => status.id)).toEqual(["wip"]);
  });

  test("updateWorkspaceStatusDefinition persists a new sort order for reordering", async () => {
    const storage = createMemoryStorage();
    await ensureDefaultWorkspaceStatuses(storage);

    const updated = await updateWorkspaceStatusDefinition({ storage, statusId: "blocked", sortOrder: 5 });

    expect(updated.sortOrder).toBe(5);
  });

  test("setDefaultWorkspaceStatusDefinition moves the default flag to exactly one status", async () => {
    const storage = createMemoryStorage();
    await ensureDefaultWorkspaceStatuses(storage);

    const { statuses } = await setDefaultWorkspaceStatusDefinition({ storage, statusId: "reviewed" });

    const defaults = statuses.filter((status) => status.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.id).toBe("reviewed");
  });

  test("setDefaultWorkspaceStatusDefinition throws for an unknown status", async () => {
    const storage = createMemoryStorage();
    await expect(setDefaultWorkspaceStatusDefinition({ storage, statusId: "ghost" })).rejects.toThrow(
      /Unknown workspace status/,
    );
  });

  test("reorder preserves the default flag", async () => {
    const storage = createMemoryStorage();
    await ensureDefaultWorkspaceStatuses(storage);
    await setDefaultWorkspaceStatusDefinition({ storage, statusId: "reviewed" });

    const { statuses } = await reorderWorkspaceStatusDefinitions({
      storage,
      statusIds: ["reviewed", "wip", "blocked"],
    });

    expect(statuses.find((status) => status.id === "reviewed")?.isDefault).toBe(true);
    expect(statuses.filter((status) => status.isDefault)).toHaveLength(1);
  });
});
