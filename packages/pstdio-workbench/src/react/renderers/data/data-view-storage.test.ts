import { describe, expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../../core";
import { resolveDataRendererStorageKey } from "./data-view-storage";

const ticketPlacement = (projectId: string): WorkbenchWidgetPlacement => ({
  widgetId: "pstdio-planner.tickets",
  contributionId: "pstdio-planner.tickets",
  resource: {
    kind: "dashboard-view",
    uri: "dashboard-workbench://dashboard-view/pstdio-planner.tickets",
    id: "pstdio-planner.tickets",
    metadata: { favoriteScope: { scope: "project", projectId } },
  },
});

describe("resolveDataRendererStorageKey", () => {
  test("separates persisted board state for project-scoped resources", () => {
    const firstProjectKey = resolveDataRendererStorageKey("pstdio-planner.tickets", ticketPlacement("project-1"));
    const secondProjectKey = resolveDataRendererStorageKey("pstdio-planner.tickets", ticketPlacement("project-2"));

    expect(firstProjectKey).not.toBe(secondProjectKey);
  });
});
