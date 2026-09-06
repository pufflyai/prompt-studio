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
      item: {
        kind: "view",
        presence: "closed",
        view: {
          kind: "view",
          id: "guide",
        },
      },
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
      item: {
        kind: "view",
        presence: "fixed",
        view: {
          kind: "view",
          id: "notes",
        },
      },
      region: "secondary",
    });
    workbench.shellPlacements.registerPlacement({
      id: "terminals",
      item: {
        kind: "binding",
        binding: {
          kinds: [
            {
              kind: "resource-kind",
              id: "terminal",
            },
          ],
          view: {
            kind: "view",
            id: "terminal",
          },
          cardinality: "many",
        },
      },
      region: "secondary",
    });
    workbench.shellPlacements.openPlacement({
      placementId: "terminals",
      resource: {
        type: "terminal",
        label: "Terminal 1",
        id: "terminal:z",
      },
      open: "pin",
      title: "Terminal 1",
    });
    workbench.shellPlacements.openPlacement({
      placementId: "terminals",
      resource: {
        type: "terminal",
        label: "Terminal 2",
        id: "terminal:a",
      },
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
