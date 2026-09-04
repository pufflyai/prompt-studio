import { describe, expect, it } from "bun:test";
import { createWorkbench, type WorkbenchModuleContribution } from "./workbench-core";

describe("workbench modules", () => {
  it("uses layout visibility as the source of truth for panel chrome", () => {
    const workbench = createWorkbench();
    const layout = workbench.layout.getLayout();
    workbench.layout.restoreLayout({
      ...layout,
      regions: { ...layout.regions, sidenav: { ...layout.regions.sidenav, visible: false } },
    });
    expect(workbench.panels.isOpen("sidenav")).toBe(false);
  });

  it("does not retain focus in a closed region", () => {
    const workbench = createWorkbench();
    workbench.focus.setActiveRegion("secondary");
    workbench.layout.setRegionVisible("secondary", false);
    expect(workbench.focus.getActiveRegion()).toBeUndefined();
  });

  it("registers modules through the core API", () => {
    const workbench = createWorkbench();
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
});
