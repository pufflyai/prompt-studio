import { expect, test } from "bun:test";
import type { WorkbenchModuleContext } from "../../core";
import { opening, ref, setup } from "./related-resource-openings.fixture";
import { createResourcePreviewOpener } from "./resource-preview-opener";

test("a declared viewer in another mode keeps its owner instead of becoming a shell projection", () => {
  const { workbench: w, source, controller } = setup();
  w.modes.registerMode({ id: "other", activate() {} });
  const panel = { kind: "placement", extensionId: "example", id: "other-reader" } as const;
  w.modePlacements.registerPlacement({
    id: panel.id,
    ref: panel,
    modeId: "other",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: ["document", "draft"].map((id) => ({ kind: "resource-kind" as const, extensionId: "example", id })),
        view: { kind: "view", id: "document" },
        cardinality: "many",
      },
    },
  });
  const page = { kind: "page", extensionId: "example", id: "other-document" } as const;
  const root = { ...page, id: "other-root" };
  w.pages.registerPage({ id: root.id, ref: root, path: "other", modeId: "other", main: { kind: "panels" }, slots: [] });
  w.pages.registerPage({
    id: page.id,
    ref: page,
    parentId: root.id,
    path: "other/document",
    modeId: "other",
    resource: { kinds: [{ kind: "resource-kind", extensionId: "example", id: "document" }] },
    main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "document" } },
    panelView: panel,
    slots: [],
  });
  const opener = createResourcePreviewOpener(w as WorkbenchModuleContext);
  expect(opener.open({ kind: "page", page, resource: ref("document", "x") }, source, opening("x", "side"))).toBe(false);
  expect(w.shellPlacements.listPlacements()).toEqual([]);
  opener.dispose();
  controller.dispose();
});

test("a related opening follows the canonical replacement of an old page slot", () => {
  const { workbench: w, source, controller } = setup();
  const legacy = { kind: "page-slot", page: w.pages.getPage("home")!.ref, id: "old-reader" } as const;
  const panel = { kind: "placement", extensionId: "example", id: "replacement" } as const;
  w.modePlacements.registerPlacement({
    id: panel.id,
    ref: panel,
    replaces: [legacy],
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", extensionId: "example", id: "document" }],
        view: { kind: "view", id: "document" },
        cardinality: "many",
      },
    },
  });
  const opener = createResourcePreviewOpener(w as WorkbenchModuleContext);
  expect(
    opener.open({ kind: "panel", panel: legacy, resource: ref("document", "x") }, source, opening("x", "side")),
  ).toBe(true);
  expect(w.layout.getActivePanel("side")?.placementIdentity).toMatchObject({ kind: "mode", placementId: panel.id });
  opener.dispose();
  controller.dispose();
});

for (const cardinality of ["one", "many"] as const) {
  for (const region of ["side", "secondary"] as const) {
    test(`related page resources keep their ${cardinality} viewer and location in ${region}`, async () => {
      const { workbench: w, source, controller } = setup();
      const panel = { kind: "placement" as const, extensionId: "example", id: "document-viewer" };
      w.modePlacements.registerPlacement({
        id: "document-viewer",
        ref: panel,
        modeId: "project",
        region: "side",
        item: {
          kind: "binding",
          binding: {
            kinds: [
              { kind: "resource-kind", id: "document", extensionId: "example" },
              { kind: "resource-kind", id: "draft", extensionId: "example" },
            ],
            view: { kind: "view", id: "document" },
            cardinality,
          },
        },
      });
      const page = { kind: "page" as const, extensionId: "example", id: "viewer-document" };
      w.pages.registerPage({
        id: "viewer-document",
        ref: page,
        path: "viewer-document",
        modeId: "project",
        parentId: "home",
        params: { filter: { type: "string", default: "all" } },
        document: { metadataKey: "documentPath" },
        resource: { kinds: [{ kind: "resource-kind", id: "document", extensionId: "example" }] },
        main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one", presentation: "page" },
        panelView: panel,
        slots: [],
      });
      const opener = createResourcePreviewOpener(w as WorkbenchModuleContext);
      const resource = { ...ref("document", "related"), metadata: { documentPath: "related.md" } };
      const location = w.pages.store.getState().location;
      const target = {
        kind: "page" as const,
        page,
        resource,
        params: { filter: "mine" },
        parent: { kind: "page" as const, page: w.pages.getPage("home")!.ref },
        section: region === "side" ? { anchors: [{ id: "intro", heading: "Introduction" }] } : undefined,
        position: region === "secondary" ? { line: 8, column: 2 } : undefined,
      };
      expect(opener.open(target, source, opening(resource.id, region))).toBe(true);
      const viewer = w.layout.getActivePanel(region)!;
      expect(viewer.placementIdentity?.kind).toBe("mode");
      expect(viewer).toMatchObject({
        pageContext: { page, parent: { page: target.parent.page }, params: target.params },
        section: target.section,
        position: target.position,
      });
      await w.navigation.openTarget(
        { kind: "viewer", operation: "switch", from: resource, resource: ref("draft", "new") },
        { viewer: viewer.placementIdentity, projectId: "project" },
      );
      expect(w.layout.getActivePanel(region)?.resource).toMatchObject({ type: "draft", id: "new" });
      expect(w.pages.store.getState().location).toEqual(location);
      opener.dispose();
      controller.dispose();
    });
  }
}

test("an invalid related target does not abort the next opening", () => {
  const { workbench: w, source, controller, target } = setup();
  const opener = createResourcePreviewOpener(w as WorkbenchModuleContext);
  const bad = { ...target(ref("document", "bad")), params: { unknown: "invalid" } };
  expect(opener.open(bad, source, opening("bad", "side"))).toBe(false);
  expect(opener.open(target(ref("document", "good")), source, opening("good", "side"))).toBe(true);
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("good");
  opener.dispose();
  controller.dispose();
});
