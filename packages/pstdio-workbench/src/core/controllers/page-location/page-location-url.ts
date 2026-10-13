import { type PageLocation, parseWorkbenchPageUrl } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { normalizeDirectWorkbenchPageLocation, workbenchPageLocationRouteKey } from "./page-location-normalization";
import { isPageHistoryState } from "./page-location-restoration";
import type { ResolvedPageLocation, WorkbenchPageBrowserEntry } from "./page-location-types";
import { resolveLocationMode } from "./page-mode-locations";

export const resolvePageLocationUrl = (input: {
  projectId: string;
  entry: WorkbenchPageBrowserEntry;
  pages: readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
  activeModeId?: string;
  normalizeStored(location: PageLocation): ResolvedPageLocation;
}) => {
  const { projectId, entry, pages, resources, activeModeId, normalizeStored } = input;
  const parsed = parseWorkbenchPageUrl({ url: entry.url, projectId, pages, resources });
  if (!parsed) return undefined;
  const direct = resolveLocationMode(
    normalizeDirectWorkbenchPageLocation({ ...parsed, pages, resources }),
    pages,
    activeModeId,
  );
  if (!isPageHistoryState(entry.state) || entry.state.projectId !== projectId) return direct;
  const contextual = normalizeStored(entry.state.location);
  const directKey = workbenchPageLocationRouteKey(direct.location, resources, pages);
  const contextualKey = workbenchPageLocationRouteKey(contextual.location, resources, pages);
  if (entry.state.routeKey !== directKey || contextualKey !== directKey) return direct;
  return contextual;
};
