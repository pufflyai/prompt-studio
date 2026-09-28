import type { CommandExecuteRequest, CommandExecuteResponse } from "@pstdio/sdk/api";
import type { ResourceRef, WorkbenchCommandExecutionContext, WorkbenchModuleContext } from "../../core";
import { unwrapCommandValue } from "./command-response";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";
export interface WorkbenchExtensionCommandContext {
  executeCommand(commandId: string, body: CommandExecuteRequest, signal?: AbortSignal): Promise<unknown> | unknown;
  prepareCommandArgs?(
    commandId: string,
    args: unknown,
    context?: WorkbenchCommandExecutionContext,
    onArgsChange?: (args: unknown) => void,
  ): Promise<unknown> | unknown;
  projectId: string;
  workbench: WorkbenchModuleContext;
}
export interface ExecuteWorkbenchExtensionCommandInput {
  workspaceId?: string;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  params?: Record<string, unknown>;
  resource?: ResourceRef;
  slot?: CommandExecuteRequest["slot"];
}
export const createExtensionSlot = (input: {
  context?: Record<string, unknown>;
  id: string;
  kind: NonNullable<CommandExecuteRequest["slot"]>["kind"];
  projectId: string;
}) => ({
  id: input.id,
  kind: input.kind,
  context: { projectId: input.projectId, ...(input.context ?? {}) },
});
export const executeWorkbenchExtensionCommandResponse = async (
  context: Pick<WorkbenchExtensionCommandContext, "executeCommand" | "projectId"> & {
    workbench: Pick<WorkbenchModuleContext, "navigation" | "notifications">;
  },
  commandId: string,
  input: ExecuteWorkbenchExtensionCommandInput = {},
) => {
  const resource = input.resource;
  const response = await context.executeCommand(
    commandId,
    {
      projectId: context.projectId,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      ...(input.params ? { params: input.params } : {}),
      ...(resource ? { resource } : {}),
      ...(input.slot ? { slot: input.slot } : {}),
      source: "dashboard",
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
    input.signal,
  );
  unwrapCommandValue(response);
  const outcome = (response as Partial<CommandExecuteResponse> | undefined)?.outcome;
  if (outcome?.status === "success") {
    for (const target of outcome.navigationRequests ?? []) {
      try {
        await context.workbench.navigation.openTarget(toWorkbenchNavigationTarget(target));
      } catch (error) {
        context.workbench.notifications.show({
          level: "warning",
          title: "Command completed, but navigation failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return response;
};
export const executeWorkbenchExtensionCommand = async (
  context: WorkbenchExtensionCommandContext,
  commandId: string,
  input: ExecuteWorkbenchExtensionCommandInput = {},
) => {
  const value = unwrapCommandValue(await executeWorkbenchExtensionCommandResponse(context, commandId, input));
  return value;
};
