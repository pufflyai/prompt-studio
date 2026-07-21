import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { openPanelWidget } from "./panel-widget-open";

describe("openPanelWidget", () => {
  test("opens Add panel widgets as closable tabs", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerWidget({
      id: "workspaces",
      title: "Workspaces",
      region: "main",
      panelAddable: true,
      rendererId: "workspaces.renderer",
    });

    openPanelWidget({ workbench, widget: workbench.layout.getWidget("workspaces")!, region: "main" });

    expect(workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({ contributionId: "workspaces", closable: true }),
    ]);
  });
});
