import { describe, expect, test } from "bun:test";
import {
  createWorkbenchCore,
  type ResourceRef,
  workbenchRegionTabLeadingMenuPath,
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

describe("createWorkbenchTerminalModule", () => {
  test("registers the host-owned terminal widget in the secondary region", () => {
    const workbench = setup();
    expect(workbench.layout.getWidget(WORKBENCH_TERMINAL_WIDGET_ID)).toMatchObject({
      region: "secondary",
      closable: true,
      mountStrategy: "keep-mounted",
      reuse: "none",
      singleton: false,
      title: "Terminal",
    });
  });

  test("does not register a global top-header terminal opener", () => {
    const workbench = setup();

    expect(
      workbench.layout
        .listMenuItems(workbenchTopHeaderTrailingMenuPath)
        .some((item) => item.commandId === WORKBENCH_TERMINAL_OPEN_COMMAND_ID),
    ).toBe(false);
  });

  test("the secondary tab strip keeps the terminal opener", () => {
    const workbench = setup();

    expect(workbench.layout.listMenuItems(workbenchRegionTabLeadingMenuPath("secondary"))).toContainEqual(
      expect.objectContaining({ commandId: WORKBENCH_TERMINAL_OPEN_COMMAND_ID, label: "New terminal" }),
    );
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

  test("keeps a hidden terminal launcher after the terminal has opened", async () => {
    const workbench = setup();

    expect(workbench.layout.getLayout().regions.secondary.widgets).toEqual([]);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    workbench.layout.closeWidget(WORKBENCH_TERMINAL_WIDGET_ID);

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
    workbench.layout.updateWidgetPlacement((firstTerminal as { widgetId: string }).widgetId, { title: "zsh" });

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
    workbench.layout.closeWidget((firstTerminal as { widgetId: string }).widgetId);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminals = workbench.layout
      .getLayout()
      .regions.secondary.widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 2", "Terminal 3"]);
  });

  test("terminal numbering reconciles with externally opened terminal titles", async () => {
    const workbench = setup();

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    workbench.layout.openWidget(WORKBENCH_TERMINAL_WIDGET_ID, { title: "Terminal 10" });

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminals = workbench.layout
      .getLayout()
      .regions.secondary.widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 1", "Terminal 10", "Terminal 11"]);
  });

  test("terminal numbering stays monotonic across module contexts", async () => {
    const workbench = setup();

    const firstTerminal = openWorkbenchTerminal(workbench);
    workbench.layout.closeWidget(firstTerminal.widgetId);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminals = workbench.layout
      .getLayout()
      .regions.secondary.widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 2"]);
  });

  test("the open command inherits the active workspace resource", async () => {
    const workbench = setup();
    workbench.layout.registerWidget({
      id: "test.workspace",
      title: "Workspace",
      region: "main",
      rendererId: "test.workspace",
    });
    workbench.layout.openWidget("test.workspace", { resource: workspaceResource });

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource).toBe(workspaceResource);
  });

  test("the open command prefers the active workspace over the primary workspace", async () => {
    const workbench = setup();
    workbench.layout.registerWidget({
      id: "test.primary-workspace",
      title: "Primary Workspace",
      region: "main",
      rendererId: "test.primary-workspace",
    });
    workbench.layout.registerWidget({
      id: "test.active-workspace",
      title: "Active Workspace",
      region: "side",
      rendererId: "test.active-workspace",
    });
    workbench.layout.openWidget("test.primary-workspace", { resource: workspaceResource });
    workbench.layout.openWidget("test.active-workspace", { resource: activeWorkspaceResource });

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource).toBe(activeWorkspaceResource);
  });

  test("the open command keeps the primary workspace when the active resource has no workspace path", async () => {
    const workbench = setup();
    workbench.layout.registerWidget({
      id: "test.primary-workspace",
      title: "Primary Workspace",
      region: "main",
      rendererId: "test.primary-workspace",
    });
    workbench.layout.registerWidget({
      id: "test.active-session",
      title: "Active Session",
      region: "side",
      rendererId: "test.active-session",
    });
    workbench.layout.openWidget("test.primary-workspace", { resource: workspaceResource });
    workbench.layout.openWidget("test.active-session", { resource: sessionResource });

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource).toBe(workspaceResource);
  });

  test("the open command ignores command context resources without a workspace path", async () => {
    const workbench = setup();
    workbench.layout.registerWidget({
      id: "test.primary-workspace",
      title: "Primary Workspace",
      region: "main",
      rendererId: "test.primary-workspace",
    });
    workbench.layout.openWidget("test.primary-workspace", { resource: workspaceResource });

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID, undefined, {
      resource: sessionResource,
    });

    const terminal = workbench.layout
      .getLayout()
      .regions.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminal?.resource).toBe(workspaceResource);
  });
});
