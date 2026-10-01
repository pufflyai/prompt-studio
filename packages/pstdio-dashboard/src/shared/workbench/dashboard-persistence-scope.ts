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
// The bare project scope is only a loading step before a page applies. Its saved
// region state is older than the page's, so it never carries into a page.
const pageScopeMatch = (scope: string | undefined) => scope?.match(/^project\/([^/]+)\/mode\/([^/]+)\//);
export const resolveDashboardPersistenceScope = (input: WorkbenchPagePersistenceScopeInput) => {
  const { currentScope, modeId, pageId, projectId, resource } = input;
  if (!projectId) return { scope: undefined };
  const scope =
    modeId && pageId
      ? `project/${projectId}/mode/${modeId}/${resource ? `resource/${defaultPageResourceCodec.toUri(resource)}` : `page/${pageId}`}`
      : `project/${projectId}`;
  const current = pageScopeMatch(currentScope);
  const sameMode = current?.[2] === modeId;
  const carryRegions =
    current?.[1] === projectId ? projectOwnedRegions.filter((region) => sameMode || !/^side(?:-|$)/.test(region)) : [];
  return { scope, carryRegions };
};
