import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { openPanelWidget } from "./panel-widget-open";

describe("openPanelWidget", () => {
  test("preserves the Panel's declared closability when opened from Add Panel", () => {
    const workbench = createWorkbenchCore();
    workbench.layout.registerPanel({
      closable: false,
      id: "workspaces",
      title: "Workspaces",
      region: "main",
      rendererId: "workspaces.renderer",
    });

    openPanelWidget({ workbench, widget: workbench.layout.getWidget("workspaces")!, region: "main" });

    expect(workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({ contributionId: "workspaces", closable: false }),
    ]);
  });

  test("marks command-backed opens as Add Panel requests", async () => {
    const workbench = createWorkbenchCore();
    const contexts: unknown[] = [];
    workbench.commands.registerCommand(
      { id: "sessions.new", label: "New session" },
      { execute: (_args, context) => contexts.push(context) },
    );
    workbench.layout.registerPanel({
      closable: false,
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
    workbench.layout.registerPanel({
      closable: false,
      id: "sessions",
      title: "Sessions",
      region: "side",
      rendererId: "sessions.renderer",
    });

    openPanelWidget({ workbench, widget: workbench.layout.getWidget("sessions")!, region: "side" });

    expect(workbench.sidePanel.getMode()).toBe("floating");
  });
});
