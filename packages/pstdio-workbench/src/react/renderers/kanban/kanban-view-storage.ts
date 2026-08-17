import type { WorkbenchPanelInstance } from "../../../core";

const resolveProjectScope = (placement: WorkbenchPanelInstance, storageScope: string | undefined) => {
  const metadata = placement.resource?.metadata;
  const projectId = metadata?.projectId;
  if (typeof projectId === "string") return projectId;

  const favoriteScope = metadata?.favoriteScope;
  if (!favoriteScope || typeof favoriteScope !== "object" || Array.isArray(favoriteScope)) {
    return storageScope;
  }

  const scope = favoriteScope as { scope?: unknown; projectId?: unknown };
  return scope.scope === "project" && typeof scope.projectId === "string" ? scope.projectId : undefined;
};

export const resolveKanbanRendererStorageKey = (
  kanbanRendererId: string,
  placement: WorkbenchPanelInstance,
  storageScope?: string,
) => {
  const baseKey = `pstdio:workbench:kanbanRenderer:${kanbanRendererId}:${placement.instanceId}`;
  const projectScope = resolveProjectScope(placement, storageScope);
  return projectScope ? `${baseKey}:project:${projectScope}` : baseKey;
};
