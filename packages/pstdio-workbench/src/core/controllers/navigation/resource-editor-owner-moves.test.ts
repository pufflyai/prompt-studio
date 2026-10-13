import { expect, test } from "bun:test";
import { harness, navigate, page, panel, resource } from "../composition/placement-lifecycle-test-support";

test("reopen an existing editor in a resource-only inactive mode", async () => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  w.modes.registerMode({ id: "review", activate() {} });
  w.pages.registerPage({
    id: "review",
    ref: page("review"),
    path: "review",
    modeId: "review",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  await w.navigation.openTarget(navigate("alpha"));
  const target = { kind: "panel", panel, resource: resource("a"), open: "pin" } as const;
  await w.navigation.openTarget(target);
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget({ kind: "page", page: page("review") });
  await w.navigation.openTarget(target);
  expect(w.pages.store.getState().activeModeId).toBe("edit");
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
});

test("moving an active document selects another document when a tool is adjacent", async () => {
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
    slots: [
      { id: "tools", region: "main", item: { kind: "view", view: { kind: "view", id: "empty" }, presence: "open" } },
    ],
  });
  const open = (id: string) =>
    w.pageLocations.navigate({ kind: "page", page: page("documents"), resource: resource(id), open: "pin" });
  expect(open("a").ok).toBe(true);
  expect(open("b").ok).toBe(true);
  const main = w.layout.getLayout().regions.main;
  const a = main.widgets.find((tab) => tab.resource?.id === "a")!;
  const b = main.widgets.find((tab) => tab.resource?.id === "b" && tab.role === "location")!;
  const tool = main.widgets.find((tab) => tab.viewId === "empty")!;
  // Arrange an allowed mixed tab order through the public movement API.
  w.movePanel(tool.widgetId, "main", { afterWidgetId: a.widgetId });
  expect(open("a").ok).toBe(true);
  w.movePanel(a.widgetId, "side");
  expect(w.layout.getLayout().regions.main.activeWidgetId).toBe(b.widgetId);
  expect(w.pages.store.getState().location?.resource?.id).toBe("b");
});

test("reopening a document restores its moved owner after a fallback changes mode", async () => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  w.modes.registerMode({ id: "review", activate() {} });
  w.pages.registerPage({
    id: "collection",
    ref: page("collection"),
    path: "collection",
    modeId: "review",
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
  expect(
    w.pageLocations.navigate({ kind: "page", page: page("documents"), resource: resource("a"), open: "pin" }).ok,
  ).toBe(true);
  const id = w.layout.getLayout().activeWidgetId!;
  w.movePanel(id, "side");
  expect(w.pages.store.getState().activePageId).toBe("collection");
  await w.navigation.openTarget({ kind: "page", page: page("documents"), resource: resource("a"), open: "pin" });
  expect(w.pages.store.getState().activeModeId).toBe("edit");
  expect(w.layout.getLayout().regions.side.widgets.some((tab) => tab.widgetId === id)).toBe(true);
});

test("a moved editor uses the latest requested position after returning to Main", async () => {
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
    document: { metadataKey: "path" },
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  const open = (line: number) =>
    w.pageLocations.navigate({
      kind: "page",
      page: page("documents"),
      resource: { ...resource("a"), metadata: { path: "a.ts" } },
      position: { line, column: 1 },
      open: "pin",
    });
  expect(open(10).ok).toBe(true);
  const id = w.layout.getLayout().activeWidgetId!;
  w.movePanel(id, "side");
  expect(open(20).ok).toBe(true);
  w.movePanel(id, "main");
  expect(open(30).ok).toBe(true);
  expect(w.layout.getLayout().regions.main.widgets.find((tab) => tab.widgetId === id)?.position).toEqual({
    line: 30,
    column: 1,
  });
});
