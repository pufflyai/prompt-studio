import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { createOwnedAddablePanels } from "./owned-addable-panels";

for (const source of ["side", "secondary"] as const) {
  const destination = source === "side" ? "secondary" : "side";
  for (const addCommand of [false, true]) {
    test(`adding a ${addCommand ? "command-created" : "resource-bound"} tab to ${destination} keeps empty ${source} open`, async () => {
      const w = createWorkbench();
      w.views.registerView({ id: "tool", title: "Tool", body: { kind: "react", render: () => null } });
      w.commands.registerCommand(
        { id: "create-tool", label: "Create tool" },
        {
          execute: (_args, context) => {
            w.shellPlacements.openPlacement({
              placementId: "tool",
              resource: { type: "tool", id: "new" },
              open: "pin",
              region: context?.region,
            });
          },
        },
      );
      w.shellPlacements.registerPlacement({
        id: "tool",
        region: source,
        item: {
          kind: "binding",
          binding: {
            view: { kind: "view", id: "tool" },
            kinds: [{ kind: "resource-kind", id: "tool" }],
            cardinality: "many",
            ...(addCommand
              ? {
                  add: {
                    kind: "command" as const,
                    target: { command: { kind: "command" as const, id: "create-tool" } },
                  },
                }
              : {}),
          },
        },
      });
      w.layout.registerWidget({ id: "main", rendererId: "main", title: "Main", region: "main" });
      w.layout.openWidget("main", { resource: { type: "tool", id: "current" }, role: "location" });
      w.shell.setRegionOpen(source, true);
      const before = structuredClone(w.layout.getLayout().regions[source]);
      const observed: (typeof before)[] = [];
      const unsubscribe = w.layout.store.subscribe(() => {
        observed.push(structuredClone(w.layout.getLayout().regions[source]));
      });
      const panel = createOwnedAddablePanels(w, {
        layout: w.layout.getLayout(),
        region: destination,
        resource: { type: "tool", id: "current" },
      }).find((item) => item.contribution.title === "Tool");
      expect(panel?.open).toBeDefined();
      await panel!.open!({ type: "tool", id: "current" });
      unsubscribe();
      expect(w.layout.listPanelInstances(destination)).toHaveLength(1);
      expect(w.layout.listPanelInstances(source)).toEqual([]);
      expect(w.shell.getRegionState(source).open).toBe(true);
      expect(observed.length).toBeGreaterThan(0);
      for (const region of observed) expect(region).toEqual(before);
      const existing = w.layout.getActivePanel(destination)!;
      w.movePanel(existing.instanceId, source);
      await panel!.open!({ type: "tool", id: "current" });
      const reusedRegion = addCommand ? destination : source;
      const emptyRegion = addCommand ? source : destination;
      expect(w.layout.listPanelInstances(reusedRegion).map((tab) => tab.instanceId)).toEqual([existing.instanceId]);
      expect(w.layout.listPanelInstances(emptyRegion)).toEqual([]);
      expect(w.shell.getRegionState(source).open).toBe(!addCommand);
    });
  }
}

test("an explicit close while adding a tab stays closed", async () => {
  const w = createWorkbench();
  w.layout.registerWidget({ id: "tool", rendererId: "tool", title: "Tool", region: "secondary", closable: true });
  w.shell.setRegionOpen("secondary", true);
  const { promise, resolve } = Promise.withResolvers<void>();
  w.commands.registerCommand(
    { id: "add-tool", label: "Add tool" },
    {
      execute: async (_args, context) => {
        await promise;
        w.layout.openPanel("tool", { region: context?.region });
      },
    },
  );
  const { openPanelWidget } = await import("../../../react/region/panel-widget-open");
  const added = openPanelWidget({
    workbench: w,
    widget: { ...w.layout.getWidget("tool")!, openCommand: { commandId: "add-tool" } },
    region: "side",
  });
  w.shell.setRegionOpen("secondary", false);
  resolve();
  await added;
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
  expect(w.shell.getRegionState("secondary").open).toBe(false);
});
