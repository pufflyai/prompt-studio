import { ResizableSplitLayout } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { usePagePanelGeometry, WorkbenchPagePanel } from "./workbench-page-panel";

export const WorkbenchPageBottomLayout = (props: { workbench: WorkbenchCore; children: ReactNode }) => {
  const { workbench, children } = props;
  const { settings, size, edge } = usePagePanelGeometry(workbench, "bottom");
  const policy = usePanelPolicy(workbench, "bottom");
  return (
    <ResizableSplitLayout
      minH="0"
      minW="0"
      resizableSide={edge === "top" ? "top" : "bottom"}
      contentPanel={children}
      resizablePanel={<WorkbenchPagePanel workbench={workbench} region="bottom" />}
      collapsed={!policy.open}
      collapsible={policy.canClose && (settings?.collapsible ?? true)}
      resizable={policy.resizable}
      defaultSizePx={size ?? 160}
      minSizePx={settings?.size?.minPx ?? 80}
      maxSizePx={settings?.size?.maxPx}
      contentMinSizePx={160}
      resizeLabel="Resize page bottom"
      onSizeChange={(height) => workbench.shell.setRegionSize("bottom", height)}
      onCollapsedChange={(collapsed) => {
        if (!collapsed || policy.canClose) void workbench.shell.setRegionOpen("bottom", !collapsed);
      }}
      separator="line"
    />
  );
};
