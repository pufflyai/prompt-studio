import { describe, expect, test } from "bun:test";
import { createStatusRegistry } from "./status-registry";

const validStatuses = [
  { id: "todo", label: "Todo", color: "gray", sortOrder: 100, isDefault: true },
  { id: "done", label: "Done", color: "green", sortOrder: 200 },
];

describe("createStatusRegistry", () => {
  test("loads a status set once and reuses its cached values", async () => {
    const registry = createStatusRegistry();
    let queryCount = 0;
    registry.registerStatusSet({
      id: "planner.ticket",
      title: "Ticket statuses",
      query: async () => {
        queryCount += 1;
        return validStatuses;
      },
    });

    await expect(Promise.all([registry.load("planner.ticket"), registry.load("planner.ticket")])).resolves.toEqual([
      validStatuses,
      validStatuses,
    ]);
    await expect(registry.load("planner.ticket")).resolves.toEqual(validStatuses);
    expect(queryCount).toBe(1);
  });

  test("registers independent editable and read-only status sets", async () => {
    const registry = createStatusRegistry();
    registry.registerStatusSet({ id: "planner.ticket", title: "Ticket statuses", query: async () => validStatuses });
    registry.registerStatusSet({
      id: "deploy.release",
      title: "Release statuses",
      query: async () => [{ id: "ready", label: "Ready", color: "blue", sortOrder: 100 }],
      save: async (statuses) => statuses,
    });

    expect(registry.listStatusSets().map((set) => ({ id: set.id, readOnly: !set.save }))).toEqual([
      { id: "deploy.release", readOnly: false },
      { id: "planner.ticket", readOnly: true },
    ]);
    await expect(registry.query("planner.ticket")).resolves.toEqual(validStatuses);
  });

  test("validates each provider result without disturbing other providers", async () => {
    const registry = createStatusRegistry();
    registry.registerStatusSet({ id: "valid", title: "Valid", query: async () => validStatuses });
    registry.registerStatusSet({
      id: "invalid",
      title: "Invalid",
      query: async () => [
        { id: "same", label: "One", color: "gray", sortOrder: 100 },
        { id: "same", label: "Two", color: "gray", sortOrder: 200 },
      ],
    });

    await expect(registry.query("invalid")).rejects.toThrow('Status set "invalid" contains duplicate id "same"');
    await expect(registry.query("valid")).resolves.toEqual(validStatuses);
  });
});
