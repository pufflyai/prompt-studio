import { expect, test } from "bun:test";
import { harness, navigate, page, panel, resource } from "../composition/placement-lifecycle-test-support";
import { openOwnerLayouts } from "../page-runtime/open-owner-layouts";

const setup = () => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  w.pages.registerPage({
    id: "documents",
    ref: page("documents"),
    path: "documents",
    modeId: "edit",
    parentId: "workspace",
    document: { metadataKey: "path" },
    resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
    main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
    slots: [],
  });
  return w;
};
const doc = (id: string, line = 10) => ({
  kind: "page" as const,
  page: page("documents"),
  resource: { ...resource(id), metadata: { path: `${id}.ts` } },
  position: { line, column: 1 },
  parent: navigate("alpha"),
  open: "pin" as const,
});
const section = { anchors: [{ id: "intro", heading: "Intro" }] };
const open = async (compound: boolean, leave: boolean, nextDocument = true) => {
  const w = setup();
  await w.navigation.openTarget(doc("a"));
  const id = w.layout.getLayout().activeWidgetId;
  const heading = { ...doc("a"), position: undefined, section };
  const targets = [heading, ...(nextDocument ? [doc("b", 20)] : []), ...(leave ? [navigate("beta")] : [])];
  if (compound) await w.navigation.openTarget({ kind: "compound", targets });
  else for (const target of targets) await w.navigation.openTarget(target);
  const saved = openOwnerLayouts(w)
    .flatMap((o) => Object.values(o.layout.regions).flatMap((r) => r.widgets))
    .find((tab) => tab.widgetId === id);
  return { w, saved, id };
};

for (const compound of [true]) {
  for (const leave of [false, true]) {
    const label = `${compound ? "compound" : "separate"} heading then Main B ${leave ? "then Beta" : "staying"}`;
    test(`${label} clears the old source position`, async () => {
      const { saved } = await open(compound, leave);
      expect(saved?.section).toEqual(section);
      expect(saved?.position).toBeUndefined();
    });
    test(`${label} allows panel reuse`, async () => {
      const { w, id } = await open(compound, leave);
      await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource });
      expect(w.layout.getLayout().activeWidgetId).toBe(id);
      expect(w.pages.store.getState().location?.section).toEqual(section);
      expect(w.pages.store.getState().location?.position).toBeUndefined();
    });
  }
}

for (const compound of [false, true]) {
  test(`${compound ? "compound" : "separate"} final heading target clears position and reopens`, async () => {
    const { w, saved, id } = await open(compound, false, false);
    expect(saved?.section).toEqual(section);
    expect(saved?.position).toBeUndefined();
    await w.navigation.openTarget({ kind: "panel", panel, resource: doc("a").resource });
    expect(w.layout.getLayout().activeWidgetId).toBe(id);
    expect(w.pages.store.getState().location?.section).toEqual(section);
    expect(w.pages.store.getState().location?.position).toBeUndefined();
  });
}
