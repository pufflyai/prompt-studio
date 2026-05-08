import { Box, Flex, Text } from "@chakra-ui/react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from "react";
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
  } = props;

  const initialWidth = resolveInitialWidth(width, defaultWidth);
  const initialState = {
    ...(defaultExpandedSections ? { expandedSections: defaultExpandedSections } : {}),
    width: initialWidth,
  };

  const open = useSidebarStore(storageKey, (state) => state.open, initialState);
  const persistedWidth = useSidebarStore(storageKey, (state) => state.width, initialState);
  const expandedSections = useSidebarStore(storageKey, (state) => state.expandedSections, initialState);
  const expandedNodes = useSidebarStore(storageKey, (state) => state.expandedNodes, initialState);
  const closeSidebar = useSidebarStore(storageKey, (state) => state.closeSidebar, initialState);
  const toggleSection = useSidebarStore(storageKey, (state) => state.toggleSection, initialState);
  const toggleNode = useSidebarStore(storageKey, (state) => state.toggleNode, initialState);
  const setStoreWidth = useSidebarStore(storageKey, (state) => state.setWidth, initialState);

  const cleanupRef = useRef<() => void>(() => undefined);

  useEffect(() => () => cleanupRef.current(), []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  if (!open && closable) {
    return null;
  }

  const effectiveWidth = clamp(persistedWidth ?? initialWidth, minWidth, maxWidth);
  const widthCss = resizable ? `${effectiveWidth}px` : (width ?? `${initialWidth}px`);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = effectiveWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    const onMove = (moveEvent: PointerEvent) => {
      const next = clamp(startWidth + (moveEvent.clientX - startX), minWidth, maxWidth);
      setStoreWidth(next);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      cleanupRef.current = () => undefined;
    };

    cleanupRef.current = cleanup;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cleanup, { once: true });
  };

  return (
    <Flex
      as="aside"
      data-testid="sidebar"
      direction="column"
      position="relative"
      h="100%"
      w={widthCss}
      minW={widthCss}
      maxW={widthCss}
      flexShrink={0}
      borderRightWidth="1px"
      borderRightColor="border.muted"
      bg="bg"
    >
      <SidebarHeader onClose={closable ? closeSidebar : undefined}>{header}</SidebarHeader>

      <ScrollArea
        flex="1"
        mt="lg"
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
            />
          )}
        </Box>
      </ScrollArea>

      <SidebarFooter>{footer}</SidebarFooter>

      {resizable ? (
        <Box
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          position="absolute"
          top="0"
          bottom="0"
          right="0"
          width="3"
          transform="translateX(50%)"
          cursor="col-resize"
          touchAction="none"
          zIndex="1"
          onPointerDown={handlePointerDown}
        />
      ) : null}
    </Flex>
  );
};
