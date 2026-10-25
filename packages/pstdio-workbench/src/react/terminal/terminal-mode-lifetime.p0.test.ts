import { expect, test } from "bun:test";
import { modePanelFixture } from "../../core/controllers/page-runtime/mode-panel-state.fixture";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "./terminal-module";

test.each([
  true,
  false,
])("a pinned Main terminal hides on page leave without ending its process, scoped=%s", async (scoped) => {
  const { w, navigate } = modePanelFixture(undefined, scoped);
  w.registerModule(createWorkbenchTerminalModule());
  let killed = 0;
  w.terminal.setSessionOpener(async () => ({
    id: "page-terminal",
    write() {},
    resize() {},
    kill() {
      killed++;
    },
    onData: () => () => undefined,
    onExit: () => () => undefined,
    onError: () => () => undefined,
  }));
  const tab = openWorkbenchTerminal(w);
  await w.terminal.open({ bindingId: tab.instanceId, request: { cols: 80, rows: 24 } });
  w.movePanel(tab.instanceId, "main");
  navigate("alpha-list");
  expect(w.layout.listPanelInstances("main").map((panel) => panel.instanceId)).not.toContain(tab.instanceId);
  expect(killed).toBe(0);
  navigate("alpha");
  expect(w.layout.getActivePanel("main")?.instanceId).toBe(tab.instanceId);
  expect(killed).toBe(0);
  w.closePlacement(w.layout.getActivePanel("main")!.placementIdentity!);
  await Promise.resolve();
  expect(killed).toBe(1);
});

test.each([true, false])("leaving a page closes its preview terminal process, scoped=%s", async (scoped) => {
  const { w, navigate } = modePanelFixture(undefined, scoped);
  w.registerModule(createWorkbenchTerminalModule());
  let killed = 0;
  w.terminal.setSessionOpener(async () => ({
    id: "preview-terminal",
    write() {},
    resize() {},
    kill() {
      killed++;
    },
    onData: () => () => undefined,
    onExit: () => () => undefined,
    onError: () => () => undefined,
  }));
  const tab = openWorkbenchTerminal(w);
  await w.terminal.open({ bindingId: tab.instanceId, request: { cols: 80, rows: 24 } });
  w.pinPlacement(tab.placementIdentity!, false);
  navigate("alpha-list");
  await Promise.resolve();
  expect(w.layout.listPanelInstances("secondary")).toEqual([]);
  expect(killed).toBe(1);
});

test.each([
  "page",
  "mode",
] as const)("unscoped %s changes preserve a terminal process until its tab closes", async (change) => {
  const { w, navigate } = modePanelFixture(undefined, false);
  const switchMode = (id: string) => (change === "page" ? navigate(id) : w.modes.setActiveMode(id));
  w.registerModule(createWorkbenchTerminalModule());
  let killed = 0;
  w.terminal.setSessionOpener(async () => ({
    id: "retained-terminal",
    write() {},
    resize() {},
    kill() {
      killed++;
    },
    onData: () => () => undefined,
    onExit: () => () => undefined,
    onError: () => () => undefined,
  }));
  const tab = openWorkbenchTerminal(w);
  await w.terminal.open({ bindingId: tab.instanceId, request: { cols: 80, rows: 24 } });
  switchMode("bare");
  expect(killed).toBe(0);
  switchMode("alpha");
  expect(w.layout.getActivePanel("secondary")?.instanceId).toBe(tab.instanceId);
  expect(killed).toBe(0);
  w.closePlacement(w.layout.getActivePanel("secondary")!.placementIdentity!);
  await Promise.resolve();
  expect(killed).toBe(1);
});
