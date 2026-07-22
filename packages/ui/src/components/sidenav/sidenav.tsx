import { Box, Flex, Text } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { TreeList } from "../tree-list/tree-list";
import { useSidenavStore } from "./sidenav.store";
import type { SidenavProps } from "./sidenav.types";
import { SidenavFooter } from "./sidenav-footer";
import { SidenavHeader } from "./sidenav-header";

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

export const Sidenav = (props: SidenavProps) => {
  const {
    storageKey,
    sections,
    activeNodeId,
    contextActions = [],
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

  const open = useSidenavStore(storageKey, (state) => state.open, initialState);
  const persistedWidth = useSidenavStore(storageKey, (state) => state.width, initialState);
  const expandedSections = useSidenavStore(storageKey, (state) => state.expandedSections, initialState);
  const expandedNodes = useSidenavStore(storageKey, (state) => state.expandedNodes, initialState);
  const toggleSection = useSidenavStore(storageKey, (state) => state.toggleSection, initialState);
  const toggleNode = useSidenavStore(storageKey, (state) => state.toggleNode, initialState);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  const effectiveWidth = clamp(persistedWidth ?? initialWidth, minWidth, maxWidth);
  if (!open && closable) {
    return null;
  }

  const widthCss = resizable ? `${effectiveWidth}px` : (width ?? `${initialWidth}px`);

  const content = (
    <Flex
      as="aside"
      data-testid="sidenav"
      direction="column"
      position="relative"
      h="100%"
      w={widthCss}
      minW={widthCss}
      maxW={widthCss}
      flexShrink={0}
      borderRightWidth="1px"
      borderRightColor="border.subtle"
      bg="bg"
    >
      <SidenavHeader>{header}</SidenavHeader>

      <ScrollArea
        flex="1"
        mt="lg"
        viewportRef={viewportRef}
        viewportProps={{ display: "block", style: { overflowX: "hidden" } }}
        contentProps={{
          style: { minWidth: "100%", width: "100%", minHeight: "100%", display: "flex", flexDirection: "column" },
        }}
      >
        <Box w="full" minW="0" flex="1 0 auto" display="flex" flexDirection="column">
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
              nodeGap="1px"
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

      <SidenavFooter>{footer}</SidenavFooter>
    </Flex>
  );

  return (
    <ResourceContextMenu actions={contextActions} closeOnSelect={false}>
      {content}
    </ResourceContextMenu>
  );
};
