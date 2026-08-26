import type { CommandExecuteRequest, CommandExecuteResponse } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type {
  Disposable,
  FileRendererContent,
  FileRendererRefreshEnvelope,
  FileRendererRefreshOrigin,
  ResourceRef,
  WorkbenchModuleContext,
} from "../../core";
import { unwrapCommandValue } from "../host/command-response";
import type { InternalWorkbenchExtensionMetadata as WorkbenchExtensionMetadata } from "../host/internal-workbench-extension-metadata";
import {
  panelMenuDeclarationOffsets,
  panelRendererId,
  registerWorkbenchExtensionPanel,
  resolveWorkbenchExtensionViewInput,
  toWorkbenchCompositionPanelContribution,
  type WorkbenchExtensionViewInputResolver,
} from "./panel-contributions";

type FileRendererRecord = NonNullable<WorkbenchExtensionMetadata["fileRenderers"]>[number];
type ViewRecord = WorkbenchExtensionMetadata["panels"][number];

export interface RegisterWorkbenchExtensionFileRenderersInput {
  executeCommand(commandId: string, body: CommandExecuteRequest): Promise<unknown> | unknown;
  metadata: WorkbenchExtensionMetadata;
  projectId: string;
  resolveViewInput?: WorkbenchExtensionViewInputResolver;
  workbench: WorkbenchModuleContext;
}

interface ExtensionResource {
  type: string;
  id: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

const toExtensionResource = (resource: ResourceRef | undefined): ExtensionResource | undefined => {
  if (!resource) return undefined;
  return {
    type: resource.kind,
    id: resource.id ?? resource.uri,
    label: resource.label,
    metadata: resource.metadata,
  };
};

const slotContext = (input: { projectId: string; rendererId: string; resource?: ExtensionResource }) => ({
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
) => {
  const ext = toExtensionResource(resource);
  const result = await input.executeCommand(commandId, {
    projectId: input.projectId,
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
    slot: slotContext({ projectId: input.projectId, rendererId, resource: ext }),
    source: "dashboard",
    ...(metadata ? { metadata } : {}),
  });
  return unwrapCommandValue(result);
};

const revisionFromValue = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const revision = (value as { revision?: unknown }).revision;
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
  const resourceUri = metadata?.fileRendererResourceUri;
  const revision = revisionFromValue(response.outcome.value);
  return {
    origin: {
      rendererId: candidate.rendererId,
      instanceId: candidate.instanceId,
      operationId: candidate.operationId,
    },
    ...(typeof resourceUri === "string" ? { resourceUri } : {}),
    ...(revision ? { revision } : {}),
  };
};

const registerFileRenderer = (input: RegisterWorkbenchExtensionFileRenderersInput, record: FileRendererRecord) =>
  input.workbench.renderers.registerFileRenderer({
    id: record.id,
    title: text(record.title, record.id),
    resourceKind: record.resourceKind,
    load: async (resource) => {
      const result = await executeFileCommand(input, record.id, record.loadHandlerId, resource);
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
              ...(resource?.uri ? { fileRendererResourceUri: resource.uri } : {}),
            },
          );
          const revision = revisionFromValue(result);
          return revision ? { revision } : undefined;
        }
      : undefined,
  });

const registerFileViewWidget = (
  input: RegisterWorkbenchExtensionFileRenderersInput,
  panel: ViewRecord,
  index: number,
  menuDeclarationOffset: number,
) => {
  const rendererId = panelRendererId(panel, "file");
  if (!rendererId) return undefined;
  return registerWorkbenchExtensionPanel({
    workbench: input.workbench,
    path: panel.path,
    aliases: panel.aliases,
    resolveInput: resolveWorkbenchExtensionViewInput(input.resolveViewInput, panel),
    contribution: toWorkbenchCompositionPanelContribution({
      panel,
      rendererId,
      declarationIndex: index,
      menuDeclarationOffset: menuDeclarationOffset,
      resourcePanels: input.metadata.resourcePanels,
    }),
  });
};

export const registerWorkbenchExtensionFileRenderers = (input: RegisterWorkbenchExtensionFileRenderersInput) => {
  const disposables: Disposable[] = [];

  for (const record of input.metadata.fileRenderers ?? []) {
    disposables.push(registerFileRenderer(input, record));
  }

  const menuOffsets = panelMenuDeclarationOffsets(input.metadata.panels);
  input.metadata.panels.forEach((panel, index) => {
    const disposable = registerFileViewWidget(input, panel, index, menuOffsets[index]!);
    if (disposable) disposables.push(disposable);
  });

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
