import { describe, expect, it } from "bun:test";
import { createWorkbenchCore, type WorkbenchModuleContribution } from "./workbench-core";

describe("workbench modules", () => {
  it("registers workbench modules through the workbench core API", () => {
    const workbench = createWorkbenchCore();
    const module: WorkbenchModuleContribution = {
      id: "dashboard.project",
      activate: (ctx) => {
        ctx.commands.registerCommand({ id: "project.open", label: "Open project" }, { execute: () => undefined });
      },
    };

    workbench.registerModule(module);

    expect(workbench.commands.getCommand("project.open")?.ownerId).toBe("dashboard.project");
    expect(workbench.commands.getCommand("project.open")?.source).toBe("module");
  });

  it("derives the active resource from the active layout placement", () => {
    const workbench = createWorkbenchCore();
    const ticketsResource = {
      kind: "dashboard-view",
      uri: "pstdio://dashboard/tickets",
      label: "Tickets",
    };
    const workspacesResource = {
      kind: "dashboard-view",
      uri: "pstdio://dashboard/workspaces",
      label: "Workspaces",
    };
    const changes: (string | undefined)[] = [];

    workbench.layout.registerWidget({
      id: "dashboard.tickets",
      title: "Tickets",
      area: "main",
      rendererId: "dashboard.tickets",
    });
    workbench.layout.registerWidget({
      id: "dashboard.workspaces",
      title: "Workspaces",
      area: "main",
      rendererId: "dashboard.workspaces",
    });
    workbench.onDidChangeActiveResource((resource) => changes.push(resource?.uri));

    workbench.layout.openWidget("dashboard.tickets", { resource: ticketsResource });
    workbench.layout.openWidget("dashboard.workspaces", { resource: workspacesResource });
    workbench.layout.activateWidget("dashboard.tickets");

    expect(workbench.getActiveResource()).toEqual(ticketsResource);
    expect(changes).toEqual([
      "pstdio://dashboard/tickets",
      "pstdio://dashboard/workspaces",
      "pstdio://dashboard/tickets",
    ]);
  });
});
