import type { WorkbenchPagePersistenceScopeInput } from "@pstdio/workbench";

const projectOwnedRegions = [
  "nav",
  "activity",
  "sidenav",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "status",
] as const;

const projectIdFromScope = (scope: string | undefined) => scope?.match(/^project\/([^/]+)(?:\/|$)/)?.[1];

export const resolveDashboardPersistenceScope = (input: WorkbenchPagePersistenceScopeInput) => {
  const { currentScope, modeId, pageId, projectId, resource } = input;
  if (!projectId) return { scope: undefined };

  const scope =
    modeId && pageId
      ? `project/${projectId}/mode/${modeId}/${resource ? `resource/${resource.uri}` : `page/${pageId}`}`
      : `project/${projectId}`;
  const carryRegions = projectIdFromScope(currentScope) === projectId ? projectOwnedRegions : [];
  return { scope, carryRegions };
};
