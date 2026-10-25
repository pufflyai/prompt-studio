import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";

test("opening a resource from a browser focuses its existing auxiliary viewer and preserves Main", async () => {
  const { w, openMain, openSide, other, side } = createResourceViewerFixture();
  other();
  await openSide("x");
  const viewer = side();
  w.sidePanel.setMode("closed");
  const location = w.pages.store.getState().location;
  await openMain("x");
  expect(w.pages.store.getState().location).toBe(location);
  expect(side().instanceId).toBe(viewer.instanceId);
  expect(w.sidePanel.getMode()).toBe("attached");
  expect(w.focus.getActiveRegion()).toBe("side");
  expect(w.pages.getContent()?.resource).toBeUndefined();
});

test("opening a new resource targets Main and leaves an auxiliary viewer unchanged", async () => {
  const { w, openMain, openSide, side } = createResourceViewerFixture();
  await openSide("x");
  await openMain("y");
  expect(w.pages.getContent()?.resource?.id).toBe("y");
  expect(side().resource?.id).toBe("x");
});

test("a viewer switches itself without changing Main URL context", async () => {
  const { w, openMain, openSide, side } = createResourceViewerFixture();
  await openMain("x");
  await openSide("y");
  const viewer = side();
  const location = w.pages.store.getState().location;
  w.viewers.change(viewer.placementIdentity!, {
    operation: "switch",
    from: viewerResource("y"),
    resource: viewerResource("z"),
  });
  expect(side().instanceId).toBe(viewer.instanceId);
  expect(side().resource?.id).toBe("z");
  expect(w.pages.store.getState().location).toBe(location);
});

test("a duplicate viewer switch focuses Main and keeps the requesting viewer on its old resource", async () => {
  const { w, openMain, openSide, side } = createResourceViewerFixture();
  await openMain("x");
  await openSide("y");
  w.viewers.change(side().placementIdentity!, {
    operation: "switch",
    from: viewerResource("y"),
    resource: viewerResource("x"),
  });
  expect(side().resource?.id).toBe("y");
  expect(w.pages.getContent()?.resource?.id).toBe("x");
  expect(w.focus.getActiveRegion()).toBe("main");
});

test("opening a panel for a resource already shown in Main focuses Main instead of duplicating it", async () => {
  const { w, openMain, openSide } = createResourceViewerFixture();
  await openMain("x");
  await openSide("x");
  expect(w.layout.listPanelInstances("side")).toEqual([]);
  expect(w.focus.getActiveRegion()).toBe("main");
});

test("opening an inactive auxiliary resource selects that tab without moving it", async () => {
  const { w, openMain, openSide, side } = createResourceViewerFixture();
  await openSide("x");
  const first = side();
  await openSide("y");
  const second = side();
  await openMain("x");
  expect(side().instanceId).toBe(first.instanceId);
  expect(w.layout.listPanelInstances("side").map((panel) => panel.instanceId)).toContain(second.instanceId);
});

test("selecting an inactive Main resource tab updates Main's routed resource", async () => {
  const { w, openMain } = createResourceViewerFixture({ tabs: true });
  await openMain("x");
  const first = w.layout.getActivePanel("main")!;
  await openMain("y");
  w.layout.activatePanel(first.instanceId);
  expect(w.getPrimaryResource()?.id).toBe("x");
  expect(w.pages.store.getState().location?.resource?.id).toBe("x");
});

test("opening an inactive Main resource selects its tab and resource context", async () => {
  const { w, openMain } = createResourceViewerFixture({ tabs: true });
  await openMain("x");
  const first = w.layout.getActivePanel("main")!;
  await openMain("y");
  await openMain("x");
  expect(w.layout.getActivePanel("main")?.instanceId).toBe(first.instanceId);
  expect(w.getPrimaryResource()?.id).toBe("x");
});

test("a stale switch cannot change a viewer that has already switched resources", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("x");
  const identity = side().placementIdentity!;
  w.viewers.change(identity, { operation: "switch", from: viewerResource("x"), resource: viewerResource("y") });
  w.viewers.change(identity, { operation: "switch", from: viewerResource("x"), resource: viewerResource("z") });
  expect(side().resource?.id).toBe("y");
});

test("draft replacement updates its inactive viewer without stealing focus", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("draft", "draft");
  const draft = side();
  await openSide("x");
  const selected = side();
  w.viewers.change(draft.placementIdentity!, {
    operation: "replace",
    from: viewerResource("draft", "draft"),
    resource: viewerResource("created"),
  });
  expect(side().instanceId).toBe(selected.instanceId);
  expect(w.layout.listPanelInstances("side").find((panel) => panel.instanceId === draft.instanceId)?.resource?.id).toBe(
    "created",
  );
});

test("a duplicate draft completion preserves Main focus while consuming the inactive draft", async () => {
  const { w, openSide, side, other } = createResourceViewerFixture();
  await openSide("created");
  w.movePanel(side().instanceId, "secondary");
  await openSide("draft", "draft");
  const draft = side();
  other();
  const location = w.pages.store.getState().location;
  w.viewers.change(draft.placementIdentity!, {
    operation: "replace",
    from: viewerResource("draft", "draft"),
    resource: viewerResource("created"),
  });
  expect(w.layout.listPanelInstances("side")).toEqual([]);
  expect(w.focus.getActiveRegion()).toBe("main");
  expect(w.pages.store.getState().location).toBe(location);
});

test("an active Main draft completion focuses an existing created resource without duplicating it", async () => {
  const { w, openSide, openMain } = createResourceViewerFixture();
  await openSide("created");
  await openMain("draft", "draft");
  w.viewers.change(w.pages.getContent()!.placementIdentity!, {
    operation: "replace",
    from: viewerResource("draft", "draft"),
    resource: viewerResource("created"),
  });
  expect(w.pages.getContent()?.resource).toBeUndefined();
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
  expect(w.focus.getActiveRegion()).toBe("side");
});

test("an invalid Main replacement page cannot consume its draft even if the resource already has a viewer", async () => {
  const { w, openSide, openMain } = createResourceViewerFixture();
  await openSide("created");
  await openMain("draft", "draft");
  const content = w.pages.getContent()!;
  expect(() =>
    w.viewers.change(content.placementIdentity!, {
      operation: "replace",
      from: viewerResource("draft", "draft"),
      resource: viewerResource("created"),
      page: viewerPage("missing"),
    }),
  ).toThrow();
  expect(w.pages.getContent()).toBe(content);
});

test("a closed draft's late completion cannot reopen a viewer or change navigation", async () => {
  const { w, openSide, side, other } = createResourceViewerFixture();
  await openSide("draft", "draft");
  const draft = side();
  w.closePlacement(draft.placementIdentity!);
  other();
  const location = w.pages.store.getState().location;
  w.viewers.change(draft.placementIdentity!, {
    operation: "replace",
    from: viewerResource("draft", "draft"),
    resource: viewerResource("created"),
  });
  expect(w.layout.listPanelInstances("side")).toEqual([]);
  expect(w.pages.store.getState().location).toBe(location);
});

test("restoring a page uses landing when its remembered resource is already in Side", async () => {
  const { w, openMain, openSide, other, side } = createResourceViewerFixture();
  await openMain("x");
  other();
  await openSide("x");
  await w.navigation.openPage({ page: viewerPage("reader"), intent: "restore" });
  expect(w.pages.store.getState().activePageId).toBe("reader");
  expect(w.pages.store.getState().location?.resource).toBeUndefined();
  expect(side().resource?.id).toBe("x");
  w.closePlacement(side().placementIdentity!);
  other();
  await w.navigation.openPage({ page: viewerPage("reader"), intent: "restore" });
  expect(w.pages.store.getState().location?.resource).toBeUndefined();
});

test("restoring a page reopens its remembered Main resource when no other viewer owns it", async () => {
  const { w, openMain, other } = createResourceViewerFixture();
  await openMain("x");
  other();
  await w.navigation.openPage({ page: viewerPage("reader"), intent: "restore" });
  expect(w.pages.getContent()?.resource?.id).toBe("x");
});

test("deleting a Main page resource returns it to its landing and deleting a panel resource closes its viewer", async () => {
  const { w, openMain, openSide } = createResourceViewerFixture();
  await openMain("x");
  await openSide("y");
  w.resources.removed(viewerResource("y"));
  expect(w.layout.listPanelInstances("side")).toEqual([]);
  w.resources.removed(viewerResource("x"));
  expect(w.pages.store.getState().activePageId).toBe("reader");
  expect(w.pages.store.getState().location?.resource).toBeUndefined();
});
