import { expect, test } from "bun:test";
import { harness, navigate } from "../../core/controllers/composition/placement-lifecycle-test-support";
import { createWorkbenchTerminalModule, openWorkbenchTerminal, WORKBENCH_TERMINAL_WIDGET_ID } from "./terminal-module";
import { updateTerminalPlacementTitle } from "./terminal-placement-title";

test("terminal process titles follow the tab across page and mode owners", async () => {
  const w = harness();
  await w.navigation.openTarget(navigate("alpha"));
  w.registerModule(createWorkbenchTerminalModule());
  const tab = openWorkbenchTerminal(w);
  w.movePanel(tab.instanceId, "main");
  updateTerminalPlacementTitle(w, tab.instanceId, "bun test");
  expect(w.layout.getActivePanel("main")?.resource?.label).toBe("bun test");
  w.movePanel(tab.instanceId, "side");
  updateTerminalPlacementTitle(w, tab.instanceId, "bun build");
  expect(w.layout.getActivePanel("side")?.title).toBe("bun build");
  expect(w.layout.getActivePanel("side")?.viewId).toBe(WORKBENCH_TERMINAL_WIDGET_ID);
  await w.navigation.openTarget(navigate("beta"));
  expect(w.layout.getActivePanel("side")?.resource?.label).toBe("bun build");
});
