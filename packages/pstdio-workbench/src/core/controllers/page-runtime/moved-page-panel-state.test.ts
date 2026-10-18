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
