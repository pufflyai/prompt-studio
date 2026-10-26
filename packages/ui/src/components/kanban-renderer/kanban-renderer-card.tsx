import { HStack, Stack, Text, Wrap } from "@chakra-ui/react";
import { type DragEventHandler, type MouseEvent, type ReactNode, useRef } from "react";
import type { WorkspaceBadgeProps } from "@/components/primitives/workspace-badge";
import { WorkspaceBadge } from "@/components/primitives/workspace-badge";
import { HighlightedText } from "../collection-view/highlighted-text";
import { KanbanRendererAttributeBadge } from "./kanban-renderer-attribute-badge";
import type { AttributeBadge } from "./kanban-renderer-helpers";

export interface KanbanRendererCardProps {
  eyebrow?: string;
  title: string;
  /** Search text to mark in the title and eyebrow. */
  highlight?: string;
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
    highlight = "",
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

  const pointerStartedOnControl = useRef(false);
  const hasBadges = badges.length > 0 || customSlots.length > 0;
  const clickCursor = onClick ? "pointer" : "default";
  const cursor = draggable ? "grab" : clickCursor;
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const startedOnControl = pointerStartedOnControl.current;
    pointerStartedOnControl.current = false;
    if (event.detail > 0 && startedOnControl) return;
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
      onPointerDownCapture={(event) => {
        if (!event.isPrimary) return;
        const control =
          event.target instanceof Element
            ? event.target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"]')
            : null;
        // A control can move during a live update, making the browser target its card on release.
        pointerStartedOnControl.current = Boolean(control && event.currentTarget.contains(control));
      }}
      onPointerCancel={(event) => {
        if (event.isPrimary) pointerStartedOnControl.current = false;
      }}
      onClick={onClick ? handleClick : undefined}
      data-selected={isSelected ? "true" : undefined}
      data-testid="renderer-card"
      data-board-pan-ignore
    >
      {eyebrow || workspaceBadge ? (
        <HStack minW="0" gap="2xs">
          {eyebrow ? (
            <Text textStyle="label/XS" color="fg.muted" fontFamily="mono" truncate>
              <HighlightedText text={eyebrow} query={highlight} />
            </Text>
          ) : null}
          <HStack marginLeft="auto">{workspaceBadge ? <WorkspaceBadge {...workspaceBadge} /> : null}</HStack>
        </HStack>
      ) : null}

      <Text textStyle="paragraph/S/regular" minW="0" overflowWrap="anywhere">
        <HighlightedText text={title} query={highlight} />
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
