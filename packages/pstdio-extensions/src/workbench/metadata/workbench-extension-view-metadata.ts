import type { WorkbenchExtensionMetadata, WorkbenchExtensionViewBody } from "@pstdio/sdk/api";
import type { CommandRef, PackageAssetDescriptor, ViewBody, WebviewContribution } from "@pstdio/sdk/extensions";
import type { ExtensionRuntime } from "../../types/runtime";
import { commandRef, normalizedRef, refreshEventIds } from "./workbench-extension-metadata-normalizers";

type WorkbenchExtensionWebview = Extract<WorkbenchExtensionViewBody, { kind: "webview" }>["webview"];

export interface ResolveWorkbenchExtensionWebviewInput {
  extensionId: string;
  extensionName: string;
  id: string;
  sourcePath: string;
  webview: WebviewContribution & { entry: PackageAssetDescriptor };
}

export type ResolveWorkbenchExtensionWebview = (
  input: ResolveWorkbenchExtensionWebviewInput,
) => WorkbenchExtensionWebview | null | undefined;

interface ViewMetadataInput {
  resolveWebview?: ResolveWorkbenchExtensionWebview;
}

const resolveWebview = (input: ViewMetadataInput, view: ExtensionRuntime["views"][number]) => {
  const body = view.contribution.body;
  if (body.kind !== "webview" || !input.resolveWebview) return null;
  return (
    input.resolveWebview({
      extensionId: view.extensionId,
      extensionName: view.name,
      id: view.id,
      sourcePath: view.sourcePath,
      webview: body,
    }) ?? null
  );
};

const commandActions = <T extends { command: CommandRef }>(actions: readonly T[] | undefined, extensionId: string) =>
  actions?.map((action) => ({ ...action, command: commandRef(action.command, extensionId) }));

const toNativeViewBody = (
  view: ExtensionRuntime["views"][number],
): Exclude<WorkbenchExtensionViewBody, { kind: "webview" }> => {
  const body = view.contribution.body as Exclude<ViewBody, { kind: "webview" }>;
  const handlers = body as typeof body & Record<string, unknown>;
  const common = {
    refreshEventIds: refreshEventIds(body.refreshEvents, view.extensionId),
    emptyTitle: body.emptyTitle,
    emptyDescription: body.emptyDescription,
  };
  if (body.kind === "tree") {
    return {
      kind: "tree",
      ...common,
      searchable: body.searchable,
      searchPlaceholder: body.searchPlaceholder,
      bodyHandlerId: String(handlers.bodyHandlerId),
      childrenHandlerId: handlers.childrenHandlerId as string | undefined,
      footerHandlerId: handlers.footerHandlerId as string | undefined,
      defaultExpandedSectionIds: body.defaultExpandedSectionIds,
      defaultExpandedNodeIds: body.defaultExpandedNodeIds,
    };
  }
  if (body.kind === "file") {
    return {
      kind: "file",
      ...common,
      loadHandlerId: String(handlers.loadHandlerId),
      saveHandlerId: handlers.saveHandlerId as string | undefined,
    };
  }
  if (body.kind === "controls") {
    return {
      kind: "controls",
      ...common,
      queryHandlerId: String(handlers.queryHandlerId),
      valueChangeHandlerId: handlers.valueChangeHandlerId as string | undefined,
      applyHandlerId: handlers.applyHandlerId as string | undefined,
      resetHandlerId: handlers.resetHandlerId as string | undefined,
      defaultValues: body.defaultValues,
    };
  }
  if (body.kind === "dataTable") {
    return {
      kind: "dataTable",
      ...common,
      columns: body.columns,
      queryHandlerId: String(handlers.queryHandlerId),
      selectionMode: body.selectionMode,
      selectionActions: commandActions(body.selectionActions, view.extensionId),
      rowActions: commandActions(body.rowActions, view.extensionId),
      rowActivationHandlerId: handlers.rowActivationHandlerId as string | undefined,
      initialPageSize: body.initialPageSize,
      pageSizeOptions: body.pageSizeOptions,
    };
  }
  return {
    kind: "kanban",
    ...common,
    attributes: body.attributes?.map((attribute) =>
      attribute.type.kind === "status"
        ? {
            ...attribute,
            type: { ...attribute.type, statuses: normalizedRef(attribute.type.statuses, view.extensionId) },
          }
        : attribute,
    ),
    queryHandlerId: String(handlers.queryHandlerId),
    attributeChangeHandlerId: handlers.attributeChangeHandlerId as string | undefined,
    reorderHandlerId: handlers.reorderHandlerId as string | undefined,
    columnActionHandlerId: handlers.columnActionHandlerId as string | undefined,
    rowActivationHandlerId: handlers.rowActivationHandlerId as string | undefined,
    createRow: body.createRow
      ? {
          ...body.createRow,
          command: commandRef(body.createRow.command, view.extensionId),
          attachments: body.createRow.attachments
            ? {
                ...body.createRow.attachments,
                command: commandRef(body.createRow.attachments.command, view.extensionId),
              }
            : undefined,
        }
      : undefined,
    rowActions: commandActions(body.rowActions, view.extensionId),
    defaultSettings: body.defaultSettings,
    defaultFilters: body.defaultFilters,
    defaultViews: body.defaultViews,
    defaultActiveViewId: body.defaultActiveViewId,
    hideToolbar: body.hideToolbar,
  };
};

export const toViewRecord = (
  input: ViewMetadataInput,
  view: ExtensionRuntime["views"][number],
): WorkbenchExtensionMetadata["views"][number] | null => {
  const webview = resolveWebview(input, view);
  if (view.contribution.body.kind === "webview" && !webview) return null;
  return {
    id: view.id,
    localId: view.localId,
    extensionId: view.extensionId,
    title: view.contribution.title,
    icon: view.contribution.icon,
    path: view.contribution.path,
    body: webview ? { kind: "webview", webview } : toNativeViewBody(view),
  };
};
