import { expect, test } from "bun:test";
import { createWorkbench } from "./workbench-core";

test("mode floating policy governs shell requests, and each mode keeps its own Side Panel state", () => {
  const workbench = createWorkbench({ initialSidePanelMode: "floating" });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.modes.registerMode({ id: "kiln", floatingPanels: "hidden", activate: () => undefined });
  workbench.modes.setActiveMode("project");
  expect(workbench.shell.getSidePanelPresentation()).toBe("floating");
  workbench.modes.setActiveMode("kiln");
  expect(workbench.sidePanel.canFloat()).toBe(false);
  expect(workbench.shell.getSidePanelPresentation()).toBe("attached");
  workbench.shell.setSidePanelPresentation("floating");
  expect(workbench.shell.getSidePanelPresentation()).toBe("attached");
  workbench.shell.setRegionOpen("side", false);
  expect(workbench.shell.getRegionState("side").open).toBe(false);
  workbench.modes.setActiveMode("project");
  expect(workbench.sidePanel.canFloat()).toBe(true);
  expect(workbench.shell.getSidePanelPresentation()).toBe("floating");
  workbench.modes.setActiveMode("kiln");
  expect(workbench.shell.getSidePanelPresentation()).toBe("closed");
  workbench.modes.setActiveMode("project");
  workbench.shell.setRegionOpen("side", false);
  workbench.shell.setRegionOpen("side", true);
  expect(workbench.shell.getSidePanelPresentation()).toBe("attached");
  workbench.shell.setSidePanelPresentation("floating");
  expect(workbench.shell.getRegionState("side").open).toBe(true);
});

test("a mode without floating panels shows a floating panel attached and preserves a closed panel", () => {
  for (const initialMode of ["floating", "closed"] as const) {
    const workbench = createWorkbench({ initialSidePanelMode: initialMode });
    workbench.modes.registerMode({ id: "kiln", floatingPanels: "hidden", activate: () => undefined });
    workbench.modes.setActiveMode("kiln");
    expect(workbench.sidePanel.getMode()).toBe(initialMode === "closed" ? "closed" : "attached");
  }
});

test("region policy inherits host defaults per setting", () => {
  const size = { defaultPx: 220, minPx: 180 };
  const workbench = createWorkbench({ regionSettings: { secondary: { size, collapsible: false } } });
  workbench.modes.registerMode({
    id: "project",
    regionSettings: { secondary: { alwaysShowTabs: true } },
    activate: () => undefined,
  });
  workbench.modes.setActiveMode("project");
  expect(workbench.layout.getRegionSettings("secondary")).toEqual({ size, collapsible: false, alwaysShowTabs: true });
  workbench.shell.setRegionOpen("secondary", false);
  expect(workbench.shell.getRegionState("secondary").open).toBe(false);
  workbench.shell.setRegionOpen("secondary", true);
  expect(workbench.shell.getRegionState("secondary").open).toBe(true);
});
