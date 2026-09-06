import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import { resourceKey } from "@pstdio/sdk/extensions";
import type { ResourceRef, WorkbenchCommandExecutionContext, WorkbenchModuleContext } from "../../core";
import { unwrapCommandValue } from "./command-response";
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
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const deletedResourceId = (value: unknown) => {
  if (!isRecord(value) || value.deleted !== true) return undefined;
  return typeof value.id === "string" ? value.id : undefined;
};
const handleDeletedResource = async (
  context: WorkbenchExtensionCommandContext,
  resource: ResourceRef | undefined,
  value: unknown,
) => {
  if (!resource || deletedResourceId(value) !== (resource.id ?? resourceKey(resource))) return;
  if (resourceKey(context.workbench.getPrimaryResource()) !== resourceKey(resource)) return;
  const result = context.workbench.pageLocations.navigateToParent();
  if (!result.ok) throw new Error(result.diagnostic.message);
};
export const executeWorkbenchExtensionCommand = async (
  context: WorkbenchExtensionCommandContext,
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
  const value = unwrapCommandValue(response);
  await handleDeletedResource(context, input.resource, value);
  return value;
};
