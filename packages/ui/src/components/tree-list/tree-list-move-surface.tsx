import { Box } from "@chakra-ui/react";
import type { DragEvent as ReactDragEvent, ReactNode } from "react";
import { readDraggedTreeNodeId } from "./tree-list-drag";

interface TreeListMoveSurfaceProps {
  children: ReactNode;
  onMoveNode?: (sourceNodeId: string, targetNodeId?: string) => void;
}

export const TreeListMoveSurface = (props: TreeListMoveSurfaceProps) => {
  const { children, onMoveNode } = props;

  const handleDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!onMoveNode) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!onMoveNode) return;
    event.preventDefault();
    const sourceNodeId = readDraggedTreeNodeId(event.dataTransfer);
    if (sourceNodeId) onMoveNode(sourceNodeId);
  };

  return (
    <Box
      p="xs"
      w="full"
      minW="0"
      maxW="full"
      minH="full"
      flex="1 0 auto"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
    </Box>
  );
};
