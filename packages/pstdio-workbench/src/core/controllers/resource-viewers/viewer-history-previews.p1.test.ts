import { expect, test } from "bun:test";
import { createMemoryWorkbenchPageLocationBrowser } from "../page-location/page-location-memory";
import { createResourceViewerFixture, viewerPanel, viewerResource } from "./resource-viewer-test-fixture";

test("Back restores page content after its related preview leaves with the current page", async () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const { w, openMain, other } = createResourceViewerFixture({ browser });
  await openMain("conversation");
  other();
  await w.navigation.openPanel({ panel: viewerPanel, resource: viewerResource("conversation"), open: "preview" });
  w.pageLocations.goBack();
  expect(w.pages.getContent()?.resource?.id).toBe("conversation");
  expect(w.layout.listPanelInstances("side")).toEqual([]);
});
