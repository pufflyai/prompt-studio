import { expect, test } from "bun:test";
import { harness, navigate, openFile, panel, resource } from "../composition/placement-lifecycle-test-support";

const prepared = async (saved = new Map()) => {
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("saved-side"), open: "pin" });
  w.shell.setSidePanelPresentation("closed");
  for (const id of ["one", "two"]) await w.navigation.openTarget({ ...openFile(id), region: "secondary", open: "pin" });
  const first = w.layout.getLayout().regions.secondary.widgets[0]!;
  w.layout.activateWidget(first.widgetId);
  w.focus.setActiveRegion("secondary");
  return w;
};

for (const position of ["left", "right"] as const) {
  test(`moving Bottom ${position} swaps the closed Side tray and preserves both after reload`, async () => {
    const saved = new Map();
    const w = await prepared(saved);
    w.shell.setRegionSize("side", 400);
    w.shell.setRegionSize("secondary", 240);
    const before = w.layout.getLayout();
    const secondary = before.regions.secondary;
    const side = before.regions.side;

    await w.commands.executeCommand("workbench.repositionPanel", { region: "secondary", position });

    const after = w.layout.getLayout();
    expect(after.regions.side.widgets).toEqual(secondary.widgets);
    expect(after.regions.side.activeWidgetId).toBe(secondary.activeWidgetId);
    expect(after.regions.side.id).toBe("side");
    expect(after.regions.side.size).toBe(400);
    expect(w.sidePanel.getMode()).toBe("attached");
    expect(w.shell.getArrangement().side).toBe(position);
    expect(after.regions.secondary.widgets).toEqual(side.widgets);
    expect(after.regions.secondary.activeWidgetId).toBe(side.activeWidgetId);
    expect(after.regions.secondary.id).toBe("secondary");
    expect(after.regions.secondary.size).toBe(240);
    expect(after.regions.secondary.visible).toBe(false);
    expect(after.activeWidgetId).toBe(before.activeWidgetId);
    expect(w.focus.getActiveRegion()).toBe("side");
    expect(after.regions.main).toEqual(before.regions.main);

    const restored = harness(saved);
    await restored.navigation.openTarget(navigate("alpha"));
    expect(restored.layout.getLayout().regions.side.widgets.map((tab) => tab.widgetId)).toEqual(
      secondary.widgets.map((tab) => tab.widgetId),
    );
    expect(restored.layout.getLayout().regions.secondary.widgets.map((tab) => tab.widgetId)).toEqual(
      side.widgets.map((tab) => tab.widgetId),
    );
    expect(restored.sidePanel.getMode()).toBe("attached");
    expect(restored.shell.getRegionState("secondary").open).toBe(false);
  });
}

test("an open Side panel cannot be replaced by moving Bottom", async () => {
  const w = await prepared();
  w.shell.setRegionOpen("side", true);
  const before = w.layout.getLayout();
  expect(w.shell.getPanelPositions("secondary")).not.toContain("right");
  expect(() => w.shell.repositionPanel("secondary", "right")).toThrow("cannot move");
  expect(w.layout.getLayout()).toBe(before);
});

test("swap destinations enforce the live movement, open, close and tab policies before changing either tray", async () => {
  const w = await prepared();
  const mode = w.modes.getMode("edit")!;
  for (const regionSettings of [
    { side: { movable: false } },
    { side: { canOpen: false } },
    { side: { acceptsTabs: false } },
    { secondary: { movable: false } },
    { secondary: { canClose: false } },
    { secondary: { acceptsTabs: false } },
  ]) {
    mode.regionSettings = regionSettings;
    const before = w.layout.getLayout();
    expect(w.shell.getPanelPositions("secondary")).not.toContain("left");
    expect(() => w.shell.repositionPanel("secondary", "left")).toThrow("cannot move");
    expect(w.layout.getLayout()).toBe(before);
  }
});
