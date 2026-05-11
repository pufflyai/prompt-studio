import { Box, Flex, Text } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { usePanelSidebarRegistration } from "../panel-sidebar-registration-context";
import { ScrollArea } from "../scroll-area";
import { TreeList } from "../tree-list/tree-list";
import { useSidebarStore } from "./sidebar.store";
import type { SidebarProps } from "./sidebar.types";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarHeader } from "./sidebar-header";

const DEFAULT_WIDTH = 240;
const DEFAULT_MIN_WIDTH = 200;
const DEFAULT_MAX_WIDTH = 480;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const resolveInitialWidth = (width?: string | number, defaultWidth = DEFAULT_WIDTH) => {
  if (typeof width === "number") return width;
  if (typeof width === "string") {
    const parsed = parseInt(width, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return defaultWidth;
};

export const Sidebar = (props: SidebarProps) => {
  const {
    storageKey,
    sections,
    activeNodeId,
    header,
    footer,
    width,
    closable = true,
    emptyLabel = "No items available.",
    defaultExpandedSections,
    linkComponent,
    onNavigate,
    onOpenChange,
    resizable = true,
    defaultWidth,
    minWidth = DEFAULT_MIN_WIDTH,
    maxWidth = DEFAULT_MAX_WIDTH,
    virtualize = false,
  } = props;

  const viewportRef = useRef<HTMLDivElement | null>(null);

  const initialWidth = resolveInitialWidth(width, defaultWidth);
  const initialState = {
    ...(defaultExpandedSections ? { expandedSections: defaultExpandedSections } : {}),
    width: initialWidth,
  };

  const open = useSidebarStore(storageKey, (state) => state.open, initialState);
  const persistedWidth = useSidebarStore(storageKey, (state) => state.width, initialState);
  const expandedSections = useSidebarStore(storageKey, (state) => state.expandedSections, initialState);
  const expandedNodes = useSidebarStore(storageKey, (state) => state.expandedNodes, initialState);
  const openSidebar = useSidebarStore(storageKey, (state) => state.openSidebar, initialState);
  const closeSidebar = useSidebarStore(storageKey, (state) => state.closeSidebar, initialState);
  const toggleSection = useSidebarStore(storageKey, (state) => state.toggleSection, initialState);
  const toggleNode = useSidebarStore(storageKey, (state) => state.toggleNode, initialState);
  const setStoreWidth = useSidebarStore(storageKey, (state) => state.setWidth, initialState);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  const effectiveWidth = clamp(persistedWidth ?? initialWidth, minWidth, maxWidth);
  const setOpen = (nextOpen: boolean) => {
    if (nextOpen) openSidebar();
    else closeSidebar();
  };
  const managedByPanelLayout = usePanelSidebarRegistration({
    open,
    resizable,
    width: effectiveWidth,
    minWidth,
    maxWidth,
    onWidthChange: setStoreWidth,
    onOpenChange: setOpen,
  });

  if (!open && closable) {
    return null;
  }

  const widthCss = resizable ? `${effectiveWidth}px` : (width ?? `${initialWidth}px`);

  return (
    <Flex
      as="aside"
      data-testid="sidebar"
      direction="column"
      position="relative"
      h="100%"
      w={managedByPanelLayout ? "full" : widthCss}
      minW={managedByPanelLayout ? "0" : widthCss}
      maxW={managedByPanelLayout ? "none" : widthCss}
      flexShrink={0}
      borderRightWidth="1px"
      borderRightColor="border.muted"
      bg="bg"
    >
      <SidebarHeader>{header}</SidebarHeader>

      <ScrollArea
        flex="1"
        mt="lg"
        viewportRef={viewportRef}
        viewportProps={{ display: "block", style: { overflowX: "hidden" } }}
        contentProps={{ style: { minWidth: "100%", width: "100%" } }}
      >
        <Box w="full" minW="0">
          {sections.length === 0 ? (
            <Text textStyle="paragraph/S/regular" color="fg.muted" p="3">
              {emptyLabel}
            </Text>
          ) : (
            <TreeList
              sections={sections}
              expandedSectionIds={expandedSections}
              expandedNodeIds={expandedNodes}
              activeNodeId={activeNodeId}
              rowVariant="compact"
              sectionGap="md"
              linkComponent={linkComponent}
              onNavigate={onNavigate}
              onToggleSection={toggleSection}
              onToggleNode={toggleNode}
              virtualize={virtualize}
              scrollRef={viewportRef}
            />
          )}
        </Box>
      </ScrollArea>

      <SidebarFooter>{footer}</SidebarFooter>
    </Flex>
  );
};
