import { Box, useRecipe } from "@chakra-ui/react";
import { type Header, ResourceContextMenu } from "@pstdio/ui";
import type { ComponentProps } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { PanelDragHeader, usePanelPositionActions } from "./panel-position-controls";

interface PanelHeaderProps extends ComponentProps<typeof Header> {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
}

/** Keep an accessible context surface even when the tab header is hidden. */
export const PanelHeader = (props: PanelHeaderProps) => {
  const { workbench, region, children, ...rest } = props;
  const edgeStyles = useRecipe({ key: "panelHeaderEdge" })();
  const policy = usePanelPolicy(workbench, region);
  const positionActions = usePanelPositionActions(workbench, region);
  const show = policy.showHeader;
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
  return (
    <ResourceContextMenu
      actions={[
        ...positionActions,
        {
          key: "header",
          label: show ? "Hide header" : "Show header",
          icon: <WorkbenchIcon name="PanelTop" size={14} />,
          onSelect: () => workbench.shell.setHeaderVisible(region, !show),
        },
      ]}
    >
      {show ? header : <Box css={edgeStyles} aria-label={`${label} header edge`} aria-haspopup="menu" tabIndex={0} />}
    </ResourceContextMenu>
  );
};
