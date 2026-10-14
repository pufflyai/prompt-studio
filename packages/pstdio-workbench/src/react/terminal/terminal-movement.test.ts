import { expect, test } from "bun:test";
import { harness, navigate } from "../../core/controllers/composition/placement-lifecycle-test-support";
import { createWorkbenchTerminalModule, openWorkbenchTerminal } from "./terminal-module";
import { terminalPlacementBindingId } from "./terminal-placement-binding";

test("moving and closing a live terminal preserve its runtime until an explicit stop", async () => {
  const workbench = harness();
  await workbench.navigation.openTarget(navigate("alpha"));
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
    bindingId: terminalPlacementBindingId(instance.instanceId),
    request: { cols: 80, rows: 24 },
  });
  workbench.movePanel(instance.instanceId, "main");
  expect(workbench.layout.getLayout().regions.main.widgets[0]?.placementIdentity?.kind).toBe("page");
  await Promise.resolve();
  expect(signals).toEqual([]);
  workbench.movePanel(instance.instanceId, "side");
  const identity = workbench.layout.getLayout().regions.side.widgets[0]!.placementIdentity!;
  expect(identity.kind).toBe("mode");
  await workbench.navigation.openTarget(navigate("beta"));
  const reopened = await workbench.terminal.open({
    bindingId: terminalPlacementBindingId(instance.instanceId),
    request: { cols: 80, rows: 24 },
  });
  expect(reopened.sessionId).toBe("live-terminal");
  await Promise.resolve();
  expect(signals).toEqual([]);
  workbench.closePlacement(identity);
  await Promise.resolve();
  expect(signals).toEqual([]);
  expect(workbench.terminal.getSession("live-terminal")?.status).toBe("running");
  await workbench.terminal.kill({ sessionId: "live-terminal" });
  expect(workbench.terminal.getSession("live-terminal")?.status).toBe("killed");
});
