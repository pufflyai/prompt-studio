import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { harness, navigate, openFile } from "../composition/placement-lifecycle-test-support";

test("Main can change vertical placement only while Bottom is open", async () => {
  const w = createWorkbench();
  w.shell.setRegionOpen("secondary", false);
  const before = w.layout.getLayout();
  expect(w.shell.getPanelPositions("main")).toEqual([]);
  await expect(
    w.commands.executeCommand("workbench.repositionPanel", { region: "main", position: "bottom" }),
  ).rejects.toThrow("Panel cannot move");
  expect(w.layout.getLayout()).toBe(before);
  expect(w.shell.getPanelPositions("secondary")).toEqual(["top", "bottom"]);
  w.shell.setRegionOpen("secondary", true);
  expect(w.shell.getPanelPositions("main")).toEqual(["top", "bottom"]);
  w.shell.repositionPanel("main", "bottom");
  expect(w.shell.getArrangement().secondary).toBe("top");
  w.shell.setRegionOpen("secondary", false);
  expect(w.shell.getPanelPositions("main")).toEqual([]);
});

test("placement commands preserve tabs and restore the mode arrangement after reload", async () => {
  const saved = new Map();
  const w = harness(saved);
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ ...openFile("draft"), open: "pin" });
  const original = w.layout.getLayout().regions.main;
  for (const [region, position] of [
    ["side", "left"],
    ["sidenav", "right"],
    ["main", "bottom"],
  ] as const)
    await w.commands.executeCommand("workbench.repositionPanel", { region, position });
  await w.commands.executeCommand("workbench.setActionBarPosition", { position: "top" });
  expect(w.shell.getArrangement()).toEqual({ side: "left", sidenav: "right", secondary: "top", activity: "top" });
  expect(w.layout.getLayout().regions.main).toEqual(original);
  await w.navigation.openTarget(navigate("beta"));
  expect(w.shell.getArrangement().side).toBe("left");
  await w.navigation.openTarget(navigate("alpha"));
  const restored = harness(saved);
  await restored.navigation.openTarget(navigate("alpha"));
  expect(restored.shell.getArrangement()).toEqual(w.shell.getArrangement());
});

test("mode movement policy and supported edges constrain public commands without edits", async () => {
  const w = createWorkbench();
  w.modes.registerMode({
    id: "fixed",
    panels: ["main"],
    regionSettings: { main: { movable: false }, activity: { movable: false } },
    activate() {},
  });
  w.modes.setActiveMode("fixed");
  expect(w.shell.getPanelPositions("main")).toEqual([]);
  expect(w.shell.getPanelPositions("side")).toEqual([]);
  const before = w.layout.getLayout();
  for (const args of [
    { region: "side", position: "left" },
    { region: "main", position: "bottom" },
    { region: "sidenav", position: "top" },
  ])
    await expect(w.commands.executeCommand("workbench.repositionPanel", args)).rejects.toThrow();
  await expect(w.commands.executeCommand("workbench.setActionBarPosition", { position: "bottom" })).rejects.toThrow();
  expect(w.layout.getLayout()).toBe(before);
});

test("switching modes restores placement and applies current movement permissions", () => {
  const w = createWorkbench();
  for (const id of ["a", "b"]) w.modes.registerMode({ id, activate() {} });
  w.modes.setActiveMode("a");
  w.shell.repositionPanel("side", "left");
  w.shell.repositionPanel("sidenav", "right");
  w.modes.setActiveMode("b");
  expect(w.shell.getArrangement().side).toBe("right");
  expect(w.shell.getArrangement().sidenav).toBe("left");
  w.modes.setActiveMode("a");
  expect(w.shell.getArrangement().side).toBe("left");
  expect(w.shell.getArrangement().sidenav).toBe("right");
  w.modes.getMode("a")!.regionSettings = { side: { movable: false } };
  w.layout.restoreLayout(w.layout.getLayout());
  expect(w.shell.getArrangement().side).toBe("right");
});

test("each supported command position preserves visibility, selection and resource bindings", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget({ ...openFile("draft"), open: "pin" });
  const before = w.layout.getLayout().regions;
  for (const region of ["side", "sidenav", "secondary", "main", "activity"] as const) {
    for (const position of w.shell.getPanelPositions(region)) {
      await w.commands.executeCommand(
        region === "activity" ? "workbench.setActionBarPosition" : "workbench.repositionPanel",
        { region, position },
      );
      expect(w.layout.getLayout().regions).toEqual(before);
    }
  }
  w.resetLayout();
  expect(w.shell.getArrangement()).toEqual({ side: "right", sidenav: "left", secondary: "bottom", activity: "left" });
});

test("Main cannot change order when the mode does not provide Bottom", () => {
  const w = createWorkbench();
  w.modes.registerMode({ id: "main-only", panels: ["main"], activate() {} });
  w.modes.setActiveMode("main-only");
  expect(w.shell.getPanelPolicy("main").movable).toBe(true);
  expect(w.shell.getPanelPositions("main")).toEqual([]);
});
