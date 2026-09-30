import { Box, HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { KanbanRendererAttributeBadge } from "./kanban-renderer-attribute-badge";
import type { AttributeBadge } from "./kanban-renderer-helpers";
import type { AttributeDescriptor } from "./types";

export interface KanbanRendererListCell {
  id: string;
  size: NonNullable<AttributeDescriptor["listColumn"]>["size"];
  align?: NonNullable<AttributeDescriptor["listColumn"]>["align"];
  badge?: AttributeBadge | null;
  content?: ReactNode;
}

const widths = {
  "2xs": "kanban-column-2xs",
  xs: "kanban-column-xs",
  sm: "kanban-column-sm",
  md: "kanban-column-md",
  lg: "kanban-column-lg",
} as const;

interface KanbanRendererListCellsProps {
  cells?: KanbanRendererListCell[];
  onBadgeChange?: (attributeId: string, value: unknown) => void;
}

export const KanbanRendererListCells = (props: KanbanRendererListCellsProps) => {
  const { cells, onBadgeChange } = props;
  if (!cells?.length) return null;
  return (
    <HStack gap="compact" flexShrink={0}>
      {cells.map((cell) => (
        <Box
          key={cell.id}
          data-list-column={cell.id}
          width={widths[cell.size]}
          minW="0"
          display="flex"
          alignItems="center"
          justifyContent={cell.align === "end" ? "flex-end" : "flex-start"}
          overflow="hidden"
          flexShrink={0}
        >
          {cell.badge ? <KanbanRendererAttributeBadge badge={cell.badge} onChange={onBadgeChange} /> : cell.content}
        </Box>
      ))}
    </HStack>
  );
};
