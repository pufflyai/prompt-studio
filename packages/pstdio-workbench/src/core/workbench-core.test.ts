import { describe, expect, it } from "bun:test";
import { createLocalStorageWorkbenchPersistence } from "../storage";
import { createWorkbench, type WorkbenchModuleContribution } from "./workbench-core";

describe("workbench modules", () => {
  it("enforces the host detachment option through the shell API", () => {
    const workbench = createWorkbench({ floatingPanels: "hidden", initialSidePanelMode: "floating" });

    expect(workbench.sidePanel.getMode()).toBe("attached");
    workbench.shell.setSidePanelPresentation("closed");
    workbench.shell.setSidePanelPresentation("floating");
    expect(workbench.sidePanel.getMode()).toBe("attached");
  });

  it("uses layout visibility as the source of truth for panel chrome", () => {
    const workbench = createWorkbench();
    const layout = workbench.layout.getLayout();
    workbench.layout.restoreLayout({
      ...layout,
      regions: { ...layout.regions, sidenav: { ...layout.regions.sidenav, visible: false } },
    });
    expect(workbench.shell.getRegionState("sidenav").open).toBe(false);
  });

  it("saves pending layout changes and releases persistence listeners when disposed", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: values.set.bind(values) };
    const listeners = new Set<() => void>();
    const eventTarget = {
      addEventListener: (_type: "pagehide", listener: () => void) => void listeners.add(listener),
      removeEventListener: (_type: "pagehide", listener: () => void) => void listeners.delete(listener),
    };
    const persist = () => createLocalStorageWorkbenchPersistence({ namespace: "dispose", storage, eventTarget });
    const first = createWorkbench({ ...persist(), initialSidePanelMode: "closed" });
    first.sidePanel.setMode("attached");
    await first.dispose();

    expect(listeners.size).toBe(0);
    expect(createWorkbench({ ...persist(), initialSidePanelMode: "closed" }).sidePanel.getMode()).toBe("attached");
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
