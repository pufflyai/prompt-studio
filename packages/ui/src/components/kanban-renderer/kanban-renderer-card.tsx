import { HStack, Stack, Text, Wrap } from "@chakra-ui/react";
import type { DragEventHandler, MouseEvent, ReactNode } from "react";
import type { WorkspaceBadgeProps } from "@/components/primitives/workspace-badge";
import { WorkspaceBadge } from "@/components/primitives/workspace-badge";
import { KanbanRendererAttributeBadge } from "./kanban-renderer-attribute-badge";
import type { AttributeBadge } from "./kanban-renderer-helpers";

export interface KanbanRendererCardProps {
  eyebrow?: string;
  title: string;
  badges?: AttributeBadge[];
  customSlots?: ReactNode[];
  workspaceBadge?: WorkspaceBadgeProps;
  isSelected?: boolean;
  draggable?: boolean;
  onBadgeChange?: (attributeId: string, value: unknown) => void;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
  onClick?: () => void;
}

export const KanbanRendererCard = (props: KanbanRendererCardProps) => {
  const {
    eyebrow,
    title,
    badges = [],
    customSlots = [],
    workspaceBadge,
    isSelected = false,
    draggable,
    onBadgeChange,
    onDragStart,
    onDragEnd,
    onClick,
  } = props;

  const hasBadges = badges.length > 0 || customSlots.length > 0;
  const cursor = draggable ? "grab" : onClick ? "pointer" : "default";
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    onClick?.();
  };

  return (
    <Stack
      gap="xs"
      padding="compact"
      borderRadius="compact"
      borderWidth="1px"
      borderColor={isSelected ? "border.accent" : "border"}
      width="100%"
      background="bg"
      transition="border-color 0.2s ease-in-out, background 0.2s ease-in-out"
      _hover={{ borderColor: isSelected ? "border.accent" : "border.accent-light" }}
      cursor={cursor}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick ? handleClick : undefined}
      data-selected={isSelected ? "true" : undefined}
      data-testid="renderer-card"
    >
      {eyebrow || workspaceBadge ? (
        <HStack minW="0" gap="2xs">
          {eyebrow ? (
            <Text textStyle="label/XS" color="fg.muted" fontFamily="mono" truncate>
              {eyebrow}
            </Text>
          ) : null}
          <HStack marginLeft="auto">{workspaceBadge ? <WorkspaceBadge {...workspaceBadge} /> : null}</HStack>
        </HStack>
      ) : null}

      <Text textStyle="paragraph/S/regular" minW="0" overflowWrap="anywhere">
        {title}
      </Text>

      {hasBadges && (
        <Wrap gap="2xs">
          {badges.map((badge) => (
            <KanbanRendererAttributeBadge key={badge.attributeId} badge={badge} onChange={onBadgeChange} />
          ))}
          {customSlots}
        </Wrap>
      )}
    </Stack>
  );
};
