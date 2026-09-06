import type { WorkbenchPagePersistenceScopeInput } from "@pstdio/workbench";
import { defaultPageResourceCodec } from "@pstdio/workbench";

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
const modeIdFromScope = (scope: string | undefined) => {
  if (!projectIdFromScope(scope)) return undefined;
  return scope?.match(/\/mode\/([^/]+)/)?.[1] ?? "project";
};
export const resolveDashboardPersistenceScope = (input: WorkbenchPagePersistenceScopeInput) => {
  const { currentScope, modeId, pageId, projectId, resource } = input;
  if (!projectId) return { scope: undefined };
  const scope =
    modeId && pageId
      ? `project/${projectId}/mode/${modeId}/${resource ? `resource/${defaultPageResourceCodec.toUri(resource)}` : `page/${pageId}`}`
      : `project/${projectId}`;
  const sameMode = modeIdFromScope(currentScope) === modeId;
  const carryRegions =
    projectIdFromScope(currentScope) === projectId
      ? projectOwnedRegions.filter((region) => sameMode || !/^side(?:-|$)/.test(region))
      : [];
  return { scope, carryRegions };
};
