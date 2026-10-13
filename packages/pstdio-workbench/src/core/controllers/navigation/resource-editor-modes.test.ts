import { expect, test } from "bun:test";
import { harness, page, panel, resource } from "../composition/placement-lifecycle-test-support";

const sharedWorkbench = () => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  w.modes.registerMode({ id: "review", activate() {} });
  w.pages.registerPage({
    id: "shared-home",
    ref: page("shared-home"),
    path: "shared-home",
    modeId: "edit",
    modeIds: ["edit", "review"],
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [],
  });
  w.pages.registerPage({
    id: "shared",
    ref: page("shared"),
    path: "shared",
    modeId: "edit",
    modeIds: ["edit", "review"],
    parentId: "shared-home",
    document: { metadataKey: "path" },
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  return w;
};
const open = (mode: "edit" | "review", id: string, line = 1) => ({
  kind: "page" as const,
  page: page("shared"),
  mode: { kind: "mode" as const, id: mode },
  resource: { ...resource(id), metadata: { path: `${id}.ts` } },
  position: { line, column: 1 },
  open: "pin" as const,
});

test("a unique Main editor keeps requested modes and positions through navigation history", async () => {
  const w = sharedWorkbench();
  await w.navigation.openTarget(open("edit", "a", 10));
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget(open("review", "a", 20));
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.pages.store.getState().activeModeId).toBe("review");
  expect(w.pages.store.getState().location?.position?.line).toBe(20);
  w.pageLocations.goBack();
  expect(w.pages.store.getState().activeModeId).toBe("edit");
  w.pageLocations.goForward();
  expect(w.pages.store.getState().activeModeId).toBe("review");
  expect(w.pages.store.getState().location?.position?.line).toBe(20);
});

test("opening a mode editor on a shared page restores its actual mode owner", async () => {
  const w = sharedWorkbench();
  await w.navigation.openTarget(open("edit", "page-resource"));
  const target = { kind: "panel" as const, panel, resource: resource("side"), open: "pin" as const };
  await w.navigation.openTarget(target);
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget(open("review", "page-resource"));
  expect(w.pages.store.getState().activeModeId).toBe("review");
  await w.navigation.openTarget(target);
  expect(w.pages.store.getState().activeModeId).toBe("edit");
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.layout.getLayout().regions.side.widgets.filter((tab) => tab.resource?.id === "side")).toHaveLength(1);
});

test("each compound page step uses the mode selected by the preceding step", async () => {
  const w = sharedWorkbench();
  w.pages.registerPage({
    id: "review-only",
    ref: page("review-only"),
    path: "review-only",
    modeId: "review",
    modeIds: ["review"],
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [],
  });
  await w.navigation.openTarget(open("edit", "a"));
  await w.navigation.openTarget({
    kind: "compound",
    targets: [open("review", "a"), { kind: "page", page: page("review-only") }],
  });
  expect(w.pages.store.getState().activePageId).toBe("review-only");
  expect(w.pages.store.getState().activeModeId).toBe("review");
});

test("an inactive page editor restores a mode allowed by its owner page", async () => {
  const w = sharedWorkbench();
  w.pages.registerPage({
    id: "owned",
    ref: page("owned"),
    path: "owned",
    modeId: "edit",
    modeIds: ["edit"],
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [
      {
        id: "bottom",
        region: "bottom",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "file" }],
            view: { kind: "view", id: "editor" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  await w.navigation.openTarget({ kind: "page", page: page("owned"), mode: { kind: "mode", id: "edit" } });
  const target = {
    kind: "panel" as const,
    panel: { kind: "page-slot" as const, page: page("owned"), id: "bottom" },
    resource: resource("bottom"),
    open: "pin" as const,
  };
  await w.navigation.openTarget(target);
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget(open("review", "a"));
  await w.navigation.openTarget(target);
  expect(w.pages.store.getState().activePageId).toBe("owned");
  expect(w.pages.store.getState().activeModeId).toBe("edit");
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
});

test("a request from another page focuses a unique Main editor in its allowed owner mode", async () => {
  const w = sharedWorkbench();
  w.pages.registerPage({
    id: "edit-documents",
    ref: page("edit-documents"),
    path: "edit-documents",
    modeId: "edit",
    modeIds: ["edit"],
    parentId: "shared-home",
    document: { metadataKey: "path" },
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  await w.navigation.openTarget({ ...open("edit", "a"), page: page("edit-documents") });
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget(open("review", "a"));
  expect(w.pages.store.getState().activePageId).toBe("edit-documents");
  expect(w.pages.store.getState().activeModeId).toBe("edit");
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
});
