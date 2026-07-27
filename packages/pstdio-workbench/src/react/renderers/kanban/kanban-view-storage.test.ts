import { describe, expect, test } from "bun:test";
import type { WorkbenchPanelInstance } from "../../../core";
import { resolveKanbanRendererStorageKey } from "./kanban-view-storage";

const ticketPlacement = (projectId: string): WorkbenchPanelInstance => ({
  instanceId: "pstdio-planner.tickets",
  panelId: "pstdio-planner.tickets",
  closable: false,
  resource: {
    kind: "dashboard-view",
    uri: "dashboard-workbench://dashboard-view/pstdio-planner.tickets",
    id: "pstdio-planner.tickets",
    metadata: { favoriteScope: { scope: "project", projectId } },
  },
});

describe("resolveKanbanRendererStorageKey", () => {
  test("separates persisted board state for project-scoped resources", () => {
    const firstProjectKey = resolveKanbanRendererStorageKey("pstdio-planner.tickets", ticketPlacement("project-1"));
    const secondProjectKey = resolveKanbanRendererStorageKey("pstdio-planner.tickets", ticketPlacement("project-2"));

    expect(firstProjectKey).not.toBe(secondProjectKey);
  });
});
