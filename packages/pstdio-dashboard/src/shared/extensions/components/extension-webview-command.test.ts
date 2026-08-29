import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { executeWebviewCommand, openWebviewResource } from "./extension-webview-command";

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

  test("keeps the command outcome envelope for extension commands registered in the workbench", async () => {
    const workbench = createWorkbenchCore();
    const extensionCalls: unknown[] = [];
    const response = {
      commandId: "pstdio.extension-lab.command.counter.read",
      extensionId: "pstdio.extension-lab",
      outcome: { ok: true, status: "success", value: { counter: 1 } },
    };
    workbench.commands.registerCommand(
      { id: response.commandId, label: "Read counter" },
      { execute: () => response.outcome.value },
    );

    const result = await executeWebviewCommand({
      commandId: response.commandId,
      workbench,
      executeExtensionCommand: async (input) => {
        extensionCalls.push(input);
        return response;
      },
    });

    expect(result).toEqual(response);
    expect(extensionCalls).toEqual([{ commandId: response.commandId }]);
  });

  test("opens SDK resources with the same normalization used by commands", async () => {
    const calls: unknown[] = [];
    const workbench = {
      resources: {
        openResource: async (resource: unknown, input: unknown) => {
          calls.push({ input, resource });
        },
      },
    } as unknown as ReturnType<typeof createWorkbenchCore>;

    await openWebviewResource(workbench, {
      resource: { type: "ticket", id: "PS-1", label: "Ticket", metadata: { status: "open" } },
      input: { strategy: "replace-active" },
    });

    expect(calls).toEqual([
      {
        input: { replaceActive: true },
        resource: {
          id: "PS-1",
          kind: "ticket",
          label: "Ticket",
          metadata: { status: "open" },
          uri: "pstdio://extension-resource/ticket/PS-1",
        },
      },
    ]);
  });
});
