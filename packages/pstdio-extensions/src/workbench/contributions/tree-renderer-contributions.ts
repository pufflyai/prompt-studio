import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type {
  Disposable,
  NavigationTarget,
  ResourceRef,
  TreeAction,
  TreeContext,
  TreeNode,
  TreeViewSection,
  WorkbenchCore,
} from "pstdio-workbench/core";
import { unwrapCommandValue } from "../host/command-response";
import { text } from "../shared/localization";
import { resolveWorkbenchViewArea } from "../shared/workbench-targets";
import type {
  ExtensionTreeAction,
  ExtensionTreeNode,
  ExtensionTreeRendererRecord,
  ExtensionTreeResource,
  ExtensionTreeSection,
  ExtensionTreeTarget,
  ExtensionTreeViewRecord,
  TargetCommandArgs,
} from "./tree-renderer-contribution-types";

export interface RegisterWorkbenchExtensionTreeRenderersInput {
  executeCommand(commandId: string, body: CommandExecuteRequest): Promise<unknown> | unknown;
  metadata: WorkbenchExtensionMetadata;
  projectId: string;
  workbench: WorkbenchCore;
}

const toExtensionResource = (resource: ResourceRef | undefined): ExtensionTreeResource | undefined => {
  if (!resource) return undefined;
  return {
    type: resource.kind,
    id: resource.id ?? resource.uri,
    label: resource.label,
    metadata: resource.metadata,
  };
};

const toWorkbenchResource = (resource: ExtensionTreeResource): ResourceRef => ({
  kind: resource.type,
  uri: `pstdio://extension-resource/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}`,
  id: resource.id,
  label: resource.label,
  metadata: resource.metadata,
});

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

const createQueryParams = (
  input: RegisterWorkbenchExtensionTreeRenderersInput,
  record: ExtensionTreeRendererRecord,
  ctx: TreeContext,
  node?: ExtensionTreeNode,
) => {
  const resource = toExtensionResource(ctx.resource);
  return {
    projectId: input.projectId,
    modeId: input.workbench.modes.getActiveModeId(),
    resource,
    treeId: record.id,
    state: input.workbench.renderers.getTreeState(record.id),
    ...(ctx.filter ? { filter: ctx.filter } : {}),
    ...(node ? { node } : {}),
  };
};

const executeCallback = async (
  input: RegisterWorkbenchExtensionTreeRenderersInput,
  commandId: string,
  params: Record<string, unknown>,
) => {
  const resource = params.resource as ExtensionTreeResource | undefined;
  const result = await input.executeCommand(commandId, {
    projectId: input.projectId,
    params,
    resource,
    slot: slotContext({
      modeId: params.modeId as string | undefined,
      projectId: input.projectId,
      resource,
      treeId: params.treeId as string,
    }),
    source: "dashboard",
  });
  return unwrapCommandValue(result);
};

const executeTreeActionCommand = async (
  input: RegisterWorkbenchExtensionTreeRenderersInput,
  record: ExtensionTreeRendererRecord,
  commandId: string,
  params: Record<string, unknown> | undefined,
  resource: ExtensionTreeResource | undefined,
) => {
  const modeId = input.workbench.modes.getActiveModeId();
  const result = await input.executeCommand(commandId, {
    projectId: input.projectId,
    ...(params ? { params } : {}),
    resource,
    slot: slotContext({ modeId, projectId: input.projectId, resource, treeId: record.id }),
    source: "dashboard",
    metadata: { treeId: record.id },
  });
  return unwrapCommandValue(result);
};

const createTreeMapper = (input: RegisterWorkbenchExtensionTreeRenderersInput, record: ExtensionTreeRendererRecord) => {
  const originalNodes = new WeakMap<TreeNode, ExtensionTreeNode>();
  const runnerCommandId = `workbench.extensionTreeRenderer.${record.id}.command`;

  const mapTarget = (
    target: ExtensionTreeTarget | undefined,
    node: ExtensionTreeNode,
    ctx: TreeContext,
  ): NavigationTarget | undefined => {
    if (!target) return undefined;
    if (target.kind === "resource" && target.resource) {
      return { kind: "resource", resource: toWorkbenchResource(target.resource) };
    }
    if (target.kind === "view" && target.widgetId) return { kind: "view", widgetId: target.widgetId };
    if (target.kind !== "command" || !target.commandId) return undefined;
    return {
      kind: "command",
      commandId: runnerCommandId,
      args: {
        commandId: target.commandId,
        nodeId: node.id,
        params: target.args,
        resource: node.resource ?? toExtensionResource(ctx.resource),
        treeId: record.id,
      } satisfies TargetCommandArgs,
    };
  };

  const mapAction = (
    action: ExtensionTreeAction,
    node: ExtensionTreeNode | undefined,
    ctx: TreeContext,
  ): TreeAction => {
    const commandId = action.commandId;
    return {
      id: action.id,
      label: text(action.label),
      icon: action.icon,
      when: action.when,
      disabled: action.disabled,
      // Actions mutate tree data (create/delete/…), so refresh afterwards. Plain
      // node-target navigation runs through the runner command and must not refetch.
      run: commandId
        ? async () => {
            await executeTreeActionCommand(
              input,
              record,
              commandId,
              action.args,
              node?.resource ?? toExtensionResource(ctx.resource),
            );
            input.workbench.renderers.refresh(record.id);
          }
        : undefined,
    };
  };

  const mapNode = (node: ExtensionTreeNode, ctx: TreeContext): TreeNode => {
    const mapped: TreeNode = {
      id: node.id,
      label: text(node.label),
      icon: node.icon,
      iconColor: node.iconColor,
      iconTooltip: node.iconTooltip,
      resource: node.resource ? toWorkbenchResource(node.resource) : undefined,
      target: mapTarget(node.target, node, ctx),
      actions: node.actions?.map((action) => mapAction(action, node, ctx)),
      contextMenuActions: node.contextMenuActions?.map((action) => mapAction(action, node, ctx)),
      collapsible: node.collapsible,
      disabled: node.disabled,
      children: node.children?.map((child) => mapNode(child, ctx)),
      description: node.description,
      contextValue: node.contextValue,
      hiddenByDefault: node.hiddenByDefault,
    };
    originalNodes.set(mapped, node);
    return mapped;
  };

  const mapSections = (sections: ExtensionTreeSection[], ctx: TreeContext): TreeViewSection[] =>
    sections.map((section) => ({
      id: section.id,
      label: text(section.label),
      actions: section.actions?.map((action) => mapAction(action, undefined, ctx)),
      collapsible: section.collapsible,
      nodes: section.nodes.map((node) => mapNode(node, ctx)),
      hiddenByDefault: section.hiddenByDefault,
    }));

  const mapNodes = (nodes: ExtensionTreeNode[], ctx: TreeContext): TreeNode[] =>
    nodes.map((node) => mapNode(node, ctx));

  return { mapNodes, mapSections, originalNodes, runnerCommandId };
};

const isTreeSectionArray = (value: unknown): value is ExtensionTreeSection[] =>
  Array.isArray(value) && value.every((section) => section && typeof section === "object" && "nodes" in section);

const isTreeNodeArray = (value: unknown): value is ExtensionTreeNode[] =>
  Array.isArray(value) && value.every((node) => node && typeof node === "object" && "id" in node);

const registerTree = (input: RegisterWorkbenchExtensionTreeRenderersInput, record: ExtensionTreeRendererRecord) => {
  const mapper = createTreeMapper(input, record);
  const commandDisposable = input.workbench.commands.registerCommand(
    { id: mapper.runnerCommandId, label: `${text(record.title, record.id)} tree command` },
    {
      execute: async (rawArgs) => {
        const args = rawArgs as TargetCommandArgs;
        if (args.nodeId) input.workbench.renderers.setSelectedNode(record.id, args.nodeId);
        return executeTreeActionCommand(input, record, args.commandId, args.params, args.resource);
      },
    },
  );

  const treeDisposable = input.workbench.renderers.registerTreeRenderer({
    id: record.id,
    title: text(record.title, record.id),
    icon: record.icon,
    defaultExpandedNodeIds: record.defaultExpandedNodeIds,
    defaultExpandedSectionIds: record.defaultExpandedSectionIds,
    getBody: async (ctx) => {
      const result = await executeCallback(input, record.bodyCommandId, createQueryParams(input, record, ctx));
      return isTreeSectionArray(result) ? mapper.mapSections(result, ctx) : [];
    },
    getFooter: async (ctx) => {
      if (!record.footerCommandId) return [];
      const result = await executeCallback(input, record.footerCommandId, createQueryParams(input, record, ctx));
      return isTreeNodeArray(result) ? mapper.mapNodes(result, ctx) : [];
    },
    getChildren: async (node, ctx) => {
      if (!record.childrenCommandId) return node.children ?? [];
      const originalNode = mapper.originalNodes.get(node) ?? (node as unknown as ExtensionTreeNode);
      const result = await executeCallback(
        input,
        record.childrenCommandId,
        createQueryParams(input, record, ctx, originalNode),
      );
      return isTreeNodeArray(result) ? mapper.mapNodes(result, ctx) : [];
    },
  });

  return {
    dispose() {
      treeDisposable.dispose();
      commandDisposable.dispose();
    },
  };
};

const registerTreeViewWidget = (input: RegisterWorkbenchExtensionTreeRenderersInput, view: ExtensionTreeViewRecord) => {
  if (!view.treeRendererId) return undefined;
  const area = resolveWorkbenchViewArea(view.target);
  return input.workbench.layout.registerWidget({
    id: view.id,
    title: text(view.title, view.id),
    area: view.surface === "modal" ? "overlay" : area,
    rendererId: view.treeRendererId,
    singleton: true,
    resourceKinds: view.resourceKind ? [view.resourceKind] : undefined,
  });
};

export const registerWorkbenchExtensionTreeRenderers = (input: RegisterWorkbenchExtensionTreeRenderersInput) => {
  const disposables: Disposable[] = [];

  for (const record of input.metadata.treeRenderers ?? []) {
    disposables.push(registerTree(input, record));
  }

  for (const view of input.metadata.views) {
    const disposable = registerTreeViewWidget(input, view);
    if (disposable) disposables.push(disposable);
  }

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
