import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { openPanelWidget } from "./panel-widget-open";

describe("openPanelWidget", () => {
  test("opens Add panel widgets as closable tabs", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerSubPanel({
      id: "workspaces",
      title: "Workspaces",
      region: "main",
      rendererId: "workspaces.renderer",
    });

    openPanelWidget({ workbench, widget: workbench.layout.getWidget("workspaces")!, region: "main" });

    expect(workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({ contributionId: "workspaces", closable: true }),
    ]);
  });

  test("marks command-backed opens as Add Panel requests", async () => {
    const workbench = createWorkbenchCore();
    const contexts: unknown[] = [];
    workbench.commands.registerCommand(
      { id: "sessions.new", label: "New session" },
      { execute: (_args, context) => contexts.push(context) },
    );
    workbench.layout.registerSubPanel({
      id: "sessions",
      title: "Sessions",
      region: "side",
      rendererId: "sessions.renderer",
      openCommandId: "sessions.new",
    });

    openPanelWidget({ workbench, widget: workbench.layout.getWidget("sessions")!, region: "side" });
    await Promise.resolve();

    expect(contexts).toEqual([{ source: "panel-add" }]);
  });

  test("keeps a floating Side Panel detached when adding a tab", () => {
    const workbench = createWorkbenchCore({ initialSidePanelMode: "floating" });
    workbench.layout.registerSubPanel({
      id: "sessions",
      title: "Sessions",
      region: "side",
      rendererId: "sessions.renderer",
    });

    openPanelWidget({ workbench, widget: workbench.layout.getWidget("sessions")!, region: "side" });

    expect(workbench.sidePanel.getMode()).toBe("floating");
  });
});
