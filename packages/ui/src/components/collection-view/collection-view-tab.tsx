import { Box, Tabs, Text } from "@chakra-ui/react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { type ResourceContextAction, ResourceContextMenu } from "@/components/overlays/resource-context-menu";
import { DropIndicator } from "@/components/primitives/drop-indicator";

interface CollectionViewTabProps {
  id: string;
  title: string;
  dirty: boolean;
  actions: ResourceContextAction[];
  reorderable: boolean;
  dropEdge?: "before" | "after";
  onMove: (direction: "left" | "right") => void;
}

export const CollectionViewTab = (props: CollectionViewTabProps) => {
  const { id, title, dirty, actions, reorderable, dropEdge, onMove } = props;
  const drag = useDraggable({ id, disabled: !reorderable });
  const target = useDroppable({ id, disabled: !reorderable });
  return (
    <ResourceContextMenu actions={actions} positioning={{ placement: "bottom-start" }}>
      <Box
        position="relative"
        flexShrink="0"
        ref={(node: HTMLDivElement | null) => {
          drag.setNodeRef(node);
          target.setNodeRef(node);
        }}
      >
        <Tabs.Trigger
          value={id}
          title={title}
          data-reorderable={reorderable || undefined}
          data-dragging={drag.isDragging || undefined}
          aria-keyshortcuts={reorderable ? "Alt+ArrowLeft Alt+ArrowRight" : undefined}
          {...drag.listeners}
          onKeyDown={(event) => {
            if (!reorderable || !event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            onMove(event.key === "ArrowLeft" ? "left" : "right");
          }}
        >
          <Text as="span" data-tab-label>
            {title}
          </Text>
          {dirty ? (
            <Box
              aria-label="Unsaved view changes"
              width="0.375rem"
              height="0.375rem"
              flexShrink={0}
              borderRadius="full"
              bg="fg.warning"
            />
          ) : null}
        </Tabs.Trigger>
        {dropEdge ? (
          <DropIndicator
            orientation="vertical"
            left={dropEdge === "before" ? "0" : undefined}
            right={dropEdge === "after" ? "0" : undefined}
          />
        ) : null}
      </Box>
    </ResourceContextMenu>
  );
};
