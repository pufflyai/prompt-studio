import { expect, test } from "bun:test";
import { harness, navigate, openFile, panel, resource } from "../composition/placement-lifecycle-test-support";

const ids = (w: ReturnType<typeof harness>, region: "main" | "side" | "secondary") =>
  w.layout.getLayout().regions[region].widgets.map((tab) => tab.resource?.id);
const find = (w: ReturnType<typeof harness>, id: string) =>
  w.layout.listPanelInstances().find((tab) => tab.resource?.id === id)!;

test("one tray replaces previews across shell and mode owners without restoring replaced resources", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  w.shellPlacements.registerPlacement({
    id: "shell",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "editor" },
        kinds: [{ kind: "resource-kind", id: "file" }],
        cardinality: "many",
      },
    },
  });
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("kept"), open: "pin" });
  w.shellPlacements.openPlacement({ placementId: "shell", resource: resource("old"), open: "preview" });
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("new"), open: "preview" });
  expect(ids(w, "side")).toEqual(["new", "kept"]);
  w.pinPlacement(find(w, "kept").placementIdentity!);
  expect(ids(w, "side")).toEqual(["new", "kept"]);
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(navigate("alpha"));
  expect(ids(w, "side")).toEqual(["new", "kept"]);
});

test("preview is leftmost when opened, unpinned, or reordered beside pinned tabs", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("a"));
  w.pinPlacement(find(w, "a").placementIdentity!);
  await w.navigation.openTarget(openFile("b"));
  w.pinPlacement(find(w, "b").placementIdentity!);
  await w.navigation.openTarget(openFile("preview"));
  expect(ids(w, "main")).toEqual(["preview", "b", "a"]);
  w.pinPlacement(find(w, "b").placementIdentity!, false);
  expect(ids(w, "main")).toEqual(["b", "a"]);
  w.layout.reorderPanel(find(w, "b").instanceId, "end");
  expect(ids(w, "main")).toEqual(["b", "a"]);
  w.layout.reorderPanel(find(w, "a").instanceId, "start");
  expect(ids(w, "main")).toEqual(["b", "a"]);
});

test("dropping a preview replaces the destination preview across owners and keeps the route", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("kept"));
  w.pinPlacement(find(w, "kept").placementIdentity!);
  await w.navigation.openTarget(openFile("old"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("moved"), open: "preview" });
  const location = w.pages.store.getState().location;
  w.movePanel(find(w, "moved").instanceId, "main", "end");
  expect(ids(w, "main")).toEqual(["moved", "kept"]);
  expect(ids(w, "side")).toEqual([]);
  expect(w.pages.store.getState().location).toEqual(location);
  w.pinPlacement(find(w, "moved").placementIdentity!);
  expect(ids(w, "main")).toEqual(["moved", "kept"]);
  expect(ids(w, "side")).toEqual([]);
});

test("previews from one binding can remain open in different trays", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("moved"));
  w.movePanel(find(w, "moved").instanceId, "secondary");
  await w.navigation.openTarget(openFile("new"));
  expect(ids(w, "main")).toEqual(["new"]);
  expect(ids(w, "secondary")).toEqual(["moved"]);
  const restored = harness(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(ids(restored, "main")).toEqual(["new"]);
  expect(ids(restored, "secondary")).toEqual(["moved"]);
  w.pinPlacement(find(w, "new").placementIdentity!);
  expect(ids(w, "secondary")).toEqual(["moved"]);
});

test("a pinned drop preserves the destination preview and stays after it", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("preview"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("pinned"), open: "pin" });
  w.movePanel(find(w, "pinned").instanceId, "main", "start");
  expect(ids(w, "main")).toEqual(["preview", "pinned"]);
});

test("a moved destination preview is forgotten by its original binding", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("old"), open: "preview" });
  w.movePanel(find(w, "old").instanceId, "main");
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("new"), open: "preview" });
  w.movePanel(find(w, "new").instanceId, "main");
  expect(ids(w, "main")).toEqual(["new", "alpha"]);
  expect(ids(w, "side")).toEqual([]);
  w.pinPlacement(find(w, "new").placementIdentity!);
  expect(ids(w, "main")).toEqual(["new", "alpha"]);
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(navigate("alpha"));
  expect(ids(w, "main")).toEqual(["new", "alpha"]);
  expect(ids(w, "side")).toEqual([]);
  const restored = harness(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(ids(restored, "main")).toEqual(["new", "alpha"]);
  expect(ids(restored, "side")).toEqual([]);
});

test("refreshing routed metadata does not reopen a replaced primary preview", async () => {
  const w = harness();
  const page = { kind: "page", extensionId: "test", id: "documents" } as const;
  w.pages.registerPage({
    id: "documents",
    ref: page,
    path: "documents",
    parentId: "workspace",
    modeId: "edit",
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  await w.navigation.openTarget({ kind: "page", page, resource: resource("routed"), open: "preview" });
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("incoming"), open: "preview" });
  w.movePanel(find(w, "incoming").instanceId, "main");
  expect(ids(w, "main")).toEqual(["incoming"]);
  w.pageLocations.replay({
    ...w.pages.store.getState().location!,
    resource: { ...resource("routed"), label: "Hydrated" },
  });
  expect(ids(w, "main")).toEqual(["incoming"]);
});

test("a lower-level preview replacement removes the replaced owner's instance", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("owned"), open: "preview" });
  w.layout.registerPanel({ id: "raw", title: "Raw", rendererId: "editor", region: "side", reuse: "none" });
  w.layout.openWidget("raw", { resource: resource("raw"), role: "sub-panel", tabRetention: "preview" });
  expect(ids(w, "side")).toEqual(["raw"]);
  w.shellPlacements.registerPlacement({
    id: "unrelated",
    region: "secondary",
    item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "closed" },
  });
  expect(ids(w, "side")).toEqual(["raw"]);
});

test("the last compound preview target wins in its actual tray", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  const moved = { kind: "panel", panel, resource: resource("moved"), open: "preview" } as const;
  await w.navigation.openTarget(moved);
  w.movePanel(find(w, "moved").instanceId, "main");
  await w.navigation.openTarget({ kind: "compound", targets: [openFile("new-file"), moved] });
  expect(ids(w, "main").filter((id) => id !== "alpha")).toEqual(["moved"]);
  expect(w.layout.getActivePanel()?.resource?.id).toBe("moved");
});

test("a preview can be reopened after another tab is unpinned over it", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  const target = (id: string) => ({ kind: "panel", panel, resource: resource(id), open: "preview" }) as const;
  await w.navigation.openTarget(target("original"));
  await w.navigation.openTarget(target("created"));
  w.pinPlacement(find(w, "created").placementIdentity!);
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(target("original"));
  w.pinPlacement(find(w, "created").placementIdentity!, false);
  expect(ids(w, "side")).toEqual(["created"]);
  await w.navigation.openTarget(target("original"));
  expect(ids(w, "side")).toEqual(["original"]);
});
