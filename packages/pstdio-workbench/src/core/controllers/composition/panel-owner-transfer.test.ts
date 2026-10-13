import { expect, test } from "bun:test";
import { toPanelInstance } from "../../registries/layout/panel-api";
import { harness, navigate, openFile, panel, resource } from "./placement-lifecycle-test-support";

test("a closed transferred tab can reopen through its original declaration", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("file"));
  const file = w.layout.getLayout().regions.main.widgets[0]!;
  w.movePanel(file.widgetId, "side");
  w.closePlacement(w.layout.getLayout().regions.side.widgets[0]!.placementIdentity!);
  await w.navigation.openTarget(openFile("file"));
  expect(w.layout.getLayout().regions.main.widgets[0]?.resource).toEqual(resource("file"));
});

test("opening a transferred declaration selects the existing tab in its actual destination", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("file"));
  const file = w.layout.getLayout().regions.main.widgets[0]!;
  w.movePanel(file.widgetId, "side");
  await w.navigation.openTarget({ kind: "panel", panel, resource: resource("session"), open: "pin" });
  w.sidePanel.setMode("closed");
  await w.navigation.openTarget(openFile("file"));
  expect(w.layout.getLayout().activeWidgetId).toBe(file.widgetId);
  expect(w.layout.getLayout().regions.side.activeWidgetId).toBe(file.widgetId);
  expect(w.sidePanel.getMode()).toBe("attached");
  expect(w.layout.getLayout().regions.main.widgets).toHaveLength(0);
});

test("transferred tabs rehydrate live tab callbacks after serialization", async () => {
  const saved = new Map();
  const create = (customTab = true) => {
    const w = harness(saved);
    w.modePlacements.registerPlacement({
      id: "tools",
      ref: { kind: "placement", extensionId: "test", id: "tools" },
      modeId: "edit",
      region: "side",
      item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "open" },
      ...(customTab ? { tab: { getSnapshot: () => ({ label: "Live tools" }) } } : {}),
    });
    return w;
  };
  const source = create();
  await source.navigation.openTarget(navigate("alpha"));
  const tab = source.layout.getLayout().regions.side.widgets[0]!;
  source.movePanel(tab.widgetId, "main");
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const restored = create();
  await restored.navigation.openTarget(navigate("alpha"));
  const placement = restored.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === tab.widgetId)!;
  expect(placement.tab?.getSnapshot(toPanelInstance(placement))).toEqual({ label: "Live tools" });
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const withoutCustomization = create(false);
  await withoutCustomization.navigation.openTarget(navigate("alpha"));
  expect(
    withoutCustomization.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === tab.widgetId)?.tab,
  ).toBeUndefined();
});

test("a transferred tab cannot return after its contribution is unregistered", async () => {
  const w = harness();
  const registration = w.modePlacements.registerPlacement({
    id: "tools",
    ref: { kind: "placement", extensionId: "test", id: "tools" },
    modeId: "edit",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "open" },
  });
  await w.navigation.openTarget(navigate("alpha"));
  const tab = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(tab.widgetId, "main");
  await w.navigation.openTarget(navigate("beta"));
  registration.dispose();
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.main.widgets.some((p) => p.widgetId === tab.widgetId)).toBe(false);
});
