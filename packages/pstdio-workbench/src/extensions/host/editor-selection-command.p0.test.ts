import { expect, test } from "bun:test";
import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

test("a contributed editor action receives the captured selection and resource", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project-one");
  const resource = { type: "note", id: "note-one", extensionId: "notes", projectId: "project-one" };
  const selection = { text: "Selected passage", start: { line: 2, column: 1 }, end: { line: 2, column: 17 } };
  const received: CommandExecuteRequest[] = [];
  const metadata = {
    ...emptyWorkbenchExtensionMetadata,
    commands: [{ id: "consumer.command.ask", extensionId: "consumer", title: "Ask" }],
    menuContributions: [
      {
        id: "consumer.ask",
        extensionId: "consumer",
        commandId: "consumer.command.ask",
        slotId: "editor.selection",
        label: "Ask",
      },
    ],
  } satisfies WorkbenchExtensionMetadata;
  const registration = registerWorkbenchExtensionContributions({
    workbench,
    projectId: "project-one",
    metadata,
    menuSlotsById: new Map([["editor.selection", { menuPath: ["editor", "selection"] }]]),
    executeCommand: (_id, body) => {
      received.push(body);
      return { outcome: { ok: true, status: "success", value: null } };
    },
  });
  try {
    const action = workbench.layout.listMenuItems(["editor", "selection"])[0]!;
    const context = {
      projectId: "project-one",
      resource,
      slot: {
        id: "editor.selection",
        kind: "menu" as const,
        context: { selection, projectId: "forged", panelId: "forged" },
      },
    };
    await workbench.commands.executeCommand(action.commandId, {}, context);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      resource,
      slot: {
        id: "editor.selection",
        kind: "menu",
        context: { projectId: "project-one", panelId: "consumer.ask", selection },
      },
    });
    await workbench.commands.executeCommand(
      action.commandId,
      {},
      { ...context, slot: { ...context.slot, id: "unrelated.slot" } },
    );
    expect(received[1]?.slot?.context).toEqual({ projectId: "project-one", panelId: "consumer.ask" });
  } finally {
    registration.dispose();
    workbench.dispose();
  }
});
