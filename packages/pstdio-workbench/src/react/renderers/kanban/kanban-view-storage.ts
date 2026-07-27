import type { WorkbenchPanelInstance } from "../../../core";

const resolveProjectScope = (placement: WorkbenchPanelInstance) => {
  const metadata = placement.resource?.metadata;
  const projectId = metadata?.projectId;
  if (typeof projectId === "string") return projectId;

  const favoriteScope = metadata?.favoriteScope;
  if (!favoriteScope || typeof favoriteScope !== "object" || Array.isArray(favoriteScope)) return undefined;

  const scope = favoriteScope as { scope?: unknown; projectId?: unknown };
  return scope.scope === "project" && typeof scope.projectId === "string" ? scope.projectId : undefined;
};

export const resolveKanbanRendererStorageKey = (kanbanRendererId: string, placement: WorkbenchPanelInstance) => {
  const baseKey = `pstdio:workbench:kanbanRenderer:${kanbanRendererId}:${placement.instanceId}`;
  const projectScope = resolveProjectScope(placement);
  return projectScope ? `${baseKey}:project:${projectScope}` : baseKey;
};
