import { expect, test } from "bun:test";
import { createOwnedAddablePanels } from "../composition/owned-addable-panels";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

test.each(["alpha", "document"])("reset reopens %s Main after closing its content", (page) => {
  const { w, navigate } = modePanelFixture();
  navigate(page, page === "document" ? "one" : undefined);
  if (page === "document")
    w.pageLocations.navigate({
      kind: "page",
      page: pageRef(page),
      resource: { type: "document", id: "one" },
      section: { anchors: [{ id: "intro", heading: "Introduction" }] },
    });
  const original = w.layout.getActivePanel("main")!;
  w.closePlacement(original.placementIdentity!);
  w.resetLayout();
  expect(w.layout.getActivePanel("main")?.placementIdentity).toEqual(original.placementIdentity);
  expect(w.layout.getActivePanel("main")?.section).toEqual(original.section);
});

test("revisiting a collection reopens and selects its declared landing tab", () => {
  const { w, navigate } = modePanelFixture(undefined, true, [
    {
      id: "collection",
      ref: pageRef("collection"),
      modeId: "alpha",
      path: "collection",
      main: { kind: "panels", empty: { kind: "view", id: "document" }, landing: "library" },
      slots: [
        {
          id: "library",
          region: "main",
          item: { kind: "view", view: { kind: "view", id: "document" }, presence: "open" },
        },
      ],
    },
  ]);
  navigate("collection");
  w.closePlacement(w.layout.getActivePanel("main")!.placementIdentity!);
  expect(w.layout.listPanelInstances("main")).toEqual([]);
  navigate("alpha");
  navigate("collection");
  expect(w.layout.getActivePanel("main")?.placementIdentity).toMatchObject({ pageId: "collection", slotId: "library" });
  const preview = w.shellPlacements.openPlacement({
    placementId: "shared-main",
    resource: { type: "document", id: "preview" },
    open: "pin",
  });
  const previewTab = w.layout
    .listPanelInstances("main")
    .find((tab) => tab.placementIdentity?.kind === preview.kind && tab.resource?.id === "preview")!;
  w.layout.activatePanel(previewTab.instanceId);
  expect(w.layout.getActivePanel("main")?.instanceId).toBe(previewTab.instanceId);
  navigate("collection");
  expect(w.layout.getActivePanel("main")?.placementIdentity).toMatchObject({ pageId: "collection", slotId: "library" });
});

test("collection navigation leaves an unavailable landing tab closed", () => {
  const { w, navigate } = modePanelFixture(undefined, true, [
    {
      id: "collection",
      ref: pageRef("collection"),
      modeId: "alpha",
      path: "collection",
      main: { kind: "panels", landing: "library" },
      slots: [
        {
          id: "library",
          region: "main",
          isAvailable: () => false,
          item: { kind: "view", view: { kind: "view", id: "document" }, presence: "open" },
        },
      ],
    },
  ]);
  expect(() => navigate("collection")).not.toThrow();
  expect(w.pages.store.getState().activePageId).toBe("collection");
  expect(w.layout.listPanelInstances("main")).toEqual([]);
});

for (const page of ["alpha", "document"]) {
  test(`closing ${page} Main keeps the page open and its content can reopen`, async () => {
    const { w, navigate } = modePanelFixture();
    navigate(page, page === "document" ? "one" : undefined);
    const tab = w.layout.getActivePanel("main")!;
    expect(tab.closable).toBe(true);
    w.closePlacement(tab.placementIdentity!);
    expect(w.pages.store.getState().activePageId).toBe(page);
    expect(w.layout.listPanelInstances("main")).toEqual([]);
    if (page === "document") navigate(page, "one");
    else {
      const addable = createOwnedAddablePanels(w, {
        region: "main",
        layout: w.layout.getLayout(),
        resource: w.pages.store.getState().location?.resource,
      });
      await addable.find((entry) => entry.panelId === tab.panelId)!.open!();
    }
    expect(w.layout.listPanelInstances("main")).toHaveLength(1);
    expect(w.layout.getActivePanel("main")!.placementIdentity).toEqual(tab.placementIdentity);
  });
}

test("moving a page tab back from Side keeps its identity", () => {
  const { w, navigate } = modePanelFixture();
  navigate("document", "one");
  const tab = w.layout.getActivePanel("main")!;
  w.movePanel(tab.instanceId, "side");
  w.movePanel(tab.instanceId, "main");
  expect(w.layout.listPanelInstances("side")).toEqual([]);
  expect(w.layout.getActivePanel("main")!.instanceId).toBe(tab.instanceId);
});

test("a formerly fixed panel can close and reopen through Add", async () => {
  const { w } = modePanelFixture();
  w.shellPlacements.registerPlacement({
    id: "tool",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "document" }, presence: "fixed" },
  });
  const tab = w.layout.getActivePanel("side")!;
  expect(tab.closable).toBe(true);
  w.closePlacement(tab.placementIdentity!);
  expect(w.layout.listPanelInstances("side")).toEqual([]);
  const addable = createOwnedAddablePanels(w, { region: "side", layout: w.layout.getLayout() });
  await addable.find((entry) => entry.panelId === tab.panelId)!.open!();
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
});

test.each(["main", "side", "secondary"] as const)("restored page tabs in %s use current close rules", (region) => {
  const s = modePanelFixture();
  const original = s.w.layout.getActivePanel("main")!;
  s.w.movePanel(original.instanceId, region === "main" ? "side" : region);
  s.navigate("alpha-list");
  if (region === "main") s.w.movePanel(original.instanceId, "main");
  s.navigate("beta");
  s.w.pageLocations.dispose();
  for (const layout of s.saved.values()) {
    for (const panel of Object.values(layout.regions)) {
      for (const tab of panel.widgets) {
        if (tab.placementIdentity?.kind === "page" && tab.placementIdentity.pageId === "alpha") tab.closable = false;
      }
    }
  }
  const restored = modePanelFixture(s.saved, true, [], "alpha-list");
  const tab = restored.w.layout.listPanelInstances(region).find((tab) => tab.instanceId === original.instanceId)!;
  expect(tab.closable).toBe(true);
  restored.w.closePlacement(tab.placementIdentity!);
  expect(restored.w.layout.listPanelInstances(region).some((tab) => tab.instanceId === original.instanceId)).toBe(
    false,
  );
  expect(restored.w.pages.store.getState().activePageId).toBe("alpha-list");
});
