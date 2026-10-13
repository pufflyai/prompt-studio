import { Box, IconButton } from "@chakra-ui/react";
import { PANEL_HEADER_CONTROL_SIZE, ResourceActionMenu, ResourceContextMenu } from "@pstdio/ui";
import type { ReactElement } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";

interface PanelHeaderMenuProps {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
}

export const PanelHeaderContextMenu = (props: PanelHeaderMenuProps & { children: ReactElement }) => {
  const { workbench, region, children } = props;
  return (
    <ResourceContextMenu
      actions={[
        { key: "hide-header", label: "Hide header", onClick: () => workbench.shell.setHeaderVisible(region, false) },
      ]}
    >
      {children}
    </ResourceContextMenu>
  );
};

export const PanelHeaderMenu = (props: PanelHeaderMenuProps) => {
  const { workbench, region } = props;
  const policy = usePanelPolicy(workbench, region);
  if (!policy.provided) return null;
  return (
    <ResourceActionMenu
      actions={[
        {
          key: "hide-header",
          label: "Hide header",
          icon: <WorkbenchIcon name="PanelTop" size={14} />,
          onClick: () => workbench.shell.setHeaderVisible(region, false),
        },
      ]}
    >
      <IconButton aria-label={`${region} header options`} variant="ghost" size={PANEL_HEADER_CONTROL_SIZE}>
        <WorkbenchIcon name="Ellipsis" size={14} />
      </IconButton>
    </ResourceActionMenu>
  );
};

export const PanelHeaderEdge = (props: PanelHeaderMenuProps & { visible: boolean }) => {
  const { workbench, region, visible } = props;
  if (visible || !workbench.shell.getPanelPolicy(region).provided) return null;
  return (
    <ResourceContextMenu
      actions={[
        {
          key: "show-header",
          label: "Show header",
          icon: <WorkbenchIcon name="PanelTop" size={14} />,
          onClick: () => workbench.shell.setHeaderVisible(region, true),
        },
      ]}
    >
      <Box layerStyle="panelHeaderEdge" tabIndex={0} aria-label={`${region} header edge`} aria-haspopup="menu" />
    </ResourceContextMenu>
  );
};
