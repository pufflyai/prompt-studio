import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerPanel, viewerResource } from "./resource-viewer-test-fixture";

const section = { anchors: [{ id: "details", heading: "Details" }] };
const document = (name: string) => ({ ...viewerResource("x"), metadata: { document: name } });

test("a resource link transfers its independent viewer into Main and applies its section", async () => {
  const { w, openSide, other } = createResourceViewerFixture();
  await openSide("x");
  other();
  await w.navigation.openPage({ page: viewerPage("reader"), resource: viewerResource("x"), section });
  expect(w.pages.getContent()?.section ?? w.layout.getActivePanel("main")?.section).toEqual(section);
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
});

test("a resource link brings its moved page viewer into Main with the requested section", async () => {
  const { w, openMain } = createResourceViewerFixture({ tabs: true });
  await openMain("x");
  w.movePanel(w.layout.getActivePanel("main")!.instanceId, "side");
  await openMain("y");
  await w.navigation.openPage({ page: viewerPage("reader"), resource: viewerResource("x"), section });
  expect(w.pages.getContent()?.section ?? w.layout.getActivePanel("main")?.section).toEqual(section);
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
});

test("a resource link applies source coordinates to the owning viewer and restores them after reload", async () => {
  const first = createResourceViewerFixture({ document: true });
  await first.w.navigation.openPanel({ panel: viewerPanel, resource: document("a"), region: "side", open: "pin" });
  first.other();
  await first.w.navigation.openPage({
    page: viewerPage("reader"),
    resource: document("a"),
    position: { line: 3, column: 2 },
  });
  expect(first.w.pages.getContent()?.position).toEqual({ line: 3, column: 2 });
  first.w.movePanel(first.w.pages.getContent()!.widgetId, "side");
  const next = createResourceViewerFixture({ document: true, saved: first.saved, locations: first.locations });
  expect(next.side().position).toEqual({ line: 3, column: 2 });
});

test("many viewers use complete document identity rather than only the enclosing resource ID", async () => {
  const { w } = createResourceViewerFixture({ document: true });
  await w.navigation.openPanel({ panel: viewerPanel, resource: document("a"), region: "side", open: "pin" });
  await w.navigation.openPanel({ panel: viewerPanel, resource: document("b"), region: "side", open: "pin" });
  expect(w.layout.listPanelInstances("side").map((viewer) => viewer.resource?.metadata?.document)).toEqual(["a", "b"]);
});

test("switching to an existing resource brings it to the caller and applies its section", async () => {
  const { w, openMain, openSide } = createResourceViewerFixture();
  await openMain("main");
  await openSide("side");
  const caller = w.pages.getContent()!.placementIdentity!;
  w.viewers.change(caller, {
    operation: "switch",
    from: viewerResource("main"),
    resource: viewerResource("side"),
    section,
  });
  expect(w.pages.getContent()?.section).toEqual(section);
  expect(w.pages.getContent()?.resource?.id).toBe("side");
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
});

test("a denied duplicate draft replacement preserves its caller and target", async () => {
  const { w, openMain, openSide, side } = createResourceViewerFixture({ sideCanOpen: false });
  await openSide("existing");
  await openMain("draft", "draft");
  const caller = w.pages.getContent()!.placementIdentity!;
  const location = w.pages.store.getState().location;
  w.shell.setRegionOpen("side", false);
  expect(() =>
    w.viewers.change(caller, {
      operation: "replace",
      from: viewerResource("draft", "draft"),
      resource: viewerResource("existing"),
      section,
    }),
  ).toThrow();
  expect(w.pages.store.getState().location).toBe(location);
  expect(w.pages.getContent()?.resource?.id).toBe("draft");
  expect(side()?.section).toBeUndefined();
});

test("selecting a retained Main document restores that viewer's source coordinates", async () => {
  const { w } = createResourceViewerFixture({ tabs: true, document: true });
  w.pageLocations.navigate({
    kind: "page",
    page: viewerPage("reader"),
    resource: document("a"),
    position: { line: 3 },
    open: "pin",
  });
  const first = w.layout.getActivePanel("main")!;
  await w.navigation.openPage({
    page: viewerPage("reader"),
    resource: document("b"),
    position: { line: 7 },
    open: "pin",
  });
  w.layout.activatePanel(first.instanceId);
  expect(w.pages.store.getState().location?.position).toEqual({ line: 3 });
  expect(w.layout.getActivePanel("main")?.position).toEqual({ line: 3 });
});

test("compound navigation transfers resources and selects its final page", async () => {
  const { w, openSide, other } = createResourceViewerFixture();
  await openSide("x");
  other();
  await w.navigation.openTarget({
    kind: "compound",
    targets: [
      { kind: "page", page: viewerPage("reader"), resource: viewerResource("x"), section },
      { kind: "page", page: viewerPage("reader"), resource: viewerResource("y") },
    ],
  });
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
  expect(w.pages.getContent()?.resource?.id).toBe("y");
  expect(w.focus.getActiveRegion()).toBe("main");
});

test("switching a viewer clears its previous source reference", async () => {
  const { w, openSide, side } = createResourceViewerFixture({ document: true });
  await openSide("x");
  w.viewers.refreshReference(viewerResource("x"), { position: { line: 3 } });
  w.viewers.change(side().placementIdentity!, {
    operation: "switch",
    from: viewerResource("x"),
    resource: viewerResource("y"),
    section,
  });
  expect(side().section).toEqual(section);
  expect(side().position).toBeUndefined();
  w.viewers.change(side().placementIdentity!, {
    operation: "switch",
    from: viewerResource("y"),
    resource: viewerResource("z"),
  });
  expect(side().section).toBeUndefined();
  expect(side().position).toBeUndefined();
});

test("an inactive draft completing to Main preserves the active auxiliary viewer and focus", async () => {
  const { w, openMain, openSide, side } = createResourceViewerFixture();
  await openMain("existing");
  await openSide("draft", "draft");
  const draft = side().placementIdentity!;
  await openSide("active");
  const active = side().instanceId;
  w.focus.setActiveRegion("side");
  w.viewers.change(draft, {
    operation: "replace",
    from: viewerResource("draft", "draft"),
    resource: viewerResource("existing"),
    section,
  });
  expect(side().instanceId).toBe(active);
  expect(w.focus.getActiveRegion()).toBe("side");
  expect(w.pages.getContent()?.section).toEqual(section);
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
});
