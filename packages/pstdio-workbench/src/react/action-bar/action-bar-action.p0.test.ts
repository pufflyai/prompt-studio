import { expect, test } from "bun:test";
import {
  createResourceViewerFixture,
  viewerPage,
  viewerResource,
} from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { executeActionBarTarget } from "./action-bar-action";

test("an action bar switches its calling viewer without moving the page", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("first");
  const location = w.pages.store.getState().location;
  const placement = side().placementIdentity;

  await executeActionBarTarget(
    w,
    { kind: "viewer", operation: "switch", from: viewerResource("first"), resource: viewerResource("second") },
    { placement, projectId: "project", resource: viewerResource("first") },
  );

  expect(side().resource?.id).toBe("second");
  expect(w.pages.store.getState().location).toBe(location);
});

test("an action bar outside the resource viewer can open a page", async () => {
  const { w } = createResourceViewerFixture();
  w.modePlacements.registerPlacement({
    id: "toolbar",
    ref: { kind: "placement", extensionId: "example.readers", id: "toolbar" },
    modeId: "project",
    region: "sidenav",
    item: { kind: "view", view: { kind: "view", id: "browser" }, presence: "open" },
  });
  const placement = w.layout.getActivePanel("sidenav")?.placementIdentity;
  expect(placement).toBeDefined();

  await executeActionBarTarget(w, { kind: "page", page: viewerPage("other") }, { placement, projectId: "project" });

  expect(w.pages.store.getState().activePageId).toBe("other");
});
