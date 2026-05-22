import type { ResourceRef, WorkbenchSavedView } from "../../../../../core";

const savedViewFavoriteScope = (view: WorkbenchSavedView) =>
  view.scope === "project" ? { scope: "project", projectId: view.projectId } : { scope: "user" };

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
