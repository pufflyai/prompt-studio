import type { TreeContext } from "../../core";
import { unwrapCommandValue } from "../host/command-response";
import type {
  ExtensionTreeNode,
  ExtensionTreeRendererRecord,
  ExtensionTreeResource,
} from "./tree-renderer-contribution-types";
import type { RegisterWorkbenchExtensionTreeRenderersInput } from "./tree-renderer-contributions";

const slotContext = (input: {
  modeId?: string;
  projectId: string;
  resource?: ExtensionTreeResource;
  treeId: string;
}) => ({
  id: input.treeId,
  kind: "renderer" as const,
  context: {
    projectId: input.projectId,
    treeId: input.treeId,
    ...(input.modeId ? { modeId: input.modeId } : {}),
    ...(input.resource ? { resourceType: input.resource.type, resourceId: input.resource.id } : {}),
  },
});
export const createQueryParams = (
  input: RegisterWorkbenchExtensionTreeRenderersInput,
  record: ExtensionTreeRendererRecord,
  ctx: TreeContext,
  node?: ExtensionTreeNode,
) => {
  const resource = ctx.resource;
  const modeId = input.workbench.modes.getActiveModeId();
  return {
    renderer: {
      rendererId: record.id,
      projectId: input.projectId,
      ...(modeId ? { modeId } : {}),
      ...(resource ? { resource } : {}),
      invocation: { placement: "visible" },
    },
    state: ctx.state,
    ...(ctx.filter ? { filter: ctx.filter } : {}),
    ...(node ? { node } : {}),
  };
};
export const executeCallback = async (
  input: RegisterWorkbenchExtensionTreeRenderersInput,
  record: ExtensionTreeRendererRecord,
  commandId: string,
  params: Record<string, unknown>,
) => {
  const renderer = params.renderer as
    | {
        modeId?: string;
        resource?: ExtensionTreeResource;
      }
    | undefined;
  const resource = renderer?.resource;
  const result = await input.executeCommand(commandId, {
    projectId: input.projectId,
    params,
    resource,
    slot: slotContext({
      modeId: renderer?.modeId,
      projectId: input.projectId,
      resource,
      treeId: record.id,
    }),
    source: "dashboard",
  });
  return unwrapCommandValue(result);
};
export const executeTreeActionCommand = async (
  input: RegisterWorkbenchExtensionTreeRenderersInput,
  record: ExtensionTreeRendererRecord,
  commandId: string,
  params: Record<string, unknown> | undefined,
  resource: ExtensionTreeResource | undefined,
) => {
  const modeId = input.workbench.modes.getActiveModeId();
  const rendererParams = {
    ...(params ?? {}),
    renderer: {
      rendererId: record.id,
      projectId: input.projectId,
      ...(modeId ? { modeId } : {}),
      ...(resource ? { resource } : {}),
      invocation: { placement: "visible" },
    },
  };
  const result = await input.executeCommand(commandId, {
    projectId: input.projectId,
    params: rendererParams,
    resource,
    slot: slotContext({ modeId, projectId: input.projectId, resource, treeId: record.id }),
    source: "dashboard",
    metadata: { treeId: record.id },
  });
  return unwrapCommandValue(result);
};
