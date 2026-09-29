import { Box } from "@chakra-ui/react";
import { useSortable } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import type { TreeListDropIndicator } from "./tree-list-drop-indicator";

// The accent line marks the drop slot on the target's edge without shifting the rows.
const DropLine = (props: { edge: TreeListDropIndicator["edge"] }) => {
  const { edge } = props;
  return (
    <Box
      aria-hidden
      data-tree-list-drop-indicator={edge}
      position="absolute"
      insetX="0"
      zIndex="1"
      h="drop-indicator"
      borderRadius="full"
      bg="bg.accent-primary.default"
      pointerEvents="none"
      {...(edge === "before"
        ? { top: "0", transform: "translateY(-50%)" }
        : { bottom: "0", transform: "translateY(50%)" })}
    />
  );
};

interface SortableHostProps {
  id: string;
  disabled?: boolean;
  indicator: TreeListDropIndicator | null;
  // Rows are their own drag handle; a section is dragged by its header only.
  handle: "self" | "child";
  liftedBg?: string;
  children: (listeners: ReturnType<typeof useSortable>["listeners"]) => ReactNode;
}

// No grip glyph: the row or section header is the handle. Clicks pass through because the pointer sensor
// activates only after the cursor moves 4px (configured by the tree list). Items stay in place while dragging; the
// lifted item fades and the drop line shows where it lands.
export const SortableHost = (props: SortableHostProps) => {
  const { id, disabled, indicator, handle, liftedBg, children } = props;
  const sortable = useSortable({ id, disabled });
  const edge = indicator?.id === id ? indicator.edge : undefined;
  return (
    <Box
      ref={sortable.setNodeRef}
      position="relative"
      w="full"
      minW="0"
      borderRadius="xs"
      opacity={sortable.isDragging ? 0.5 : 1}
      bg={sortable.isDragging ? liftedBg : undefined}
      onPointerDownCapture={handle === "self" ? (event) => sortable.listeners?.onPointerDown?.(event) : undefined}
    >
      {children(sortable.listeners)}
      {edge ? <DropLine edge={edge} /> : null}
    </Box>
  );
};
