import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse, ExtensionMenuContribution } from "@pstdio/sdk/api";
import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { createExtensionMenuCommandHandler } from "./extension-command-handler";

const successResponse = {
  outcome: { ok: true, status: "success", value: {} },
} as unknown as CommandExecuteResponse;

const baseContribution = {
  id: "pstdio-planner.run-attempt.menu.0",
  commandId: "pstdio-planner.run-attempt",
  slotId: "ticket.headerPrimary",
} as unknown as ExtensionMenuContribution;

const createHandler = (input: { contribution: ExtensionMenuContribution; onBody: (body: unknown) => void }) =>
  createExtensionMenuCommandHandler({
    ctx: {} as unknown as WorkbenchModuleContext,
    contribution: input.contribution,
    executeCommand: async (_projectId, _commandId, body) => {
      input.onBody(body);
      return successResponse;
    },
    getActiveResource: () => undefined,
    projectId: "project-1",
  });

describe("extension menu command handler", () => {
  test("forwards collected args as params merged with contribution params", async () => {
    let body: { params?: unknown } | undefined;
    const handler = createHandler({
      contribution: { ...baseContribution, params: { template: "refine-ticket" } } as ExtensionMenuContribution,
      onBody: (value) => {
        body = value as { params?: unknown };
      },
    });

    await handler.execute({ agent: { harnessId: "opencode", model: "gpt-5" } });

    expect(body?.params).toEqual({
      template: "refine-ticket",
      agent: { harnessId: "opencode", model: "gpt-5" },
    });
  });

  test("omits params when the action has neither contribution params nor collected args", async () => {
    let body: { params?: unknown } | undefined;
    const handler = createHandler({
      contribution: baseContribution,
      onBody: (value) => {
        body = value as { params?: unknown };
      },
    });

    await handler.execute(undefined);

    expect(body).toBeDefined();
    expect(body).not.toHaveProperty("params");
  });

  test("uses the command execution resource before the active resource", async () => {
    let body: { resource?: { type?: string; id?: string } } | undefined;
    const activeTicket = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/PS-1",
      id: "PS-1",
      label: "PS-1",
    } satisfies ResourceRef;
    const rowWorkspace = {
      kind: "workspace",
      uri: "dashboard-workbench://workspace/ws-1",
      id: "ws-1",
      label: "WS-1",
    } satisfies ResourceRef;
    const handler = createExtensionMenuCommandHandler({
      ctx: {} as unknown as WorkbenchModuleContext,
      contribution: baseContribution,
      executeCommand: async (_projectId, _commandId, value) => {
        body = value as { resource?: { type?: string; id?: string } };
        return successResponse;
      },
      getActiveResource: () => activeTicket,
      projectId: "project-1",
    });

    await handler.execute(undefined, { resource: rowWorkspace });

    expect(body?.resource).toMatchObject({ type: "workspace", id: "ws-1" });
  });
});
