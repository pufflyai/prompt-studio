import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";

test("Main resource tabs without a page restore on reload and remain isolated from other pages", async () => {
  const first = createResourceViewerFixture({ homePage: true });
  first.w.movePanel(first.w.pages.getContent()!.widgetId, "side");
  const open = (id: string, retention: "pin" | "preview") =>
    first.w.navigation.openTarget({
      kind: "page",
      page: viewerPage("reader"),
      resource: viewerResource(id),
      open: retention,
    });
  await open("pinned", "pin");
  await open("preview", "preview");
  expect(first.w.pages.store.getState().activePageId).toBeUndefined();
  expect(first.w.layout.listPanelInstances("main").map((tab) => tab.resource?.id)).toEqual(["preview", "pinned"]);
  expect(first.w.layout.getActivePanel("main")?.resource?.id).toBe("preview");
  await first.w.dispose();

  const restored = createResourceViewerFixture({
    homePage: true,
    saved: first.saved,
    locations: first.locations,
    boot: true,
  });
  expect(restored.w.pages.store.getState().activePageId).toBeUndefined();
  expect(restored.w.layout.listPanelInstances("main").map((tab) => tab.resource?.id)).toEqual(["preview", "pinned"]);
  expect(restored.w.layout.getActivePanel("main")?.resource?.id).toBe("preview");
  restored.other();
  expect(restored.w.pages.getContent()).toBeDefined();
  expect(restored.w.layout.listPanelInstances("main")).toHaveLength(0);
  restored.w.pageLocations.goBack();
  expect(restored.w.pages.store.getState().activePageId).toBeUndefined();
  expect(restored.w.layout.listPanelInstances("main").map((tab) => tab.resource?.id)).toEqual(["pinned"]);
  expect(restored.w.layout.getActivePanel("main")?.resource?.id).toBe("pinned");
  restored.w.movePanel(restored.w.layout.getActivePanel("main")!.instanceId, "secondary");
  await restored.w.dispose();
  const empty = createResourceViewerFixture({
    homePage: true,
    saved: first.saved,
    locations: first.locations,
    boot: true,
  });
  expect(empty.w.layout.listPanelInstances("main")).toHaveLength(0);
  expect(empty.w.layout.getActivePanel("secondary")?.resource?.id).toBe("pinned");
  await empty.w.dispose();
});
