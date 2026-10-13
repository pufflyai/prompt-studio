import { expect, test } from "bun:test";
import { harness, navigate, openFile, panel, resource } from "../composition/placement-lifecycle-test-support";

const target = (id: string) => ({ kind: "panel" as const, panel, resource: resource(id), open: "pin" as const });

test("a direct mode open selects its existing tab after transfer into a page", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(target("session"));
  const moved = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(moved.widgetId, "main");
  await w.navigation.openTarget(openFile("other"));
  await w.navigation.openTarget(target("session"));
  expect(w.layout.getLayout().activeWidgetId).toBe(moved.widgetId);
  expect(w.layout.getLayout().regions.main.activeWidgetId).toBe(moved.widgetId);
  expect(w.layout.getLayout().regions.side.widgets).toHaveLength(0);
});

test("a direct mode open on another page creates a separate tab from the transferred instance", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(target("same"));
  const moved = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(moved.widgetId, "main");
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(target("same"));
  const reopened = w.layout.getLayout().regions.side.widgets[0]!;
  expect(reopened?.resource?.id).toBe("same");
  expect(reopened?.widgetId).not.toBe(moved.widgetId);
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.main.widgets.some((p) => p.widgetId === moved.widgetId)).toBe(true);
  expect(w.layout.getLayout().regions.side.widgets[0]?.widgetId).toBe(reopened.widgetId);
});

test("Add focuses a transferred declared tool in its current panel", async () => {
  const w = harness();
  w.modePlacements.registerPlacement({
    id: "tools",
    ref: { kind: "placement", extensionId: "test", id: "tools" },
    modeId: "edit",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "open" },
  });
  await w.navigation.openTarget(navigate("alpha"));
  const moved = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(moved.widgetId, "main");
  await w.navigation.openTarget(openFile("other"));
  const add = w.composition.panelsFor("secondary").addable.find((p) => p.panelId === moved.contributionId)!;
  await add.open!();
  expect(w.layout.getLayout().regions.main.activeWidgetId).toBe(moved.widgetId);
  expect(w.layout.getLayout().activeWidgetId).toBe(moved.widgetId);
  expect(w.focus.getActiveRegion()).toBe("main");
  expect(w.layout.getLayout().regions.secondary.widgets).toHaveLength(0);
});

test("a transferred fixed mode tool stays in its page after navigation and reload", async () => {
  const saved = new Map();
  const create = () => {
    const w = harness(saved);
    w.modePlacements.registerPlacement({
      id: "tools",
      ref: { kind: "placement", extensionId: "test", id: "tools" },
      modeId: "edit",
      region: "secondary",
      item: { kind: "view", view: { kind: "view", id: "editor" }, presence: "fixed" },
    });
    return w;
  };
  const w = create();
  await w.navigation.openTarget(navigate("alpha"));
  const moved = w.layout.getLayout().regions.secondary.widgets[0]!;
  w.movePanel(moved.widgetId, "main");
  await w.navigation.openTarget(navigate("beta"));
  expect(w.layout.getLayout().regions.secondary.widgets).toHaveLength(0);
  for (const [scope, layout] of saved) saved.set(scope, JSON.parse(JSON.stringify(layout)));
  const restored = create();
  await restored.navigation.openTarget(navigate("beta"));
  expect(restored.layout.getLayout().regions.secondary.widgets).toHaveLength(0);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.layout.getLayout().regions.main.widgets.some((p) => p.widgetId === moved.widgetId)).toBe(true);
});

test("reopening a page declaration creates a new instance when its original belongs to another page", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ ...openFile("same"), open: "pin" });
  const moved = w.layout.getLayout().regions.main.widgets[0]!;
  w.movePanel(moved.widgetId, "side");
  await w.navigation.openTarget(navigate("beta"));
  w.movePanel(moved.widgetId, "main");
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ ...openFile("same"), open: "pin" });
  expect(w.layout.getLayout().regions.main.widgets[0]?.widgetId).not.toBe(moved.widgetId);
  await w.navigation.openTarget(navigate("beta"));
  expect(w.layout.getLayout().regions.main.widgets.some((p) => p.widgetId === moved.widgetId)).toBe(true);
});
