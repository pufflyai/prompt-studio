import { expect, test } from "bun:test";
import {
  createResourceViewerFixture,
  viewerPage,
  viewerResource,
} from "../resource-viewers/resource-viewer-test-fixture";
import { openDroppedPage, openPanelAsPage, panelPageDropTarget } from "./panel-page-drop";

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

test("a related-resource shell tab returns to its owning page with document context", async () => {
  const { w, side } = createResourceViewerFixture({ document: true });
  const resource = { ...viewerResource("note"), metadata: { document: "notes.md" } };
  w.shellPlacements.registerPlacement({
    id: "related",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }],
        view: { kind: "view", id: "reader" },
        cardinality: "many",
      },
    },
  });
  w.shellPlacements.openPlacement({
    placementId: "related",
    resource,
    open: "pin",
    location: {
      pageContext: { page: viewerPage("reader"), parent: { page: viewerPage("home") } },
      position: { line: 8, column: 3 },
    },
  });
  const id = side().instanceId;
  expect(panelPageDropTarget(w, id)?.resource).toEqual(resource);
  await openPanelAsPage(w, id);
  expect(w.pages.store.getState().location).toMatchObject({
    page: viewerPage("reader"),
    resource,
    parent: { page: viewerPage("home") },
    position: { line: 8, column: 3 },
  });
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
});

test("an unsupported side resource is preserved when it has no page destination", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("orphan");
  w.pages.getPage("reader")!.resource = undefined;
  const id = side().instanceId;
  expect(panelPageDropTarget(w, id)).toBeUndefined();
  await openPanelAsPage(w, id);
  expect(side().instanceId).toBe(id);
});

test("an invalid page drop leaves its already displayed resource open", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("draft");
  const id = side().instanceId;
  await expect(
    openDroppedPage(w, { kind: "page", page: viewerPage("missing"), resource: viewerResource("draft") }),
  ).rejects.toThrow();
  expect(side()?.instanceId).toBe(id);
});
