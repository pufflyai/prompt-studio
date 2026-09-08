import type { CommandExecuteRequest } from "@pstdio/sdk/api";
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
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";
import type { InternalWorkbenchExtensionMetadata as WorkbenchExtensionMetadata } from "../host/internal-workbench-extension-metadata";
import { localizeParamSchema } from "./param-schema-localization";
import { createQueryParams, executeCallback, executeTreeActionCommand } from "./tree-renderer-callbacks";
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
const toActionParams = (params: unknown, fallback: Record<string, unknown> | undefined) => {
  if (params && typeof params === "object" && !Array.isArray(params)) return params as Record<string, unknown>;
  return fallback;
};
const toRecordParams = (params: object | undefined) =>
  params && !Array.isArray(params) ? (params as Record<string, unknown>) : undefined;
const createTreeMapper = (input: RegisterWorkbenchExtensionTreeRenderersInput, record: ExtensionTreeRendererRecord) => {
  const originalNodes = new WeakMap<TreeNode, ExtensionTreeNode>();
  const runnerCommandId = `workbench.extensionTreeRenderer.${record.id}.command`;
  const resolveResource: (resource: ExtensionTreeResource) => ResourceRef = (resource) => {
    const resolved = input.resolveNodeResource?.(resource);
    return resolved ?? resource;
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
    const commandTargetOf = (
      commandTarget: Extract<
        ExtensionTreeTarget,
        {
          kind: "command";
        }
      >,
    ) => ({
      kind: "command" as const,
      commandId: runnerCommandId,
      args: {
        commandId: `${commandTarget.target.command.extensionId ?? record.extensionId}.command.${commandTarget.target.command.id}`,
        nodeId: node.id,
        params: commandTarget.target.params,
        resource: node.resource ?? ctx.resource,
        treeId: record.id,
      } satisfies TargetCommandArgs,
    });
    return toWorkbenchNavigationTarget(target, {
      commandTargetOf,
      extensionId: record.extensionId,
    });
  };
  const mapAction = (
    action: ExtensionTreeAction,
    node: ExtensionTreeNode | undefined,
    ctx: TreeContext,
  ): TreeAction => {
    const commandId = action.command
      ? `${action.command.extensionId ?? record.extensionId}.command.${action.command.id}`
      : undefined;
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
              node?.resource ?? ctx.resource,
            );
            ctx.refresh();
          }
        : undefined,
    };
  };
  const mapNode = (node: ExtensionTreeNode, ctx: TreeContext): TreeNode => {
    const mapped: TreeNode = {
      id: node.id,
      selected: node.selected,
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
const hostNodeSection = (id: string, nodes: TreeNode[]): TreeViewSection[] =>
  nodes.length > 0 ? [{ id, nodes, canReorder: false }] : [];
const registerTree = (input: RegisterWorkbenchExtensionTreeRenderersInput, record: ExtensionTreeRendererRecord) => {
  const mapper = createTreeMapper(input, record);
  const treeViews = treeViewsFor(input.metadata, record);
  const commandDisposable = input.workbench.commands.registerCommand(
    { id: mapper.runnerCommandId, label: `${text(record.title, record.id)} tree command` },
    {
      execute: async (rawArgs) => {
        const args = rawArgs as TargetCommandArgs;
        const result = await executeTreeActionCommand(input, record, args.commandId, args.params, args.resource);
        for (const view of input.workbench.views.listViews()) {
          if (view.body.kind === "file") input.workbench.views.refreshView(view.id);
        }
        return result;
      },
    },
  );
  const treeDisposable = input.workbench.views.registerView({
    id: record.id,
    title: text(record.title, record.id),
    icon: record.icon,
    body: {
      kind: "tree",
      searchable: record.searchable,
      searchPlaceholder: text(record.searchPlaceholder, "Search files"),
      defaultExpandedNodeIds: record.defaultExpandedNodeIds,
      defaultExpandedSectionIds: record.defaultExpandedSectionIds,
      getHeader: async (ctx) => {
        const hostHeader = await resolveHostTreeHeaderNodes({
          ctx,
          getHostTreeHeaderNodes: input.getHostTreeHeaderNodes,
          record,
          treeViews,
        });
        if (!record.headerHandlerId) return hostNodeSection(`${record.id}:host-header`, hostHeader);
        const result = await executeCallback(
          input,
          record,
          record.headerHandlerId,
          createQueryParams(input, record, ctx),
        );
        const extensionHeader = isTreeSectionArray(result) ? mapper.mapSections(result, ctx) : [];
        return [...hostNodeSection(`${record.id}:host-header`, hostHeader), ...extensionHeader];
      },
      getBody: async (ctx) => {
        const result = await executeCallback(
          input,
          record,
          record.bodyHandlerId,
          createQueryParams(input, record, ctx),
        );
        if (!isTreeSectionArray(result)) return [];
        return mapper.mapSections(result, ctx);
      },
      getFooter: async (ctx) => {
        const hostFooter = await resolveHostTreeFooterNodes({
          ctx,
          getHostTreeFooterNodes: input.getHostTreeFooterNodes,
          record,
          treeViews,
        });
        if (!record.footerHandlerId) return hostNodeSection(`${record.id}:host-footer`, hostFooter);
        const result = await executeCallback(
          input,
          record,
          record.footerHandlerId,
          createQueryParams(input, record, ctx),
        );
        const extensionFooter = isTreeSectionArray(result) ? mapper.mapSections(result, ctx) : [];
        return [...extensionFooter, ...hostNodeSection(`${record.id}:host-footer`, hostFooter)];
      },
      getChildren: async (node, ctx) => {
        if (!record.childrenHandlerId) return node.children ?? [];
        const originalNode = mapper.originalNodes.get(node);
        if (!originalNode) return node.children ?? [];
        const result = await executeCallback(
          input,
          record,
          record.childrenHandlerId,
          createQueryParams(input, record, ctx, originalNode),
        );
        return isTreeNodeArray(result) ? mapper.mapNodes(result, ctx) : [];
      },
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
  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
