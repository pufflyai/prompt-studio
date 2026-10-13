import { expect, test } from "bun:test";
import { harness, navigate, page, panel, resource } from "../composition/placement-lifecycle-test-support";
import { pageLocationTarget } from "../page-location/page-location-target";

const create = (saved?: Parameters<typeof harness>[0]) => {
  const w = harness(saved);
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
  return w;
};
const doc = (id: string, line = 10) => ({
  kind: "page" as const,
  page: page("documents"),
  resource: { ...resource(id), metadata: { path: `${id}.ts` } },
  open: "pin" as const,
  position: { line, column: 1 },
  parent: navigate("alpha"),
});

test("panel reuse of an inactive Main editor restores its owner context", async () => {
  const w = create();
  await w.navigation.openTarget(doc("a"));
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource, open: "pin" });
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("alpha");
});

test("compound earlier moved editor open retains its requested position", async () => {
  const w = create();
  await w.navigation.openTarget(doc("a"));
  const id = w.layout.getLayout().activeWidgetId!;
  w.movePanel(id, "side");
  await w.navigation.openTarget({ kind: "compound", targets: [doc("a", 20), navigate("beta")] });
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.side.widgets.find((t) => t.widgetId === id)?.position?.line).toBe(20);
});

test("panel reuse preserves the nested workspace breadcrumb of an inactive Main editor", async () => {
  const w = create();
  w.pages.getPage("collection")!.parentId = "workspace";
  const target = {
    ...doc("a"),
    parent: { kind: "page" as const, page: page("collection"), parent: navigate("alpha") },
  };
  await w.navigation.openTarget(target);
  const id = w.layout.getLayout().activeWidgetId;
  expect(w.pages.store.getState().location?.parent?.parent?.resource?.id).toBe("alpha");
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource, open: "pin" });
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  const ancestor = w.pages.store.getState().location!.parent!.parent!;
  expect(w.pageLocations.navigate(pageLocationTarget(ancestor)).ok).toBe(true);
});

test("explicit page reopen preserves inactive Main editor ancestry", async () => {
  const w = create();
  w.pages.getPage("collection")!.parentId = "workspace";
  const target = {
    ...doc("a"),
    parent: { kind: "page" as const, page: page("collection"), parent: navigate("alpha") },
  };
  await w.navigation.openTarget(target);
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(target);
  const ancestor = w.pages.store.getState().location!.parent!.parent!;
  expect(w.pageLocations.navigate(pageLocationTarget(ancestor)).ok).toBe(true);
});

test("reusing an inactive page-owned panel preserves its Main ancestor resource", async () => {
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
  const target = { ...navigate("alpha"), parent: { kind: "page" as const, page: page("collection") } };
  await w.navigation.openTarget(target);
  const open = {
    kind: "panel" as const,
    panel: { kind: "page-slot" as const, page: page("workspace"), id: "files" },
    resource: resource("a"),
    open: "pin" as const,
  };
  await w.navigation.openTarget(open);
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(open);
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.pages.store.getState().location?.resource?.id).toBe("alpha");
  expect(w.pages.store.getState().location?.parent?.page.id).toBe("collection");
});

test("page reopen without a parent keeps captured ancestry after reload", async () => {
  const saved = new Map();
  const first = create(saved);
  await first.navigation.openTarget(doc("a"));
  const id = first.layout.getLayout().activeWidgetId;
  await first.navigation.openTarget(navigate("beta"));
  first.dispose();
  const w = create(saved);
  const { parent: _parent, ...target } = doc("a", 30);
  expect(w.pageLocations.navigate(target).ok).toBe(true);
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("alpha");
  expect(w.pages.store.getState().location?.position?.line).toBe(30);
});

test("an explicit new parent replaces an inactive editor's captured ancestry", async () => {
  const w = create();
  await w.navigation.openTarget(doc("a"));
  await w.navigation.openTarget(navigate("beta"));
  expect(w.pageLocations.navigate({ ...doc("a"), parent: navigate("gamma") }).ok).toBe(true);
  expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("gamma");
});

test("each saved Main document retains its own parent", async () => {
  const w = create();
  await w.navigation.openTarget(doc("a"));
  await w.navigation.openTarget({ ...doc("b"), parent: navigate("gamma") });
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource });
  expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("alpha");
  await w.navigation.openTarget({ kind: "panel", panel, resource: doc("b").resource });
  expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("gamma");
});

test("an earlier moved-editor position survives a compound ending in another mode", async () => {
  const w = create();
  w.modes.registerMode({ id: "review", activate() {} });
  w.pages.registerPage({
    id: "review-home",
    ref: page("review-home"),
    path: "review-home",
    modeId: "review",
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [],
  });
  await w.navigation.openTarget(doc("a"));
  const id = w.layout.getLayout().activeWidgetId!;
  w.movePanel(id, "side");
  await w.navigation.openTarget({
    kind: "compound",
    targets: [
      doc("a", 20),
      {
        kind: "page",
        page: page("review-home"),
        mode: { kind: "mode", id: "review" },
      },
    ],
  });
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.side.widgets.find((t) => t.widgetId === id)?.position?.line).toBe(20);
});

for (const action of ["move", "close"] as const) {
  test(`selecting the neighbor after ${action} restores its captured parent and position`, async () => {
    const w = create();
    await w.navigation.openTarget(doc("a", 12));
    await w.navigation.openTarget({ ...doc("b", 34), parent: navigate("gamma") });
    const tab = w.layout.getLayout().regions.main.widgets.find((value) => value.resource?.id === "b")!;
    if (action === "move") w.movePanel(tab.widgetId, "side");
    else w.closePlacement(tab.placementIdentity!);
    expect(w.pages.store.getState().location?.resource?.id).toBe("a");
    expect(w.pages.store.getState().location?.parent?.resource?.id).toBe("alpha");
    expect(w.pages.store.getState().location?.position?.line).toBe(12);
  });
}

for (const direct of [false, true]) {
  test(`a shared-page reopen keeps the current allowed mode through ${direct ? "pageLocations" : "navigation"}`, async () => {
    const w = create();
    w.modes.registerMode({ id: "review", activate() {} });
    w.pages.getPage("documents")!.modeIds = ["edit", "review"];
    w.pages.getPage("workspace")!.modeIds = ["edit", "review"];
    await w.navigation.openTarget({ ...doc("a"), mode: { kind: "mode", id: "edit" } });
    const id = w.layout.getLayout().activeWidgetId;
    await w.navigation.openTarget({ ...navigate("beta"), mode: { kind: "mode", id: "review" } });
    if (direct) expect(w.pageLocations.navigate(doc("a")).ok).toBe(true);
    else await w.navigation.openTarget(doc("a"));
    expect(w.layout.getLayout().activeWidgetId).toBe(id);
    expect(w.pages.store.getState().activeModeId).toBe("review");
  });
}
