import { describe, expect, test } from "bun:test";
import { extensionKanbanRendererRecordSchema } from "./extensions";

describe("extension kanban renderer contracts", () => {
  test("accepts workspace badge display metadata on attributes", () => {
    const record = extensionKanbanRendererRecordSchema.parse({
      id: "planner.tickets",
      extensionId: "pstdio.planner",
      title: "Tickets",
      queryCommandId: "planner.query-tickets",
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
