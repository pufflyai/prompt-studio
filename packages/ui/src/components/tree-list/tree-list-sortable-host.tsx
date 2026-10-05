import { Box, type StackProps } from "@chakra-ui/react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import { DropIndicator } from "../primitives/drop-indicator";
import type { TreeListDropIndicator } from "./tree-list-drop-indicator";
import { toGapDragId } from "./tree-list-reorder";

const edgePosition = {
  before: { top: "0", transform: "translateY(-50%)" },
  after: { bottom: "0", transform: "translateY(50%)" },
  middle: { top: "50%", transform: "translateY(-50%)" },
} as const;

// The accent line marks the drop slot on the target's edge without shifting the rows.
const DropLine = (props: { edge: TreeListDropIndicator["edge"] }) => {
  const { edge } = props;
  return <DropIndicator data-tree-list-drop-indicator={edge} {...edgePosition[edge]} />;
};

interface SortableHostProps {
  id: string;
  disabled?: boolean;
  indicator: TreeListDropIndicator | null;
  // Rows are their own drag handle; a section is dragged by its header only.
  handle: "self" | "child";
  liftedBg?: string;
  // A group the dragged row drops into.
  highlighted?: boolean;
  children: (listeners: ReturnType<typeof useSortable>["listeners"]) => ReactNode;
}

// No grip glyph: the row or section header is the handle. Clicks pass through because the pointer sensor
// activates only after the cursor moves 4px (configured by the tree list). Items stay in place while dragging;
// the lifted item fades and the drop line shows where it lands.
export const SortableHost = (props: SortableHostProps) => {
  const { id, disabled, indicator, handle, liftedBg, highlighted, children } = props;
  const sortable = useSortable({ id, disabled });
  const edge = indicator?.lineId === id ? indicator.edge : undefined;
  const lifted = sortable.isDragging ? liftedBg : undefined;
  return (
    <Box
      ref={sortable.setNodeRef}
      position="relative"
      w="full"
      minW="0"
      borderRadius="xs"
      opacity={sortable.isDragging ? 0.5 : 1}
      bg={highlighted ? "bg.accent-subtle" : lifted}
      data-tree-list-drop-group={highlighted ? "" : undefined}
      onPointerDownCapture={handle === "self" ? (event) => sortable.listeners?.onPointerDown?.(event) : undefined}
    >
      {children(sortable.listeners)}
      {edge ? <DropLine edge={edge} /> : null}
    </Box>
  );
};

interface SectionGapProps {
  sectionId: string;
  nextSectionId?: string;
  gap: StackProps["gap"];
  indicator: TreeListDropIndicator | null;
}

// The space after a section is a drop zone of its own: dropping here places a row behind the section.
export const SectionGap = (props: SectionGapProps) => {
  const { sectionId, nextSectionId, gap, indicator } = props;
  const id = toGapDragId(sectionId);
  const droppable = useDroppable({ id, data: { nextSectionId } });
  return (
    <Box ref={droppable.setNodeRef} position="relative" w="full" pt={gap} flexShrink={0}>
      {indicator?.lineId === id ? <DropLine edge="middle" /> : null}
    </Box>
  );
};
