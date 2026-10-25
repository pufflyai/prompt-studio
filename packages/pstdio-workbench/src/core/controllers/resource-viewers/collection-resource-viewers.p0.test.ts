import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";

test("a resource collection uses its declared independent viewer as its only owner", async () => {
  const { w, openMain } = createResourceViewerFixture({ collection: true });
  await openMain("x");
  const first = w.layout.getActivePanel("main")!;
  expect(first?.resource?.id).toBe("x");
  expect(first?.placementIdentity?.kind).toBe("mode");
  await openMain("y");
  expect(w.layout.listPanelInstances("main").map((panel) => panel.resource?.id)).toEqual(["x", "y"]);
  w.layout.activatePanel(first.instanceId);
  expect(w.pages.store.getState().location?.resource?.id).toBe("x");
});

test("an independent collection viewer can move and reopen without changing ownership", async () => {
  const { w, openMain, side } = createResourceViewerFixture({ collection: true });
  await openMain("x");
  const first = w.layout.getActivePanel("main")!;
  w.movePanel(first.instanceId, "side");
  await openMain("y");
  const location = w.pages.store.getState().location;
  await openMain("x");
  expect(side().instanceId).toBe(first.instanceId);
  expect(w.layout.listPanelInstances("main").map((panel) => panel.resource?.id)).toEqual(["y"]);
  expect(w.pages.store.getState().location).toBe(location);
});

test("restoring a tabbed tray retires resources now owned by auxiliary viewers", async () => {
  const { w, saved, locations, openMain, openSide, other, side } = createResourceViewerFixture({ tabs: true });
  await openMain("x");
  await openMain("y");
  other();
  await openSide("x");
  await w.navigation.openPage({ page: viewerPage("reader"), intent: "restore" });
  expect(w.layout.listPanelInstances("main").map((panel) => panel.resource?.id)).toEqual(["y"]);
  w.closePlacement(side().placementIdentity!);
  other();
  await w.navigation.openPage({ page: viewerPage("reader"), intent: "restore" });
  expect(w.layout.listPanelInstances("main").map((panel) => panel.resource?.id)).toEqual(["y"]);
  expect(w.pages.store.getState().location?.resource).toEqual(viewerResource("y"));
  const restored = createResourceViewerFixture({ tabs: true, saved, locations });
  await restored.w.navigation.openPage({ page: viewerPage("reader"), intent: "restore" });
  expect(restored.w.layout.listPanelInstances("main").map((panel) => panel.resource?.id)).toEqual(["y"]);
});

test("collection viewer declarations keep the resource route unambiguous", () => {
  const { w } = createResourceViewerFixture({ collection: true });
  const page = w.pages.getPage("reader")!;
  expect(() =>
    w.pages.registerPage({ ...page, id: "ambiguous", ref: viewerPage("ambiguous"), path: "ambiguous" }),
  ).toThrow("unambiguous");
});
