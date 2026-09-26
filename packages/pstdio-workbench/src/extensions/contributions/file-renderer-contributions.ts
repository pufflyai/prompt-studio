import type { CommandExecuteRequest, CommandExecuteResponse } from "@pstdio/sdk/api";
import { resourceKey } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import type {
  Disposable,
  FileRendererContent,
  FileRendererRefreshEnvelope,
  FileRendererRefreshOrigin,
  ResourceRef,
  WorkbenchModuleContext,
} from "../../core";
import type { InternalWorkbenchExtensionMetadata as WorkbenchExtensionMetadata } from "../host/internal-workbench-extension-metadata";
import { executeWorkbenchExtensionCommand } from "../host/workbench-extension-command";

type FileRendererRecord = NonNullable<WorkbenchExtensionMetadata["fileRenderers"]>[number];
export interface RegisterWorkbenchExtensionFileRenderersInput {
  executeCommand(commandId: string, body: CommandExecuteRequest, signal?: AbortSignal): Promise<unknown> | unknown;
  metadata: WorkbenchExtensionMetadata;
  projectId: string;
  workbench: WorkbenchModuleContext;
}

const slotContext = (input: { projectId: string; rendererId: string; resource?: ResourceRef }) => ({
  id: input.rendererId,
  kind: "renderer" as const,
  context: {
    projectId: input.projectId,
    ...(input.resource ? { resourceType: input.resource.type, resourceId: input.resource.id } : {}),
  },
});
const executeFileCommand = async (
  input: RegisterWorkbenchExtensionFileRenderersInput,
  rendererId: string,
  commandId: string,
  resource: ResourceRef | undefined,
  extra: Record<string, unknown> = {},
  metadata?: CommandExecuteRequest["metadata"],
  signal?: AbortSignal,
) => {
  const ext = resource;
  return executeWorkbenchExtensionCommand(input, commandId, {
    params: {
      renderer: {
        rendererId,
        projectId: input.projectId,
        ...(ext ? { resource: ext } : {}),
        invocation: { placement: "visible" },
      },
      ...extra,
    },
    resource: ext,
    signal,
    slot: slotContext({ projectId: input.projectId, rendererId, resource: ext }),
    ...(metadata ? { metadata } : {}),
  });
};
const revisionFromValue = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const revision = (
    value as {
      revision?: unknown;
    }
  ).revision;
  return typeof revision === "string" ? revision : undefined;
};
export const fileRendererRefreshEnvelopeFromCommand = (
  body: CommandExecuteRequest,
  response: CommandExecuteResponse,
): FileRendererRefreshEnvelope | undefined => {
  const metadata = body.metadata;
  const origin = metadata?.fileRendererOrigin;
  if (!origin || typeof origin !== "object") return undefined;
  const candidate = origin as Partial<FileRendererRefreshOrigin>;
  if (
    typeof candidate.rendererId !== "string" ||
    typeof candidate.instanceId !== "string" ||
    typeof candidate.operationId !== "string"
  ) {
    return undefined;
  }
  const resourceKey = metadata?.fileRendererResourceKey;
  const revision = revisionFromValue(response.outcome.value);
  return {
    origin: {
      rendererId: candidate.rendererId,
      instanceId: candidate.instanceId,
      operationId: candidate.operationId,
    },
    ...(typeof resourceKey === "string" ? { resourceKey } : {}),
    ...(revision ? { revision } : {}),
  };
};
const registerFileRenderer = (input: RegisterWorkbenchExtensionFileRenderersInput, record: FileRendererRecord) =>
  input.workbench.views.registerView({
    id: record.id,
    title: text(record.title, record.id),
    icon: record.icon,
    body: {
      kind: "file",
      resourceKind: record.resourceKind,
      load: async (resource, signal) => {
        const result = await executeFileCommand(
          input,
          record.id,
          record.loadHandlerId,
          resource,
          {},
          undefined,
          signal,
        );
        return (result ?? {}) as FileRendererContent;
      },
      save: record.saveHandlerId
        ? async (resource, content, origin) => {
            const result = await executeFileCommand(
              input,
              record.id,
              record.saveHandlerId as string,
              resource,
              { content },
              {
                ...(origin ? { fileRendererOrigin: origin } : {}),
                ...(resourceKey(resource) ? { fileRendererResourceKey: resourceKey(resource) } : {}),
              },
            );
            const revision = revisionFromValue(result);
            return revision ? { revision } : undefined;
          }
        : undefined,
    },
  });
export const registerWorkbenchExtensionFileRenderers = (input: RegisterWorkbenchExtensionFileRenderersInput) => {
  const disposables: Disposable[] = [];
  for (const record of input.metadata.fileRenderers ?? []) {
    disposables.push(registerFileRenderer(input, record));
  }
  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
