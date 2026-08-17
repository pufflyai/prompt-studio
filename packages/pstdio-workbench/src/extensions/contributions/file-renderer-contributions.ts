import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, FileRendererContent, ResourceRef, WorkbenchModuleContext } from "../../core";
import { unwrapCommandValue } from "../host/command-response";
import {
  panelMenuDeclarationOffsets,
  panelRendererId,
  registerWorkbenchExtensionPanel,
  toWorkbenchExtensionPlacementMetadata,
  toWorkbenchPanelEligibility,
  toWorkbenchPanelMenus,
} from "./panel-contributions";

type FileRendererRecord = NonNullable<WorkbenchExtensionMetadata["fileRenderers"]>[number];
type ViewRecord = WorkbenchExtensionMetadata["panels"][number];

export interface RegisterWorkbenchExtensionFileRenderersInput {
  executeCommand(commandId: string, body: CommandExecuteRequest): Promise<unknown> | unknown;
  metadata: WorkbenchExtensionMetadata;
  projectId: string;
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
  });
  return unwrapCommandValue(result);
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
      ? async (resource, content) => {
          await executeFileCommand(input, record.id, record.saveHandlerId as string, resource, { content });
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
    contribution: {
      id: panel.id,
      title: text(panel.title, panel.id),
      icon: panel.icon,
      region: panel.region,
      closable: panel.closable,
      rendererId,
      singleton: true,
      resourceKinds: panel.resourceKind ? [panel.resourceKind] : undefined,
      eligibleLocations: toWorkbenchPanelEligibility(panel.eligibleLocations),
      panelMenus: toWorkbenchPanelMenus(panel.panelMenus, menuDeclarationOffset),
      ...toWorkbenchExtensionPlacementMetadata({ placement: panel.placement, declarationIndex: index }),
    },
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
