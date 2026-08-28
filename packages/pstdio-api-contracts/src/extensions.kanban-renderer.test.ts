import { describe, expect, test } from "bun:test";
import { extensionKanbanRendererRecordSchema } from "./extensions";

describe("extension kanban renderer contracts", () => {
  test("preserves extension-declared default saved views", () => {
    const record = extensionKanbanRendererRecordSchema.parse({
      id: "planner.tickets",
      extensionId: "pstdio.planner",
      title: "Tickets",
      queryHandlerId: "planner.tickets.query",
      rowActivationHandlerId: "planner.tickets.onRowActivate",
      defaultViews: [
        {
          id: "all",
          title: "All tickets",
          settings: {
            viewMode: "board",
            columnGrouping: "status",
            rowGrouping: "none",
            ordering: { attributeId: "manual", direction: "asc" },
            displayProperties: ["priority"],
          },
          filters: {},
          isDefault: true,
        },
      ],
      defaultActiveViewId: "all",
    });

    expect(record.defaultViews).toEqual([
      {
        id: "all",
        title: "All tickets",
        settings: {
          viewMode: "board",
          columnGrouping: "status",
          rowGrouping: "none",
          ordering: { attributeId: "manual", direction: "asc" },
          displayProperties: ["priority"],
        },
        filters: {},
        isDefault: true,
      },
    ]);
    expect(record.defaultActiveViewId).toBe("all");
    expect(record.rowActivationHandlerId).toBe("planner.tickets.onRowActivate");
  });

  test("accepts badge list display metadata on attributes", () => {
    const record = extensionKanbanRendererRecordSchema.parse({
      id: "planner.tickets",
      extensionId: "pstdio.planner",
      title: "Tickets",
      queryHandlerId: "planner.tickets.query",
      attributes: [
        {
          id: "workspace",
          label: "Workspace",
          type: { kind: "string" },
          displayable: true,
          display: { kind: "badge-list", itemsAttributeId: "contributorItems" },
        },
      ],
    });

    expect(record.attributes?.[0]).toMatchObject({
      id: "workspace",
      display: { kind: "badge-list", itemsAttributeId: "contributorItems" },
    });
  });

  test("preserves unknown display metadata so the host can report it", () => {
    const record = extensionKanbanRendererRecordSchema.parse({
      id: "recipes",
      extensionId: "example.recipes",
      title: "Recipes",
      queryHandlerId: "recipes.query",
      attributes: [
        {
          id: "contributors",
          label: "Contributors",
          type: { kind: "string" },
          display: { kind: "portrait-stack", itemsAttributeId: "contributorItems" },
        },
      ],
    });

    expect(record.attributes?.[0]?.display).toEqual({
      kind: "portrait-stack",
      itemsAttributeId: "contributorItems",
    });
  });

  test("rejects a badge list without its items attribute", () => {
    const result = extensionKanbanRendererRecordSchema.safeParse({
      id: "recipes",
      extensionId: "example.recipes",
      title: "Recipes",
      queryHandlerId: "recipes.query",
      attributes: [
        {
          id: "contributors",
          label: "Contributors",
          type: { kind: "string" },
          display: { kind: "badge-list" },
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
