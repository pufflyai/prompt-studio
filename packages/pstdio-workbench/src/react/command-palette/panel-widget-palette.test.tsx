import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createWorkbenchPanelWidgetPaletteEntries } from "./panel-widget-palette";

describe("createWorkbenchPanelWidgetPaletteEntries", () => {
  test("shares Panel eligibility with the header add menu", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerSubPanel({
      id: "files",
      title: "Files",
      icon: "Folder",
      region: "main",
      fallbackRegion: "side",
      rendererId: "files.renderer",
    });
    workbench.layout.registerWidget({
      id: "preview",
      title: "Preview",
      region: "main",
      rendererId: "preview.renderer",
    });
    workbench.layout.openWidget("preview");

    const entries = createWorkbenchPanelWidgetPaletteEntries({ workbench, onClose: () => undefined });

    expect(entries.map((entry) => entry.id)).toEqual(["workbench-panel:main:files", "workbench-panel:side:files"]);
  });
});
