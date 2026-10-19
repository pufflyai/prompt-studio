import { Box, useRecipe } from "@chakra-ui/react";
import { Header, ResourceContextMenu } from "@pstdio/ui";
import type { ComponentProps } from "react";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { usePanelPolicy } from "../shared/use-panel-policy";

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
  return (
    <ResourceContextMenu
      actions={[
        {
          key: "header",
          label: show ? "Hide header" : "Show header",
          icon: <WorkbenchIcon name="PanelTop" size={14} />,
          onClick: () => workbench.shell.setHeaderVisible(region, !show),
        },
      ]}
    >
      {show ? (
        <Header {...rest} data-workbench-panel-header={region} aria-label={`${label} panel header`} tabIndex={0}>
          {children}
        </Header>
      ) : (
        <Box css={edgeStyles} aria-label={`${label} header edge`} aria-haspopup="menu" tabIndex={0} />
      )}
    </ResourceContextMenu>
  );
};
