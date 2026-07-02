import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import {
  createWorkbenchTerminalModule,
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
      singleton: true,
      title: "Terminal",
    });
  });

  test("the open command reveals the terminal panel in the secondary area", async () => {
    const workbench = setup();
    workbench.panels.setOpen("secondary", false);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const widgets = workbench.layout.getLayout().areas.secondary.widgets;
    expect(widgets.map((placement) => placement.widgetId)).toEqual([WORKBENCH_TERMINAL_WIDGET_ID]);
    expect(workbench.panels.isOpen("secondary")).toBe(true);
  });

  test("opening the terminal again focuses the existing panel instead of duplicating it", async () => {
    const workbench = setup();

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const widgets = workbench.layout.getLayout().areas.secondary.widgets;
    expect(widgets).toHaveLength(1);
    expect(widgets[0]?.widgetId).toBe(WORKBENCH_TERMINAL_WIDGET_ID);
  });
});
