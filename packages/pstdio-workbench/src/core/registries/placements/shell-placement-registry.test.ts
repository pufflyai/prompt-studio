import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

describe("shell placement registry", () => {
  test("removes the rendered instance when the last optional placement closes", () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: "guide",
      title: "Guide",
      body: { kind: "react", render: () => null },
    });
    workbench.shellPlacements.registerPlacement({
      id: "guide",
      item: { kind: "view", viewId: "guide", presence: "closed" },
      region: "main",
    });

    const identity = workbench.shellPlacements.openPlacement({ placementId: "guide" });
    expect(workbench.layout.getLayout().regions.main.widgets).toHaveLength(1);

    workbench.shellPlacements.closePlacement(identity);

    expect(workbench.layout.getLayout().regions.main.widgets).toHaveLength(0);
  });

  test("appends a newly opened resource tab after the existing tabs", () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: "notes",
      title: "Notes",
      body: { kind: "react", render: () => null },
    });
    workbench.views.registerView({
      id: "terminal",
      title: "Terminal",
      body: { kind: "react", render: () => null },
    });
    workbench.shellPlacements.registerPlacement({
      id: "notes",
      item: { kind: "view", viewId: "notes", presence: "fixed" },
      region: "secondary",
    });
    workbench.shellPlacements.registerPlacement({
      id: "terminals",
      item: {
        kind: "resource",
        viewId: "terminal",
        resourceKinds: ["terminal"],
        cardinality: "many",
      },
      region: "secondary",
    });
    workbench.shellPlacements.openPlacement({
      placementId: "terminals",
      resource: { kind: "terminal", uri: "terminal:z", label: "Terminal 1" },
      open: "pin",
      title: "Terminal 1",
    });

    workbench.shellPlacements.openPlacement({
      placementId: "terminals",
      resource: { kind: "terminal", uri: "terminal:a", label: "Terminal 2" },
      open: "pin",
      title: "Terminal 2",
    });

    expect(workbench.layout.getLayout().regions.secondary.widgets.map((placement) => placement.title)).toEqual([
      "Notes",
      "Terminal 1",
      "Terminal 2",
    ]);
  });
});
