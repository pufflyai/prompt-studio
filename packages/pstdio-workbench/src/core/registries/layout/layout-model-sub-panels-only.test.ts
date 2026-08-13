import { describe, expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";

const registerBoard = (layout: ReturnType<typeof createLayoutModel>) => {
  layout.registerPanel({
    closable: false,
    id: "board.host",
    title: "Board",
    region: "main",
    singleton: true,
    subPanelsOnly: true,
    rendererId: "board.host",
  });
  layout.registerPanel({
    closable: true,
    id: "board.columns",
    title: "Columns",
    region: "main",
    singleton: true,
    eligibleLocations: {},
    resourceKinds: ["board.view"],
    rendererId: "board.columns",
  });
  layout.registerPanel({
    closable: true,
    id: "board.timeline",
    title: "Timeline",
    region: "main",
    singleton: true,
    eligibleLocations: {},
    resourceKinds: ["board.view"],
    rendererId: "board.timeline",
  });
};

const boardResource = { kind: "board.view", uri: "board://main", id: "board", label: "Board" };

describe("sub-panels-only locations", () => {
  test("activates the first owned Sub Panel instead of the Location", () => {
    const layout = createLayoutModel();
    registerBoard(layout);

    const host = layout.openPanel("board.host", { resource: boardResource, strategy: { kind: "persistent" } });
    layout.establishLocation(host.instanceId);
    const columns = layout.openPanel("board.columns", {
      resource: boardResource,
      title: "Columns",
      strategy: { kind: "persistent" },
    });
    layout.openPanel("board.timeline", {
      resource: boardResource,
      title: "Timeline",
      strategy: { kind: "persistent" },
    });

    // Re-establishing the Location (e.g. on mode re-entry) must land on a Sub
    // Panel: the Location presents no content of its own.
    layout.establishLocation(host.instanceId);

    const main = layout.getLayout().regions.main;
    expect(main.activeWidgetId).toBe(columns.instanceId);
    expect(main.widgets.find((placement) => placement.widgetId === host.instanceId)?.role).toBe("location");
  });

  test("keeps the Location active while it has no Sub Panels", () => {
    const layout = createLayoutModel();
    registerBoard(layout);

    const host = layout.openPanel("board.host", { resource: boardResource, strategy: { kind: "persistent" } });
    layout.establishLocation(host.instanceId);

    expect(layout.getLayout().regions.main.activeWidgetId).toBe(host.instanceId);
  });
});
