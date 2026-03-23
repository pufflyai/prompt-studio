import { Flex, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { ScrollArea } from "../scroll-area";
import { SidebarTree } from "../sidebar-tree/sidebar-tree";
import { useSidebarNextStore } from "./sidebar-next.store";
import type { SidebarNextProps } from "./sidebar-next.types";
import { SidebarNextFooter } from "./sidebar-next-footer";
import { SidebarNextHeader } from "./sidebar-next-header";

export const SidebarNext = (props: SidebarNextProps) => {
  const {
    storageKey,
    sections,
    activeNodeId,
    header,
    footer,
    width = "240px",
    closable = true,
    emptyLabel = "No items available.",
    linkComponent,
    onNavigate,
    onOpenChange,
  } = props;

  const open = useSidebarNextStore(storageKey, (state) => state.open);
  const expandedSections = useSidebarNextStore(storageKey, (state) => state.expandedSections);
  const expandedNodes = useSidebarNextStore(storageKey, (state) => state.expandedNodes);
  const closeSidebar = useSidebarNextStore(storageKey, (state) => state.closeSidebar);
  const toggleSection = useSidebarNextStore(storageKey, (state) => state.toggleSection);
  const toggleNode = useSidebarNextStore(storageKey, (state) => state.toggleNode);

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
      <SidebarNextHeader onClose={closable ? closeSidebar : undefined}>{header}</SidebarNextHeader>

      <ScrollArea flex="1">
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
      </ScrollArea>

      <SidebarNextFooter>{footer}</SidebarNextFooter>
    </Flex>
  );
};
