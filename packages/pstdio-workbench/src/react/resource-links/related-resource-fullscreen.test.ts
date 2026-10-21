import { expect, test } from "bun:test";
import { opening, setup } from "./related-resource-openings.fixture";

test("automatic preview departure dismisses its temporary Side overlay", async () => {
  const s = setup([opening("related")]);
  await s.controller.open(s.source);
  s.workbench.fullscreen.enter();
  expect(s.workbench.fullscreen.store.getState().sideOpen).toBe(true);
  s.workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "example", id: "home" } });
  expect(s.workbench.fullscreen.store.getState()).toEqual({ active: true, sideOpen: false });
  s.controller.dispose();
});

test("fullscreen preserves automatic preview cleanup and remembered panel closure", async () => {
  const s = setup([opening("related")]);
  const w = s.workbench;
  await s.controller.open(s.source);
  w.fullscreen.enter();
  w.fullscreen.hideSide();
  w.shell.setRegionOpen("side", false);
  w.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "example", id: "home" } });
  expect(w.fullscreen.store.getState().active).toBe(true);
  expect(w.layout.listPanelInstances("side")).toEqual([]);
  expect(w.fullscreen.store.getState().sideOpen).toBe(false);
  w.pageLocations.navigate(s.target(s.source));
  await s.controller.open(s.source);
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("related");
  expect(w.sidePanel.getMode()).toBe("closed");
  w.fullscreen.exit();
  expect(w.sidePanel.getMode()).toBe("closed");
  s.controller.dispose();
});
