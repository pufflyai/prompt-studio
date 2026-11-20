import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";
import { viewerHostKey } from "./viewer-host-continuity";

for (const operation of ["navigateToParent", "navigateToRootLevel"] as const)
  for (const collection of [false, true]) {
    test(`${operation} brings its resource from Side into Main; collection=${collection}`, async () => {
      const { w, openSide, side } = createResourceViewerFixture({ collection });
      w.pages.registerPage({
        ...w.pages.getPage("other")!,
        id: "child",
        ref: viewerPage("child"),
        path: "child",
        parentId: "reader",
      });
      w.navigationTrees.registerContribution({
        id: "child",
        owner: viewerPage("child"),
        sourceExtensionId: "example.readers",
        declarationIndex: 0,
        slot: "content",
        getSections: () => [],
      });
      await openSide("a");
      const host = viewerHostKey(w, side().instanceId);
      await w.navigation.openPage({
        page: viewerPage("child"),
        parent: { kind: "page", page: viewerPage("reader"), resource: viewerResource("a") },
      });
      expect(w.pageLocations[operation]().ok).toBe(true);
      const main = w.pages.getContent() ?? w.layout.getActivePanel("main")!;
      expect(main.resource?.id).toBe("a");
      expect(w.layout.listPanelInstances("side")).toHaveLength(0);
      expect(viewerHostKey(w, "instanceId" in main ? main.instanceId : main.widgetId)).toBe(host);
      w.pageLocations.goBack();
      expect(w.pages.store.getState().activePageId).toBe(operation === "navigateToParent" ? "home" : "child");
    });
  }

test("default-page navigation reclaims a moved resource-free singleton", () => {
  const w = createWorkbench({ defaultPage: viewerPage("home") });
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "home", title: "Home", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "home",
    ref: viewerPage("home"),
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "home" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  w.pageLocations.setProject("project");
  w.pageLocations.navigateToDefaultPage();
  const host = viewerHostKey(w, w.pages.getContent()!.widgetId);
  w.movePanel(w.pages.getContent()!.widgetId, "side");
  expect(w.pageLocations.navigateToDefaultPage().ok).toBe(true);
  expect(w.pages.getContent()?.viewId).toBe("home");
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
  expect(viewerHostKey(w, w.pages.getContent()!.widgetId)).toBe(host);
});
