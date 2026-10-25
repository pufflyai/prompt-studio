import type { PageLocation } from "@pstdio/sdk/extensions";
import { serializeWorkbenchPageUrl } from "pstdio-api-contracts";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { workbenchPageLocationRouteKey } from "./page-location-normalization";
import type {
  WorkbenchPageHistoryState,
  WorkbenchPageLocationDiagnostic,
  WorkbenchPageLocationHistoryState,
} from "./page-location-types";

export const createPageHistoryEntry =
  (input: {
    pages(): WorkbenchPageContribution[];
    resources: WorkbenchPageResourceCodec;
    removalVersion?(): number;
    removalEpoch?(): string;
  }) =>
  (projectId: string, location: PageLocation, index: number) => ({
    url: serializeWorkbenchPageUrl({ projectId, location, pages: input.pages(), resources: input.resources }),
    state: {
      kind: "pstdio.page-location",
      index,
      projectId,
      routeKey: workbenchPageLocationRouteKey(location, input.resources, input.pages()),
      location,
      removalVersion: input.removalVersion?.() ?? 0,
      removalEpoch: input.removalEpoch?.(),
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

export const createPageLocationHistory = () => {
  let index = 0;
  let maxIndex = 0;
  const store = createWorkbenchStore<WorkbenchPageLocationHistoryState>({
    name: "workbench.page-location-history",
    initialState: { canGoBack: false, canGoForward: false },
  });
  const canGoBack = () => index > 0;
  const canGoForward = () => index < maxIndex;
  const publish = () =>
    store.setState({ canGoBack: canGoBack(), canGoForward: canGoForward() }, false, "pageLocationHistory");
  return {
    store,
    publish,
    canGoBack,
    canGoForward,
    getIndex: () => index,
    commitIndex(next: number, push: boolean) {
      index = next;
      if (push) maxIndex = next;
    },
    adopt(next: number) {
      index = next;
      maxIndex = Math.max(maxIndex, next);
      publish();
    },
    reset() {
      index = 0;
      maxIndex = 0;
      publish();
    },
  };
};
