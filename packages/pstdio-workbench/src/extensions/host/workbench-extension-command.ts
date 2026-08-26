import type { CommandExecuteRequest } from "@pstdio/sdk/api";
import {
  isWorkbenchViewHierarchyNode,
  type ResourceRef,
  type WorkbenchCommandExecutionContext,
  type WorkbenchModuleContext,
} from "../../core";
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
  if (!resource || deletedResourceId(value) !== (resource.id ?? resource.uri)) return;

  context.workbench.navigator.forgetResource(resource.uri);
  if (context.workbench.getPrimaryResource()?.uri !== resource.uri) return;

  const parent = context.workbench.resources.walkHierarchy(resource).at(-2);
  if (!parent) return;

  if (isWorkbenchViewHierarchyNode(parent)) {
    await context.workbench.views.openView(parent.viewId, { strategy: { kind: "replace-active" } });
    return;
  }
  await context.workbench.resources.openResource(parent, { replaceActive: true });
};

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
  const value = unwrapCommandValue(response);
  await handleDeletedResource(context, input.resource, value);
  return value;
};
