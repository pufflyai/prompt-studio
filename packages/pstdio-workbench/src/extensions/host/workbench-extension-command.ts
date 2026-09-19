import type { CommandExecuteRequest, CommandExecuteResponse } from "@pstdio/sdk/api";
import type { ResourceRef, WorkbenchCommandExecutionContext, WorkbenchModuleContext } from "../../core";
import { unwrapCommandValue } from "./command-response";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";
export interface WorkbenchExtensionCommandContext {
  executeCommand(commandId: string, body: CommandExecuteRequest): Promise<unknown> | unknown;
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
    workbench: Pick<WorkbenchModuleContext, "navigation">;
  },
  commandId: string,
  input: ExecuteWorkbenchExtensionCommandInput = {},
) => {
  const resource = input.resource;
  const response = await context.executeCommand(commandId, {
    projectId: context.projectId,
    ...(input.params ? { params: input.params } : {}),
    ...(resource ? { resource } : {}),
    ...(input.slot ? { slot: input.slot } : {}),
    source: "dashboard",
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });
  unwrapCommandValue(response);
  const outcome = (response as Partial<CommandExecuteResponse> | undefined)?.outcome;
  if (outcome?.status === "success") {
    for (const target of outcome.navigationRequests ?? []) {
      await context.workbench.navigation.openTarget(toWorkbenchNavigationTarget(target));
    }
  }
  return response;
};
export const executeWorkbenchExtensionCommand = async (
  context: WorkbenchExtensionCommandContext,
  commandId: string,
  input: ExecuteWorkbenchExtensionCommandInput = {},
) => unwrapCommandValue(await executeWorkbenchExtensionCommandResponse(context, commandId, input));
