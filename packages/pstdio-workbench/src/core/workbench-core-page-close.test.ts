import { describe, expect, test } from "bun:test";
import { createWorkbench } from "./workbench-core";

const page = { extensionId: "example.mail", kind: "page" as const, id: "inbox" };
const home = { ...page, id: "home" };
const createInbox = (cardinality: "one" | "many" = "one") => {
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
  test("closing an inactive pinned resource keeps a manually closed reader closed", () => {
    const workbench = createInbox("many");
    for (const id of ["one", "two"]) {
      expect(
        workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "thread", id }, open: "pin" }).ok,
      ).toBe(true);
    }
    const placements = workbench.pages.store.getState().placements;
    const reader = placements.find((item) => item.identity.kind === "page" && item.identity.slotId === "reader")!;
    const inactive = placements.find(
      (item) => item.identity.kind === "page" && item.identity.slotId === "$main" && item.value.resource?.id === "one",
    )!;
    expect(workbench.pageLocations.closePlacement(reader.identity).ok).toBe(true);
    expect(workbench.pageLocations.closePlacement(inactive.identity).ok).toBe(true);
    expect(workbench.pages.store.getState().location?.resource?.id).toBe("two");
    expect(workbench.layout.getLayout().regions.side.widgets.some((item) => item.viewId === "reader")).toBe(false);
  });
  test("closing the selected pinned resource updates its reader to the remaining resource", () => {
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
    expect(workbench.pageLocations.closePlacement(selected.identity).ok).toBe(true);
    expect(workbench.pages.store.getState().location?.resource?.id).toBe("one");
    expect(
      workbench.layout.getLayout().regions.side.widgets.find((item) => item.viewId === "reader")?.resource?.id,
    ).toBe("one");
  });
  test("removes resource page panels when navigating to the home page", () => {
    const workbench = createInbox();
    expect(workbench.pageLocations.navigate({ kind: "page", page: home }).ok).toBe(true);
    expect(workbench.pages.store.getState().location?.resource).toBeUndefined();
    expect(workbench.layout.getLayout().regions.side.widgets).toEqual([]);
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
    ]);
  });
});
