import { describe, expect, test } from "bun:test";
import { createWorkbench } from "./workbench-core";

const page = { extensionId: "example.mail", kind: "page" as const, id: "inbox" };

const home = { ...page, id: "home" };

const createInbox = () => {
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
    slots: [{ id: "inbox", role: "primary", region: "main", viewId: "inbox" }],
  });
  workbench.pages.registerPage({
    id: "inbox",
    parentId: "home",
    ref: page,
    path: "inbox",
    modeId: "mail",
    slots: [
      {
        id: "inbox",
        role: "primary",
        region: "main",

        binding: { resourceKinds: ["thread"], viewId: "inbox", cardinality: "one" },
      },
      {
        id: "reader",
        role: "auxiliary",
        region: "side",
        openOn: "page-resource",
        binding: { resourceKinds: ["thread"], viewId: "reader", cardinality: "one" },
      },
      { id: "tools", role: "auxiliary", region: "side", viewId: "tools", presence: "open" },
    ],
  });
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.navigate({ kind: "page", page, resource: { type: "thread", id: "one" } });
  return workbench;
};

describe("closing page resource panels", () => {
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
