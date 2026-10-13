import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { pageOwnerResource } from "../../registries/pages/page-main";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";

export interface OwnerLayoutContext {
  projectId?: string;
  modeId?: string;
  pageId?: string;
  resource?: ResourceRef;
}

export const pageLayoutScope = (context: OwnerLayoutContext, page?: WorkbenchPageContribution) => {
  if (!context.projectId) return undefined;
  if (!context.pageId) return `project/${context.projectId}`;
  const owner = `project/${context.projectId}/owner/page/${encodeURIComponent(context.pageId)}`;
  const resource = pageOwnerResource(page, context.resource);
  return `${owner}/${resource ? `resource/${encodeURIComponent(resourceKey(resource))}` : "unbound"}`;
};

export const modeLayoutScope = (projectId: string | undefined, modeId: string) =>
  `project/${projectId ?? "__global__"}/owner/mode/${encodeURIComponent(modeId)}`;

export const pageGeometryScope = (projectId: string, pageId: string) =>
  `project/${projectId}/owner/page/${encodeURIComponent(pageId)}/geometry`;

export const pageOwnerFromLayoutScope = (scope?: string) => {
  const match = scope?.match(/^project\/([^/]+)\/owner\/page\/([^/]+)\/(?:resource\/|unbound$)/);
  return match ? { projectId: match[1]!, pageId: decodeURIComponent(match[2]!) } : undefined;
};
