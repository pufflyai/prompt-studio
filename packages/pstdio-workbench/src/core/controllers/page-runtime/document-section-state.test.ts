import { expect, test } from "bun:test";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

const fixture = (saved: Parameters<typeof modePanelFixture>[0] = new Map(), main: "view" | "panels" = "view") => {
  const s = modePanelFixture(saved, true, [
    {
      id: "section-page",
      ref: pageRef("section-page"),
      path: "section-page",
      modeId: "alpha",
      parentId: "alpha",
      resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
      document: { metadataKey: "file" },
      main:
        main === "view"
          ? { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" }
          : { kind: "panels", empty: { kind: "view", id: "document" } },
      slots: [
        {
          id: "optional",
          region: "main",
          item: { kind: "view", view: { kind: "view", id: "document" }, presence: "open" },
        },
      ],
    },
  ]);
  const navigate = (section: string, file = "a.md") =>
    s.w.pageLocations.navigate({
      kind: "page",
      page: pageRef("section-page"),
      resource: { type: "document", id: "one", metadata: { file } },
      section: { anchors: [{ id: section, heading: section }] },
    });
  const optional = () =>
    s.w.layout
      .listPanelInstances("main")
      .filter((tab) => tab.placementIdentity?.kind === "page" && tab.placementIdentity.slotId === "optional");
  return { ...s, navigate, optional };
};

test.each([
  "view",
  "panels",
] as const)("optional Main closure belongs to the document across section returns and reload with %s Main", (main) => {
  const s = fixture(undefined, main);
  s.navigate("A");
  expect(s.optional()).toHaveLength(1);
  s.navigate("B");
  s.w.closePlacement(s.optional()[0]!.placementIdentity!);
  expect(s.optional()).toEqual([]);
  s.navigate("A");
  expect(s.optional()).toEqual([]);
  s.navigate("A", "b.md");
  expect(s.optional()).toHaveLength(1);
  s.navigate("B");
  expect(s.optional()).toEqual([]);
  s.w.pageLocations.dispose();
  const restored = fixture(s.saved, main);
  restored.navigate("A");
  expect(restored.optional()).toEqual([]);
  restored.navigate("B", "b.md");
  expect(restored.optional()).toHaveLength(1);
});
