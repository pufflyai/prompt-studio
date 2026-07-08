import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, selectDashboardProject } from "@/shared/app/project-context";
import { createProjectsModule } from "./module";

describe("createProjectsModule", () => {
  test("updates the selection without forcing a landing resource (bootstrap owns landing)", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createProjectsModule());

    await workbench.resources.openResource({
      kind: "project",
      uri: "dashboard-workbench://project/project-1",
      id: "project-1",
      label: "Prompt Studio",
    });

    expect(getDashboardSelectedProjectId(workbench)).toBe("project-1");
    expect(workbench.getPrimaryResource()).toBeUndefined();
  });

  test("clears the back-stack when the selected project is cleared", async () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createProjectsModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    workbench.layout.registerWidget({
      id: "scratch",
      title: "Scratch",
      area: "main",
      singleton: false,
      reuse: "none",
      rendererId: "noop",
    });
    workbench.layout.openWidget("scratch");
    expect(workbench.history.store.getState().entries.length).toBeGreaterThan(0);

    await workbench.commands.executeCommand(dashboardCommandIds.clearSelectedProject);

    // Project-scoped history must not survive deselection — otherwise Back would replay entries
    // the route project guard cannot render, stranding the cursor.
    expect(workbench.history.store.getState().entries).toEqual([]);
    expect(workbench.history.store.getState().cursor).toBe(-1);
  });

  test("selects the only synced project when no project is selected", async () => {
    const workbench = createWorkbenchCore();
    getWriter("projects")?.truncateAndWrite([]);

    const projects = workbench.registerModule(createProjectsModule());

    try {
      workbench.modes.setActiveMode("project-selection");
      markInitialCollectionsSyncComplete();
      getWriter("projects")?.truncateAndWrite([
        { id: "project-1", name: "Prompt Studio", created_at: "2026-01-01T00:00:00.000Z" },
      ]);

      expect(getDashboardSelectedProjectId(workbench)).toBe("project-1");
      expect(workbench.modes.getActiveModeId()).toBeUndefined();
    } finally {
      projects.dispose();
      getWriter("projects")?.truncateAndWrite([]);
    }
  });
});
