import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, workbenchAreaTabLeadingMenuPath, workbenchTopHeaderTrailingMenuPath } from "../../core";
import {
  createWorkbenchTerminalModule,
  WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID,
  WORKBENCH_TERMINAL_OPEN_COMMAND_ID,
  WORKBENCH_TERMINAL_WIDGET_ID,
} from "./terminal-module";

const setup = () => {
  const workbench = createWorkbenchCore();
  workbench.registerModule(createWorkbenchTerminalModule());
  return workbench;
};

describe("createWorkbenchTerminalModule", () => {
  test("registers the host-owned terminal widget in the secondary area", () => {
    const workbench = setup();
    expect(workbench.layout.getWidget(WORKBENCH_TERMINAL_WIDGET_ID)).toMatchObject({
      area: "secondary",
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

    expect(workbench.layout.listMenuItems(workbenchAreaTabLeadingMenuPath("secondary"))).toContainEqual(
      expect.objectContaining({ commandId: WORKBENCH_TERMINAL_OPEN_COMMAND_ID, label: "New terminal" }),
    );
  });

  test("the open command reveals the terminal panel in the secondary area", async () => {
    const workbench = setup();
    workbench.panels.setOpen("secondary", false);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const widgets = workbench.layout.getLayout().areas.secondary.widgets;
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

    expect(workbench.layout.getLayout().areas.secondary.widgets).toEqual([]);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    workbench.layout.closeWidget(WORKBENCH_TERMINAL_WIDGET_ID);

    expect(workbench.layout.getLayout().areas.secondary.widgets).toEqual([
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
      .areas.secondary.widgets.find((placement) => placement.contributionId === WORKBENCH_TERMINAL_LAUNCHER_WIDGET_ID);

    expect(launcher).toMatchObject({
      hiddenByDefault: true,
      title: "Terminal",
    });
  });

  test("opening the terminal again creates another workbench tab", async () => {
    const workbench = setup();

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const widgets = workbench.layout.getLayout().areas.secondary.widgets;
    const terminals = widgets.filter((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID);
    expect(terminals).toHaveLength(2);
    expect(terminals.map((placement) => placement.title)).toEqual(["Terminal 1", "Terminal 2"]);
    expect(workbench.layout.getLayout().areas.secondary.activeWidgetId).toBe(terminals[1]?.widgetId);
  });
});
