import { expect, test } from "bun:test";
import { modePanelFixture } from "../../core/controllers/page-runtime/mode-panel-state.fixture";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "./terminal-module";

for (const region of ["main", "side", "secondary"] as const) {
  test(`manual ${region} terminals survive fullscreen, page and mode transitions`, async () => {
    const { w, navigate } = modePanelFixture();
    w.registerModule(createWorkbenchTerminalModule());
    let opened = 0;
    let killed = 0;
    w.terminal.setSessionOpener(async () => ({
      id: `manual-${++opened}`,
      write() {},
      resize() {},
      kill() {
        killed++;
      },
      onData: () => () => undefined,
      onExit: () => () => undefined,
      onError: () => () => undefined,
    }));
    const tab = openWorkbenchTerminal(w, { region });
    const first = await w.terminal.open({ bindingId: tab.instanceId, request: { cols: 80, rows: 24 } });
    w.fullscreen.enter();
    navigate("alpha-list");
    expect(w.fullscreen.store.getState().active).toBe(true);
    navigate("bare");
    expect(w.fullscreen.store.getState().active).toBe(false);
    navigate("alpha");
    w.fullscreen.enter();
    w.fullscreen.exit();
    expect(w.layout.getActivePanel(region)?.instanceId).toBe(tab.instanceId);
    expect(await w.terminal.open({ bindingId: tab.instanceId, request: { cols: 80, rows: 24 } })).toEqual(first);
    expect(opened).toBe(1);
    expect(killed).toBe(0);
    w.closePlacement(tab.placementIdentity!);
    await Promise.resolve();
    expect(killed).toBe(1);
  });
}
