import { describe, expect, mock, test } from "bun:test";
import type { CommandExecuteResponse, ExtensionMenuContribution } from "@pstdio/sdk/api";
import type { ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createExtensionMenuCommandHandler } from "./extension-command-handler";

const response = {
  commandId: "extension.workspace.review",
  extensionId: "pstdio.extension-lab",
  outcome: { ok: true, status: "success", value: null },
} satisfies CommandExecuteResponse;

const contribution = {
  id: "extension.workspace.review.menu.0",
  extensionId: "pstdio.extension-lab",
  commandId: "extension.workspace.review",
  slotId: "workspace.headerPrimary",
  label: "Review workspace",
} satisfies ExtensionMenuContribution;

describe("extension command handler", () => {
  test("passes enriched workspace resource metadata to extension commands", async () => {
    const executeCommand = mock(async () => response);
    const resource = {
      kind: "workspace",
      uri: "dashboard-workbench://workspace/workspace-1",
      id: "workspace-1",
      label: "Dashboard workbench datalayer",
      metadata: {
        workspaceId: "workspace-1",
        workspaceShorthand: "PS-307_A1",
        ticket: "PS-307",
        ticketId: "ticket-1",
        diffOverview: "+8 -2",
        diffAdditions: 8,
        diffDeletions: 2,
        diffFileCount: 3,
      },
    } satisfies ResourceRef;
    const ctx = {
      notifications: { show: mock() },
    } as unknown as WorkbenchModuleContributionContext;
    const handler = createExtensionMenuCommandHandler({
      ctx,
      contribution,
      executeCommand,
      getActiveResource: () => resource,
      projectId: "project-1",
    });

    await handler.execute();

    expect(executeCommand).toHaveBeenCalledWith(
      "project-1",
      "extension.workspace.review",
      expect.objectContaining({
        resource: expect.objectContaining({
          type: "workspace",
          id: "workspace-1",
          label: "Dashboard workbench datalayer",
          metadata: expect.objectContaining({
            workspaceShorthand: "PS-307_A1",
            ticket: "PS-307",
            ticketId: "ticket-1",
            diffOverview: "+8 -2",
            diffAdditions: 8,
            diffDeletions: 2,
            diffFileCount: 3,
          }),
        }),
      }),
    );
  });
});
