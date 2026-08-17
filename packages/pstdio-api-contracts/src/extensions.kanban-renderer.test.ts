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

  test("accepts workspace badge display metadata on attributes", () => {
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
          display: { kind: "workspace-badge", itemsAttributeId: "workspaceItems" },
        },
      ],
    });

    expect(record.attributes?.[0]).toMatchObject({
      id: "workspace",
      display: { kind: "workspace-badge", itemsAttributeId: "workspaceItems" },
    });
  });
});
