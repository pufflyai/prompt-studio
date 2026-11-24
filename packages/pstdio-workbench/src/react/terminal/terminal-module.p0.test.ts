import { describe, expect, test } from "bun:test";
import { createScopedQueryClient, resourceKey } from "@pstdio/sdk/extensions";
import { createWorkbench, type ResourceRef, shellPlacementContributionId, type WorkbenchLayout } from "../../core";
import { registerResourcePage } from "../../core/controllers/page-runtime/page-runtime-test-support";
import type { WorkbenchTerminalSessionAdapter } from "../../core/controllers/terminal/terminal-controller-types";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import {
  createWorkbenchTerminalModule,
  openWorkbenchTerminal,
  WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "./terminal-module";

const setup = () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkbenchTerminalModule());
  return workbench;
};
const workspaceResource: ResourceRef = {
  type: "workspace",
  id: "workspace-1",
  metadata: { workspacePath: "/repo/.pstdio/workspaces/PS-161_A1" },
};
const activeWorkspaceResource: ResourceRef = {
  type: "workspace",
  id: "workspace-2",
  metadata: { workspacePath: "/repo/.pstdio/workspaces/PS-161_A2" },
};
const sessionResource: ResourceRef = {
  type: "session",
  id: "session-1",
};
const openPrimaryWorkspace = async (workbench: ReturnType<typeof setup>, panelId: string, resource: ResourceRef) => {
  workbench.resources.registerKind({ kind: resource.type, label: "Workspace" });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({
    id: panelId,
    title: "Workspace",
    body: { kind: "react", render: () => null },
  });
  const page = { extensionId: "pstdio.test", kind: "page" as const, id: `${panelId}.page` };
  registerResourcePage(workbench, {
    id: page.id,
    ref: page,
    path: page.id,
    modeId: "project",
    resource: {
      kinds: [
        {
          kind: "resource-kind",
          id: resource.type,
        },
      ],
    },
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: panelId,
      },
      cardinality: "one",
    },
    slots: [],
  });
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.navigate({
    kind: "page",
    page,
    resource: {
      type: resource.type,
      id: resource.id ?? resourceKey(resource),
      label: resource.label,
      metadata: { workspacePath: String(resource.metadata?.workspacePath ?? "") },
    },
  });
};
describe("createWorkbenchTerminalModule", () => {
  test("exposes the terminal panel to the secondary add menu", () => {
    const workbench = setup();
    const addable = workbench.composition.panelsFor("secondary").addable;
    expect(addable.map((panel) => panel.panelId)).toContain(shellPlacementContributionId(WORKBENCH_TERMINAL_WIDGET_ID));
  });
  test("the open command reveals the terminal panel in the secondary region", async () => {
    const workbench = setup();
    workbench.shell.setRegionOpen("secondary", false);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const widgets = workbench.layout.getLayout().regions.secondary.widgets;
    const terminals = widgets.filter((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(widgets).toHaveLength(1);
    expect(terminals[0]).toMatchObject({
      closable: true,
      mountStrategy: "keep-mounted",
      title: "Terminal 1",
    });
    expect(workbench.shell.getRegionState("secondary").open).toBe(true);
  });
  test.each([
    "main",
    "side",
  ] as const)("adding a terminal to the %s panel keeps the secondary panel closed", async (region) => {
    const workbench = setup();
    workbench.shell.setRegionOpen("secondary", false);
    const terminalPanelId = shellPlacementContributionId(WORKBENCH_TERMINAL_WIDGET_ID);
    const observed: number[] = [];
    const unsubscribe = workbench.layout.store.subscribe(() => {
      observed.push(workbench.layout.listPanelInstances("secondary").length);
    });
    const add = workbench.composition.panelsFor(region).addable.find((panel) => panel.panelId === terminalPanelId);
    await add?.open?.();
    unsubscribe();
    expect(observed.every((count) => count === 0)).toBe(true);
    const widgets = workbench.layout.getLayout().regions[region].widgets;
    expect(widgets.some((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID)).toBe(true);
    expect(workbench.shell.getRegionState("secondary").open).toBe(false);
  });
  test("opening the terminal again creates another workbench tab", async () => {
    const workbench = setup();
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const widgets = workbench.layout.getLayout().regions.secondary.widgets;
    const terminals = widgets.filter((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals).toHaveLength(2);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 1", "Terminal 2"]);
    expect(workbench.layout.getLayout().regions.secondary.activeWidgetId).toBe(terminals[1]?.widgetId);
  });
  test("opening another terminal keeps numbering after process titles replace tab titles", async () => {
    const workbench = setup();
    const firstTerminal = await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const firstIdentity = workbench.layout.getLayout().regions.secondary.widgets.find(
      (candidate) =>
        candidate.widgetId ===
        (
          firstTerminal as {
            instanceId: string;
          }
        ).instanceId,
    )?.placementIdentity;
    if (firstIdentity) workbench.shellPlacements.updatePlacement(firstIdentity, { title: "zsh" });
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const terminals = workbench.layout
      .getLayout()
      .regions.secondary.widgets.filter((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals.map((placement) => placement.title)).toEqual(["zsh", "Terminal 2"]);
  });
  test("terminal numbering does not reuse closed tab titles", async () => {
    const workbench = setup();
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const firstIdentity = workbench.layout.getLayout().regions.secondary.widgets[0]?.placementIdentity;
    if (firstIdentity) workbench.shellPlacements.closePlacement(firstIdentity);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const terminals = workbench.layout
      .getLayout()
      .regions.secondary.widgets.filter((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 2", "Terminal 3"]);
  });
  test("terminal numbering stays monotonic across module contexts", async () => {
    const workbench = setup();
    openWorkbenchTerminal(workbench);
    const firstIdentity = workbench.layout.getLayout().regions.secondary.widgets[0]?.placementIdentity;
    if (firstIdentity) workbench.shellPlacements.closePlacement(firstIdentity);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const terminals = workbench.layout
      .getLayout()
      .regions.secondary.widgets.filter((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 2"]);
  });
  test("the open command inherits the active workspace resource", async () => {
    const workbench = setup();
    await openPrimaryWorkspace(workbench, "test.workspace", workspaceResource);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource?.metadata).toEqual(workspaceResource.metadata);
  });
  test("the open command prefers the active workspace over the primary workspace", async () => {
    const workbench = setup();
    workbench.layout.registerPanel({
      id: "test.active-workspace",
      title: "Active Workspace",
      region: "side",
      rendererId: "test.active-workspace",
    });
    await openPrimaryWorkspace(workbench, "test.primary-workspace", workspaceResource);
    workbench.layout.openPanel("test.active-workspace", { resource: activeWorkspaceResource });
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource?.metadata).toEqual(activeWorkspaceResource.metadata);
  });
  test("the open command keeps the primary workspace when the active resource has no workspace path", async () => {
    const workbench = setup();
    workbench.layout.registerPanel({
      id: "test.active-session",
      title: "Active Session",
      region: "side",
      rendererId: "test.active-session",
    });
    await openPrimaryWorkspace(workbench, "test.primary-workspace", workspaceResource);
    workbench.layout.openPanel("test.active-session", { resource: sessionResource });
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource?.metadata).toEqual(workspaceResource.metadata);
  });
  test("the open command ignores command context resources without a workspace path", async () => {
    const workbench = setup();
    workbench.layout.registerPanel({
      id: "test.primary-workspace",
      title: "Primary Workspace",
      region: "main",
      rendererId: "test.primary-workspace",
    });
    workbench.layout.openPanel("test.primary-workspace", { resource: workspaceResource });
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID, undefined, {
      resource: sessionResource,
    });
    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.viewId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource?.metadata).toEqual(workspaceResource.metadata);
  });
});
describe("terminal session lifecycle", () => {
  test("closing a terminal carried to another page ends its original session", async () => {
    const layouts = new Map<string | undefined, WorkbenchLayout>();
    const workbench = createWorkbench({
      layoutPersistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (layout, scope) => layouts.set(scope, structuredClone(layout)),
      },
      resolvePagePersistenceScope: ({ resource }) => ({ scope: resource?.id, carryRegions: ["secondary"] }),
    });
    workbench.registerModule(createWorkbenchTerminalModule());
    const killSignals: Array<string | undefined> = [];
    workbench.terminal.setSessionOpener(async () => ({
      id: "carried-terminal",
      write() {},
      resize() {},
      kill(signal) {
        killSignals.push(signal);
      },
      onData: () => () => undefined,
      onExit: () => () => undefined,
      onError: () => () => undefined,
    }));
    await openPrimaryWorkspace(workbench, "workspace", workspaceResource);
    const placement = openWorkbenchTerminal(workbench);
    await workbench.terminal.open({
      bindingId: placement.instanceId,
      request: { cols: 80, rows: 24 },
    });
    workbench.pageLocations.navigate({
      kind: "page",
      page: { extensionId: "pstdio.test", kind: "page", id: "workspace.page" },
      resource: activeWorkspaceResource,
    });
    expect(workbench.layout.getPersistenceScope()).toBe(activeWorkspaceResource.id);
    await Promise.resolve();
    expect(workbench.layout.getActivePanel("secondary")?.instanceId).toBe(placement.instanceId);
    expect(killSignals).toHaveLength(0);
    expect(workbench.terminal.getSession("carried-terminal")?.status).toBe("running");
    await workbench.closePlacement(placement.placementIdentity!);
    expect(workbench.layout.getPersistenceScope()).toBe(activeWorkspaceResource.id);
    expect(killSignals).toHaveLength(1);
    expect(workbench.terminal.getSession("carried-terminal")?.status).toBe("killed");
  });

  test("keeps a terminal alive across scope changes and kills it when its tab closes", async () => {
    const layouts = new Map<string | undefined, WorkbenchLayout>();
    const workbench = createWorkbench({
      layoutPersistence: {
        getLayout: (scope) => layouts.get(scope),
        setLayout: (layout, scope) => layouts.set(scope, structuredClone(layout)),
      },
    });
    workbench.registerModule(createWorkbenchTerminalModule());
    const killSignals: Array<string | undefined> = [];
    workbench.terminal.setSessionOpener(async () => ({
      id: "session-1",
      write() {},
      resize() {},
      kill(signal) {
        killSignals.push(signal);
      },
      onData: () => () => undefined,
      onExit: () => () => undefined,
      onError: () => () => undefined,
    }));
    workbench.layout.setPersistenceScope("workspace-1");
    const placement = openWorkbenchTerminal(workbench);
    await workbench.terminal.open({
      bindingId: placement.instanceId,
      request: { cols: 80, rows: 24 },
    });
    workbench.layout.setPersistenceScope("workspaces");
    expect(killSignals).toEqual([]);
    workbench.layout.setPersistenceScope("workspace-1");
    const identity = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((candidate) => candidate.widgetId === placement.instanceId)?.placementIdentity;
    if (identity) workbench.shellPlacements.closePlacement(identity);
    await Promise.resolve();
    expect(killSignals).toHaveLength(1);
  });
  test("restores saved terminal placements through the declared shell placement", async () => {
    let savedLayout: WorkbenchLayout | undefined;
    const persistence = {
      getLayout: () => savedLayout,
      setLayout: (layout: WorkbenchLayout) => {
        savedLayout = structuredClone(layout);
      },
    };
    const source = createWorkbench({ layoutPersistence: persistence });
    source.registerModule(createWorkbenchTerminalModule());
    await source.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    const restored = createWorkbench({ layoutPersistence: persistence });
    restored.registerModule(createWorkbenchTerminalModule());
    expect(restored.layout.getLayout().regions.secondary.widgets).toEqual([
      expect.objectContaining({
        viewId: WORKBENCH_TERMINAL_WIDGET_ID,
        title: "Terminal 1",
        mountStrategy: "keep-mounted",
        placementIdentity: expect.objectContaining({ kind: "shell", placementId: WORKBENCH_TERMINAL_WIDGET_ID }),
      }),
    ]);
  });
});

test("terminal close refuses to hide the tab when System activity cannot admit it", async () => {
  const queries = createScopedQueryClient({ runtimeId: "terminal-test", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  workbench.registerModule(createWorkbenchTerminalModule());
  const operations = getWorkbenchOperations(queries);
  const busy = Promise.withResolvers<void>();
  let stops = 0;
  const adapter = {
    id: "at-capacity",
    write() {},
    resize() {},
    kill: async () => {
      stops++;
    },
    onData: () => () => {},
    onExit: () => () => {},
    onError: () => () => {},
  };
  try {
    workbench.terminal.setSessionOpener(async () => adapter);
    const tab = openWorkbenchTerminal(workbench);
    await workbench.terminal.open({ bindingId: tab.instanceId, request: { cols: 80, rows: 24 } });
    for (let index = 0; index < 128; index++) {
      void operations
        .submit({ title: "Existing work", domain: "fixture", subjects: [String(index)], write: () => busy.promise })
        .result.catch(() => {});
    }
    await expect(Promise.resolve().then(() => workbench.closePlacement(tab.placementIdentity!))).rejects.toMatchObject({
      name: "OperationCapacityError",
    });
    expect(workbench.layout.getActivePanel("secondary")?.instanceId).toBe(tab.instanceId);
    expect(stops).toBe(0);
  } finally {
    busy.resolve();
    await workbench.dispose();
    queries.dispose();
  }
});

test("closing during terminal startup stops the original admission when it receives an adapter", async () => {
  const workbench = setup();
  const opener = Promise.withResolvers<WorkbenchTerminalSessionAdapter>();
  const stopped = Promise.withResolvers<void>();
  let kills = 0;
  let signal: AbortSignal | undefined;
  workbench.terminal.setSessionOpener((_request, _view, originalSignal) => {
    signal = originalSignal;
    return opener.promise;
  });
  try {
    const tab = openWorkbenchTerminal(workbench);
    const opening = workbench.terminal.open({ bindingId: tab.instanceId, request: { cols: 80, rows: 24 } });
    await workbench.closePlacement(tab.placementIdentity!);
    expect(workbench.layout.getActivePanel("secondary")).toBeUndefined();
    expect(signal?.aborted).toBe(false);
    opener.resolve({
      id: "starting-session",
      write() {},
      resize() {},
      kill: async () => {
        kills++;
        stopped.resolve();
      },
      onData: () => () => {},
      onExit: () => () => {},
      onError: () => () => {},
    });
    await opening;
    await stopped.promise;
    expect(kills).toBe(1);
  } finally {
    opener.reject(new Error("Test finished"));
    await workbench.dispose();
  }
});
