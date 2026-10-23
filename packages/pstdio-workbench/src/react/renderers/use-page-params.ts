import type { PageParams } from "@pstdio/sdk/extensions";
import { resolvePageParams } from "pstdio-api-contracts";
import { useLayoutEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { WorkbenchCore, WorkbenchPanelInstance } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const usePageParams = (workbench: WorkbenchCore, placement?: WorkbenchPanelInstance) => {
  const owner = placement?.placementIdentity;
  const pageId = owner?.kind === "page" ? owner.pageId : undefined;
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const params = useWorkbenchStore(
    workbench.pages.store,
    useShallow((state) =>
      pageId && pageId === state.activePageId
        ? resolvePageParams(state.pages[pageId]?.params, state.location?.params)
        : undefined,
    ),
  );
  const retained = useRef<{ pageId: string; projectId?: string; params: PageParams } | undefined>(undefined);
  useLayoutEffect(() => {
    if (pageId && params) retained.current = { pageId, projectId, params };
  }, [pageId, projectId, params]);
  if (!pageId) return undefined;
  // Retained views keep their last query scope while another page is active.
  // Clearing it would reload the hidden view during navigation.
  const previous = retained.current;
  return params ?? (previous?.pageId === pageId && previous.projectId === projectId ? previous.params : undefined);
};
