import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

for (const owner of ["page", "mode", "legacy"] as const) {
  test(`${owner} tabs move across all tab panels independently of Add choices`, () => {
    const workbench = createWorkbench();
    const page = { kind: "page", extensionId: "test", id: "home" } as const;
    const item = { kind: "view", view: { kind: "view", id: "tool" }, presence: "open" } as const;
    workbench.views.registerView({ id: "tool", title: "Tool", body: { kind: "react", render: () => null } });
    workbench.modes.registerMode({
      id: "project",
      activate() {},
      listAddablePanels:
        owner === "legacy" ? () => [{ panelId: "tool", region: "side", allowedRegions: ["side"] }] : undefined,
    });
    if (owner === "mode")
      workbench.modePlacements.registerPlacement({
        id: "tool",
        ref: { kind: "placement", extensionId: "test", id: "tool" },
        modeId: "project",
        region: "side",
        movableTo: ["side"],
        item,
      });
    workbench.pages.registerPage({
      id: page.id,
      ref: page,
      path: "",
      modeId: "project",
      main: { kind: "panels" },
      slots: owner === "page" ? [{ id: "tool", region: "side", movableTo: ["side"], item }] : [],
    });
    workbench.pageLocations.setProject("project");
    workbench.pageLocations.navigate({ kind: "page", page });
    if (owner === "legacy") {
      workbench.layout.registerPanel({
        id: "tool",
        title: "Tool",
        rendererId: "tool",
        region: "side",
        singleton: true,
      });
      workbench.layout.openPanel("tool", { region: "side" });
    }
    const tab = workbench.layout.getActivePanel("side")!;
    expect(tab).toBeDefined();
    expect(workbench.getPanelDestinations(tab.instanceId)).toHaveLength(3);
    for (const region of ["main", "secondary", "side"] as const) {
      workbench.movePanel(tab.instanceId, region);
      expect(workbench.layout.getActivePanel(region)?.instanceId).toBe(tab.instanceId);
    }
    workbench.movePanel(tab.instanceId, "secondary");
    workbench.pageLocations.navigate({ kind: "page", page });
    expect(workbench.layout.getActivePanel("secondary")?.instanceId).toBe(tab.instanceId);
  });
}
