import { expect, test } from "bun:test";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

const fixture = (presence: "fixed" | "open" = "fixed", saved: Parameters<typeof modePanelFixture>[0] = new Map()) =>
  modePanelFixture(saved, true, [
    {
      id: "collection",
      ref: pageRef("collection"),
      path: "collection",
      modeId: "alpha",
      resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
      main: { kind: "panels", empty: { kind: "view", id: "document" } },
      slots: [
        {
          id: "files",
          region: "main",
          item: { kind: "view", view: { kind: "view", id: "document" }, presence },
        },
      ],
    },
  ]);

test("fixed views belong to each resource when a panel collection changes resources", () => {
  const s = fixture();
  for (const id of ["a", "b", "a"]) {
    s.navigate("collection", id);
    expect(s.ids("main")).toEqual([id]);
    expect(s.w.layout.getLayout().regions.main.widgets[0]?.placementIdentity).toMatchObject({ slotId: "files" });
  }
});

test("closing a moved optional view changes only its source resource", () => {
  const s = fixture("open");
  s.navigate("collection", "a");
  const a = s.w.layout.listPanelInstances("main")[0]!;
  s.w.movePanel(a.instanceId, "side");
  s.navigate("collection", "b");
  s.w.closePlacement(a.placementIdentity!);
  expect(s.ids("main")).toEqual(["b"]);
  s.navigate("collection", "a");
  expect(
    s.w.layout
      .getLayout()
      .regions.main.widgets.map((tab) =>
        tab.placementIdentity?.kind === "page" ? tab.placementIdentity.slotId : undefined,
      ),
  ).toEqual(["$main"]);
  s.navigate("collection", "b");
  expect(
    s.w.layout
      .getLayout()
      .regions.main.widgets.map((tab) =>
        tab.placementIdentity?.kind === "page" ? tab.placementIdentity.slotId : undefined,
      ),
  ).toEqual(["files"]);
});

test("reload does not reopen a resource's closed view because another resource has the same slot in Side", () => {
  const s = fixture("open");
  s.navigate("collection", "a");
  s.w.closePlacement(s.w.layout.listPanelInstances("main")[0]!.placementIdentity!);
  s.navigate("collection", "b");
  s.w.movePanel(s.w.layout.listPanelInstances("main")[0]!.instanceId, "side");
  s.navigate("collection", "a");
  expect(
    s.w.layout
      .getLayout()
      .regions.main.widgets.map((tab) =>
        tab.placementIdentity?.kind === "page" ? tab.placementIdentity.slotId : undefined,
      ),
  ).toEqual(["$main"]);
  s.w.pageLocations.dispose();
  const restored = fixture("open", s.saved);
  restored.navigate("collection", "a");
  expect(restored.ids("side")).toEqual(["b"]);
  expect(
    restored.w.layout
      .getLayout()
      .regions.main.widgets.map((tab) =>
        tab.placementIdentity?.kind === "page" ? tab.placementIdentity.slotId : undefined,
      ),
  ).toEqual(["$main"]);
});

test.each(["side", "secondary"] as const)("a moved fixed view retains its resource in %s", (region) => {
  const s = fixture();
  s.navigate("collection", "a");
  const a = s.w.layout.listPanelInstances("main")[0]!;
  s.w.movePanel(a.instanceId, region);
  s.navigate("collection", "b");
  expect(s.ids(region)).toEqual(["a"]);
  expect(s.ids("main")).toEqual(["b"]);
  expect(s.w.layout.listPanelInstances("main")[0]?.instanceId).not.toBe(a.instanceId);
  s.navigate("collection", "a");
  expect(s.ids(region)).toEqual(["a"]);
  expect(
    s.w.layout
      .getLayout()
      .regions.main.widgets.some(
        (tab) => (tab.placementIdentity?.kind === "page" ? tab.placementIdentity.slotId : undefined) === "files",
      ),
  ).toBe(false);
  s.navigate("collection", "b");
  expect(s.ids("main")).toEqual(["b"]);
});
