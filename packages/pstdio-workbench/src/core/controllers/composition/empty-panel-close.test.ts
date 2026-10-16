import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("closing the last shell tab closes its auxiliary panel", () => {
  for (const region of ["side", "secondary"] as const) {
    const w = createWorkbench();
    w.views.registerView({ id: "notes", title: "Notes", body: { kind: "react", render: () => null } });
    w.shellPlacements.registerPlacement({
      id: "notes",
      region,
      item: {
        kind: "binding",
        binding: {
          view: { kind: "view", id: "notes" },
          kinds: [{ kind: "resource-kind", id: "note" }],
          cardinality: "many",
        },
      },
    });
    const open = (id: string) =>
      w.shellPlacements.openPlacement({ placementId: "notes", resource: { type: "note", id }, open: "pin" });
    const first = open("first");
    const last = open("last");
    w.shell.setRegionOpen(region, true);
    w.closePlacement(first);
    expect(w.shell.getRegionState(region).open).toBe(true);
    w.closePlacement(last);
    expect(w.layout.listPanelInstances(region)).toEqual([]);
    expect(w.shell.getRegionState(region).open).toBe(false);
  }
});

test("closing the last unowned tab closes its auxiliary panel", () => {
  for (const region of ["side", "secondary"] as const) {
    const w = createWorkbench();
    w.layout.registerWidget({ id: "notes", rendererId: "notes", region, title: "Notes", closable: true });
    const panel = w.layout.openPanel("notes");
    w.shell.setRegionOpen(region, true);
    w.layout.closePanel(panel.instanceId);
    expect(w.shell.getRegionState(region).open).toBe(false);
  }
});
