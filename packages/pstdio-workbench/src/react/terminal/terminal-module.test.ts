import { describe, expect, test } from "bun:test";
import {
  createWorkbenchCore,
  type ResourceRef,
  type WorkbenchLayout,
  workbenchTopHeaderTrailingMenuPath,
} from "../../core";
import {
  createWorkbenchTerminalModule,
  openWorkbenchTerminal,
  WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
  WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "./terminal-module";

const setup = () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createWorkbenchTerminalModule());
  return workbench;
};

const workspaceResource: ResourceRef = {
  kind: "workspace",
  id: "workspace-1",
  uri: "dashboard-workbench://workspace/workspace-1",
  metadata: { workspacePath: "/repo/.pstdio/workspaces/PS-161_A1" },
};

const activeWorkspaceResource: ResourceRef = {
  kind: "workspace",
  id: "workspace-2",
  uri: "dashboard-workbench://workspace/workspace-2",
  metadata: { workspacePath: "/repo/.pstdio/workspaces/PS-161_A2" },
};

const sessionResource: ResourceRef = {
  kind: "session",
  id: "session-1",
  uri: "dashboard-workbench://session/session-1",
};

const openPrimaryWorkspace = async (workbench: ReturnType<typeof setup>, panelId: string, resource: ResourceRef) => {
  workbench.resources.registerKind({ kind: resource.kind, label: "Workspace" });
  workbench.resources.registerPresenter({
    id: `${panelId}.presenter`,
    canOpen: (candidate) => candidate.kind === resource.kind,
    open: (candidate) => workbench.layout.openPanel(panelId, { resource: candidate }),
  });
  await workbench.resources.openResource(resource);
};

describe("createWorkbenchTerminalModule", () => {
  test("registers the host-owned terminal widget in the secondary region", () => {
    const workbench = setup();
    expect(workbench.layout.getWidget(WORKBENCH_TERMINAL_WIDGET_ID)).toMatchObject({
      region: "secondary",
      closable: true,
      mountStrategy: "keep-mounted",
      reuse: "none",
      regionSize: { defaultPx: 240, minPx: 128 },
      singleton: false,
      title: "Terminal",
    });
    expect(workbench.layout.getWidget(WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID)).toMatchObject({
      regionSize: { defaultPx: 240, minPx: 128 },
    });
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

    expect(workbench.layout.getWidget(WORKBENCH_TERMINAL_WIDGET_ID)).toMatchObject({
      openCommandId: WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
      region: "secondary",
    });
  });

  test("the open command reveals the terminal panel in the secondary region", async () => {
    const workbench = setup();
    workbench.panels.setOpen("secondary", false);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const widgets = workbench.layout.getLayout().regions.secondary.widgets;
    const terminals = widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(widgets.map((placement) => placement.contributionId)).toEqual([
      WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
      WORKBENCH_TERMINAL_WIDGET_ID,
    ]);
    expect(terminals[0]).toMatchObject({
      closable: true,
      mountStrategy: "keep-mounted",
      title: "Terminal 1",
    });
    expect(workbench.panels.isOpen("secondary")).toBe(true);
  });

  test("mounts a hidden terminal launcher before the first terminal opens", () => {
    const workbench = setup();

    expect(workbench.layout.getLayout().regions.secondary.widgets).toEqual([
      expect.objectContaining({
        closable: false,
        contributionId: WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
        hiddenByDefault: true,
      }),
    ]);
  });

  test("keeps the hidden launcher out of the visible terminal tabs", async () => {
    const workbench = setup();

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const launcher = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find(
        (placement) => placement.contributionId === WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
      );

    expect(launcher).toMatchObject({
      hiddenByDefault: true,
      title: "Terminal",
    });
  });

  test("opening the terminal again creates another workbench tab", async () => {
    const workbench = setup();

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const widgets = workbench.layout.getLayout().regions.secondary.widgets;
    const terminals = widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals).toHaveLength(2);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 1", "Terminal 2"]);
    expect(workbench.layout.getLayout().regions.secondary.activeWidgetId).toBe(terminals[1]?.widgetId);
  });

  test("opening another terminal keeps numbering after process titles replace tab titles", async () => {
    const workbench = setup();

    const firstTerminal = await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    workbench.layout.updatePanel((firstTerminal as { instanceId: string }).instanceId, { title: "zsh" });

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminals = workbench.layout
      .getLayout()
      .regions.secondary.widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals.map((placement) => placement.title)).toEqual(["zsh", "Terminal 2"]);
  });

  test("terminal numbering does not reuse closed tab titles", async () => {
    const workbench = setup();

    const firstTerminal = await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    workbench.layout.closePanel((firstTerminal as { instanceId: string }).instanceId);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminals = workbench.layout
      .getLayout()
      .regions.secondary.widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 2", "Terminal 3"]);
  });

  test("terminal numbering reconciles with externally opened terminal titles", async () => {
    const workbench = setup();

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    workbench.layout.openPanel(WORKBENCH_TERMINAL_WIDGET_ID, {
      title: "Terminal 10",
      strategy: { kind: "persistent" },
    });

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminals = workbench.layout
      .getLayout()
      .regions.secondary.widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 1", "Terminal 10", "Terminal 11"]);
  });

  test("terminal numbering stays monotonic across module contexts", async () => {
    const workbench = setup();

    const firstTerminal = openWorkbenchTerminal(workbench);
    workbench.layout.closePanel(firstTerminal.instanceId);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminals = workbench.layout
      .getLayout()
      .regions.secondary.widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 2"]);
  });

  test("the open command inherits the active workspace resource", async () => {
    const workbench = setup();
    workbench.layout.registerPanel({
      closable: false,
      id: "test.workspace",
      title: "Workspace",
      region: "main",
      rendererId: "test.workspace",
    });
    await openPrimaryWorkspace(workbench, "test.workspace", workspaceResource);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource).toBe(workspaceResource);
  });

  test("the open command prefers the active workspace over the primary workspace", async () => {
    const workbench = setup();
    workbench.layout.registerPanel({
      closable: false,
      id: "test.primary-workspace",
      title: "Primary Workspace",
      region: "main",
      rendererId: "test.primary-workspace",
    });
    workbench.layout.registerPanel({
      closable: false,
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
      .regions.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource).toBe(activeWorkspaceResource);
  });

  test("the open command keeps the primary workspace when the active resource has no workspace path", async () => {
    const workbench = setup();
    workbench.layout.registerPanel({
      closable: false,
      id: "test.primary-workspace",
      title: "Primary Workspace",
      region: "main",
      rendererId: "test.primary-workspace",
    });
    workbench.layout.registerPanel({
      closable: false,
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
      .regions.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource).toBe(workspaceResource);
  });

  test("the open command ignores command context resources without a workspace path", async () => {
    const workbench = setup();
    workbench.layout.registerPanel({
      closable: false,
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
      .regions.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource).toBe(workspaceResource);
  });
});

describe("restored terminal selection", () => {
  test("restores a real terminal when the hidden launcher was persisted active", async () => {
    const savedLayouts: WorkbenchLayout[] = [];
    const persistence = {
      getLayout: () => savedLayouts.at(-1),
      setLayout: (layout: WorkbenchLayout) => savedLayouts.push(structuredClone(layout)),
    };
    const firstWorkbench = createWorkbenchCore({ layoutPersistence: persistence });
    firstWorkbench.registerModule(createWorkbenchTerminalModule());
    await firstWorkbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    firstWorkbench.layout.setRegionActiveWidget("secondary", WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID);
    expect(firstWorkbench.layout.getLayout().regions.secondary.activeWidgetId).toBe(
      WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
    );

    const restoredWorkbench = createWorkbenchCore({ layoutPersistence: persistence });
    restoredWorkbench.registerModule(createWorkbenchTerminalModule());
    const secondary = restoredWorkbench.layout.getLayout().regions.secondary;
    const restoredTerminal = secondary.widgets.find(
      (placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID,
    );

    expect(secondary.activeWidgetId).toBe(restoredTerminal?.widgetId);
  });
});
