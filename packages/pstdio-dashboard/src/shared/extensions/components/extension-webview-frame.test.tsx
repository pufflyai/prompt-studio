import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { executeWebviewCommand } from "./extension-webview-command";
import { notificationStatusRouteVerb } from "./notification-transition-route";

describe("notificationStatusRouteVerb", () => {
  test("maps dismissed status to the dismiss route verb", () => {
    expect(notificationStatusRouteVerb("dismissed")).toBe("dismiss");
  });

  test("keeps done status as the done route verb", () => {
    expect(notificationStatusRouteVerb("done")).toBe("done");
  });
});

describe("executeWebviewCommand", () => {
  test("runs registered workbench commands in the host", async () => {
    const workbench = createWorkbenchCore();
    const extensionCalls: unknown[] = [];
    workbench.commands.registerCommand(
      { id: "workbench.test.open", label: "Open" },
      {
        execute: (params, context) => ({ context, params, source: "workbench" }),
      },
    );

    const result = await executeWebviewCommand({
      commandId: "workbench.test.open",
      params: { modeId: "lab" },
      resource: { type: "ticket", id: "PS-1", label: "Ticket", metadata: { status: "open" } },
      workbench,
      executeExtensionCommand: async (input) => {
        extensionCalls.push(input);
      },
    });

    expect(result).toEqual({
      context: {
        resource: {
          id: "PS-1",
          kind: "ticket",
          label: "Ticket",
          metadata: { status: "open" },
          uri: "pstdio://extension-resource/ticket/PS-1",
        },
      },
      params: { modeId: "lab" },
      source: "workbench",
    });
    expect(extensionCalls).toEqual([]);
  });

  test("sends extension commands to the project API", async () => {
    const workbench = createWorkbenchCore();
    const extensionCalls: unknown[] = [];

    await executeWebviewCommand({
      commandId: "extension-lab.counter.bump",
      metadata: { sourcePanel: "lab" },
      params: { amount: 1 },
      resource: { type: "counter", id: "main" },
      workbench,
      executeExtensionCommand: async (input) => {
        extensionCalls.push(input);
      },
    });

    expect(extensionCalls).toEqual([
      {
        commandId: "extension-lab.counter.bump",
        metadata: { sourcePanel: "lab" },
        params: { amount: 1 },
        resource: { type: "counter", id: "main" },
      },
    ]);
  });
});
