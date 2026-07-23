import { HStack, Icon, IconButton, Stack, Text, Wrap } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import type { DragEventHandler, MouseEvent, ReactNode } from "react";
import { ResourceActionMenu, type ResourceContextAction } from "@/components/overlays/resource-context-menu";
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
  contextMenuActions?: ResourceContextAction[];
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
    contextMenuActions = [],
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
        {contextMenuActions.length > 0 ? (
          <ResourceActionMenu actions={contextMenuActions} positioning={{ placement: "bottom-end" }}>
            <IconButton
              variant="ghost"
              size="2xs"
              aria-label={`Actions for ${title}`}
              onClick={(event) => event.stopPropagation()}
            >
              <Icon as={ChevronDown} boxSize="14px" />
            </IconButton>
          </ResourceActionMenu>
        ) : null}
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
