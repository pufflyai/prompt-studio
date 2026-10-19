import { expect, test } from "bun:test";
import { harness, navigate, panel, resource } from "./placement-lifecycle-test-support";

for (const region of ["side", "secondary"] as const) {
  test(`${region} rejects navigation and tab drops before changing layout`, async () => {
    const w = harness();
    await w.navigation.openTarget(navigate("alpha"));
    await w.navigation.openTarget({ kind: "panel", panel, resource: resource("one"), open: "pin" });
    const tab = w.layout.getActivePanel("side")!;
    w.modes.getMode("edit")!.regionSettings = { [region]: { acceptsTabs: false } };
    const before = w.layout.getLayout();
    expect(w.getPanelDestinations(tab.instanceId)).not.toContain(region);
    expect(() => w.movePanel(tab.instanceId, region)).toThrow("cannot move");
    await expect(w.navigation.openTarget({ kind: "panel", panel, region, resource: resource("two") })).rejects.toThrow(
      "accept tabs",
    );
    expect(w.layout.getLayout()).toBe(before);
  });
}

test("compound navigation cannot reveal a forbidden panel or publish part of the page change", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  w.shell.setRegionOpen("side", false);
  w.modes.getMode("edit")!.regionSettings = { side: { canOpen: false } };
  const before = w.layout.getLayout();
  await expect(
    w.navigation.openTarget({
      kind: "compound",
      targets: [navigate("beta"), { kind: "panel", panel, resource: resource("two") }],
    }),
  ).rejects.toThrow("cannot open");
  expect(w.layout.getLayout()).toBe(before);
  expect(w.pages.store.getState().location?.resource?.id).toBe("alpha");
});

test("reused tabs cannot move into a forbidden destination, but existing tabs remain usable", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  const target = { kind: "panel", panel, resource: resource("one"), open: "pin" } as const;
  await w.navigation.openTarget(target);
  w.modes.getMode("edit")!.regionSettings = { secondary: { acceptsTabs: false }, side: { acceptsTabs: false } };
  const before = w.layout.getLayout();
  await expect(w.navigation.openTarget({ ...target, region: "secondary" })).rejects.toThrow("accept tabs");
  expect(w.layout.getLayout()).toBe(before);
  await w.navigation.openTarget(target);
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("one");
});

test("a single page panel open enforces the destination policy", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  w.modes.getMode("edit")!.regionSettings = { secondary: { acceptsTabs: false } };
  const before = w.layout.getLayout();
  await expect(
    w.navigation.openTarget({
      kind: "panel",
      panel: { kind: "page-slot", page: { kind: "page", extensionId: "test", id: "workspace" }, id: "files" },
      region: "secondary",
      resource: resource("one"),
    }),
  ).rejects.toThrow("accept tabs");
  expect(w.layout.getLayout()).toBe(before);
});

test("closing the final tab collapses an optional panel and preserves a nonclosing surface", async () => {
  for (const canClose of [true, false]) {
    const w = harness();
    await w.navigation.openTarget(navigate("alpha"));
    w.modes.getMode("edit")!.regionSettings = { side: { canClose } };
    await w.navigation.openTarget({ kind: "panel", panel, resource: resource("one"), open: "pin" });
    w.closePlacement(w.layout.getActivePanel("side")!.placementIdentity!);
    expect(w.layout.listPanelInstances("side")).toEqual([]);
    expect(w.shell.getRegionState("side").open).toBe(!canClose);
  }
});

test("reset clears header choices read from persisted layout", async () => {
  const saved = new Map();
  const initial = harness().layout.getLayout();
  initial.regions.side.headerVisible = true;
  saved.set(undefined, initial);
  const w = harness(saved);
  w.modes.getMode("edit")!.regionSettings = { side: { showHeader: false } };
  await w.navigation.openTarget(navigate("alpha"));
  w.shell.setHeaderVisible("side", true);
  w.resetLayout();
  expect(w.layout.getLayout().regions.side.headerVisible).toBeUndefined();
  expect(w.shell.getPanelPolicy("side").showHeader).toBe(false);
});
