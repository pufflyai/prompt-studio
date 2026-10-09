import {
  type BoardField,
  dataTableBuiltInViews,
  type ExtensionDataTableRendererRecord,
  WORKSPACES_COLLECTION_ID,
  workspaceCollectionColumns,
  workspaceCollectionDefaults,
} from "pstdio-api-contracts";
import { VIEW_FILTER_CONDITIONS } from "pstdio-api-contracts/extension-kernel";

export const nativeWorkspaceBoard = (projectId: string) => {
  const body: Pick<
    ExtensionDataTableRendererRecord,
    "columns" | "defaultSettings" | "defaultViews" | "defaultFilter" | "defaultSorts" | "defaultActiveViewId"
  > = {
    columns: workspaceCollectionColumns,
    defaultSettings: workspaceCollectionDefaults,
  };
  const { settings, views } = dataTableBuiltInViews(body);
  return {
    id: WORKSPACES_COLLECTION_ID,
    title: "Workspaces",
    kind: "dataTable" as const,
    extensionId: null,
    scope: { project_id: projectId, extension_instance_id: null, board_id: WORKSPACES_COLLECTION_ID },
    body,
    settings,
    startingViews: views.map((view) => ({ ...view, boardId: WORKSPACES_COLLECTION_ID, title: String(view.title) })),
  };
};

export const nativeWorkspaceFields = () =>
  workspaceCollectionColumns.map(
    (column) =>
      ({
        id: column.id,
        label: column.label,
        kind: column.type,
        conditions: [...VIEW_FILTER_CONDITIONS[column.type]],
        filterable: column.filterable ?? true,
        sortable: true,
        displayable: true,
        groupable: column.groupable ?? false,
      }) satisfies BoardField,
  );
