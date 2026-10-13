import { expect, test } from "bun:test";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "../../../react/terminal/terminal-module";
import { terminalPlacementBindingId } from "../../../react/terminal/terminal-placement-binding";
import { harness, navigate, panel, resource } from "./placement-lifecycle-test-support";

const target = { kind: "panel" as const, panel, resource: resource("session"), open: "preview" as const };

test("an explicit pin open updates an existing transferred tab in the current page", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(target);
  const tab = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(tab.widgetId, "main");
  const moved = w.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === tab.widgetId)!;
  await w.navigation.openTarget({ ...target, open: "pin" });
  const pinned = w.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === tab.widgetId)!;
  expect(pinned.tabRetention).toBe("persistent");
  expect(pinned.resource).toEqual(tab.resource);
  expect(pinned.placementIdentity).toEqual(moved.placementIdentity);
  await w.navigation.openTarget(target);
  expect(w.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === tab.widgetId)?.tabRetention).toBe(
    "persistent",
  );
});

test("a pin open on another page keeps the transferred tab in its owner and pins a separate mode instance", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(target);
  const tab = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(tab.widgetId, "main");
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget({ ...target, open: "pin" });
  const pinned = w.layout.getLayout().regions.side.widgets[0]!;
  expect(pinned.widgetId).not.toBe(tab.widgetId);
  expect(pinned.tabRetention).toBe("persistent");
  expect(w.layout.getLayout().regions.main.widgets.some((p) => p.widgetId === tab.widgetId)).toBe(false);
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === tab.widgetId)?.tabRetention).toBe(
    "preview",
  );
  expect(w.layout.getLayout().regions.side.widgets[0]?.widgetId).toBe(pinned.widgetId);
});

test("a moved terminal receives source registry label updates without changing its owner or binding", async () => {
  const w = harness();
  w.registerModule(createWorkbenchTerminalModule());
  await w.navigation.openTarget(navigate("alpha"));
  const tab = openWorkbenchTerminal(w);
  w.movePanel(tab.instanceId, "side");
  const moved = w.layout.getLayout().regions.side.widgets[0]!;
  w.shellPlacements.updatePlacement(tab.placementIdentity!, { resource: { ...tab.resource!, label: "zsh" } });
  const updated = w.layout.getLayout().regions.side.widgets.find((p) => p.widgetId === tab.instanceId)!;
  expect(updated.resource?.label).toBe("zsh");
  expect(updated.resource?.id).toBe(tab.resource!.id);
  expect(updated.placementIdentity).toEqual(moved.placementIdentity);
  expect(updated.viewId).toBe(moved.viewId);
  expect(terminalPlacementBindingId(updated.widgetId)).toBe(terminalPlacementBindingId(tab.instanceId));
});

test("a moved mode resource receives source registry updates in its destination page", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(target);
  const original = w.layout.getLayout().regions.side.widgets[0]!;
  w.movePanel(original.widgetId, "main");
  const moved = w.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === original.widgetId)!;
  w.modePlacements.updatePlacement(original.placementIdentity!, {
    resource: { ...resource("session"), label: "Updated" },
    open: "pin",
  });
  const updated = w.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === original.widgetId)!;
  expect(updated.resource?.label).toBe("Updated");
  expect(updated.tabRetention).toBe("persistent");
  expect(updated.placementIdentity).toEqual(moved.placementIdentity);
  expect(updated.viewId).toBe(original.viewId);
});

test("a transferred terminal label update reaches its saved page while that page is inactive", async () => {
  const w = harness();
  w.registerModule(createWorkbenchTerminalModule());
  await w.navigation.openTarget(navigate("alpha"));
  const tab = openWorkbenchTerminal(w);
  w.movePanel(tab.instanceId, "side");
  w.movePanel(tab.instanceId, "main");
  const moved = w.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === tab.instanceId)!;
  await w.navigation.openTarget(navigate("beta"));
  w.shellPlacements.updatePlacement(tab.placementIdentity!, { resource: { ...tab.resource!, label: "zsh" } });
  await w.navigation.openTarget(navigate("alpha"));
  const updated = w.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === tab.instanceId)!;
  expect(updated.resource?.label).toBe("zsh");
  expect(updated.placementIdentity).toEqual(moved.placementIdentity);
  expect(updated.viewId).toBe(moved.viewId);
});
