import type { CommandExecuteRequest, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type {
  Disposable,
  NavigationTarget,
  ResourceRef,
  TreeAction,
  TreeContext,
  TreeNode,
  TreeViewSection,
  WorkbenchModuleContext,
} from "../../core";
import { FILE_SECTION_NAVIGATION_METADATA_KEY } from "../../core/registries/renderers/file-section-navigation";
import { unwrapCommandValue } from "../host/command-response";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";
import { panelMenuDeclarationOffsets } from "./panel-contributions";
import { localizeParamSchema } from "./param-schema-localization";
import type {
  ExtensionTreeAction,
  ExtensionTreeNode,
  ExtensionTreeRendererRecord,
  ExtensionTreeResource,
  ExtensionTreeSection,
  ExtensionTreeTarget,
  TargetCommandArgs,
} from "./tree-renderer-contribution-types";
import {
  type HostTreeDefaultNodesResolver,
  resolveHostTreeFooterNodes,
  resolveHostTreeHeaderNodes,
  treeViewsFor,
} from "./tree-renderer-host-defaults";
import { registerTreeViewWidget } from "./tree-renderer-panels";

export interface RegisterWorkbenchExtensionTreeRenderersInput {
  executeCommand(commandId: string, body: CommandExecuteRequest): Promise<unknown> | unknown;
  getHostTreeFooterNodes?: HostTreeDefaultNodesResolver;
  getHostTreeHeaderNodes?: HostTreeDefaultNodesResolver;
  metadata: WorkbenchExtensionMetadata;
  projectId: string;
  /**
   * Host canonicalization for node resources. A host that gives extension
   * resources its own URIs (layout scopes, history, and hierarchy key on the
   * URI) must convert tree node resources the same way, or the same resource
   * gets a second identity when opened from a tree.
   */
  resolveNodeResource?: (resource: ExtensionTreeResource) => ResourceRef;
  workbench: WorkbenchModuleContext;
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

const refId = (value: { id?: string } | string | undefined) => (typeof value === "string" ? value : value?.id);

const toWorkbenchResource = (
  resource: ExtensionTreeResource,
  sectionNavigation?: {
    treeId: string;
    targetNodeId: string;
    anchors: Array<{ id: string; heading: string; occurrence?: number }>;
  },
): ResourceRef => ({
  kind: resource.type,
  uri: `pstdio://extension-resource/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}`,
  id: resource.id,
  label: resource.label,
  metadata: sectionNavigation
    ? { ...resource.metadata, [FILE_SECTION_NAVIGATION_METADATA_KEY]: sectionNavigation }
    : resource.metadata,
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
  const modeId = input.workbench.modes.getActiveModeId();
  return {
    renderer: {
      rendererId: record.id,
      projectId: input.projectId,
      ...(modeId ? { modeId } : {}),
      ...(resource ? { resource } : {}),
      invocation: { placement: "visible" },
    },
    state: input.workbench.renderers.getTreeState(record.id),
    ...(ctx.filter ? { filter: ctx.filter } : {}),
    ...(node ? { node } : {}),
  };
};

const executeCallback = async (
  input: RegisterWorkbenchExtensionTreeRenderersInput,
  record: ExtensionTreeRendererRecord,
  commandId: string,
  params: Record<string, unknown>,
) => {
  const renderer = params.renderer as { modeId?: string; resource?: ExtensionTreeResource } | undefined;
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

const executeTreeActionCommand = async (
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

const toActionParams = (params: unknown, fallback: Record<string, unknown> | undefined) => {
  if (params && typeof params === "object" && !Array.isArray(params)) return params as Record<string, unknown>;
  return fallback;
};

const toRecordParams = (params: object | undefined) =>
  params && !Array.isArray(params) ? (params as Record<string, unknown>) : undefined;

const createTreeMapper = (input: RegisterWorkbenchExtensionTreeRenderersInput, record: ExtensionTreeRendererRecord) => {
  const originalNodes = new WeakMap<TreeNode, ExtensionTreeNode>();
  const runnerCommandId = `workbench.extensionTreeRenderer.${record.id}.command`;

  const resolveResource: typeof toWorkbenchResource = (resource, sectionNavigation) => {
    const resolved = input.resolveNodeResource?.(resource);
    if (!resolved) return toWorkbenchResource(resource, sectionNavigation);
    if (!sectionNavigation) return resolved;
    return {
      ...resolved,
      metadata: { ...resolved.metadata, [FILE_SECTION_NAVIGATION_METADATA_KEY]: sectionNavigation },
    };
  };

  const mapEmptyState = (section: ExtensionTreeSection): TreeViewSection["emptyState"] => {
    if (!section.emptyState) return undefined;
    return {
      title: text(section.emptyState.title),
      description: text(section.emptyState.description),
      icon: section.emptyState.icon,
    };
  };

  const mapTarget = (
    target: ExtensionTreeTarget | undefined,
    node: ExtensionTreeNode,
    ctx: TreeContext,
  ): NavigationTarget | undefined => {
    if (!target) return undefined;
    const commandTargetOf = (commandTarget: Extract<ExtensionTreeTarget, { kind: "command" }>) => ({
      kind: "command" as const,
      commandId: runnerCommandId,
      args: {
        commandId: typeof commandTarget.command === "string" ? commandTarget.command : commandTarget.command.id,
        nodeId: node.id,
        params: commandTarget.params,
        resource: node.resource ?? toExtensionResource(ctx.resource),
        treeId: record.id,
      } satisfies TargetCommandArgs,
    });
    return toWorkbenchNavigationTarget(target, {
      commandTargetOf,
      resourceOf: (resource, resourceTarget) =>
        resolveResource(
          resource,
          resourceTarget.section
            ? { treeId: record.id, targetNodeId: node.id, anchors: resourceTarget.section.anchors }
            : undefined,
        ),
    });
  };

  const mapAction = (
    action: ExtensionTreeAction,
    node: ExtensionTreeNode | undefined,
    ctx: TreeContext,
  ): TreeAction => {
    const commandId = refId(action.command);
    return {
      id: action.id,
      label: text(action.label),
      icon: action.icon,
      args: toRecordParams(action.params),
      params: localizeParamSchema(action.input, text),
      submitLabel: action.submitLabel,
      when: action.when,
      disabled: action.disabled,
      // Actions mutate tree data (create/delete/...), so refresh afterwards. Plain
      // node-target navigation runs through the runner command and must not refetch.
      run: commandId
        ? async (params) => {
            await executeTreeActionCommand(
              input,
              record,
              commandId,
              toActionParams(params, toRecordParams(action.params)),
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
      resource: node.resource ? resolveResource(node.resource) : undefined,
      target: mapTarget(node.target, node, ctx),
      rowVariant: node.rowVariant,
      actions: node.actions?.map((action) => mapAction(action, node, ctx)),
      contextMenuActions: node.contextMenuActions?.map((action) => mapAction(action, node, ctx)),
      collapsible: node.collapsible,
      disabled: node.disabled,
      children: node.children?.map((child) => mapNode(child, ctx)),
      description: node.description,
      contextValue: node.contextValue,
      hiddenByDefault: node.hiddenByDefault,
      canHide: node.canHide,
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
      emptyState: mapEmptyState(section),
      nodes: section.nodes.map((node) => mapNode(node, ctx)),
      hiddenByDefault: section.hiddenByDefault,
      canHide: section.canHide,
    }));

  const mapNodes = (nodes: ExtensionTreeNode[], ctx: TreeContext): TreeNode[] =>
    nodes.map((node) => mapNode(node, ctx));

  return { mapNodes, mapSections, originalNodes, runnerCommandId };
};

const isTreeSectionArray = (value: unknown): value is ExtensionTreeSection[] =>
  Array.isArray(value) && value.every((section) => section && typeof section === "object" && "nodes" in section);

const isTreeNodeArray = (value: unknown): value is ExtensionTreeNode[] =>
  Array.isArray(value) && value.every((node) => node && typeof node === "object" && "id" in node);

// The node a command marks with `selected: true` (e.g. the open document in a
// files tree) becomes the tree's highlighted selection.
const selectedNodeIdFromNodes = (nodes: ExtensionTreeNode[]): string | undefined => {
  for (const node of nodes) {
    if (node.selected) return node.id;
    const selectedChild = selectedNodeIdFromNodes(node.children ?? []);
    if (selectedChild) return selectedChild;
  }
  return undefined;
};

export const selectedNodeIdFromSections = (sections: ExtensionTreeSection[]): string | undefined => {
  for (const section of sections) {
    const selectedNodeId = selectedNodeIdFromNodes(section.nodes);
    if (selectedNodeId) return selectedNodeId;
  }
  return undefined;
};

const registerTree = (input: RegisterWorkbenchExtensionTreeRenderersInput, record: ExtensionTreeRendererRecord) => {
  const mapper = createTreeMapper(input, record);
  const treeViews = treeViewsFor(input.metadata, record);
  const commandDisposable = input.workbench.commands.registerCommand(
    { id: mapper.runnerCommandId, label: `${text(record.title, record.id)} tree command` },
    {
      execute: async (rawArgs) => {
        const args = rawArgs as TargetCommandArgs;
        if (args.nodeId) input.workbench.renderers.setSelectedNode(record.id, args.nodeId);
        const result = await executeTreeActionCommand(input, record, args.commandId, args.params, args.resource);
        for (const renderer of input.workbench.renderers.listFileRenderers()) {
          input.workbench.renderers.refreshFileRenderer(renderer.id);
        }
        return result;
      },
    },
  );

  const treeDisposable = input.workbench.renderers.registerTreeRenderer({
    id: record.id,
    title: text(record.title, record.id),
    icon: record.icon,
    defaultExpandedNodeIds: record.defaultExpandedNodeIds,
    defaultExpandedSectionIds: record.defaultExpandedSectionIds,
    getHeader: (ctx) =>
      resolveHostTreeHeaderNodes({ ctx, getHostTreeHeaderNodes: input.getHostTreeHeaderNodes, record, treeViews }),
    getBody: async (ctx) => {
      const result = await executeCallback(input, record, record.bodyHandlerId, createQueryParams(input, record, ctx));
      if (!isTreeSectionArray(result)) return [];
      const selectedNodeId = selectedNodeIdFromSections(result);
      if (selectedNodeId) input.workbench.renderers.setSelectedNode(record.id, selectedNodeId);
      return mapper.mapSections(result, ctx);
    },
    getFooter: async (ctx) => {
      const hostFooter = await resolveHostTreeFooterNodes({
        ctx,
        getHostTreeFooterNodes: input.getHostTreeFooterNodes,
        record,
        treeViews,
      });
      if (!record.footerHandlerId) return hostFooter;
      const result = await executeCallback(
        input,
        record,
        record.footerHandlerId,
        createQueryParams(input, record, ctx),
      );
      const extensionFooter = isTreeNodeArray(result) ? mapper.mapNodes(result, ctx) : [];
      return [...extensionFooter, ...hostFooter];
    },
    getChildren: async (node, ctx) => {
      if (!record.childrenHandlerId) return node.children ?? [];
      const originalNode = mapper.originalNodes.get(node) ?? (node as unknown as ExtensionTreeNode);
      const result = await executeCallback(
        input,
        record,
        record.childrenHandlerId,
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

export const registerWorkbenchExtensionTreeRenderers = (input: RegisterWorkbenchExtensionTreeRenderersInput) => {
  const disposables: Disposable[] = [];

  for (const record of input.metadata.treeRenderers ?? []) {
    disposables.push(registerTree(input, record));
  }

  const menuOffsets = panelMenuDeclarationOffsets(input.metadata.panels);
  input.metadata.panels.forEach((panel, index) => {
    const disposable = registerTreeViewWidget(input, panel, index, menuOffsets[index]!);
    if (disposable) disposables.push(disposable);
  });

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
