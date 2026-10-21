import { describe, expect, test } from "bun:test";
import { createWorkbench } from "./workbench-core";

const page = { extensionId: "example.mail", kind: "page" as const, id: "inbox" };
const home = { ...page, id: "home" };
const createInbox = (cardinality: "one" | "many" = "one", closable?: boolean, homeClosable?: boolean) => {
  const workbench = createWorkbench({ startPage: home });
  workbench.modes.registerMode({ id: "mail", activate: () => undefined });
  for (const id of ["inbox", "reader", "tools"]) {
    workbench.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
  }
  workbench.pages.registerPage({
    id: "home",
    ref: home,
    path: "home",
    modeId: "mail",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "inbox",
      },
      cardinality: "one",
      closable: homeClosable,
    },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "inbox",
    parentId: "home",
    ref: page,
    path: "inbox",
    modeId: "mail",
    resource: {
      kinds: [
        {
          kind: "resource-kind",
          id: "thread",
        },
      ],
    },
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "inbox",
      },
      cardinality,
      closable,
    },
    slots: [
      {
        id: "reader",
        region: "side",
        openOn: "page-resource",
        item: {
          kind: "binding",
          binding: {
            kinds: [
              {
                kind: "resource-kind",
                id: "thread",
              },
            ],
            view: {
              kind: "view",
              id: "reader",
            },
            cardinality: "one",
          },
        },
      },
      {
        id: "tools",
        region: "side",
        item: {
          kind: "view",
          view: {
            kind: "view",
            id: "tools",
          },
          presence: "open",
        },
      },
    ],
  });
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "thread", id: "one" } });
  return workbench;
};
describe("closing page resource panels", () => {
  test("closing static Main preserves its routed section", () => {
    const workbench = createInbox("one", true, true);
    const location = { page: home, section: { anchors: [{ id: "summary", heading: "Summary" }] } };
    expect(workbench.pageLocations.replay(location).ok).toBe(true);
    const before = workbench.pages.store.getState().location;
    workbench.closePlacement(workbench.layout.getActivePanel("main")!.placementIdentity!);
    expect(workbench.pages.store.getState().location).toEqual(before);
  });
  for (const region of ["main", "side", "secondary"] as const) {
    test(`a closeable static Main in ${region} closes and reopens through page navigation`, () => {
      const workbench = createInbox("one", true, true);
      workbench.pageLocations.navigate({ kind: "page", page: home });
      const original = workbench.layout.getActivePanel("main")!;
      if (region !== "main") workbench.movePanel(original.instanceId, region);
      expect(workbench.layout.getActivePanel(region)?.closable).toBe(true);
      workbench.closePlacement(original.placementIdentity!);
      expect(workbench.layout.listPanelInstances(region).some((item) => item.instanceId === original.instanceId)).toBe(
        false,
      );
      expect(workbench.pages.store.getState().location).toEqual({ page: home });
      expect(workbench.pages.store.getState().pageStates.home?.activePrimaryInstanceKey).toBeUndefined();
      expect(workbench.pageLocations.navigate({ kind: "page", page: home }).ok).toBe(true);
      expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
      workbench.closePlacement(original.placementIdentity!);
      workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "thread", id: "next" } });
      workbench.closePlacement(workbench.layout.getActivePanel("main")!.placementIdentity!);
      expect(workbench.pages.store.getState().location).toEqual({ page: home });
      expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(original.instanceId);
    });
  }
  for (const region of ["main", "side", "secondary"] as const) {
    test(`closing the routed resource in ${region} returns to its parent`, () => {
      const workbench = createInbox("one", true);
      const main = workbench.layout.getLayout().regions.main.widgets[0]!;
      if (region !== "main") workbench.movePanel(main.widgetId, region);
      workbench.closePlacement(main.placementIdentity!);
      expect(workbench.pages.store.getState().location).toEqual({ page: home });
    });
  }
  test("a single-resource page can opt into closing back to its parent", () => {
    const workbench = createInbox("one", true);
    const main = workbench.layout.getLayout().regions.main.widgets[0]!;
    expect(main.closable).toBe(true);
    expect(workbench.pageLocations.closePlacement(main.placementIdentity!).ok).toBe(true);
    expect(workbench.pages.store.getState().location).toEqual({ page: home });
  });
  test("single-resource Main is fixed while its optional panels remain closable", () => {
    const workbench = createInbox();
    const main = workbench.layout.getLayout().regions.main.widgets[0]!;
    expect(main.closable).toBe(false);
    expect(workbench.layout.getLayout().regions.side.widgets.every((item) => item.closable)).toBe(true);
    const location = workbench.pages.store.getState().location;
    expect(workbench.pageLocations.closePlacement(main.placementIdentity!).ok).toBe(false);
    expect(workbench.pages.store.getState().location).toEqual(location);
    expect(workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "thread", id: "two" } }).ok).toBe(
      true,
    );
    expect(workbench.layout.getLayout().regions.main.widgets).toMatchObject([
      { closable: false, resource: { id: "two" } },
    ]);
  });
  test("a page supporting many resources keeps its only tab closable", () => {
    const workbench = createInbox("many");
    const main = workbench.layout.getLayout().regions.main.widgets[0]!;
    expect(main.closable).toBe(true);
    expect(workbench.pageLocations.closePlacement(main.placementIdentity!).ok).toBe(true);
    expect(workbench.pages.store.getState().location).toEqual({ page: home });
  });
  test("closing a shared resource from another page keeps a manually closed reader closed", () => {
    const workbench = createInbox("many");
    const first = workbench.layout.getActivePanel("main")!;
    workbench.movePanel(first.instanceId, "secondary");
    expect(
      workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "thread", id: "two" }, open: "pin" }).ok,
    ).toBe(true);
    const placements = workbench.pages.store.getState().placements;
    const reader = placements.find((item) => item.identity.kind === "page" && item.identity.slotId === "reader")!;
    workbench.closePlacement(reader.identity);
    workbench.closePlacement(first.placementIdentity!);
    expect(workbench.pages.store.getState().location?.resource?.id).toBe("two");
    expect(workbench.layout.getLayout().regions.side.widgets.some((item) => item.viewId === "reader")).toBe(false);
  });
  test("closing the last current Main resource returns to its parent and keeps shared panels", () => {
    const workbench = createInbox("many");
    for (const id of ["one", "two"]) {
      expect(
        workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "thread", id }, open: "pin" }).ok,
      ).toBe(true);
    }
    const selected = workbench.pages.store
      .getState()
      .placements.find(
        (item) =>
          item.identity.kind === "page" && item.identity.slotId === "$main" && item.value.resource?.id === "two",
      )!;
    const shared = workbench.layout.getLayout().regions.side.widgets.map((item) => item.widgetId);
    expect(workbench.pageLocations.closePlacement(selected.identity).ok).toBe(true);
    expect(workbench.pages.store.getState().location).toEqual({ page: home });
    expect(workbench.layout.getLayout().regions.side.widgets.map((item) => item.widgetId)).toEqual(shared);
  });
  test("keeps page-created auxiliary panels when navigating to the home page", () => {
    const workbench = createInbox();
    const shared = workbench.layout.getLayout().regions.side.widgets.map((item) => item.widgetId);
    expect(workbench.pageLocations.navigate({ kind: "page", page: home }).ok).toBe(true);
    expect(workbench.pages.store.getState().location?.resource).toBeUndefined();
    expect(workbench.layout.getLayout().regions.side.widgets.map((item) => item.widgetId)).toEqual(shared);
  });
  test("closes the reader without changing the route or reopening it when another panel closes", () => {
    const workbench = createInbox();
    const before = workbench.pages.store.getState();
    const reader = before.placements.find(
      (item) => item.identity.kind === "page" && item.identity.slotId === "reader",
    )!;
    expect(workbench.pageLocations.closePlacement(reader.identity).ok).toBe(true);
    expect(workbench.pages.store.getState().location).toEqual(before.location);
    expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(1);
    expect(workbench.pages.store.getState().placements).not.toContainEqual(reader);
    const tools = before.placements.find((item) => item.identity.kind === "page" && item.identity.slotId === "tools")!;
    expect(workbench.pageLocations.closePlacement(tools.identity).ok).toBe(true);
    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([]);
    workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "thread", id: "two" } });
    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({ resource: expect.objectContaining({ id: "two" }) }),
      expect.objectContaining({ viewId: "tools" }),
    ]);
  });
});
