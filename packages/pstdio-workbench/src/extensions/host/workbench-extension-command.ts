import type { CommandExecuteRequest, CommandExecutionResult, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type {
  ResourceRef,
  WorkbenchCommandExecutionContext,
  WorkbenchModuleContext,
  WorkbenchPanelRegion,
} from "../../core";
import { resolveCommandResourceParams } from "../../core/registries/commands/command-resource-params";
import { unwrapCommandValue } from "./command-response";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";
import { runResourceMutation } from "./workbench-resource-mutation";
export interface WorkbenchExtensionCommandContext {
  metadata?: Pick<WorkbenchExtensionMetadata, "commands">;
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
  placement?: PlacementIdentity;
  region?: WorkbenchPanelRegion;
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
    workbench: Pick<WorkbenchModuleContext, "navigation" | "notifications" | "resources">;
  },
  commandId: string,
  input: ExecuteWorkbenchExtensionCommandInput = {},
) => {
  const resource = input.resource;
  const removalVersion = context.workbench.resources.getRemovalVersion();
  const reportNavigationError = context.workbench.notifications.captureActionError("Open command result");
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
  const outcome = (response as Partial<CommandExecutionResult> | undefined)?.outcome;
  if (outcome?.status === "success" && !input.signal?.aborted) {
    for (const target of outcome.navigationRequests ?? []) {
      if (input.signal?.aborted) break;
      try {
        await context.workbench.navigation.openTarget(toWorkbenchNavigationTarget(target, { region: input.region }), {
          viewer: input.placement,
          projectId: context.projectId,
          removalVersion,
        });
      } catch (error) {
        reportNavigationError(error);
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
  const command = context.metadata?.commands.find((candidate) => candidate.id === commandId);
  const params = command
    ? { ...resolveCommandResourceParams(command.params, input.params, { resource: input.resource }), ...input.params }
    : input.params;
  const persist = async () =>
    unwrapCommandValue(await executeWorkbenchExtensionCommandResponse(context, commandId, { ...input, params }));
  return command ? runResourceMutation(context, command, params, { resource: input.resource }, persist) : persist();
};
