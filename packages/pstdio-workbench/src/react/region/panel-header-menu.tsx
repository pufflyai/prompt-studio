import { Box } from "@chakra-ui/react";
import { ResourceContextMenu } from "@pstdio/ui";
import type { ReactElement } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { geometryPositions, moveGeometry, panelPositionLabel } from "./panel-drag-area";

interface PanelHeaderMenuProps {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
}

export const PanelHeaderContextMenu = (props: PanelHeaderMenuProps & { children: ReactElement }) => {
  const { workbench, region, children } = props;
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const policy = usePanelPolicy(workbench, region);
  if (!policy.provided) return children;
  return (
    <ResourceContextMenu
      actions={[
        ...geometryPositions(workbench, region, layout).map((edge) => ({
          key: `move-${edge}`,
          label: panelPositionLabel(region, edge),
          icon: (
            <WorkbenchIcon
              name={{ left: "PanelLeft", right: "PanelRight", top: "PanelTop", bottom: "PanelBottom" }[edge]}
              size={14}
            />
          ),
          onClick: () => {
            void moveGeometry(workbench, region, edge);
          },
        })),
        {
          key: "hide-header",
          label: "Hide header",
          icon: <WorkbenchIcon name="PanelTop" size={14} />,
          onClick: () => workbench.shell.setHeaderVisible(region, false),
        },
      ]}
    >
      {children}
    </ResourceContextMenu>
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
