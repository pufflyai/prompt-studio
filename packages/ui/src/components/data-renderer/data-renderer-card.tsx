import { HStack, Stack, Text, Wrap } from "@chakra-ui/react";
import type { DragEventHandler, MouseEvent, ReactNode } from "react";
import type { WorkspaceBadgeProps } from "@/components/primitives/workspace-badge";
import { WorkspaceBadge } from "@/components/primitives/workspace-badge";
import { isDataRendererCardClickSuppressed } from "./card-interaction-guard";
import { DataRendererAttributeBadge } from "./data-renderer-attribute-badge";
import type { AttributeBadge } from "./data-renderer-helpers";

export interface DataRendererCardProps {
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

export const DataRendererCard = (props: DataRendererCardProps) => {
  const {
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
    if (isDataRendererCardClickSuppressed()) return;
    if (event.defaultPrevented) return;
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    onClick?.();
  };

  return (
    <Stack
      gap="xs"
      padding="sm"
      borderRadius="xs"
      borderWidth="1px"
      borderColor={isSelected ? "border.accent" : "border.subtle"}
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
      <HStack align="start" gap="2xs" flexWrap="wrap" minW="0">
        <Text textStyle="label/S/regular" flex="1" minW="0" overflowWrap="anywhere">
          {title}
        </Text>
        {workspaceBadge ? <WorkspaceBadge {...workspaceBadge} /> : null}
      </HStack>

      {hasBadges && (
        <Wrap gap="2xs">
          {badges.map((badge) => (
            <DataRendererAttributeBadge key={badge.attributeId} badge={badge} onChange={onBadgeChange} />
          ))}
          {customSlots}
        </Wrap>
      )}
    </Stack>
  );
};
