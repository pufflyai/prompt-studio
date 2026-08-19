import { describe, expect, test } from "bun:test";
import { dashboardResourceFromExtensionReference } from "./resource-hierarchy";

describe("dashboardResourceFromExtensionReference", () => {
  test("maps an extension-view reference to the canonical panel resource", () => {
    const resource = dashboardResourceFromExtensionReference(
      { type: "extension-view", id: "pstdio-planner.tickets", label: "Tickets", icon: "square-kanban" },
      { projectId: "project-1" },
    );

    expect(resource.kind).toBe("extension-view");
    expect(resource.uri).toBe("dashboard-workbench://project/project-1/extension-views/pstdio-planner.tickets");
    expect(resource.label).toBe("Tickets");
    expect(resource.metadata?.projectId).toBe("project-1");
  });

  test("keeps the generic mapping for other reference types", () => {
    const resource = dashboardResourceFromExtensionReference({ type: "ticket", id: "t-1" }, { projectId: "project-1" });

    expect(resource.uri).toBe("dashboard-workbench://ticket/t-1");
  });
});
