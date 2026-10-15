import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { usePagePanelGeometry, WorkbenchPagePanel } from "./workbench-page-panel";

export const WorkbenchPageAsideLayout = (props: { workbench: WorkbenchCore; children: ReactNode }) => {
  const { workbench, children } = props;
  const { settings, size, edge } = usePagePanelGeometry(workbench, "aside");
  const policy = usePanelPolicy(workbench, "aside");
  return (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide={edge === "left" ? "left" : "right"}
      contentPanel={children}
      resizablePanel={<WorkbenchPagePanel workbench={workbench} region="aside" />}
      collapsed={!policy.open}
      collapsible={policy.canClose && (settings?.collapsible ?? true)}
      resizable={policy.resizable}
      defaultSizePx={size ?? 280}
      minSizePx={settings?.size?.minPx ?? 160}
      maxSizePx={settings?.size?.maxPx}
      contentMinSizePx={480}
      resizeLabel="Resize page side"
      onSizeChange={(width) => workbench.shell.setRegionSize("aside", width)}
      onCollapsedChange={(collapsed) => {
        if (!collapsed || policy.canClose) void workbench.shell.setRegionOpen("aside", !collapsed);
      }}
      separator={policy.showHeader ? "content-line" : "line"}
    />
  );
};
