import { expect, test } from "bun:test";
import type { PlacementItem } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../workbench-core";
import { createOwnedAddablePanels } from "./owned-addable-panels";

test("command-backed singleton Add can create a tab again after it closes", async () => {
  const w = createWorkbench();
  w.views.registerView({ id: "tool", title: "Tool", body: { kind: "react", render: () => null } });
  w.commands.registerCommand(
    { id: "open-tool", label: "Open tool" },
    {
      execute: (_args, context) => {
        w.shellPlacements.openPlacement({
          placementId: "tool",
          resource: { type: "tool", id: "one" },
          region: context?.region,
        });
      },
    },
  );
  w.shellPlacements.registerPlacement({
    id: "tool",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "tool" },
        kinds: [{ kind: "resource-kind", id: "tool" }],
        cardinality: "one",
        add: { kind: "command", target: { command: { kind: "command", id: "open-tool" } } },
      },
    },
  });
  await w.commands.executeCommand("open-tool");
  const original = w.layout.getActivePanel("side")!;
  w.closePlacement(original.placementIdentity!);
  const add = w.composition.panelsFor("secondary").addable.find((panel) => panel.contribution.title === "Tool")!;
  await add.open!();
  expect(w.layout.getActivePanel("secondary")?.instanceId).toBe(original.instanceId);
  expect(w.layout.listPanelInstances("side")).toEqual([]);
  expect(w.shell.getRegionState("side").open).toBe(false);
});

for (const owner of ["shell", "mode", "page"] as const) {
  for (const kind of ["view", "binding"] as const) {
    test(`Add creates a ${owner} ${kind} directly in the chosen panel and keeps later moves`, async () => {
      const w = createWorkbench();
      w.views.registerView({ id: "tool", title: "Tool", body: { kind: "react", render: () => null } });
      w.modes.registerMode({ id: "project", activate() {} });
      w.commands.registerCommand(
        { id: "create-tool", label: "Create tool" },
        {
          execute: (_args, context) => {
            const target = { resource: { type: "tool", id: "new" }, region: context?.region };
            if (owner === "shell") w.shellPlacements.openPlacement({ ...target, placementId: "tool", open: "pin" });
            if (owner === "mode")
              w.modePlacements.openPlacement({
                ...target,
                panel: { kind: "placement", extensionId: "test", id: "tool" },
                open: "pin",
              });
            if (owner === "page") w.pages.openSlot({ ...target, pageId: "home", slotId: "tool", open: "pin" });
          },
        },
      );
      const item: PlacementItem =
        kind === "view"
          ? { kind: "view", view: { kind: "view", id: "tool" }, presence: "closed" }
          : {
              kind: "binding",
              binding: {
                kinds: [{ kind: "resource-kind", id: "tool" }],
                view: { kind: "view", id: "tool" },
                cardinality: "many",
                add: { kind: "command", target: { command: { kind: "command", id: "create-tool" } } },
              },
            };
      const placement = { id: "tool", region: "side" as const, item };
      if (owner === "shell") w.shellPlacements.registerPlacement(placement);
      if (owner === "mode")
        w.modePlacements.registerPlacement({
          ...placement,
          ref: { kind: "placement", extensionId: "test", id: "tool" },
          modeId: "project",
        });
      const page = { kind: "page" as const, extensionId: "test", id: "home" };
      w.pages.registerPage({
        id: "home",
        ref: page,
        path: "",
        modeId: "project",
        main: { kind: "view", view: { kind: "view", id: "tool" }, cardinality: "one" },
        slots: owner === "page" ? [placement] : [],
      });
      w.pageLocations.setProject("project");
      w.pageLocations.navigate({ kind: "page", page });
      w.shell.setRegionOpen("side", true);
      const observations: number[] = [];
      const unsubscribe = w.layout.store.subscribe(() => observations.push(w.layout.listPanelInstances("side").length));
      const add = createOwnedAddablePanels(w, {
        layout: w.layout.getLayout(),
        region: "secondary",
        modeId: "project",
        resource: { type: "tool", id: "new" },
      })[0]!;
      expect(add).toBeDefined();
      await add.open!({ type: "tool", id: "new" });
      unsubscribe();
      expect(observations.length).toBeGreaterThan(0);
      expect(observations.every((count) => count === 0)).toBe(true);
      const tab = w.layout.getActivePanel("secondary")!;
      expect(tab).toBeDefined();
      expect(w.shell.getRegionState("side").open).toBe(true);
      w.movePanel(tab.instanceId, "side");
      w.pages.refreshResource({ type: "tool", id: "new", label: "Updated" });
      expect(w.layout.getActivePanel("side")?.instanceId).toBe(tab.instanceId);
      expect(w.layout.listPanelInstances("secondary")).toEqual([]);
    });
  }
}
