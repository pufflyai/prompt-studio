import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createWorkbenchPanelWidgetPaletteEntries } from "./panel-widget-palette";

describe("createWorkbenchPanelWidgetPaletteEntries", () => {
  test("shares Panel eligibility with the header add menu", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerWidget({
      id: "files",
      title: "Files",
      icon: "Folder",
      region: "main",
      fallbackRegion: "side",
      panelAddable: true,
      rendererId: "files.renderer",
    });
    workbench.layout.registerWidget({
      id: "preview",
      title: "Preview",
      region: "main",
      panelAddable: false,
      rendererId: "preview.renderer",
    });
    workbench.layout.openWidget("preview");

    const entries = createWorkbenchPanelWidgetPaletteEntries({ workbench, onClose: () => undefined });

    expect(entries.map((entry) => entry.id)).toEqual(["workbench-panel:main:files", "workbench-panel:side:files"]);
  });
});
