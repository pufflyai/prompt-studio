import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

for (const source of ["closed", "cannot-open", "unprovided"] as const) {
  test(`catalog opening Main preserves its ${source} authored Side panel`, async () => {
    const core = createWorkbench();
    const page = (id: string) => ({ kind: "page" as const, extensionId: "test", id });
    core.modes.registerMode({
      id: "mode",
      regionSettings: { side: { acceptsTabs: false, canOpen: source === "closed", canClose: true } },
      activate() {},
    });
    core.views.registerView({ id: "view", title: "View", body: { kind: "react", render: () => null } });
    for (const id of ["home", "other"]) {
      core.pages.registerPage({
        id,
        ref: page(id),
        path: id,
        modeId: "mode",
        main: { kind: "panels", empty: { kind: "view", id: "view" } },
        slots: [],
      });
    }
    core.modePlacements.registerPlacement({
      id: "tool",
      ref: { kind: "placement", extensionId: "test", id: "tool" },
      modeId: "mode",
      region: "side",
      item: { kind: "view", view: { kind: "view", id: "view" }, presence: "open" },
    });
    try {
      core.pageLocations.setProject("project");
      await core.navigation.openTarget({ kind: "page", page: page("home") });
      const tool = core.layout.listPanelInstances("side")[0]!;
      core.movePanel(tool.instanceId, "main");
      const moved = core.layout.getLayout().regions.main.widgets.find((tab) => tab.widgetId === tool.instanceId)!;
      core.closePlacement(moved.placementIdentity!);
      await core.shell.setRegionOpen("side", false);
      if (source === "unprovided") core.modes.getMode("mode")!.panels = ["main", "secondary"];
      const reopen = core.composition.panelsFor("main").addable.find((item) => item.panelId === tool.panelId)!;
      expect(reopen).toBeDefined();
      const seen: string[] = [];
      const unsubscribe = core.layout.store.subscribe(() => {
        const layout = core.layout.getLayout();
        seen.push(`${layout.regions.side.visibility}:${layout.regions.side.widgets.length}`);
      });
      try {
        await reopen.open?.();
      } finally {
        unsubscribe();
      }
      expect(seen.length).toBeGreaterThan(0);
      expect(new Set(seen)).toEqual(new Set([source === "unprovided" ? "undefined:0" : "closed:0"]));
      const reopened = core.layout.getLayout().regions.main.widgets.find((tab) => tab.contributionId === tool.panelId)!;
      expect(reopened.placementIdentity).toMatchObject({ kind: "page", pageId: "home" });
      expect(core.layout.getLayout().regions.side.visibility).toBe(source === "unprovided" ? undefined : "closed");
      await core.navigation.openTarget({ kind: "page", page: page("other") });
      expect(core.layout.listPanelInstances("main").filter((tab) => tab.panelId === tool.panelId)).toHaveLength(0);
      await core.navigation.openTarget({ kind: "page", page: page("home") });
      expect(core.layout.listPanelInstances("main").filter((tab) => tab.panelId === tool.panelId)).toHaveLength(1);
      expect(core.layout.listPanelInstances("side")).toHaveLength(0);
    } finally {
      await core.dispose();
    }
  });
}
