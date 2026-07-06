import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createHistoryExampleModule, HISTORY_CLOSE_ACTIVE_WIDGET_COMMAND_ID } from "./module";

describe("createHistoryExampleModule", () => {
  test("registers a story-local close command for the active ticket widget", async () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createHistoryExampleModule());

    expect(workbench.commands.getCommand(HISTORY_CLOSE_ACTIVE_WIDGET_COMMAND_ID)).toBeDefined();
    expect(workbench.commands.isCommandEnabled(HISTORY_CLOSE_ACTIVE_WIDGET_COMMAND_ID)).toBe(false);

    await workbench.resources.openResource({
      kind: "history.example.ticket",
      uri: "history.example.ticket:PS-1",
      id: "PS-1",
      label: "Ticket PS-1",
      icon: "component",
    });

    expect(workbench.commands.isCommandEnabled(HISTORY_CLOSE_ACTIVE_WIDGET_COMMAND_ID)).toBe(true);

    await workbench.commands.executeCommand(HISTORY_CLOSE_ACTIVE_WIDGET_COMMAND_ID);

    expect(workbench.layout.getLayout().areas.main.widgets).toHaveLength(0);
    expect(workbench.commands.isCommandEnabled(HISTORY_CLOSE_ACTIVE_WIDGET_COMMAND_ID)).toBe(false);
  });
});
