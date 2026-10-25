import { type Header, ResourceContextMenu } from "@pstdio/ui";
import type { ComponentProps } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { PanelDragHeader, usePanelPositionActions } from "./panel-position-controls";

interface PanelHeaderProps extends ComponentProps<typeof Header> {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
}

export const PanelHeader = (props: PanelHeaderProps) => {
  const { workbench, region, children, ...rest } = props;
  const policy = usePanelPolicy(workbench, region);
  const positionActions = usePanelPositionActions(workbench, region);
  if (!policy.showHeader) return null;
  const label = { secondary: "Bottom", side: "Side", main: "Main" }[region];
  const headerProps = {
    ...rest,
    "data-workbench-panel-header": region,
    "aria-label": `${label} panel header`,
    tabIndex: 0,
  };
  const header = (
    <PanelDragHeader workbench={workbench} region={region} {...headerProps}>
      {children}
    </PanelDragHeader>
  );
  return <ResourceContextMenu actions={positionActions}>{header}</ResourceContextMenu>;
};
