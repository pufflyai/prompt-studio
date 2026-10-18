import { expect, test } from "bun:test";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

const fixture = (saved: Parameters<typeof modePanelFixture>[0] = new Map(), cardinality?: "one" | "many") => {
  const s = modePanelFixture(saved, true, [
    {
      id: "document-collection",
      ref: pageRef("document-collection"),
      path: "document-collection",
      modeId: "alpha",
      parentId: "alpha",
      resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
      document: { metadataKey: "file" },
      main: cardinality
        ? { kind: "view", view: { kind: "view", id: "document" }, cardinality }
        : { kind: "panels", empty: { kind: "view", id: "document" } },
      slots: cardinality
        ? []
        : [
            {
              id: "inspector",
              region: "main",
              item: { kind: "view", view: { kind: "view", id: "document" }, presence: "open" },
            },
          ],
    },
  ]);
  const navigate = (file: string, section?: string, open?: "pin" | "preview") =>
    s.w.pageLocations.navigate({
      kind: "page",
      page: pageRef("document-collection"),
      resource: { type: "document", id: "one", metadata: { file } },
      ...(open ? { open } : {}),
      ...(section ? { section: { anchors: [{ id: section, heading: section }] } } : {}),
    });
  return { ...s, navigateDocument: navigate };
};

test("Main tabs belong to the declared document while section changes keep them", () => {
  const s = fixture();
  s.navigateDocument("a");
  s.open("a-local", "main", "pin");
  s.open("a-preview", "side");
  s.navigateDocument("a", "details");
  expect(s.ids("main")).toContain("a-local");
  expect(s.ids("side")).toEqual(["a-preview"]);
  s.navigateDocument("b");
  expect(s.ids("main")).not.toContain("a-local");
  expect(s.ids("side")).toEqual([]);
  s.navigateDocument("a");
  expect(s.ids("main")).toContain("a-local");
});

test("reload restores an optional view's closure for its document", () => {
  const s = fixture();
  s.navigateDocument("a");
  s.w.closePlacement(s.w.layout.listPanelInstances("main")[0]!.placementIdentity!);
  s.navigateDocument("b");
  s.w.pageLocations.dispose();
  const restored = fixture(s.saved);
  restored.navigateDocument("a");
  expect(restored.w.layout.getLayout().regions.main.widgets).toEqual([
    expect.objectContaining({ placementIdentity: expect.objectContaining({ slotId: "$main" }) }),
  ]);
  restored.navigateDocument("b");
  expect(restored.w.layout.getLayout().regions.main.widgets).toEqual([
    expect.objectContaining({ placementIdentity: expect.objectContaining({ slotId: "inspector" }) }),
  ]);
});

test("a new primary document preview survives cleanup of the departing document", () => {
  const s = fixture(undefined, "many");
  s.navigateDocument("a", undefined, "preview");
  const a = s.w.layout.listPanelInstances("main")[0]!;
  s.navigateDocument("b", undefined, "preview");
  expect(s.w.layout.listPanelInstances("main")).toEqual([
    expect.objectContaining({ resource: expect.objectContaining({ metadata: { file: "b" } }) }),
  ]);
  expect(s.w.layout.listPanelInstances("main")[0]!.instanceId).not.toBe(a.instanceId);
});

test("a primary document moved to Side keeps its content while another document opens in Main", () => {
  const s = fixture(undefined, "one");
  s.navigateDocument("a");
  const a = s.w.layout.listPanelInstances("main")[0]!;
  s.w.movePanel(a.instanceId, "side");
  s.navigateDocument("b");
  expect(s.w.layout.listPanelInstances("side")).toEqual([
    expect.objectContaining({
      instanceId: a.instanceId,
      resource: expect.objectContaining({ metadata: { file: "a" } }),
    }),
  ]);
  expect(s.w.layout.listPanelInstances("main")).toEqual([
    expect.objectContaining({ resource: expect.objectContaining({ metadata: { file: "b" } }) }),
  ]);
});

test("another document's view moved into Main restores without reopening the source view", () => {
  const s = fixture();
  s.navigateDocument("a");
  s.w.closePlacement(s.w.layout.listPanelInstances("main")[0]!.placementIdentity!);
  s.navigateDocument("b");
  const b = s.w.layout.listPanelInstances("main")[0]!;
  s.w.movePanel(b.instanceId, "side");
  s.navigateDocument("a");
  s.w.movePanel(b.instanceId, "main");
  s.navigate("alpha-list");
  s.navigateDocument("a");
  expect(
    s.w.layout
      .listPanelInstances("main")
      .filter((p) => p.placementIdentity?.kind === "page" && p.placementIdentity.slotId === "inspector"),
  ).toEqual([
    expect.objectContaining({
      instanceId: b.instanceId,
      resource: expect.objectContaining({ metadata: { file: "b" } }),
    }),
  ]);
});

test.each(["close", "pin"] as const)("%s targets a foreign document moved into the current Main", (action) => {
  const s = fixture(undefined, action === "pin" ? "many" : undefined);
  s.navigateDocument("b");
  const b = s.w.layout.listPanelInstances("main")[0]!;
  s.w.movePanel(b.instanceId, "side");
  s.navigateDocument("a", undefined, action === "pin" ? "pin" : undefined);
  const a = s.w.layout.listPanelInstances("main")[0]!;
  s.w.movePanel(b.instanceId, "main");
  if (action === "close") s.w.closePlacement(b.placementIdentity!);
  else {
    s.w.pinPlacement(b.placementIdentity!, false);
    expect(s.w.layout.listPanelInstances("main").find((tab) => tab.instanceId === b.instanceId)?.tabRetention).toBe(
      "preview",
    );
    s.w.pinPlacement(b.placementIdentity!, true);
  }
  expect(s.w.pages.store.getState().location?.resource?.metadata?.file).toBe("a");
  expect(s.w.layout.listPanelInstances("main").some((tab) => tab.instanceId === a.instanceId)).toBe(true);
  s.navigate("alpha-list");
  s.navigateDocument("a", undefined, action === "pin" ? "pin" : undefined);
  expect(s.w.layout.listPanelInstances("main").some((tab) => tab.instanceId === a.instanceId)).toBe(true);
});
