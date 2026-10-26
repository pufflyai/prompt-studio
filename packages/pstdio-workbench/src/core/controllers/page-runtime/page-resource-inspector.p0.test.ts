import { expect, test } from "bun:test";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

test("a shared single-resource inspector follows its page's newly selected resource", () => {
  const s = modePanelFixture(undefined, true, [
    {
      id: "reader",
      ref: pageRef("reader"),
      path: "reader",
      modeId: "alpha",
      parentId: "alpha",
      resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
      main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
      slots: [
        {
          id: "inspector",
          region: "side",
          openOn: "page-resource",
          item: {
            kind: "binding",
            binding: {
              kinds: [{ kind: "resource-kind", id: "document" }],
              view: { kind: "view", id: "document" },
              cardinality: "one",
            },
          },
        },
      ],
    },
  ]);
  s.navigate("reader", "a");
  const original = s.w.layout.listPanelInstances("side")[0]!;
  s.navigate("reader", "b");
  expect(s.ids("side")).toEqual(["b"]);
  expect(s.w.layout.listPanelInstances("side")[0]?.instanceId).toBe(original.instanceId);
  s.navigate("reader", "a");
  expect(s.ids("side")).toEqual(["a"]);
});

test("removing the routed resource preserves a different pinned Side tab", () => {
  const s = modePanelFixture();
  s.open("a", "side", "pin");
  s.w.shell.setRegionOpen("side", true);
  s.navigate("document", "b");
  s.w.pageLocations.removeResource({ type: "document", id: "b" }, []);
  expect(s.ids("side")).toEqual(["a"]);
  expect(s.w.shell.getRegionState("side").open).toBe(true);
});
