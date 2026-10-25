import { contributionRefId, pagePlaceholderView } from "@pstdio/sdk/extensions";
import type { ReactNode } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { PageViewOwnerContext } from "../renderers/use-page-params";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { EmptyPanel } from "./empty-panel";
import { WorkbenchWidgetHost } from "./widget-host";

interface PanelPlaceholderProps {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
  fallback?: ReactNode;
}

export const PanelPlaceholder = (props: PanelPlaceholderProps) => {
  const { workbench, region, fallback } = props;
  const policy = usePanelPolicy(workbench, region);
  const pageState = useWorkbenchStore(workbench.pages.store, (state) => state);
  const page = pageState.activePageId ? pageState.pages[pageState.activePageId] : undefined;
  const empty = region === "main" ? pagePlaceholderView(page?.main.empty) : undefined;
  if (!empty) return fallback ?? (policy.acceptsTabs ? <EmptyPanel workbench={workbench} region={region} /> : null);
  return (
    <PageViewOwnerContext value={pageState.activePageId}>
      <WorkbenchWidgetHost
        workbench={workbench}
        region="main"
        placement={{
          widgetId: "workbench.empty-page",
          contributionId: "workbench.empty-page",
          viewId: contributionRefId(empty),
          closable: false,
          resource: pageState.location?.resource,
        }}
      />
    </PageViewOwnerContext>
  );
};
