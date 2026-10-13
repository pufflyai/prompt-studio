import { type PageLocation, parseWorkbenchPageUrl } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { normalizeDirectWorkbenchPageLocation, workbenchPageLocationRouteKey } from "./page-location-normalization";
import { isPageHistoryState as isHistoryState } from "./page-location-restoration";
import type { ResolvedPageLocation, WorkbenchPageBrowserEntry } from "./page-location-types";
import { resolveLocationMode } from "./page-mode-locations";

export const createPageLocationUrlResolver = (input: {
  pages(): WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
  normalizeStored(location: PageLocation): ResolvedPageLocation;
  activeModeId(): string | undefined;
}) => {
  const { pages, resources, normalizeStored, activeModeId } = input;
  return (projectId: string, entry: WorkbenchPageBrowserEntry) => {
    const parsed = parseWorkbenchPageUrl({
      url: entry.url,
      projectId,
      pages: pages(),
      resources: resources,
    });
    if (!parsed) return undefined;
    const direct = resolveLocationMode(
      normalizeDirectWorkbenchPageLocation({
        ...parsed,
        pages: pages(),
        resources: resources,
      }),
      pages(),
      activeModeId(),
    );
    if (!isHistoryState(entry.state) || entry.state.projectId !== projectId) return direct;
    const contextual = normalizeStored(entry.state.location);
    const directKey = workbenchPageLocationRouteKey(direct.location, resources, pages());
    const contextualKey = workbenchPageLocationRouteKey(contextual.location, resources, pages());
    if (entry.state.routeKey !== directKey || contextualKey !== directKey) return direct;
    return contextual;
  };
};
