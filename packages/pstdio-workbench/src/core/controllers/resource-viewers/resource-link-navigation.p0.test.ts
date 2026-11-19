import { expect, test } from "bun:test";
import { resourceLinkTarget } from "pstdio-api-contracts/extension-kernel";
import { toWorkbenchNavigationTarget } from "../../../extensions/host/extension-navigation-target";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";

for (const compound of [false, true])
  test(`a resource link in another mode enters its owning page; compound=${compound}`, async () => {
    const { w, openMain } = createResourceViewerFixture();
    w.modes.registerMode({ id: "other-mode", activate() {} });
    w.pages.registerPage({
      id: "foreign-root",
      ref: viewerPage("foreign-root"),
      path: "foreign-root",
      modeId: "other-mode",
      main: { kind: "panels" },
      slots: [],
    });
    w.pages.registerPage({
      id: "foreign",
      ref: viewerPage("foreign"),
      path: "foreign",
      modeId: "other-mode",
      resource: w.pages.getPage("reader")!.resource,
      parentId: "foreign-root",
      main: { kind: "view", view: { kind: "view", id: "reader" }, cardinality: "one", presentation: "page" },
      slots: [],
    });
    await openMain("source");
    const link = toWorkbenchNavigationTarget(
      resourceLinkTarget({ kind: "page", page: viewerPage("foreign"), resource: viewerResource("linked") }),
    );
    if (link.kind !== "page") throw new Error("Expected page link");
    await w.navigation.openTarget(compound ? { kind: "compound", targets: [link] } : link);
    expect(w.modes.getActiveModeId()).toBe("other-mode");
    expect(w.pages.getContent()?.resource?.id).toBe("linked");
  });

for (const owner of ["mode", "page"])
  test(`a link to a single-instance ${owner} binding opens without an unsupported retention intent`, async () => {
    const { w, openMain } = createResourceViewerFixture({ viewerCardinality: "one" });
    let panel: import("@pstdio/sdk/extensions").PanelRef = {
      kind: "placement",
      extensionId: "example.readers",
      id: "reader",
    };
    if (owner === "page") {
      w.pages.registerPage({
        id: "single",
        ref: viewerPage("single"),
        path: "single",
        modeId: "project",
        main: { kind: "panels" },
        slots: [
          {
            id: "record",
            region: "main",
            item: {
              kind: "binding",
              binding: {
                kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }],
                view: { kind: "view", id: "reader" },
                cardinality: "one",
              },
            },
          },
        ],
      });
      await w.navigation.openPage({ page: viewerPage("single") });
      panel = { kind: "page-slot", page: viewerPage("single"), id: "record" };
    } else await openMain("source");
    const location = w.pages.store.getState().location;
    await w.navigation.openTarget(
      toWorkbenchNavigationTarget(resourceLinkTarget({ kind: "panel", panel, resource: viewerResource("linked") })),
    );
    expect(w.pages.store.getState().location).toEqual(location);
    expect(w.layout.getActivePanel("side")?.resource?.id).toBe("linked");
  });

test("a multi-result resource path retains every explicitly pinned result in Side", async () => {
  const { w, openMain } = createResourceViewerFixture();
  await openMain("source");
  const location = w.pages.store.getState().location;
  await w.navigation.openTarget(
    toWorkbenchNavigationTarget(
      resourceLinkTarget({
        kind: "compound",
        targets: ["first", "second"].map((id) => ({
          kind: "page",
          page: viewerPage("reader"),
          resource: viewerResource(id),
          open: "pin",
        })),
      }),
    ),
  );
  expect(w.pages.store.getState().location).toEqual(location);
  expect(w.layout.listPanelInstances("side").map((item) => [item.resource?.id, item.tabRetention])).toEqual([
    ["first", "persistent"],
    ["second", "persistent"],
  ]);
});

for (const tabs of [false, true])
  test(`a resource page link opens an unpinned Side preview without replacing ${tabs ? "tabs" : "Main"}`, async () => {
    const { w, openMain } = createResourceViewerFixture({ tabs });
    await openMain("source");
    const location = w.pages.store.getState().location;
    const main = w.layout.getLayout().regions.main.widgets;
    w.shell.setRegionOpen("side", false);
    for (const type of ["record", "draft"]) {
      await w.navigation.openTarget({
        kind: "page",
        page: viewerPage("reader"),
        resource: viewerResource(type, type),
        region: "side",
        open: "preview",
        section: { anchors: [{ id: "details", heading: "Details" }] },
      });
      expect(w.pages.store.getState().location).toEqual(location);
      expect(w.layout.getLayout().regions.main.widgets).toEqual(main);
      expect(w.layout.getActivePanel("side")).toMatchObject({
        resource: { id: type, type },
        tabRetention: "preview",
        pageContext: { page: viewerPage("reader") },
        section: { anchors: [{ id: "details", heading: "Details" }] },
      });
      expect(w.shell.getPanelPolicy("side").open).toBe(true);
    }
    expect(w.layout.listPanelInstances("side")).toHaveLength(1);
  });

test("a cross-mode resource landing preserves explicit multi-result pins", async () => {
  const { w, openMain } = createResourceViewerFixture();
  w.modes.registerMode({ id: "other-mode", activate() {} });
  const landing = { kind: "placement" as const, extensionId: "example.readers", id: "foreign-landing" };
  w.modePlacements.registerPlacement({
    id: "foreign-landing",
    ref: landing,
    modeId: "other-mode",
    region: "main",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }],
        view: { kind: "view", id: "reader" },
        cardinality: "many",
      },
    },
  });
  w.pages.registerPage({
    id: "foreign-root",
    ref: viewerPage("foreign-root"),
    path: "foreign-root",
    modeId: "other-mode",
    main: { kind: "panels" },
    slots: [],
  });
  w.pages.registerPage({
    id: "foreign",
    ref: viewerPage("foreign"),
    path: "foreign",
    modeId: "other-mode",
    parentId: "foreign-root",
    resource: { kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }] },
    main: { kind: "panels", landing },
    slots: [],
  });
  await openMain("source");
  await w.navigation.openTarget({
    kind: "compound",
    targets: ["first", "second"].map((id) => ({
      kind: "page",
      page: viewerPage("foreign"),
      resource: viewerResource(id),
      region: "side",
      open: "pin",
    })),
  });
  const first = w.layout.listPanelInstances("main").find((item) => item.resource?.id === "first");
  expect(first?.tabRetention).toBe("persistent");
  await w.navigation.openPage({ page: viewerPage("foreign"), resource: viewerResource("preview"), open: "preview" });
  expect(w.layout.listPanelInstances("main").some((item) => item.instanceId === first!.instanceId)).toBe(true);
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("second");
});

test("a denied Side page link preserves its source and existing resources", async () => {
  const { w, openMain } = createResourceViewerFixture({ sideCanOpen: false });
  await openMain("source");
  w.shell.setRegionOpen("side", false);
  const location = w.pages.store.getState().location;
  await expect(
    w.navigation.openTarget({
      kind: "page",
      page: viewerPage("reader"),
      resource: viewerResource("linked"),
      region: "side",
      open: "preview",
    }),
  ).rejects.toThrow();
  expect(w.pages.store.getState().location).toEqual(location);
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
});

test("a page link reuses an existing pinned Side resource without unpinning it", async () => {
  const { w, openMain, openSide, side } = createResourceViewerFixture();
  await openMain("source");
  await openSide("linked");
  const id = side().instanceId;
  await w.navigation.openTarget({
    kind: "page",
    page: viewerPage("reader"),
    resource: viewerResource("linked"),
    region: "side",
    open: "preview",
  });
  expect(side().instanceId).toBe(id);
  expect(side().tabRetention).toBe("persistent");
  expect(w.pages.getContent()?.resource?.id).toBe("source");
});

test("a legacy resource link panel can preview outside its containing page", async () => {
  const { w, other } = createResourceViewerFixture();
  w.pages.registerPage({
    id: "legacy",
    ref: viewerPage("legacy"),
    path: "legacy",
    modeId: "project",
    main: { kind: "panels" },
    slots: [
      {
        id: "record",
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
  other();
  await w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "page-slot", page: viewerPage("legacy"), id: "record" },
    resource: viewerResource("linked"),
    region: "side",
    open: "preview",
  });
  expect(w.pages.store.getState().activePageId).toBe("other");
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("linked");
});

test("a resource with Files and Changes tabs previews its declared landing in Side", async () => {
  const { w, openMain } = createResourceViewerFixture();
  w.pages.registerPage({
    id: "workspace",
    ref: viewerPage("workspace"),
    path: "workspace",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }] },
    main: { kind: "panels", landing: "files" },
    slots: ["files", "changes"].map((id) => ({
      id,
      region: "main",
      item: { kind: "view", view: { kind: "view", id: "reader" }, presence: "open" },
    })),
  });
  await openMain("source");
  const location = w.pages.store.getState().location;
  await w.navigation.openTarget({
    kind: "page",
    page: viewerPage("workspace"),
    resource: viewerResource("linked"),
    region: "side",
    open: "preview",
  });
  expect(w.pages.store.getState().location).toEqual(location);
  expect(w.layout.getActivePanel("side")).toMatchObject({
    resource: { id: "linked" },
    tabRetention: "preview",
    pageContext: { page: viewerPage("workspace") },
  });
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
});

for (const owner of ["a", "b"])
  test(`a compound resource link resolves its ${owner} slot against the staged page`, async () => {
    const { w } = createResourceViewerFixture();
    for (const id of ["a", "b"])
      w.pages.registerPage({
        id,
        ref: viewerPage(id),
        path: id,
        modeId: "project",
        main: { kind: "panels" },
        slots: [
          {
            id: "record",
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
    await w.navigation.openPage({ page: viewerPage("a") });
    await w.navigation.openTarget({
      kind: "compound",
      targets: [
        { kind: "page", page: viewerPage("b") },
        {
          kind: "panel",
          panel: { kind: "page-slot", page: viewerPage(owner), id: "record" },
          resource: viewerResource("linked"),
          region: "side",
          open: "preview",
        },
      ],
    });
    expect(w.pages.store.getState().activePageId).toBe("b");
    expect(w.layout.getActivePanel("side")?.resource?.id).toBe("linked");
    expect(w.layout.getActivePanel("side")?.placementIdentity?.kind).toBe(owner === "b" ? "page" : "mode");
  });
