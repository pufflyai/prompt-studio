import type { PageLocation } from "@pstdio/sdk/extensions";
import { parseWorkbenchPageUrl } from "pstdio-api-contracts";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { normalizeDirectWorkbenchPageLocation, workbenchPageLocationRouteKey } from "./page-location-normalization";
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
const locationWithUrlParams = (direct: PageLocation, contextual: PageLocation) => {
  const { params: previous, ...location } = contextual;
  return { ...location, ...(direct.params ? { params: direct.params } : {}) };
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
    const contextual = input.normalize(entry.state.location);
    const directKey = workbenchPageLocationRouteKey(direct.location, input.resources, pages);
    const contextualKey = workbenchPageLocationRouteKey(contextual.location, input.resources, pages);
    if (entry.state.routeKey !== directKey || contextualKey !== directKey) return direct;
    return { ...contextual, location: locationWithUrlParams(direct.location, contextual.location) };
  };
