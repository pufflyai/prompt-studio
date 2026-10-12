import { expect, test } from "bun:test";
import { harness, page, resource } from "../composition/placement-lifecycle-test-support";

const create = () => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  w.pages.registerPage({
    id: "collection",
    ref: page("collection"),
    path: "collection",
    modeId: "edit",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  w.pages.registerPage({
    id: "documents",
    ref: page("documents"),
    path: "documents",
    modeId: "edit",
    parentId: "collection",
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  const open = (id: string) =>
    w.pageLocations.navigate({ kind: "page", page: page("documents"), resource: resource(id), open: "pin" });
  return { w, open };
};

test("moving the only document returns to the collection and direct page opens focus it", () => {
  const { w, open } = create();
  expect(open("a").ok).toBe(true);
  const tab = w.layout.getLayout().regions.main.widgets[0]!;
  w.movePanel(tab.widgetId, "side");
  expect(w.pages.store.getState().activePageId).toBe("collection");
  expect(w.layout.getLayout().regions.main.widgets.map((t) => t.viewId)).toEqual(["empty"]);
  expect(open("a").ok).toBe(true);
  expect(w.pages.store.getState().activePageId).toBe("collection");
  expect(w.layout.getLayout().activeWidgetId).toBe(tab.widgetId);
  expect(w.layout.getLayout().regions.side.widgets).toHaveLength(1);
});

test("moving an active document selects its adjacent document and moving an inactive one keeps the location", () => {
  const { w, open } = create();
  open("a");
  open("b");
  const a = w.layout.getLayout().regions.main.widgets.find((t) => t.resource?.id === "a")!;
  const b = w.layout.getLayout().regions.main.widgets.find((t) => t.resource?.id === "b")!;
  w.movePanel(a.widgetId, "side");
  expect(w.pages.store.getState().location?.resource?.id).toBe("b");
  expect(w.layout.getLayout().regions.main.activeWidgetId).toBe(b.widgetId);
  w.movePanel(b.widgetId, "secondary");
  expect(w.pages.store.getState().activePageId).toBe("collection");
  open("b");
  expect(w.layout.getLayout().activeWidgetId).toBe(b.widgetId);
  expect(w.layout.getLayout().regions.main.widgets.map((t) => t.viewId)).toEqual(["empty"]);
});

test("history and reset resolve moved editors without duplicating or moving them back", () => {
  const { w, open } = create();
  w.pageLocations.navigate({ kind: "page", page: page("collection") });
  open("a");
  open("b");
  const a = w.layout.getLayout().regions.main.widgets.find((t) => t.resource?.id === "a")!;
  w.movePanel(a.widgetId, "side");
  w.pageLocations.goBack();
  expect(
    w.layout
      .getLayout()
      .regions.side.widgets.filter((t) => t.resource?.id === "a")
      .map((t) => t.widgetId),
  ).toEqual([a.widgetId]);
  expect(w.layout.getLayout().regions.main.widgets.some((t) => t.resource?.id === "a")).toBe(false);
  w.resetLayout();
  expect(
    w.layout
      .getLayout()
      .regions.side.widgets.filter((t) => t.resource?.id === "a")
      .map((t) => t.widgetId),
  ).toEqual([a.widgetId]);
});

test("selecting an existing Main document updates the page location", () => {
  const { w, open } = create();
  open("a");
  open("b");
  open("a");
  expect(w.pages.store.getState().location?.resource?.id).toBe("a");
  expect(w.layout.getLayout().regions.main.widgets).toHaveLength(2);
});

test.each(["main", "side"] as const)("reopening a preview document in %s can pin its existing editor", (region) => {
  const { w, open } = create();
  w.pageLocations.navigate({ kind: "page", page: page("documents"), resource: resource("a"), open: "preview" });
  const editor = w.layout.getLayout().regions.main.widgets[0]!;
  expect(editor.pinned).toBe(false);
  if (region === "side") w.movePanel(editor.widgetId, region);
  expect(open("a").ok).toBe(true);
  expect(w.layout.getLayout().regions[region].widgets.find((t) => t.widgetId === editor.widgetId)?.pinned).toBe(true);
  w.pageLocations.navigate({ kind: "page", page: page("documents"), resource: resource("b"), open: "preview" });
  expect(w.layout.getLayout().regions[region].widgets.some((t) => t.widgetId === editor.widgetId)).toBe(true);
});
