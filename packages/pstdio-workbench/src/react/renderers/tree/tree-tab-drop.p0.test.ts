import { expect, test } from "bun:test";
import { openDroppedPage } from "../../../core/controllers/composition/panel-page-drop";
import {
  createResourceViewerFixture,
  viewerPage,
  viewerPanel,
  viewerResource,
} from "../../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { treePageTarget, treeTabTarget } from "./tree-tab-drop";

test("dropping a static page on Main opens it without a resource-tab intent", async () => {
  const { w, other } = createResourceViewerFixture();
  other();
  await w.navigation.openTarget(treeTabTarget(w, { kind: "page", page: viewerPage("home") }, "main")!);
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("home"));
});

test("dropping a single-resource page into Main tabs preserves its document and parent", async () => {
  const { w } = createResourceViewerFixture({ document: true });
  const page = w.pages.getPage("reader")!;
  if (page.main.kind !== "view") throw new Error("Expected reader view");
  page.main = { ...page.main, cardinality: "one" };
  const resource = { ...viewerResource("note"), metadata: { document: "notes.md" } };
  await w.navigation.openTarget(
    treeTabTarget(
      w,
      {
        kind: "page",
        page: viewerPage("reader"),
        resource,
        position: { line: 3 },
        parent: { kind: "page", page: viewerPage("home") },
      },
      "main",
    )!,
  );
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("home"));
  expect(w.layout.getActivePanel("main")).toMatchObject({
    resource,
    position: { line: 3 },
    pageContext: { page: viewerPage("reader"), parent: { page: viewerPage("home") } },
  });
});

test("dropping two one-cardinality pages onto a tab strip keeps both as pinned resource tabs", async () => {
  const { w } = createResourceViewerFixture();
  const page = w.pages.getPage("reader")!;
  if (page.main.kind !== "view") throw new Error("Expected reader view");
  page.main = { ...page.main, cardinality: "one" };
  for (const id of ["first", "second"]) {
    await w.navigation.openTarget(
      treeTabTarget(w, { kind: "page", page: viewerPage("reader"), resource: viewerResource(id) }, "main")!,
    );
  }
  expect(w.layout.listPanelInstances("main").map((tab) => [tab.resource?.id, tab.tabRetention])).toEqual([
    ["first", "persistent"],
    ["second", "persistent"],
  ]);
});

for (const destination of ["home", "other"])
  test(`compound resource drops honor the preceding ${destination} page's presentation`, async () => {
    const { w } = createResourceViewerFixture();
    const page = w.pages.getPage("reader")!;
    if (page.main.kind !== "view") throw new Error("Expected reader view");
    page.main = { ...page.main, cardinality: "one" };
    w.pageLocations.navigate({ kind: "page", page: viewerPage(destination === "home" ? "other" : "home") });
    const dropped = treeTabTarget(
      w,
      {
        kind: "compound",
        targets: [
          { kind: "page", page: viewerPage(destination) },
          { kind: "page", page: viewerPage("reader"), resource: viewerResource("a") },
        ],
      },
      "main",
    )!;
    await w.navigation.openTarget(dropped);
    if (destination === "home") {
      expect(w.pages.store.getState().activePageId).toBe("home");
      expect(w.layout.getActivePanel("main")?.tabRetention).toBe("persistent");
    } else expect(w.pages.getContent()?.resource?.id).toBe("a");
  });

test("a compound Main-body drop keeps its explicit full-page resource destination", async () => {
  const { w } = createResourceViewerFixture();
  const page = w.pages.getPage("reader")!;
  if (page.main.kind !== "view") throw new Error("Expected reader view");
  page.main = { ...page.main, cardinality: "one" };
  const dropped = treePageTarget(w, {
    kind: "compound",
    targets: [
      { kind: "page", page: viewerPage("home") },
      { kind: "page", page: viewerPage("reader"), resource: viewerResource("a") },
    ],
  });
  if (dropped?.kind !== "compound") throw new Error("Expected compound body drop");
  await openDroppedPage(w, dropped);
  expect(w.pages.getContent()?.resource?.id).toBe("a");
});

for (const kind of ["panel", "page"] as const) {
  test(`dropping a ${kind} entry into a single-resource side viewer replaces its resource`, async () => {
    const { w, side } = createResourceViewerFixture({ viewerCardinality: "one" });
    for (const id of ["first", "second"]) {
      const resource = viewerResource(id);
      const target =
        kind === "panel" ? { kind, panel: viewerPanel, resource } : { kind, page: viewerPage("reader"), resource };
      await w.navigation.openTarget(treeTabTarget(w, target, "side")!);
    }
    expect(side().resource?.id).toBe("second");
    expect(w.layout.listPanelInstances("side")).toHaveLength(1);
  });
}

for (const collection of [false, true]) {
  test(`dropping multiple resources pins each Main tab (collection=${collection})`, async () => {
    const { w } = createResourceViewerFixture({ tabs: true, collection });
    for (const id of ["first", "second"]) {
      await w.navigation.openTarget(
        treeTabTarget(
          w,
          {
            kind: "page",
            page: viewerPage("reader"),
            resource: viewerResource(id),
          },
          "main",
        )!,
      );
    }
    expect(
      w.layout
        .listPanelInstances("main")
        .map((item) => item.resource?.id)
        .sort(),
    ).toEqual(["first", "second"]);
  });
}

test("dropping a compound note target opens its collection and note in Main", async () => {
  const { w } = createResourceViewerFixture({ tabs: true, collection: true });
  w.pages.registerPage({
    id: "notes",
    ref: viewerPage("notes"),
    path: "notes",
    modeId: "project",
    main: { kind: "panels" },
    slots: [
      {
        id: "note",
        region: "main",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }],
            view: { kind: "view", id: "reader" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  const note = viewerResource("note");
  const target = {
    kind: "compound" as const,
    targets: [
      { kind: "page" as const, page: viewerPage("notes") },
      {
        kind: "panel" as const,
        panel: { kind: "page-slot" as const, page: viewerPage("notes"), id: "note" },
        resource: note,
        open: "pin" as const,
      },
    ],
  };
  const dropped = treeTabTarget(w, target, "main");
  expect(dropped).toBeDefined();
  await w.navigation.openTarget(dropped!);
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("notes"));
  expect(w.layout.listPanelInstances("main").some((tab) => tab.resource?.id === "note")).toBe(true);
});
