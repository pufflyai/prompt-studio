import { Box, Flex, IconButton } from "@chakra-ui/react";
import { Breadcrumb, type BreadcrumbItem, Header, Tooltip } from "@pstdio/ui";
import { type ShellCore, workbenchTopHeaderLeadingMenuPath, workbenchTopHeaderTrailingMenuPath } from "../../core";
import { ShellArea } from "../area/area";
import { ShellAreaTabs, shouldShowAreaTabs } from "../area/area-tabs";
import { ShellHeaderActions } from "../header/header-actions";
import { listShellMenuActionItemsFromState } from "../menus/menu-action-items";
import { ShellIcon } from "../shared/icon";
import { useShellStore } from "../shared/use-shell-store";
import { ShellTreeView } from "../tree/tree-view";
import { getHeaderBorderBottomWidth } from "./header-border";

interface ShellWorkbenchHeaderProps {
  shell: ShellCore;
  breadcrumbItems: BreadcrumbItem[];
  hasTop: boolean;
  showLeftPanelOpener: boolean;
  onOpenLeftPanel: () => void;
}

export const ShellWorkbenchHeader = (props: ShellWorkbenchHeaderProps) => {
  const { shell, breadcrumbItems, hasTop, showLeftPanelOpener, onOpenLeftPanel } = props;
  const commands = useShellStore(shell.commands.store, (state) => state.commands);
  const contextValues = useShellStore(shell.context.store, (state) => state.values);
  const actionsByPath = useShellStore(shell.menus.store, (state) => state.actionsByPath);
  const menuState = { actionsByPath, commands, contextValues };
  const hasLeadingActions = listShellMenuActionItemsFromState(menuState, workbenchTopHeaderLeadingMenuPath).length > 0;
  const hasTrailingActions =
    listShellMenuActionItemsFromState(menuState, workbenchTopHeaderTrailingMenuPath).length > 0;
  const hasBreadcrumb = breadcrumbItems.length > 0;
  const hasCenter = hasTop || hasBreadcrumb;

  if (!showLeftPanelOpener && !hasLeadingActions && !hasCenter && !hasTrailingActions) return null;

  return (
    <Header
      variant="main"
      borderBottomWidth={getHeaderBorderBottomWidth(shell, "top")}
      borderColor="border.muted"
      flexShrink={0}
      gap="xs"
      overflow="hidden"
      overflowY="hidden"
    >
      {showLeftPanelOpener ? (
        <Tooltip content="Show left side panel">
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Show left side panel"
            flexShrink={0}
            onClick={onOpenLeftPanel}
          >
            <ShellIcon name="PanelLeft" size={16} />
          </IconButton>
        </Tooltip>
      ) : null}
      <ShellHeaderActions shell={shell} menuPath={workbenchTopHeaderLeadingMenuPath} />
      {hasCenter ? (
        <Box flex="1" h="full" minW="0" overflow="hidden">
          {hasTop ? <ShellArea shell={shell} area="top" title="Top" showHeader={false} /> : null}
          {!hasTop && hasBreadcrumb ? (
            <Breadcrumb items={breadcrumbItems} separator="/" separatorGap="xs" display="flex" h="full" />
          ) : null}
        </Box>
      ) : null}
      <ShellHeaderActions shell={shell} menuPath={workbenchTopHeaderTrailingMenuPath} />
    </Header>
  );
};

interface ShellLeftSidePanelProps {
  shell: ShellCore;
  treeViewId?: string;
  footerTreeViewId?: string;
  activeNodeId?: string;
  hasHeader: boolean;
}

export const ShellLeftSidePanel = (props: ShellLeftSidePanelProps) => {
  const { shell, treeViewId, footerTreeViewId, activeNodeId, hasHeader } = props;
  const leftWidgets = useShellStore(shell.layout.store, (state) => state.layout.areas.left.widgets);
  const hasContentTabs = shouldShowAreaTabs(leftWidgets);
  const showHeaderBar = hasHeader || hasContentTabs;

  return (
    <Flex as="aside" direction="column" h="full" minH="0" minW="0" overflow="hidden" w="full">
      {showHeaderBar ? (
        <Header
          variant="main"
          borderBottomWidth={getHeaderBorderBottomWidth(shell, "left-header")}
          borderColor="border.muted"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <ShellAreaTabs shell={shell} area="left" />
          {hasHeader ? (
            <Box flex="1" h="full" minW="0" overflow="hidden">
              <ShellArea shell={shell} area="left-header" title="Left header" showHeader={false} />
            </Box>
          ) : null}
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        {treeViewId ? (
          <ShellTreeView
            shell={shell}
            treeViewId={treeViewId}
            footerTreeViewId={footerTreeViewId}
            activeNodeId={activeNodeId}
          />
        ) : (
          <ShellArea shell={shell} area="left" title="Left" showHeader={false} />
        )}
      </Box>
    </Flex>
  );
};

interface ShellWorkbenchAreaPanelProps {
  shell: ShellCore;
}

interface ShellHeaderedAreaPanelProps extends ShellWorkbenchAreaPanelProps {
  hasHeader: boolean;
}

export const ShellActivityBar = (props: ShellWorkbenchAreaPanelProps) => {
  const { shell } = props;

  return (
    <Box
      as="nav"
      borderRightWidth="1px"
      borderColor="border.muted"
      flexShrink={0}
      h="full"
      minH="0"
      overflow="hidden"
      w="3.5rem"
    >
      <ShellArea shell={shell} area="activityBar" title="Activity bar" showHeader={false} />
    </Box>
  );
};

export const ShellRightSidePanel = (props: ShellHeaderedAreaPanelProps) => {
  const { shell, hasHeader } = props;
  const rightWidgets = useShellStore(shell.layout.store, (state) => state.layout.areas["main-right"].widgets);
  const hasContentTabs = shouldShowAreaTabs(rightWidgets);
  const showHeaderBar = hasHeader || hasContentTabs;

  return (
    <Flex as="aside" direction="column" h="full" minH="0" minW="0" overflow="hidden" w="full">
      {showHeaderBar ? (
        <Header
          variant="main"
          borderBottomWidth={getHeaderBorderBottomWidth(shell, "main-right-header")}
          borderColor="border.muted"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <ShellAreaTabs shell={shell} area="main-right" />
          {hasHeader ? (
            <Box flex="1" h="full" minW="0" overflow="hidden">
              <ShellArea shell={shell} area="main-right-header" title="Main right header" showHeader={false} />
            </Box>
          ) : null}
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        <ShellArea shell={shell} area="main-right" title="Main right" showHeader={false} />
      </Box>
    </Flex>
  );
};

interface ShellMainLeftPanelProps extends ShellHeaderedAreaPanelProps {
  treeViewId?: string;
  activeNodeId?: string;
}

export const ShellMainLeftPanel = (props: ShellMainLeftPanelProps) => {
  const { shell, hasHeader, treeViewId, activeNodeId } = props;
  const mainLeftWidgets = useShellStore(shell.layout.store, (state) => state.layout.areas["main-left"].widgets);
  const hasContentTabs = shouldShowAreaTabs(mainLeftWidgets);
  const showHeaderBar = hasHeader || hasContentTabs;

  return (
    <Flex as="aside" direction="column" h="full" minH="0" minW="0" overflow="hidden" w="full">
      {showHeaderBar ? (
        <Header
          variant="main"
          borderBottomWidth={getHeaderBorderBottomWidth(shell, "main-left-header")}
          borderColor="border.muted"
          flexShrink={0}
          gap="xs"
          overflow="hidden"
          overflowY="hidden"
        >
          <ShellAreaTabs shell={shell} area="main-left" />
          {hasHeader ? (
            <Box flex="1" h="full" minW="0" overflow="hidden">
              <ShellArea shell={shell} area="main-left-header" title="Main left header" showHeader={false} />
            </Box>
          ) : null}
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        {treeViewId ? (
          <ShellTreeView shell={shell} treeViewId={treeViewId} activeNodeId={activeNodeId} />
        ) : (
          <ShellArea shell={shell} area="main-left" title="Main left" showHeader={false} />
        )}
      </Box>
    </Flex>
  );
};

export const ShellStatusBar = (props: ShellWorkbenchAreaPanelProps) => {
  const { shell } = props;

  return (
    <Box
      as="footer"
      borderTopWidth="1px"
      borderColor="border.muted"
      flexShrink={0}
      h="1.75rem"
      minH="0"
      minW="0"
      overflow="hidden"
    >
      <ShellArea shell={shell} area="status" title="Status" showHeader={false} />
    </Box>
  );
};
