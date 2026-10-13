import { expect, test } from "bun:test";
import { harness, navigate, openFile, page, panel, resource } from "../composition/placement-lifecycle-test-support";
import { openOwnerLayouts } from "../page-runtime/open-owner-layouts";

const create = () => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  w.pages.registerPage({
    id: "collection",
    ref: page("collection"),
    path: "collection",
    modeId: "edit",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  w.pages.registerPage({
    id: "documents",
    ref: page("documents"),
    path: "documents",
    modeId: "edit",
    parentId: "collection",
    document: { metadataKey: "path" },
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  w.modes.registerMode({ id: "review", activate() {} });
  w.pages.registerPage({
    id: "review",
    ref: page("review"),
    path: "review",
    modeId: "review",
    main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
    slots: [],
  });
  return w;
};
const doc = (line: number) => ({
  kind: "page" as const,
  page: page("documents"),
  resource: { ...resource("a"), metadata: { path: "a.ts" } },
  position: { line, column: 1 },
  open: "pin" as const,
});

for (const owner of ["mode", "page"] as const) {
  for (const compound of [false, true]) {
    for (const otherMode of [false, true]) {
      test(`${owner} editor source position survives ${compound ? "compound" : "separate"} opens ending in ${otherMode ? "another mode" : "another page"}`, async () => {
        const w = create();
        await w.navigation.openTarget(navigate("alpha"));
        await w.navigation.openTarget({
          ...(owner === "mode" ? { kind: "panel" as const, panel } : openFile("a")),
          resource: doc(10).resource,
          open: "pin",
        });
        const id = w.layout.getLayout().activeWidgetId!;
        await w.navigation.openTarget(doc(10));
        expect(w.layout.getActivePanel()?.position?.line).toBe(10);
        const end = otherMode ? { kind: "page" as const, page: page("review") } : navigate("beta");
        if (compound) await w.navigation.openTarget({ kind: "compound", targets: [doc(20), doc(30), end] });
        else {
          await w.navigation.openTarget(doc(20));
          await w.navigation.openTarget(doc(30));
          await w.navigation.openTarget(end);
        }
        expect(w.pages.store.getState().location?.page.id).toBe(otherMode ? "review" : "workspace");
        if (!otherMode) expect(w.pages.store.getState().location?.resource?.id).toBe("beta");
        const saved = openOwnerLayouts(w)
          .flatMap((o) => Object.values(o.layout.regions).flatMap((r) => r.widgets))
          .find((t) => t.widgetId === id);
        await w.navigation.openTarget(navigate("alpha"));
        const tab = Object.values(w.layout.getLayout().regions)
          .flatMap((r) => r.widgets)
          .find((t) => t.widgetId === id);
        expect(tab?.position?.line).toBe(30);
        expect(saved?.position?.line).toBe(30);
      });
    }
  }
}

test("an earlier mode editor position survives a later editor in the same region", async () => {
  const w = create();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: doc(10).resource, open: "pin" });
  const id = w.layout.getLayout().activeWidgetId!;
  await w.navigation.openTarget(doc(10));
  await w.navigation.openTarget({
    kind: "compound",
    targets: [doc(20), { kind: "panel", panel, resource: resource("b"), open: "pin" }],
  });
  const tab = w.layout.getLayout().regions.side.widgets.find((t) => t.widgetId === id);
  expect(tab?.position?.line).toBe(20);
  expect(w.layout.getActivePanel()?.resource?.id).toBe("b");
  expect(w.focus.getActiveRegion()).toBe("side");
});
