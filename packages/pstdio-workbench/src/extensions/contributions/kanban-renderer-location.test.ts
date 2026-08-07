import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionKanbanRendererRecord } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { registerWorkbenchExtensionKanbanRenderers } from "./kanban-renderer-contributions";

describe("extension Kanban renderer location", () => {
  test("registers board views as primary locations", () => {
    const workbench = createWorkbenchCore();
    const record = {
      id: "tickets",
      extensionId: "pstdio.pstdio-planner",
      title: "Tickets",
      queryCommandId: "pstdio-planner.query-tickets",
    } satisfies WorkbenchExtensionKanbanRendererRecord;

    registerWorkbenchExtensionKanbanRenderers({ projectId: "project-1", workbench, executeCommand: async () => [] }, [
      record,
    ]);

    expect(workbench.layout.getWidget("tickets")?.role).toBe("location");
  });
});
