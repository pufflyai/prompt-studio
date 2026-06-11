import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, FileRendererContent, ResourceRef, WorkbenchCore } from "../../core";
import { unwrapCommandValue } from "../host/command-response";
import { resolveWorkbenchViewArea } from "../shared/workbench-targets";

type FileRendererRecord = NonNullable<WorkbenchExtensionMetadata["fileRenderers"]>[number];
type ViewRecord = WorkbenchExtensionMetadata["views"][number];

export interface RegisterWorkbenchExtensionFileRenderersInput {
  executeCommand(commandId: string, body: CommandExecuteRequest): Promise<unknown> | unknown;
  metadata: WorkbenchExtensionMetadata;
  projectId: string;
  workbench: WorkbenchCore;
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
) => {
  const ext = toExtensionResource(resource);
  const result = await input.executeCommand(commandId, {
    projectId: input.projectId,
    params: { projectId: input.projectId, resource: ext, ...extra },
    resource: ext,
    slot: slotContext({ projectId: input.projectId, rendererId, resource: ext }),
    source: "dashboard",
  });
  return unwrapCommandValue(result);
};

const registerFileRenderer = (input: RegisterWorkbenchExtensionFileRenderersInput, record: FileRendererRecord) =>
  input.workbench.renderers.registerFileRenderer({
    id: record.id,
    title: text(record.title, record.id),
    resourceKind: record.resourceKind,
    load: async (resource) => {
      const result = await executeFileCommand(input, record.id, record.loadCommandId, resource);
      return (result ?? {}) as FileRendererContent;
    },
    save: record.saveCommandId
      ? async (resource, content) => {
          await executeFileCommand(input, record.id, record.saveCommandId as string, resource, { content });
        }
      : undefined,
  });

const registerFileViewWidget = (input: RegisterWorkbenchExtensionFileRenderersInput, view: ViewRecord) => {
  if (!view.fileRendererId) return undefined;
  return input.workbench.layout.registerWidget({
    id: view.id,
    title: text(view.title, view.id),
    area: view.surface === "modal" ? "overlay" : resolveWorkbenchViewArea(view.target),
    rendererId: view.fileRendererId,
    singleton: true,
    resourceKinds: view.resourceKind ? [view.resourceKind] : undefined,
  });
};

export const registerWorkbenchExtensionFileRenderers = (input: RegisterWorkbenchExtensionFileRenderersInput) => {
  const disposables: Disposable[] = [];

  for (const record of input.metadata.fileRenderers ?? []) {
    disposables.push(registerFileRenderer(input, record));
  }

  for (const view of input.metadata.views) {
    const disposable = registerFileViewWidget(input, view);
    if (disposable) disposables.push(disposable);
  }

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
