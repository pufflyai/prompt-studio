import type { CommandExecuteRequest } from "@pstdio/sdk/api";
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

export const toExtensionCommandResource = (resource: ResourceRef | undefined): CommandExecuteRequest["resource"] => {
  if (!resource) return undefined;
  return {
    type: resource.kind,
    id: resource.id ?? resource.uri,
    label: resource.label,
    metadata: resource.metadata,
  };
};

export const toWorkbenchResource = (resource: NonNullable<CommandExecuteRequest["resource"]>): ResourceRef => {
  const icon = (resource as { icon?: unknown }).icon;
  const metadata = resource.projectId ? { ...resource.metadata, projectId: resource.projectId } : resource.metadata;
  return {
    kind: resource.type,
    uri: `pstdio://extension-resource/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}`,
    id: resource.id,
    label: resource.label,
    icon: typeof icon === "string" ? icon : undefined,
    metadata,
  };
};

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

export const executeWorkbenchExtensionCommand = async (
  context: WorkbenchExtensionCommandContext,
  commandId: string,
  input: ExecuteWorkbenchExtensionCommandInput = {},
) => {
  const resource = toExtensionCommandResource(input.resource);
  const response = await context.executeCommand(commandId, {
    projectId: context.projectId,
    ...(input.params ? { params: input.params } : {}),
    ...(resource ? { resource } : {}),
    ...(input.slot ? { slot: input.slot } : {}),
    source: "dashboard",
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });
  return unwrapCommandValue(response);
};
