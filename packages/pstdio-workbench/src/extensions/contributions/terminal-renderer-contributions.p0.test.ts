import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench, getWorkbenchRenderers, type WorkbenchCore, type WorkbenchPanelRenderInput } from "../../core";
import { createControllerTerminalBridge } from "../../react/terminal/workbench-terminal-panel";
import { registerWorkbenchExtensionContributions } from "../host/workbench-extension-host";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";
import { createWorkbenchExtensionTerminalRendererOwners } from "./terminal-renderer-contributions";

const viewId = "example.console.view.shell";
const metadata: WorkbenchExtensionMetadata = {
  ...emptyWorkbenchExtensionMetadata,
  views: [
    {
      id: viewId,
      localId: "shell",
      extensionId: "example.console",
      title: "Shell",
      body: { kind: "terminal", sessionHandlerId: `${viewId}.terminal.session` },
    },
  ],
};

const nativeView = (w: WorkbenchCore) => {
  const element = getWorkbenchRenderers(w)
    .getRenderer(viewId)!
    .render({ workbench: w } as WorkbenchPanelRenderInput) as { props: { nativeView: { ownerId: string } } };
  return element.props.nativeView;
};

test("installed native terminal ownership survives movement, hiding, and unchanged metadata registration", async () => {
  const w = createWorkbench();
  const owners = createWorkbenchExtensionTerminalRendererOwners();
  const input = {
    workbench: w,
    projectId: "project",
    metadata,
    terminalRendererOwners: owners,
    executeCommand: () => undefined,
  };
  let registration = registerWorkbenchExtensionContributions(input);
  expect(w.views.getView(viewId)?.body.kind).toBe("terminal");
  w.modes.registerMode({ id: "project", panels: ["main", "secondary", "side"], activate() {} });
  w.pageLocations.setProject("project");
  w.shellPlacements.registerPlacement({
    id: "shell",
    item: { kind: "view", view: { kind: "view", id: viewId }, presence: "closed" },
    region: "secondary",
    mountStrategy: "keep-mounted",
  });
  const identity = w.shellPlacements.openPlacement({ placementId: "shell", region: "secondary" });
  const panel = w.layout.listPanelInstances().find((panel) => panel.viewId === viewId)!;
  let opens = 0;
  let kills = 0;
  w.terminal.setSessionOpener(async (_request, binding) => {
    expect(binding).toEqual({ projectId: "project", viewId, resource: undefined });
    opens += 1;
    return {
      id: "session",
      write() {},
      resize() {},
      kill() {
        kills += 1;
      },
      onData: () => () => {},
      onExit: () => () => {},
      onError: () => () => {},
    };
  });
  const bridge = createControllerTerminalBridge(w.terminal, {
    getBindingId: () => panel.instanceId,
    getOwnerId: () => nativeView(w).ownerId,
    getViewBinding: () => ({ projectId: "project", viewId }),
  });
  await bridge.openSession({ cols: 80, rows: 24 });
  w.movePanel(panel.instanceId, "side");
  w.shell.setRegionOpen("side", false);
  await bridge.openSession({ cols: 80, rows: 24 });
  expect(opens).toBe(1);
  expect(kills).toBe(0);
  owners.reconcile("project", structuredClone(metadata));
  owners.reconcile("other-project", emptyWorkbenchExtensionMetadata);
  await Bun.sleep(0);
  expect(kills).toBe(0);
  registration.dispose();
  registration = registerWorkbenchExtensionContributions(input);
  await bridge.openSession({ cols: 80, rows: 24 });
  expect(opens).toBe(1);
  expect(kills).toBe(0);
  w.closePlacement(identity);
  await Bun.sleep(0);
  expect(kills).toBe(1);
  registration.dispose();
  owners.dispose();
  await w.dispose();
});

test("disposing an installed terminal owner closes a hidden presentation", async () => {
  const w = createWorkbench();
  const owners = createWorkbenchExtensionTerminalRendererOwners();
  const registration = registerWorkbenchExtensionContributions({
    workbench: w,
    projectId: "project",
    metadata,
    terminalRendererOwners: owners,
    executeCommand: () => undefined,
  });
  let kills = 0;
  w.terminal.setSessionOpener(async () => ({
    id: "hidden",
    write() {},
    resize() {},
    kill() {
      kills += 1;
    },
    onData: () => () => {},
    onExit: () => () => {},
    onError: () => () => {},
  }));
  await w.terminal.open({ ownerId: nativeView(w).ownerId, bindingId: "offscreen", request: { cols: 80, rows: 24 } });
  owners.reconcile("project", emptyWorkbenchExtensionMetadata);
  await Bun.sleep(0);
  expect(kills).toBe(1);
  registration.dispose();
  owners.dispose();
  await w.dispose();
});

test("closing the same static placement in another project preserves the hidden project's PTY", async () => {
  const w = createWorkbench();
  const owners = createWorkbenchExtensionTerminalRendererOwners();
  w.modes.registerMode({ id: "project", panels: ["main", "side", "secondary"], activate() {} });
  const input = { workbench: w, metadata, terminalRendererOwners: owners, executeCommand: () => undefined };
  w.pageLocations.setProject("a");
  w.layout.setPersistenceScope("a");
  let registration = registerWorkbenchExtensionContributions({ ...input, projectId: "a" });
  const ownerA = nativeView(w).ownerId;
  w.shellPlacements.registerPlacement({
    id: "shared",
    item: { kind: "view", view: { kind: "view", id: viewId }, presence: "closed" },
    region: "secondary",
  });
  w.shellPlacements.openPlacement({ placementId: "shared", region: "secondary" });
  const panelA = w.layout.listPanelInstances().find((panel) => panel.viewId === viewId)!;
  let opens = 0;
  const kills: string[] = [];
  w.terminal.setSessionOpener(async () => {
    const id = `session-${++opens}`;
    return {
      id,
      write() {},
      resize() {},
      kill() {
        kills.push(id);
      },
      onData: () => () => {},
      onExit: () => () => {},
      onError: () => () => {},
    };
  });
  const request = { cols: 80, rows: 24 };
  await w.terminal.open({ bindingId: panelA.instanceId, ownerId: ownerA, request });
  registration.dispose();
  w.pageLocations.setProject("b");
  w.layout.setPersistenceScope("b");
  registration = registerWorkbenchExtensionContributions({ ...input, projectId: "b" });
  const ownerB = nativeView(w).ownerId;
  const identityB = w.shellPlacements.openPlacement({ placementId: "shared", region: "secondary" });
  const panelB = w.layout.listPanelInstances().find((panel) => panel.viewId === viewId)!;
  expect(panelB.instanceId).toBe(panelA.instanceId);
  await w.terminal.open({ bindingId: panelB.instanceId, ownerId: ownerB, request });
  w.closePlacement(identityB);
  await Bun.sleep(0);
  expect(kills).toEqual(["session-2"]);
  expect(await w.terminal.open({ bindingId: panelA.instanceId, ownerId: ownerA, request })).toEqual({
    sessionId: "session-1",
  });
  expect(opens).toBe(2);
  registration.dispose();
  owners.dispose();
  await w.dispose();
});
