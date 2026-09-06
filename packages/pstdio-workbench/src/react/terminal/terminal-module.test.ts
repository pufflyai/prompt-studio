import { describe, expect, test } from "bun:test";
import {
  createWorkbench,
  type ResourceRef,
  shellPlacementContributionId,
  type WorkbenchLayout,
  workbenchTopHeaderTrailingMenuPath,
} from "../../core";
import {
  createWorkbenchTerminalModule,
  openWorkbenchTerminal,
  WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "./terminal-module";
import { terminalPlacementBindingId } from "./terminal-placement-binding";

const setup = () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkbenchTerminalModule());
  return workbench;
};

const workspaceResource: ResourceRef = {
  kind: "workspace",
  id: "workspace-1",
  uri: "pstdio://extension-resource/workspace/workspace-1",
  metadata: { workspacePath: "/repo/.pstdio/workspaces/PS-161_A1" },
};

const activeWorkspaceResource: ResourceRef = {
  kind: "workspace",
  id: "workspace-2",
  uri: "pstdio://extension-resource/workspace/workspace-2",
  metadata: { workspacePath: "/repo/.pstdio/workspaces/PS-161_A2" },
};

const sessionResource: ResourceRef = {
  kind: "session",
  id: "session-1",
  uri: "pstdio://extension-resource/session/session-1",
};

const openPrimaryWorkspace = async (workbench: ReturnType<typeof setup>, panelId: string, resource: ResourceRef) => {
  workbench.resources.registerKind({ kind: resource.kind, label: "Workspace" });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({
    id: panelId,
    title: "Workspace",
    body: { kind: "react", render: () => null },
  });
  const page = { extensionId: "pstdio.test", kind: "page" as const, id: `${panelId}.page` };
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    path: page.id,
    modeId: "project",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { resourceKinds: [resource.kind], viewId: panelId, cardinality: "one" },
      },
    ],
  });
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.navigate({
    kind: "page",
    page,
    resource: {
      type: resource.kind,
      id: resource.id ?? resource.uri,
      label: resource.label,
      metadata: { workspacePath: String(resource.metadata?.workspacePath ?? "") },
    },
  });
};

describe("createWorkbenchTerminalModule", () => {
  test("registers the host-owned terminal widget in the secondary region", () => {
    const workbench = setup();
    expect(workbench.shellPlacements.getPlacement(WORKBENCH_TERMINAL_WIDGET_ID)).toMatchObject({
      region: "secondary",
      mountStrategy: "keep-mounted",
      item: {
        kind: "resource",
        cardinality: "many",
        viewId: WORKBENCH_TERMINAL_WIDGET_ID,
        add: { kind: "command", commandId: WORKBENCH_TERMINAL_OPEN_COMMAND_ID },
      },
    });
    expect(workbench.views.getView(WORKBENCH_TERMINAL_WIDGET_ID)).toMatchObject({ title: "Terminal" });
  });

  test("does not register a global top-header terminal panel", () => {
    const workbench = setup();

    expect(
      workbench.layout
        .listMenuItems(workbenchTopHeaderTrailingMenuPath)
        .some((item) => item.commandId === WORKBENCH_TERMINAL_OPEN_COMMAND_ID),
    ).toBe(false);
  });

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
    const firstIdentity = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find(
        (candidate) => candidate.widgetId === (firstTerminal as { instanceId: string }).instanceId,
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
      bindingId: terminalPlacementBindingId("workspace-1", placement.instanceId),
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

    expect(killSignals).toEqual([undefined]);
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
