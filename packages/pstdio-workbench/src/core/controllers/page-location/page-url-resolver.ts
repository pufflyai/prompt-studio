import type { PageLocation, PageParams, PageRef } from "@pstdio/sdk/extensions";
import { parseWorkbenchPageUrl } from "pstdio-api-contracts";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import {
  normalizeDirectWorkbenchPageLocation,
  workbenchPageLocationRouteKey,
  workbenchPageRefKey,
} from "./page-location-normalization";
import type { ResolvedPageLocation, WorkbenchPageBrowserEntry, WorkbenchPageHistoryState } from "./page-location-types";

export const isPageHistoryState = (value: unknown): value is WorkbenchPageHistoryState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<WorkbenchPageHistoryState>;
  return (
    state.kind === "pstdio.page-location" &&
    typeof state.index === "number" &&
    typeof state.projectId === "string" &&
    typeof state.routeKey === "string" &&
    Boolean(state.location && typeof state.location === "object")
  );
};
const locationWithUrlParams = (
  contextual: PageLocation,
  page: PageRef,
  params: PageParams | undefined,
): PageLocation | undefined => {
  if (workbenchPageRefKey(contextual.page) === workbenchPageRefKey(page)) {
    const { params: previous, ...location } = contextual;
    return { ...location, ...(params ? { params } : {}) };
  }
  const parent = contextual.parent && locationWithUrlParams(contextual.parent, page, params);
  return parent ? { ...contextual, parent } : undefined;
};
export const createPageUrlResolver =
  (input: {
    pages(): WorkbenchPageContribution[];
    resources: WorkbenchPageResourceCodec;
    normalize(location: PageLocation): ResolvedPageLocation;
  }) =>
  (projectId: string, entry: WorkbenchPageBrowserEntry) => {
    const pages = input.pages();
    const parsed = parseWorkbenchPageUrl({ url: entry.url, projectId, pages, resources: input.resources });
    if (!parsed) return undefined;
    const direct = normalizeDirectWorkbenchPageLocation({ ...parsed, pages, resources: input.resources });
    if (!isPageHistoryState(entry.state) || entry.state.projectId !== projectId) return direct;
    const sourcePage = pages.find((page) => page.id === parsed.pageId)!;
    const withParams = locationWithUrlParams(entry.state.location, sourcePage.ref, parsed.params);
    if (!withParams) return direct;
    const contextual = input.normalize(withParams);
    const directKey = workbenchPageLocationRouteKey(direct.location, input.resources, pages);
    const contextualKey = workbenchPageLocationRouteKey(contextual.location, input.resources, pages);
    const storedKey = workbenchPageLocationRouteKey(entry.state.location, input.resources, pages);
    if (entry.state.routeKey !== storedKey || contextualKey !== directKey) return direct;
    return contextual;
  };
