import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage } from "../resource-viewers/resource-viewer-test-fixture";
import { openPanelAsPage, panelPageDropTarget } from "./panel-page-drop";

test("dropping a side conversation onto its page opens Main and removes the side tab", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  w.pageLocations.navigate({ kind: "page", page: viewerPage("reader") });
  await openSide("conversation");
  const original = side();
  expect(panelPageDropTarget(w, original.instanceId)?.page).toEqual(viewerPage("reader"));
  await openPanelAsPage(w, original.instanceId);
  expect(w.pages.getContent()?.resource?.id).toBe("conversation");
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
});
