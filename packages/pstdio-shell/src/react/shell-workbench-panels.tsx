import { Box, Flex, IconButton } from "@chakra-ui/react";
import { Breadcrumb, type BreadcrumbItem, Header, Tooltip } from "@pstdio/ui";
import type { ReactNode } from "react";
import { type MenuPath, type ShellCore, workbenchTopActionMenuPath } from "../core";
import { ShellArea } from "./shell-area";
import { ShellHeaderActions } from "./shell-header-actions";
import { ShellIcon } from "./shell-icons";
import { ShellTreeView } from "./shell-tree-view";

interface ShellWorkbenchHeaderProps {
  shell: ShellCore;
  breadcrumbItems: BreadcrumbItem[];
  hasTop: boolean;
  showLeftPanelOpener: boolean;
  topActionMenuPath?: MenuPath;
  onOpenLeftPanel: () => void;
  onCommandError?: (error: unknown) => void;
  refresh: () => void;
}

export const ShellWorkbenchHeader = (props: ShellWorkbenchHeaderProps) => {
  const {
    shell,
    breadcrumbItems,
    hasTop,
    showLeftPanelOpener,
    topActionMenuPath = workbenchTopActionMenuPath,
    onOpenLeftPanel,
    onCommandError,
    refresh,
  } = props;

  return (
    <Header
      variant="main"
      borderBottomWidth="1px"
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
      <Box flex="1" h="full" minW="0" overflow="hidden">
        {hasTop ? (
          <ShellArea shell={shell} area="top" title="Top" showHeader={false} refresh={refresh} />
        ) : (
          <Breadcrumb items={breadcrumbItems} separator="/" separatorGap="xs" display="flex" h="full" />
        )}
      </Box>
      <ShellHeaderActions
        shell={shell}
        menuPath={topActionMenuPath}
        refresh={refresh}
        onCommandError={onCommandError}
      />
    </Header>
  );
};

interface ShellLeftSidePanelProps {
  shell: ShellCore;
  treeViewId?: string;
  footerTreeViewId?: string;
  activeNodeId?: string;
  header?: ReactNode;
  onOpenCommandPalette?: () => void;
  refresh: () => void;
}

export const ShellLeftSidePanel = (props: ShellLeftSidePanelProps) => {
  const { shell, treeViewId, footerTreeViewId, activeNodeId, header, onOpenCommandPalette, refresh } = props;

  return (
    <Flex as="aside" direction="column" h="full" minH="0" minW="0" overflow="hidden" w="full">
      {header ? (
        <Header variant="main" flexShrink={0}>
          {header}
        </Header>
      ) : null}
      <Box flex="1" minH="0" minW="0" overflow="hidden">
        {treeViewId ? (
          <ShellTreeView
            shell={shell}
            treeViewId={treeViewId}
            footerTreeViewId={footerTreeViewId}
            activeNodeId={activeNodeId}
            onOpenCommandPalette={onOpenCommandPalette}
            refresh={refresh}
          />
        ) : (
          <ShellArea shell={shell} area="left" title="Left" showHeader={false} refresh={refresh} />
        )}
      </Box>
    </Flex>
  );
};

interface ShellWorkbenchAreaPanelProps {
  shell: ShellCore;
  refresh: () => void;
}

export const ShellActivityBar = (props: ShellWorkbenchAreaPanelProps) => {
  const { shell, refresh } = props;

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
      <ShellArea shell={shell} area="activityBar" title="Activity bar" showHeader={false} refresh={refresh} />
    </Box>
  );
};

export const ShellRightSidePanel = (props: ShellWorkbenchAreaPanelProps) => {
  const { shell, refresh } = props;

  return (
    <Box as="aside" h="full" minH="0" minW="0" overflow="hidden" w="full">
      <ShellArea shell={shell} area="main-right" title="Main right" showHeader={false} refresh={refresh} />
    </Box>
  );
};

export const ShellMainLeftPanel = (props: ShellWorkbenchAreaPanelProps) => {
  const { shell, refresh } = props;

  return (
    <Box as="aside" h="full" minH="0" minW="0" overflow="hidden" w="full">
      <ShellArea shell={shell} area="main-left" title="Main left" showHeader={false} refresh={refresh} />
    </Box>
  );
};

export const ShellStatusBar = (props: ShellWorkbenchAreaPanelProps) => {
  const { shell, refresh } = props;

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
      <ShellArea shell={shell} area="status" title="Status" showHeader={false} refresh={refresh} />
    </Box>
  );
};

export const ShellOverlayLayer = (props: ShellWorkbenchAreaPanelProps) => {
  const { shell, refresh } = props;

  return (
    <Box position="absolute" inset="0" minH="0" minW="0" overflow="hidden" pointerEvents="none" zIndex="overlay">
      <ShellArea
        shell={shell}
        area="overlay"
        title="Overlay"
        showHeader={false}
        pointerEvents="none"
        transparent
        refresh={refresh}
      />
    </Box>
  );
};
