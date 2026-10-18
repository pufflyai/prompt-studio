import { expect, test } from "bun:test";
import { modePanelFixture } from "./mode-panel-state.fixture";

test("each mode restores its own shared tabs, selection, panel visibility and sizes", () => {
  const s = modePanelFixture();
  s.open("alpha-pin", "side", "pin");
  s.open("alpha-preview", "side");
  s.open("alpha-bottom", "secondary", "pin");
  s.w.shell.setRegionOpen("side", false);
  s.w.shell.setRegionOpen("secondary", true);
  s.w.shell.setRegionSize("side", 411);
  s.w.shell.setRegionSize("secondary", 233);
  const alpha = structuredClone(s.w.layout.getLayout());

  s.navigate("beta");
  expect(s.ids("side")).toEqual([]);
  expect(s.ids("secondary")).toEqual([]);
  s.open("beta-preview", "side");
  s.w.shell.setRegionOpen("side", true);
  s.w.shell.setRegionSize("side", 333);
  const beta = structuredClone(s.w.layout.getLayout());

  s.navigate("alpha");
  for (const region of ["side", "secondary"] as const)
    expect(s.w.layout.getLayout().regions[region]).toEqual(alpha.regions[region]);
  s.navigate("beta");
  expect(s.w.layout.getLayout().regions.side).toEqual(beta.regions.side);
});

test("a mode with no panels hides every tray without deleting the previous mode's tabs", () => {
  const s = modePanelFixture();
  s.open("preview", "side");
  s.open("terminal", "secondary", "pin");
  s.w.shell.setRegionOpen("side", true);
  s.w.shell.setRegionOpen("secondary", true);
  const before = structuredClone(s.w.layout.getLayout());
  s.navigate("bare");
  for (const region of ["main", "side", "secondary"] as const) {
    expect(s.w.layout.getLayout().regions[region].visible).toBe(false);
    expect(s.w.layout.listPanelInstances(region)).toEqual([]);
  }
  s.navigate("alpha");
  expect(s.w.layout.getLayout().regions.side).toEqual(before.regions.side);
  expect(s.w.layout.getLayout().regions.secondary).toEqual(before.regions.secondary);
});

test("returning to a mode restores its selected Main tab", () => {
  const s = modePanelFixture();
  s.open("main-preview", "main");
  const selected = s.w.layout.getActivePanel("main")!.instanceId;
  s.navigate("beta");
  s.navigate("alpha");
  expect(s.w.layout.getActivePanel("main")?.instanceId).toBe(selected);
  expect(s.ids("main")).toContain("main-preview");
});

test("a mode's latest panel choices restore on another page and after a fresh workbench", () => {
  const s = modePanelFixture();
  s.navigate("alpha-list");
  s.navigate("alpha");
  s.open("kept", "side", "pin");
  s.w.shell.setRegionOpen("side", true);
  s.w.shell.setRegionSize("side", 417);
  s.navigate("beta");
  s.navigate("alpha-list");
  expect(s.ids("side")).toEqual(["kept"]);
  expect(s.w.shell.getRegionState("side")).toEqual({ open: true, size: 417 });
  const restored = modePanelFixture(s.saved);
  expect(restored.ids("side")).toEqual(["kept"]);
  expect(restored.w.shell.getRegionState("side")).toEqual({ open: true, size: 417 });
});

test("host-created tabs belong to a mode even without a page persistence scope", () => {
  const s = modePanelFixture(undefined, false);
  s.w.layout.registerPanel({ id: "host", title: "Host panel", rendererId: "document", region: "side", reuse: "none" });
  s.w.layout.openPanel("host", {
    resource: { type: "document", id: "host-resource" },
    strategy: { kind: "persistent" },
  });
  s.navigate("beta");
  expect(s.ids("side")).toEqual([]);
  s.navigate("alpha");
  expect(s.ids("side")).toEqual(["host-resource"]);
});
