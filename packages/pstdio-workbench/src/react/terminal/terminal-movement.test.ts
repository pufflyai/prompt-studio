import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "./terminal-module";
import { terminalPlacementBindingId } from "./terminal-placement-binding";

test("moving a live terminal preserves its binding and closing it in its destination ends it", async () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkbenchTerminalModule());
  const signals: (string | undefined)[] = [];
  workbench.terminal.setSessionOpener(async () => ({
    id: "live-terminal",
    write() {},
    resize() {},
    kill(signal) {
      signals.push(signal);
    },
    onData: () => () => undefined,
    onExit: () => () => undefined,
    onError: () => () => undefined,
  }));
  const instance = openWorkbenchTerminal(workbench);
  await workbench.terminal.open({
    bindingId: terminalPlacementBindingId(workbench.layout.getPersistenceScope(), instance.instanceId),
    request: { cols: 80, rows: 24 },
  });
  workbench.movePanel(instance.instanceId, "main");
  await Promise.resolve();
  expect(signals).toEqual([]);
  workbench.movePanel(instance.instanceId, "side");
  await Promise.resolve();
  expect(signals).toEqual([]);
  workbench.closePlacement(instance.placementIdentity!);
  await Promise.resolve();
  expect(signals).toEqual([undefined]);
});
