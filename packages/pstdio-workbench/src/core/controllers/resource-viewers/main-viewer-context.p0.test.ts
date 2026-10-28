import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";

for (const collection of [false, true])
  for (const action of ["select", "close"] as const)
    test(`${collection ? "independent" : "page-owned"} Main viewers retain parent, parameters and position after ${action}`, async () => {
      const { w } = createResourceViewerFixture({ tabs: !collection, collection, document: true });
      w.pages.registerPage({
        id: "container",
        ref: viewerPage("container"),
        path: "container",
        modeId: "project",
        parentId: "home",
        resource: { kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "folder" }] },
        params: { filter: { type: "string" } },
        main: { kind: "view", view: { kind: "view", id: "browser" }, presentation: "page", cardinality: "one" },
        slots: [],
      });
      const parent = {
        kind: "page" as const,
        page: viewerPage("container"),
        resource: viewerResource("one", "folder"),
        params: { filter: "mine" },
      };
      await w.navigation.openPage({
        page: viewerPage("reader"),
        resource: { ...viewerResource("x"), metadata: { document: "x.ts" } },
        position: { line: 3 },
        parent,
        open: "pin",
      });
      const first = w.layout.getActivePanel("main")!;
      const expected = w.pages.store.getState().location?.parent;
      await w.navigation.openPage({
        page: viewerPage("reader"),
        resource: { ...viewerResource("y"), metadata: { document: "y.ts" } },
        position: { line: 7 },
        open: "pin",
        parent: { ...parent, resource: viewerResource("two", "folder") },
      });
      if (action === "select") w.layout.activatePanel(first.instanceId);
      else if (!collection) {
        const result = w.pageLocations.closePlacement(w.layout.getActivePanel("main")!.placementIdentity!);
        expect(result.ok && result.location.parent).toEqual(expected);
        expect(result.ok && result.location.position).toEqual({ line: 3 });
      } else w.closePlacement(w.layout.getActivePanel("main")!.placementIdentity!);
      expect(w.pages.store.getState().location?.parent).toEqual(expected);
      expect(w.pages.store.getState().location?.position).toEqual({ line: 3 });
    });

test("closing selected collection viewers follows Main selection and retires its last resource route", async () => {
  const { w, openMain, saved, locations } = createResourceViewerFixture({ collection: true });
  await openMain("x");
  const first = w.layout.getActivePanel("main")!;
  await openMain("y");
  w.closePlacement(w.layout.getActivePanel("main")!.placementIdentity!);
  expect(w.pages.store.getState().location?.resource?.id).toBe("x");
  w.closePlacement(first.placementIdentity!);
  expect(w.getPrimaryResource()).toBeUndefined();
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("home"));
  const next = createResourceViewerFixture({ collection: true, saved, locations });
  expect(next.w.getPrimaryResource()).toBeUndefined();
  expect(next.w.layout.listPanelInstances("main")).toEqual([]);
});

test("a reusable panel viewer stays inside its receiving collection", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("x");
  w.movePanel(side().instanceId, "main");
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("home"));
  expect(w.layout.getActivePanel("main")?.resource?.id).toBe("x");
  expect(w.getActiveResource()?.id).toBe("x");
  expect(w.pages.getContent()).toBeUndefined();
});
