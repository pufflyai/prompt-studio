import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { serializeWorkbenchPageUrl } from "./page-location-codec";
import { workbenchPageLocationRouteKey } from "./page-location-normalization";
import type { WorkbenchPageHistoryState, WorkbenchPageLocationDiagnostic } from "./page-location-types";

export const createPageHistoryEntry =
  (input: { pages(): WorkbenchPageContribution[]; resources: WorkbenchPageResourceCodec }) =>
  (projectId: string, location: PageLocation, index: number) => ({
    url: serializeWorkbenchPageUrl({ projectId, location, pages: input.pages(), resources: input.resources }),
    state: {
      kind: "pstdio.page-location",
      index,
      projectId,
      routeKey: workbenchPageLocationRouteKey(location, input.resources),
      location,
    } satisfies WorkbenchPageHistoryState,
  });

export const createPageLocationFailureHandler =
  (report?: (diagnostic: WorkbenchPageLocationDiagnostic) => void) =>
  (source: WorkbenchPageLocationDiagnostic["source"], error: unknown) => {
    const diagnostic: WorkbenchPageLocationDiagnostic = {
      code: "page-location-unresolved",
      source,
      message: error instanceof Error ? error.message : String(error),
    };
    report?.(diagnostic);
    return { ok: false, diagnostic } as const;
  };
