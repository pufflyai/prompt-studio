import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test.each(["side", "secondary"] as const)("%s keeps panel permissions independent", (region) => {
  const w = createWorkbench();
  w.modes.registerMode({
    id: "restricted",
    activate: () => undefined,
    regionSettings: { [region]: { canOpen: false, canClose: true, acceptsTabs: false, resizable: true } },
  });
  w.modes.setActiveMode("restricted");
  expect(w.shell.getPanelPolicy(region)).toMatchObject({
    canOpen: false,
    canClose: true,
    acceptsTabs: false,
    resizable: true,
  });
  w.shell.setRegionOpen(region, false);
  expect(() => w.shell.setRegionOpen(region, true)).toThrow("cannot open");
  w.shell.setRegionSize(region, 280);
  expect(w.shell.getRegionState(region).size).toBe(280);
});

test("a nonclosing panel can accept tabs and resize without becoming floatable", () => {
  const w = createWorkbench();
  w.modes.registerMode({
    id: "fixed",
    activate: () => undefined,
    regionSettings: { side: { canClose: false, acceptsTabs: true, floatable: false } },
  });
  w.modes.setActiveMode("fixed");
  expect(w.shell.getPanelPolicy("side")).toMatchObject({
    canClose: false,
    canOpen: true,
    acceptsTabs: true,
    resizable: true,
    floatable: false,
  });
  expect(() => w.shell.setRegionOpen("side", false)).toThrow("cannot close");
  expect(() => w.shell.setSidePanelPresentation("floating")).toThrow("cannot float");
  w.shell.setRegionSize("side", 380);
  expect(w.shell.getRegionState("side").size).toBe(380);
});

test("fixed sizes and unavailable panels cannot be resized or revealed", () => {
  const w = createWorkbench();
  w.modes.registerMode({
    id: "main",
    panels: ["main"],
    activate: () => undefined,
    regionSettings: { main: { size: { minPx: 200, maxPx: 200 } } },
  });
  w.modes.setActiveMode("main");
  expect(() => w.shell.setRegionOpen("side", true)).toThrow("not provided");
  expect(() => w.shell.setRegionSize("main", 250)).toThrow("cannot resize");
  w.layout.restoreLayout(w.layout.store.getInitialState().layout);
  expect(w.layout.getLayout().regions.side.visible).toBe(false);
  expect(w.shell.getPanelPolicy("main")).toMatchObject({ provided: true, canClose: false });
});

test("headers are mode layout choices and grant no other permission", () => {
  const w = createWorkbench();
  for (const id of ["a", "b"])
    w.modes.registerMode({
      id,
      activate: () => undefined,
      regionSettings: { side: { showHeader: false, canClose: false } },
    });
  w.modes.setActiveMode("a");
  w.shell.setHeaderVisible("side", true);
  expect(w.shell.getPanelPolicy("side")).toMatchObject({ showHeader: true, canClose: false });
  w.modes.setActiveMode("b");
  expect(w.shell.getPanelPolicy("side").showHeader).toBe(false);
  w.modes.setActiveMode("a");
  expect(w.shell.getPanelPolicy("side").showHeader).toBe(true);
});

test("mode activation constrains sizes read from persisted layout", () => {
  const initial = createWorkbench().layout.getLayout();
  initial.regions.side.size = 900;
  const w = createWorkbench({ layoutPersistence: { getLayout: () => initial, setLayout() {} } });
  w.modes.registerMode({
    id: "bounded",
    activate() {},
    regionSettings: { side: { size: { minPx: 200, maxPx: 300 } } },
  });
  w.modes.setActiveMode("bounded");
  expect(w.layout.getLayout().regions.side.size).toBe(300);
});

test("low-level panel edits enforce the same policy", () => {
  const w = createWorkbench();
  w.modes.registerMode({
    id: "restricted",
    activate() {},
    regionSettings: { side: { canOpen: false, acceptsTabs: false, resizable: false } },
  });
  w.modes.setActiveMode("restricted");
  w.shell.setRegionOpen("side", false);
  w.layout.registerPanel({ id: "tool", title: "Tool", rendererId: "tool", region: "side" });
  expect(() => w.layout.setRegionVisible("side", true)).toThrow("cannot open");
  expect(() => w.layout.setRegionSize("side", 555)).toThrow("cannot resize");
  expect(() => w.layout.openPanel("tool")).toThrow("accept tabs");
});

test("switching modes preserves each saved size within its own bounds", () => {
  const w = createWorkbench();
  for (const [id, minPx, maxPx] of [
    ["small", 200, 300],
    ["large", 600, 900],
  ] as const)
    w.modes.registerMode({ id, activate() {}, regionSettings: { side: { size: { minPx, maxPx } } } });
  w.modes.setActiveMode("large");
  w.shell.setRegionSize("side", 800);
  w.modes.setActiveMode("small");
  w.shell.setRegionSize("side", 250);
  w.modes.setActiveMode("large");
  expect(w.layout.getLayout().regions.side.size).toBe(800);
  w.modes.setActiveMode("small");
  expect(w.layout.getLayout().regions.side.size).toBe(250);
});

test("host permissions also preserve a nonclosing panel after its final tab closes", () => {
  const w = createWorkbench({ regionSettings: { side: { canClose: false } } });
  w.modes.registerMode({ id: "host", activate() {} });
  w.modes.setActiveMode("host");
  w.layout.registerPanel({ id: "tool", title: "Tool", rendererId: "tool", region: "side" });
  const tab = w.layout.openPanel("tool", { closable: true });
  w.layout.closePanel(tab.instanceId);
  expect(w.shell.getPanelPolicy("side")).toMatchObject({ canClose: false, open: true });
});

test("public commands reject forbidden operations and keep the same layout", async () => {
  const w = createWorkbench();
  w.modes.registerMode({
    id: "restricted",
    activate() {},
    regionSettings: { side: { canClose: false, floatable: false, resizable: false } },
  });
  w.modes.setActiveMode("restricted");
  const before = w.layout.getLayout();
  for (const [command, args] of [
    ["workbench.setPanelOpen", { region: "side", open: false }],
    ["workbench.resizePanel", { region: "side", size: 700 }],
    ["workbench.setSidePanelPresentation", { presentation: "floating" }],
  ] as const)
    await expect(w.commands.executeCommand(command, args)).rejects.toThrow("cannot");
  expect(w.layout.getLayout()).toBe(before);
  await w.commands.executeCommand("workbench.setPanelHeaderVisible", { region: "side", visible: false });
  expect(w.shell.getPanelPolicy("side")).toMatchObject({ canClose: false, showHeader: false });
});

test("a nonclosing panel opens even when the host starts with Side closed", () => {
  const w = createWorkbench({ initialSidePanelMode: "closed" });
  w.modes.registerMode({ id: "player", activate() {}, regionSettings: { side: { canClose: false } } });
  w.modes.setActiveMode("player");
  expect(w.shell.getPanelPolicy("side")).toMatchObject({ canClose: false, open: true });
});

test("deprecated alwaysShowTabs false hides the header until showHeader is declared", () => {
  const w = createWorkbench();
  w.modes.registerMode({
    id: "legacy",
    activate: () => undefined,
    regionSettings: { main: { alwaysShowTabs: false }, side: { alwaysShowTabs: false, showHeader: true } },
  });
  w.modes.setActiveMode("legacy");
  expect(w.shell.getPanelPolicy("main").showHeader).toBe(false);
  expect(w.shell.getPanelPolicy("side").showHeader).toBe(true);
});
