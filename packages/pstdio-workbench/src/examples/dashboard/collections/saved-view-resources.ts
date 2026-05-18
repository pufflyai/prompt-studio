import type { ResourceRef, ViewDisplayOptions, WorkbenchSavedView } from "../../../core";
import { dashboardDataRendererStorageKey } from "../mock-data/data";
import type { TicketViewSnapshot } from "./ticket-view-mapping";

export { dashboardCollectionsProjectId } from "../mock-data/data";

const savedViewFavoriteScope = (view: WorkbenchSavedView) =>
  view.scope === "project" ? { scope: "project", projectId: view.projectId } : { scope: "user" };

export const savedViewStorageKey = (viewId: string) => `dashboard-workbench-view-${viewId}`;

export const createSavedViewResource = (view: WorkbenchSavedView): ResourceRef => ({
  kind: "savedView",
  id: view.id,
  uri: `pstdio://views/${view.id}`,
  label: view.name,
  icon: "Table",
  metadata: {
    favoriteScope: savedViewFavoriteScope(view),
    resourceKind: view.resourceKind,
    projectId: view.projectId,
    filter: view.filter,
    display: view.display,
  },
});

export const resolveDataRendererStorageKey = (resource: ResourceRef | undefined) =>
  resource?.kind === "savedView" && resource.id ? savedViewStorageKey(resource.id) : dashboardDataRendererStorageKey;

export const getTicketViewSnapshotFromResource = (
  resource: ResourceRef | undefined,
): TicketViewSnapshot | undefined => {
  const filter = resource?.metadata?.filter;
  const display = resource?.metadata?.display;
  if (!filter || !display) return undefined;
  return { filter: filter as TicketViewSnapshot["filter"], display: display as ViewDisplayOptions };
};
