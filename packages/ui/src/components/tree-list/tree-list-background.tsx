import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { type ResourceContextAction, ResourceContextMenu } from "@/components/overlays/resource-context-menu";

interface TreeListBackgroundProps {
  actions: ResourceContextAction[];
  children: ReactNode;
}

// The menu target stays behind the rows so item context menus keep priority.
export const TreeListBackground = (props: TreeListBackgroundProps) => {
  const { actions, children } = props;

  return (
    <Box position="relative" flex="1 0 auto" minH="full" w="full" minW="0" maxW="full">
      <ResourceContextMenu actions={actions} closeOnSelect={false}>
        <Box position="absolute" inset="0" zIndex={0} aria-hidden data-tree-list-background="true" />
      </ResourceContextMenu>
      <Box position="relative" zIndex={1} w="full" minW="0" maxW="full">
        {children}
      </Box>
    </Box>
  );
};
