import { dataTableBuiltInViews, WORKSPACES_COLLECTION_ID, workspaceCollectionDefaults } from "pstdio-api-contracts";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";

export const seedWorkspaceViewsStory = (projectId: string) => {
  const { views } = dataTableBuiltInViews({ defaultSettings: workspaceCollectionDefaults });
  const timestamp = "2026-06-24T09:00:00Z";
  getWriter("board_views")?.truncateAndWrite(
    views.map((view, index) => ({
      id: `workspace-view-${index}`,
      project_id: projectId,
      extension_instance_id: null,
      board_id: WORKSPACES_COLLECTION_ID,
      title: view.title,
      settings: view.settings,
      filter: view.filter,
      sorts: view.sorts,
      sort_order: index,
      created_at: timestamp,
      updated_at: timestamp,
    })),
  );
  getWriter("board_default_views")?.truncateAndWrite([]);
  markInitialCollectionsSyncComplete();
};
