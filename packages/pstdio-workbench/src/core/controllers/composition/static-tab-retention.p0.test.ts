import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

for (const owner of ["page", "mode", "shell"] as const) {
  test(`${owner} static tabs can be unpinned, pinned and replaced like resource tabs`, () => {
    const w = createWorkbench();
    w.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
    w.views.registerView({ id: "tool", title: "Tool", body: { kind: "react", render: () => null } });
    const placement = {
      id: "library",
      region: "main",
      item: { kind: "view", view: { kind: "view", id: "tool" }, presence: "open" },
    } as const;
    if (owner === "mode")
      w.modePlacements.registerPlacement({
        ...placement,
        modeId: "project",
        ref: { kind: "placement", extensionId: "test", id: "library" },
      });
    if (owner === "shell") w.shellPlacements.registerPlacement(placement);
    const ref = { kind: "page", extensionId: "test", id: "library" } as const;
    w.pages.registerPage({
      id: "library",
      ref,
      path: "library",
      modeId: "project",
      main: { kind: "panels" },
      slots: owner === "page" ? [placement] : [],
    });
    w.shellPlacements.registerPlacement({
      id: "preview",
      region: "main",
      item: {
        kind: "binding",
        binding: {
          view: { kind: "view", id: "tool" },
          kinds: [{ kind: "resource-kind", id: "file" }],
          cardinality: "many",
        },
      },
    });
    w.pageLocations.setProject("project");
    w.pageLocations.navigate({ kind: "page", page: ref });
    const tab = w.layout.getActivePanel("main")!;
    expect(tab).toMatchObject({ pinned: true, tabRetention: "persistent" });
    w.pinPlacement(tab.placementIdentity!, false);
    expect(w.layout.getActivePanel("main")).toMatchObject({ pinned: false, tabRetention: "preview" });
    w.pageLocations.navigate({ kind: "page", page: ref });
    expect(w.layout.getActivePanel("main")).toMatchObject({ pinned: false, tabRetention: "preview" });
    w.pinPlacement(tab.placementIdentity!);
    expect(w.layout.getActivePanel("main")).toMatchObject({ pinned: true, tabRetention: "persistent" });
    w.pinPlacement(tab.placementIdentity!, false);
    w.shellPlacements.openPlacement({
      placementId: "preview",
      resource: { type: "file", id: "next" },
      open: "preview",
    });
    expect(w.layout.listPanelInstances("main")).toHaveLength(1);
    expect(w.layout.getActivePanel("main")?.resource?.id).toBe("next");
  });
}

for (const owner of ["mode", "shell"] as const) {
  test(`${owner} static previews close on page leave without becoming pinned again`, () => {
    const w = createWorkbench();
    w.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
    w.views.registerView({ id: "tool", title: "Tool", body: { kind: "react", render: () => null } });
    const placement = {
      id: "library",
      region: "side",
      item: { kind: "view", view: { kind: "view", id: "tool" }, presence: "open" },
    } as const;
    if (owner === "mode")
      w.modePlacements.registerPlacement({
        ...placement,
        modeId: "project",
        ref: { kind: "placement", extensionId: "test", id: "library" },
      });
    else w.shellPlacements.registerPlacement(placement);
    for (const id of ["one", "two"])
      w.pages.registerPage({
        id,
        ref: { kind: "page", extensionId: "test", id },
        path: id,
        modeId: "project",
        main: { kind: "panels" },
        slots: [],
      });
    w.pageLocations.setProject("project");
    w.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "test", id: "one" } });
    w.pinPlacement(w.layout.getActivePanel("side")!.placementIdentity!, false);
    w.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "test", id: "two" } });
    expect(w.layout.listPanelInstances("side")).toEqual([]);
  });
}
