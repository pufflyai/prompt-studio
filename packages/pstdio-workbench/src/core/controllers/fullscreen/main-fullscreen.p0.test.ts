import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

test("modes can forbid Main fullscreen through commands and the controller", () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "player", canFullscreen: false, activate() {} });
  w.modes.setActiveMode("player");
  expect(() => w.fullscreen.enter()).toThrow("Fullscreen is not available in this mode");
  expect(w.commands.isCommandEnabled("workbench.enterMainFullscreen")).toBe(false);
  expect(w.fullscreen.store.getState().active).toBe(false);
  w.modes.setActiveMode(undefined);
  expect(w.fullscreen.canEnter()).toBe(true);
  expect(w.commands.isCommandEnabled("workbench.enterMainFullscreen")).toBe(true);
  w.fullscreen.enter();
  expect(w.fullscreen.store.getState().active).toBe(true);
});

for (const presentation of ["attached", "floating", "closed"] as const) {
  test(`fullscreen preserves the ${presentation} Side layout without writes`, async () => {
    const w = createWorkbench();
    w.shell.setSidePanelPresentation(presentation);
    w.shell.setRegionSize("side", 370);
    const before = structuredClone(w.host.getSnapshot());
    let writes = 0;
    const unsubscribe = w.layout.store.subscribe(() => writes++);
    await w.commands.executeCommand("workbench.enterMainFullscreen");
    expect(w.fullscreen.store.getState()).toEqual({ active: true, sideOpen: presentation !== "closed" });
    if (presentation === "closed") w.fullscreen.showSide();
    w.fullscreen.hideSide();
    w.fullscreen.showSide();
    await w.commands.executeCommand("workbench.exitMainFullscreen");
    w.fullscreen.exit();
    expect(w.fullscreen.store.getState()).toEqual({ active: false, sideOpen: false });
    expect(w.host.getSnapshot()).toEqual(before);
    expect(writes).toBe(0);
    unsubscribe();
  });
}

test("the temporary overlay obeys Side policy", () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "fixed", activate() {}, regionSettings: { side: { floatable: false } } });
  w.modes.setActiveMode("fixed");
  w.fullscreen.enter();
  expect(w.fullscreen.store.getState().sideOpen).toBe(false);
  expect(() => w.fullscreen.showSide()).toThrow("cannot float");
  w.modes.registerMode({ id: "main", panels: ["main"], activate() {} });
  w.modes.setActiveMode("main");
  expect(w.fullscreen.store.getState().active).toBe(false);
  w.fullscreen.enter();
  expect(() => w.fullscreen.showSide()).toThrow("not provided");
});

test("fullscreen exits on project and mode change and disposal", async () => {
  const w = createWorkbench();
  w.fullscreen.enter();
  w.pageLocations.switchProject("another");
  expect(w.fullscreen.store.getState().active).toBe(false);
  w.fullscreen.enter();
  w.modes.registerMode({ id: "next", activate() {} });
  w.modes.setActiveMode("next");
  expect(w.fullscreen.store.getState().active).toBe(false);
  w.fullscreen.enter();
  await w.dispose();
  expect(w.fullscreen.store.getState().active).toBe(false);
});

test("overlay controls reject forbidden opening and closing without changing saved visibility", () => {
  const w = createWorkbench();
  w.modes.registerMode({
    id: "restricted",
    activate() {},
    regionSettings: { side: { canOpen: false, canClose: false } },
  });
  w.modes.setActiveMode("restricted");
  w.fullscreen.enter();
  const before = structuredClone(w.host.getSnapshot());
  expect(() => w.fullscreen.showSide()).toThrow("cannot open");
  expect(() => w.fullscreen.hideSide()).toThrow("cannot close");
  expect(w.host.getSnapshot()).toEqual(before);
});

test("temporary Side keeps focus while background layout changes", () => {
  const w = createWorkbench();
  w.shell.setSidePanelPresentation("closed");
  w.fullscreen.enter();
  w.fullscreen.showSide();
  w.shell.setRegionSize("secondary", 250);
  expect(w.focus.getActiveRegion()).toBe("side");
  expect(w.context.get("sideFocus")).toBe(true);
});
