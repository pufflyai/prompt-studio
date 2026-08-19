import { describe, expect, test } from "bun:test";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardResourceFromExtensionReference } from "./resource-hierarchy";

const ctx = { resources: { getKind: () => undefined } } as unknown as WorkbenchModuleContext;

describe("dashboardResourceFromExtensionReference", () => {
  test("maps an extension-view reference to the canonical panel resource", () => {
    const resource = dashboardResourceFromExtensionReference(
      ctx,
      { type: "extension-view", id: "pstdio-planner.tickets", label: "Tickets", icon: "square-kanban" },
      "project-1",
    );

    expect(resource.kind).toBe("extension-view");
    expect(resource.uri).toBe("dashboard-workbench://project/project-1/extension-views/pstdio-planner.tickets");
    expect(resource.label).toBe("Tickets");
    expect(resource.metadata?.projectId).toBe("project-1");
  });

  test("keeps the generic mapping for other reference types", () => {
    const resource = dashboardResourceFromExtensionReference(ctx, { type: "ticket", id: "t-1" }, "project-1");

    expect(resource.uri).toBe("dashboard-workbench://ticket/t-1");
  });
});
