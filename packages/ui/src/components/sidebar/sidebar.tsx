import { Box, Flex, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { ScrollArea } from "../scroll-area";
import { SidebarTree } from "../sidebar-tree/sidebar-tree";
import { useSidebarStore } from "./sidebar.store";
import type { SidebarProps } from "./sidebar.types";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarHeader } from "./sidebar-header";

export const Sidebar = (props: SidebarProps) => {
  const {
    storageKey,
    sections,
    activeNodeId,
    header,
    footer,
    width = "240px",
    closable = true,
    emptyLabel = "No items available.",
    defaultExpandedSections,
    linkComponent,
    onNavigate,
    onOpenChange,
  } = props;

  const initialState = defaultExpandedSections ? { expandedSections: defaultExpandedSections } : undefined;
  const open = useSidebarStore(storageKey, (state) => state.open, initialState);
  const expandedSections = useSidebarStore(storageKey, (state) => state.expandedSections, initialState);
  const expandedNodes = useSidebarStore(storageKey, (state) => state.expandedNodes, initialState);
  const closeSidebar = useSidebarStore(storageKey, (state) => state.closeSidebar, initialState);
  const toggleSection = useSidebarStore(storageKey, (state) => state.toggleSection, initialState);
  const toggleNode = useSidebarStore(storageKey, (state) => state.toggleNode, initialState);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  if (!open && closable) {
    return null;
  }

  return (
    <Flex
      as="aside"
      data-testid="sidebar"
      direction="column"
      h="100%"
      w={width}
      minW={width}
      maxW={width}
      borderRightWidth="1px"
      borderRightColor="border.muted"
      bg="bg"
    >
      <SidebarHeader onClose={closable ? closeSidebar : undefined}>{header}</SidebarHeader>

      <ScrollArea
        flex="1"
        px="xs"
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
            <SidebarTree
              sections={sections}
              expandedSections={expandedSections}
              expandedNodes={expandedNodes}
              activeNodeId={activeNodeId}
              linkComponent={linkComponent}
              onNavigate={onNavigate}
              onToggleSection={toggleSection}
              onToggleNode={toggleNode}
            />
          )}
        </Box>
      </ScrollArea>

      <SidebarFooter>{footer}</SidebarFooter>
    </Flex>
  );
};
