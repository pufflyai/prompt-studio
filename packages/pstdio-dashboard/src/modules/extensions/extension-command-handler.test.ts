import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse, ExtensionMenuContribution } from "@pstdio/sdk/api";
import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
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
    ctx: {} as unknown as WorkbenchModuleContributionContext,
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
});
