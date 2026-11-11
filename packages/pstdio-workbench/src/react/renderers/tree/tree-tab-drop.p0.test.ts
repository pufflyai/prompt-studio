import { expect, test } from "bun:test";
import {
  createResourceViewerFixture,
  viewerPage,
  viewerPanel,
  viewerResource,
} from "../../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { treeTabTarget } from "./tree-tab-drop";

test("dropping a static page on Main opens it without a resource-tab intent", async () => {
  const { w, other } = createResourceViewerFixture();
  other();
  await w.navigation.openTarget(treeTabTarget(w, { kind: "page", page: viewerPage("home") }, "main")!);
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("home"));
});

test("dropping a single-resource page on Main preserves its document and parent", async () => {
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
  expect(w.pages.store.getState().location).toMatchObject({
    resource,
    position: { line: 3 },
    parent: { page: viewerPage("home") },
  });
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
