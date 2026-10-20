import { expect, test } from "bun:test";
import { harness, navigate, openFile, panel, resource } from "./placement-lifecycle-test-support";

test("panel reset uses authored defaults rather than the snapshot loaded at startup", async () => {
  const initial = harness().layout.getLayout();
  initial.regions.side.size = 555;
  initial.regions.side.presentation = "attached";
  const w = harness(new Map([[undefined, initial]]));
  await w.navigation.openTarget(navigate("alpha"));
  w.resetPanelLayout();
  expect(w.layout.getLayout().regions.side.size).toBeUndefined();
  expect(w.sidePanel.getMode()).toBe("floating");
});

test("panel reset keeps moved resources, tab identity, selection and other pages through reload", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ ...openFile("draft"), open: "pin" });
  const draft = w.layout.getActivePanel("main")!;
  w.movePanel(draft.instanceId, "secondary");
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("manual"), open: "pin" });
  const before = w.layout.getLayout();
  w.layout.setRegionSize("side", 555);
  w.layout.restoreLayout({
    ...w.layout.getLayout(),
    regions: { ...w.layout.getLayout().regions, side: { ...w.layout.getLayout().regions.side, headerVisible: false } },
  });
  await w.commands.executeCommand("workbench.resetPanelLayout");
  const after = w.layout.getLayout();
  for (const id of ["main", "side", "secondary"] as const) {
    expect(after.regions[id].widgets).toEqual(before.regions[id].widgets);
    expect(after.regions[id].activeWidgetId).toBe(before.regions[id].activeWidgetId);
  }
  expect(after.regions.side.size).toBeUndefined();
  expect(after.regions.side.headerVisible).toBeUndefined();
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getActivePanel("secondary")?.instanceId).toBe(draft.instanceId);
  const restored = harness(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.getActivePanel("secondary")?.resource?.id).toBe("draft");
  expect(restored.layout.listPanelInstances("side").map((p) => p.resource?.id)).toEqual(["manual"]);
});

test("panel reset respects unavailable panels and open, close and size permissions", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  w.shell.setRegionOpen("side", false);
  const mode = w.modes.getMode("edit")!;
  mode.panels = ["main", "side"];
  mode.regionSettings = { side: { canOpen: false } };
  w.resetPanelLayout();
  expect(w.layout.getLayout().regions.side.visible).toBe(false);
  expect(w.layout.getLayout().regions.secondary.visible).toBe(false);
  mode.regionSettings = { side: { canClose: false, size: { defaultPx: 320, minPx: 320, maxPx: 320 } } };
  w.resetPanelLayout();
  expect(w.layout.getLayout().regions.side.visible).toBe(true);
  expect(w.layout.getRegionSize("side")).toMatchObject({ defaultPx: 320 });
});
