import { expect, test } from "bun:test";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

const inspectorFixture = (cardinality: "one" | "many", saved?: Parameters<typeof modePanelFixture>[0]) => {
  return modePanelFixture(saved, true, [
    {
      id: "inspector",
      ref: pageRef("inspector"),
      path: "inspector",
      modeId: "alpha",
      parentId: "alpha",
      resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
      main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
      slots: [
        {
          id: "detail",
          region: "side",
          openOn: "page-resource",
          item: {
            kind: "binding",
            binding: {
              kinds: [{ kind: "resource-kind", id: "document" }],
              view: { kind: "view", id: "document" },
              cardinality,
            },
          },
        },
      ],
    },
  ]);
};

test.each([
  "one",
  "many",
] as const)("a moved %s resource tab returns to its chosen panel within a mode", (cardinality) => {
  const s = inspectorFixture(cardinality);
  s.navigate("inspector", "ticket");
  const original = s.w.layout.listPanelInstances("side")[0]!;
  s.w.movePanel(original.instanceId, "secondary");
  s.navigate("alpha");
  s.navigate("inspector", "ticket");
  expect(s.w.layout.listPanelInstances("secondary").map((tab) => tab.instanceId)).toContain(original.instanceId);
  expect(s.w.layout.listPanelInstances("side")).toEqual([]);
  expect(s.w.shell.getRegionState("secondary").open).toBe(true);
  s.navigate("beta");
  s.navigate("inspector", "ticket");
  expect(s.w.layout.listPanelInstances("secondary").map((tab) => tab.instanceId)).toContain(original.instanceId);
  expect(s.w.layout.listPanelInstances("side")).toEqual([]);

  const restored = inspectorFixture(cardinality, s.saved);
  restored.navigate("inspector", "ticket");
  expect(restored.w.layout.listPanelInstances("secondary").map((tab) => tab.instanceId)).toContain(original.instanceId);
  expect(restored.w.layout.listPanelInstances("side")).toEqual([]);
});

test("returning to a page keeps its tab position and the mode's latest shared tab order", () => {
  const s = inspectorFixture("one");
  s.navigate("inspector", "ticket");
  const detail = s.w.layout.listPanelInstances("side")[0]!;
  s.open("one", "side", "pin");
  s.open("two", "side", "pin");
  s.w.movePanel(detail.instanceId, "side", "end");
  expect(s.ids("side")).toEqual(["one", "two", "ticket"]);

  s.navigate("alpha");
  const tabs = s.w.layout.listPanelInstances("side");
  s.w.movePanel(tabs.find((tab) => tab.resource?.id === "two")!.instanceId, "side", "start");
  s.navigate("inspector", "ticket");
  expect(s.ids("side")).toEqual(["two", "one", "ticket"]);
});

test("a single resource page replaces its conversation in the chosen region", () => {
  const s = inspectorFixture("one");
  s.navigate("inspector", "first");
  const page = s.w.layout.getLayout().regions.main.widgets[0]!;
  s.w.movePanel(page.widgetId, "secondary");
  s.navigate("inspector", "second");
  const primary = () =>
    Object.values(s.w.layout.getLayout().regions)
      .flatMap((r) => r.widgets)
      .filter(
        (p) =>
          p.placementIdentity?.kind === "page" &&
          p.placementIdentity.slotId === "$main" &&
          p.placementIdentity.pageId === "inspector",
      );
  expect(primary()).toHaveLength(1);
  expect(s.w.layout.getLayout().regions.secondary.widgets).toContainEqual(
    expect.objectContaining({ resource: { type: "document", id: "second" } }),
  );
  s.w.pageLocations.goBack();
  expect(primary()).toHaveLength(1);
  expect(primary()[0]?.resource?.id).toBe("first");
  expect(s.w.layout.getLayout().regions.secondary.widgets).toContainEqual(primary()[0]);
});

test.each([
  false,
  true,
])("a single-view parent and resource page keep the chosen region; visit another page=%s", (away) => {
  const s = inspectorFixture("one");
  const root = s.w.layout.getLayout().regions.main.widgets[0]!;
  s.w.movePanel(root.widgetId, "secondary");
  if (away) s.navigate("alpha-list");
  s.navigate("inspector", "first");
  expect(s.w.layout.getLayout().regions.secondary.widgets).toContainEqual(
    expect.objectContaining({ role: "location", resource: { type: "document", id: "first" } }),
  );
  expect(s.w.layout.getLayout().regions.secondary.widgets.some((p) => p.widgetId === root.widgetId)).toBe(false);
});

test("a single-resource panel keeps its region when selected from another active page", () => {
  const s = inspectorFixture("one");
  s.navigate("inspector", "first");
  s.w.movePanel(s.w.layout.getLayout().regions.main.widgets[0]!.widgetId, "side");
  s.navigate("alpha-list");
  s.navigate("inspector", "second");
  expect(s.w.layout.getLayout().regions.side.widgets).toContainEqual(
    expect.objectContaining({ role: "location", resource: { type: "document", id: "second" } }),
  );
});
