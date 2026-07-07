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
      closable: true,
      mountStrategy: "keep-mounted",
      reuse: "none",
      singleton: false,
      title: "Terminal",
    });
  });

  test("the open command reveals the terminal panel in the secondary area", async () => {
    const workbench = setup();
    workbench.panels.setOpen("secondary", false);

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const widgets = workbench.layout.getLayout().areas.secondary.widgets;
    expect(widgets.map((placement) => placement.widgetId)).toEqual([WORKBENCH_TERMINAL_WIDGET_ID]);
    expect(widgets[0]).toMatchObject({
      closable: true,
      mountStrategy: "keep-mounted",
      title: "Terminal 1",
    });
    expect(workbench.panels.isOpen("secondary")).toBe(true);
  });

  test("opening the terminal again creates another workbench tab", async () => {
    const workbench = setup();

    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);
    await workbench.commands.executeCommand(WORKBENCH_TERMINAL_OPEN_COMMAND_ID);

    const widgets = workbench.layout.getLayout().areas.secondary.widgets;
    expect(widgets).toHaveLength(2);
    expect(widgets.map((placement) => placement.title)).toEqual(["Terminal 1", "Terminal 2"]);
    expect(widgets.every((placement) => placement.contributionId === WORKBENCH_TERMINAL_WIDGET_ID)).toBe(true);
    expect(workbench.layout.getLayout().areas.secondary.activeWidgetId).toBe(widgets[1]?.widgetId);
  });
});
