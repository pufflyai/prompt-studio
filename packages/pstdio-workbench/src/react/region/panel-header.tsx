import { Box, useRecipe } from "@chakra-ui/react";
import { Header, ResourceContextMenu } from "@pstdio/ui";
import type { ComponentProps } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { PanelDragHeader, panelPositionActions } from "./panel-position-controls";

interface PanelHeaderProps extends ComponentProps<typeof Header> {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
  hasContent?: boolean;
  hasTabs?: boolean;
}

/** Keep an accessible context surface even when the tab header is hidden. */
export const PanelHeader = (props: PanelHeaderProps) => {
  const { workbench, region, hasContent = true, hasTabs = false, children, ...rest } = props;
  const edgeStyles = useRecipe({ key: "panelHeaderEdge" })();
  const policy = usePanelPolicy(workbench, region);
  const show = policy.legacyHeaders
    ? (policy.showHeader || hasTabs) && hasContent
    : policy.showHeader && (region !== "main" || hasContent || policy.headerExplicit);
  const label = { secondary: "Bottom", side: "Side", main: "Main" }[region];
  const headerProps = {
    ...rest,
    "data-workbench-panel-header": region,
    "aria-label": `${label} panel header`,
    tabIndex: 0,
  };
  const header =
    region === "main" ? (
      <Header {...headerProps}>{children}</Header>
    ) : (
      <PanelDragHeader workbench={workbench} region={region} {...headerProps}>
        {children}
      </PanelDragHeader>
    );
  return (
    <ResourceContextMenu
      actions={[
        ...panelPositionActions(workbench, region),
        {
          key: "header",
          label: show ? "Hide header" : "Show header",
          icon: <WorkbenchIcon name="PanelTop" size={14} />,
          onClick: () => workbench.shell.setHeaderVisible(region, !show),
        },
      ]}
    >
      {show ? header : <Box css={edgeStyles} aria-label={`${label} header edge`} aria-haspopup="menu" tabIndex={0} />}
    </ResourceContextMenu>
  );
};
