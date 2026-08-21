import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "./workbench-core";

describe("Workbench public API", () => {
  test("uses one Panel vocabulary for definitions and instances", () => {
    const workbench = createWorkbenchCore();

    workbench.layout.registerPanel({
      id: "ticket",
      title: "Ticket",
      region: "main",
      rendererId: "ticket.renderer",
    });
    workbench.layout.registerPanel({
      id: "diff",
      title: "Diff",
      region: "secondary",
      rendererId: "diff.renderer",
    });

    const ticket = workbench.layout.openPanel("ticket");
    const diff = workbench.layout.openPanel("diff", {
      closable: true,
      strategy: { kind: "preview", position: "start" },
    });

    expect(ticket).toMatchObject({ instanceId: "ticket", panelId: "ticket", closable: false });
    expect(diff).toMatchObject({ instanceId: "diff", panelId: "diff", closable: true, tabRetention: "preview" });
    expect(workbench.layout.getActivePanel("secondary")?.instanceId).toBe(diff.instanceId);
    expect(workbench.layout.listPanelInstances("secondary")).toHaveLength(1);
    expect(() => workbench.layout.closePanel(ticket.instanceId)).toThrow("Panel cannot be closed: ticket");
    expect(workbench.layout.closePanel(diff.instanceId)).toBeUndefined();
  });

  test("changes shell presentation through one canonical authority", () => {
    const workbench = createWorkbenchCore({ defaultPanelOpenByRegionId: { secondary: true } });
    let changes = 0;
    const listener = workbench.shell.onDidChange(() => {
      changes += 1;
    });

    workbench.shell.setRegionOpen("secondary", false);
    workbench.shell.setRegionSize("secondary", 420);
    workbench.shell.setSidePanelPresentation("attached");

    expect(workbench.shell.getRegionState("secondary")).toEqual({ open: false, size: 420 });
    expect(workbench.layout.getLayout().regions.secondary.visible).toBe(false);
    expect(workbench.shell.getSidePanelPresentation()).toBe("attached");
    expect(changes).toBe(3);

    listener.dispose();
  });

  test("changes scoped layout state through the host boundary", () => {
    const layouts = new Map<
      string | undefined,
      ReturnType<typeof createWorkbenchCore>["layout"] extends {
        getLayout(): infer T;
      }
        ? T
        : never
    >();
    const workbench = createWorkbenchCore({
      layoutPersistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (layout, scope) => layouts.set(scope, layout),
      },
    });

    workbench.host.setPersistenceScope("resource:a");
    workbench.shell.setRegionSize("sidenav", 280);
    workbench.shell.setRegionSize("secondary", 360);
    workbench.host.setPersistenceScope("resource:b", { carryRegions: ["sidenav"] });
    workbench.shell.setRegionSize("secondary", 480);
    workbench.host.setPersistenceScope("resource:a", { carryRegions: ["sidenav"] });

    expect(workbench.host.getPersistenceScope()).toBe("resource:a");
    expect(workbench.shell.getRegionState("sidenav").size).toBe(280);
    expect(workbench.shell.getRegionState("secondary").size).toBe(360);
  });
});
