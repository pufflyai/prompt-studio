import { expect, test } from "bun:test";
import { createResourceViewerFixture } from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { tabDragDestinations } from "./tab-drag-destinations";

for (const tabs of [false, true])
  test(`Main ${tabs ? "tab" : "page"} dragging requires an open auxiliary destination`, async () => {
    const { w, openMain } = createResourceViewerFixture({ tabs });
    await openMain("a");
    const id = tabs ? w.layout.getActivePanel("main")!.instanceId : w.pages.getContent()!.widgetId;
    for (const region of ["side", "secondary"] as const) w.shell.setRegionOpen(region, false);
    expect(tabDragDestinations(w, id).filter((region) => region !== "main")).toEqual([]);
    for (const region of ["side", "secondary"] as const) {
      w.shell.setRegionOpen(region, true);
      expect(tabDragDestinations(w, id)).toContain(region);
      w.shell.setRegionOpen(region, false);
      expect(tabDragDestinations(w, id)).not.toContain(region);
      // An explicit menu/command move can still open a closed destination.
      expect(w.getPanelDestinations(id)).toContain(region);
    }
    w.movePanel(id, "side");
    expect(w.layout.getActivePanel("side")?.resource?.id).toBe("a");
  });

test("auxiliary tabs can still move to Main or an available closed auxiliary panel", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("a");
  w.shell.setRegionOpen("secondary", false);
  expect(tabDragDestinations(w, side().instanceId)).toContain("secondary");
  expect(tabDragDestinations(w, side().instanceId)).toContain("main");
});
