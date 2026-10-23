import { expect, test } from "bun:test";
import { modePanelFixture } from "./mode-panel-state.fixture";

test.each(["main", "side"] as const)("moving from %s into a shown header preserves page inheritance", (source) => {
  const { w, open, navigate } = modePanelFixture();
  w.pages.getPage("alpha")!.regionSettings = { main: { showHeader: true } };
  w.pages.getPage("alpha-list")!.regionSettings = { main: { showHeader: false } };
  open("tool", source, "pin");
  w.movePanel(w.layout.getActivePanel(source)!.instanceId, "main");
  expect(w.layout.getLayout().regions.main.headerVisible).toBeUndefined();
  navigate("alpha-list");
  expect(w.shell.getPanelPolicy("main").showHeader).toBe(false);
});

test("page header defaults inherit from the mode until the user chooses, and reset clears that choice", () => {
  const { w, navigate } = modePanelFixture();
  w.modes.getMode("alpha")!.regionSettings = { main: { showHeader: false } };
  w.pages.getPage("alpha")!.regionSettings = { main: { showHeader: true } };
  expect(w.shell.getPanelPolicy("main").showHeader).toBe(true);
  expect(w.layout.getLayout().regions.main.headerVisible).toBeUndefined();
  navigate("alpha-list");
  expect(w.shell.getPanelPolicy("main").showHeader).toBe(false);
  w.shell.setHeaderVisible("main", true);
  navigate("alpha");
  w.shell.setHeaderVisible("main", false);
  navigate("alpha-list");
  expect(w.shell.getPanelPolicy("main").showHeader).toBe(false);
  navigate("alpha");
  expect(w.shell.getPanelPolicy("main").showHeader).toBe(false);
  w.resetLayout();
  expect(w.shell.getPanelPolicy("main").showHeader).toBe(true);
});

test("a tab move reveals a hidden destination header as a user choice", () => {
  const { w, open } = modePanelFixture();
  w.modes.getMode("alpha")!.regionSettings = { secondary: { showHeader: false } };
  w.shell.setHeaderVisible("secondary", false);
  open("tool", "side", "pin");
  const tab = w.layout.getActivePanel("side")!;
  w.movePanel(tab.instanceId, "secondary");
  expect(w.shell.getPanelPolicy("secondary").showHeader).toBe(true);
  expect(w.layout.getLayout().regions.secondary.headerVisible).toBe(true);
  expect(w.layout.getActivePanel("secondary")!.instanceId).toBe(tab.instanceId);
});

test("a rejected tab move keeps the destination header hidden", () => {
  const { w, open } = modePanelFixture();
  w.modes.getMode("alpha")!.regionSettings = { secondary: { acceptsTabs: false, showHeader: false } };
  open("tool", "side", "pin");
  const before = w.layout.getLayout();
  expect(() => w.movePanel(w.layout.getActivePanel("side")!.instanceId, "secondary")).toThrow();
  expect(w.layout.getLayout()).toBe(before);
  expect(w.shell.getPanelPolicy("secondary").showHeader).toBe(false);
});
