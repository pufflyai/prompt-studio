import { expect, test } from "bun:test";
import { pageLocationTarget } from "../page-location/page-location-target";
import { harness, page, resource } from "./placement-lifecycle-test-support";

const create = () => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  w.modes.registerMode({ id: "review", activate() {} });
  w.pages.registerPage({
    id: "collection",
    ref: page("collection"),
    path: "collection",
    modeId: "edit",
    modeIds: ["edit", "review"],
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  w.pages.registerPage({
    id: "documents",
    ref: page("documents"),
    path: "documents",
    modeId: "edit",
    modeIds: ["edit", "review"],
    parentId: "collection",
    document: { metadataKey: "path" },
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  return w;
};
const open = (id: string, line: number) => ({
  kind: "page" as const,
  page: page("documents"),
  resource: { ...resource(id), metadata: { path: `${id}.ts` } },
  position: { line, column: 1 },
  open: "pin" as const,
});

test("moving an inactive document preserves the active document position", () => {
  const w = create();
  expect(w.pageLocations.navigate(open("a", 10)).ok).toBe(true);
  expect(w.pageLocations.navigate(open("b", 20)).ok).toBe(true);
  const before = w.pages.store.getState().location!;
  const a = w.layout.getLayout().regions.main.widgets.find((tab) => tab.resource?.id === "a")!;
  w.movePanel(a.widgetId, "side");
  expect(w.pages.store.getState().location?.resource?.id).toBe("b");
  expect(w.pages.store.getState().location?.position).toEqual(before.position);
});

test("moving the active document restores the adjacent document position", () => {
  const w = create();
  expect(w.pageLocations.navigate(open("a", 10)).ok).toBe(true);
  expect(w.pageLocations.navigate(open("b", 20)).ok).toBe(true);
  const b = w.layout.getLayout().regions.main.widgets.find((tab) => tab.resource?.id === "b")!;
  w.movePanel(b.widgetId, "side");
  expect(w.pages.store.getState().location?.resource?.id).toBe("a");
  expect(w.pages.store.getState().location?.position).toEqual({ line: 10, column: 1 });
});

test("fallback restores the captured parent mode", () => {
  const w = create();
  expect(
    w.pageLocations.navigate({
      ...open("a", 10),
      mode: { kind: "mode", id: "review" },
      parent: { kind: "page", page: page("collection"), mode: { kind: "mode", id: "edit" } },
    }).ok,
  ).toBe(true);
  expect(w.pages.store.getState().location?.parent?.mode?.id).toBe("edit");
  w.movePanel(w.layout.getLayout().regions.main.activeWidgetId!, "side");
  expect(w.pages.store.getState().activePageId).toBe("collection");
  expect(w.pages.store.getState().activeModeId).toBe("edit");
  const layout = w.layout.getLayout();
  expect(
    Object.values(layout.regions).some((region) =>
      region.widgets.some((tab) => tab.widgetId === layout.activeWidgetId),
    ),
  ).toBe(true);
});

test("fallback preserves the captured ancestor resource", () => {
  const w = create();
  w.pages.getPage("collection")!.parentId = "workspace";
  expect(
    w.pageLocations.navigate({
      ...open("a", 10),
      parent: {
        kind: "page",
        page: page("collection"),
        parent: {
          kind: "page",
          page: page("workspace"),
          resource: { type: "workspace", id: "alpha" },
        },
      },
    }).ok,
  ).toBe(true);
  expect(w.pages.store.getState().location?.parent?.parent?.resource?.id).toBe("alpha");
  w.movePanel(w.layout.getLayout().regions.main.activeWidgetId!, "side");
  expect(w.pages.store.getState().activePageId).toBe("collection");
  expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("alpha");
});

test("the workspace breadcrumb can navigate after document fallback", () => {
  const w = create();
  w.pages.getPage("collection")!.parentId = "workspace";
  expect(
    w.pageLocations.navigate({
      ...open("a", 10),
      parent: {
        kind: "page",
        page: page("collection"),
        parent: {
          kind: "page",
          page: page("workspace"),
          resource: { type: "workspace", id: "alpha" },
        },
      },
    }).ok,
  ).toBe(true);
  w.movePanel(w.layout.getLayout().regions.main.activeWidgetId!, "side");
  const ancestor = w.pages.store.getState().location!.parent!;
  expect(w.pageLocations.navigate(pageLocationTarget(ancestor)).ok).toBe(true);
});
