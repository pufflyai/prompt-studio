import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWorkbenchPanelWidgetPaletteEntries } from "./panel-widget-palette";

describe("createWorkbenchPanelWidgetPaletteEntries", () => {
  test("preserves action titles and groups commands by their panel destination", () => {
    const workbench = createWorkbench();
    for (const title of ["Open console", "New draft", "Files"]) {
      workbench.layout.registerPanel({ id: title, title, region: "main", rendererId: "test", eligibleLocations: {} });
    }
    const entries = createWorkbenchPanelWidgetPaletteEntries({ workbench, onClose() {} });
    expect(entries.slice(0, 3).map(({ label, group }) => ({ label, group }))).toEqual([
      { label: "Open console", group: "Main panel" },
      { label: "New draft", group: "Main panel" },
      { label: "Open Files", group: "Main panel" },
    ]);
    expect(entries.find((entry) => entry.id === "workbench-panel:side:New draft")?.searchText).toContain("Side panel");
    expect(entries.every((entry) => entry.icon)).toBe(true);
  });
  test("shares Panel eligibility with the header add menu", () => {
    const workbench = createWorkbench();
    workbench.layout.registerPanel({
      id: "files",
      title: "Files",
      icon: "Folder",
      region: "main",
      fallbackRegion: "side",
      rendererId: "files.renderer",
      eligibleLocations: {},
    });
    workbench.layout.registerPanel({
      id: "preview",
      title: "Preview",
      region: "main",
      rendererId: "preview.renderer",
    });
    workbench.layout.openPanel("preview");

    const entries = createWorkbenchPanelWidgetPaletteEntries({ workbench, onClose: () => undefined });

    expect(entries.map((entry) => entry.id)).toEqual([
      "workbench-panel:main:files",
      "workbench-panel:secondary:files",
      "workbench-panel:side:files",
    ]);
  });
});
