import { Badge, HStack, Stack, Text, Wrap } from "@chakra-ui/react";
import type { DragEventHandler, ReactNode } from "react";
import type { WorkspaceBadgeProps } from "@/components/workspace-badge";
import { WorkspaceBadge } from "@/components/workspace-badge";
import type { AttributeBadge } from "./data-renderer-helpers";

export interface DataRendererCardProps {
  ticketId?: string;
  parentPath?: string[];
  title: string;
  badges?: AttributeBadge[];
  customSlots?: ReactNode[];
  workspaceBadge?: WorkspaceBadgeProps;
  isSelected?: boolean;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
  onClick?: () => void;
}

export const DataRendererCard = (props: DataRendererCardProps) => {
  const {
    title,
    ticketId,
    parentPath = [],
    badges = [],
    customSlots = [],
    workspaceBadge,
    isSelected = false,
    draggable,
    onDragStart,
    onDragEnd,
    onClick,
  } = props;

  const hasBadges = badges.length > 0 || customSlots.length > 0;
  const cursor = draggable ? "grab" : onClick ? "pointer" : "default";
  const hasTicketLabel = Boolean(ticketId) || parentPath.length > 0;
  const hasTicketHeader = Boolean(ticketId) || parentPath.length > 0 || Boolean(workspaceBadge);

  return (
    <Stack
      gap="xs"
      padding="sm"
      borderRadius="sm"
      borderWidth="1px"
      width="100%"
      background="bg"
      transition="box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out"
      _hover={{ borderColor: "border.blue", boxShadow: "mid" }}
      cursor={cursor}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      data-selected={isSelected ? "true" : undefined}
      data-testid={ticketId ? "ticket-card" : "renderer-card"}
    >
      {hasTicketHeader && (
        <HStack gap="2xs" flexWrap="wrap" alignItems="center" minW="0">
          {hasTicketLabel && (
            <Text textStyle="label/S/regular" flexShrink={0} color="fg.muted">
              {parentPath.length > 0 ? `${parentPath.join(" / ")} / ` : null}
              {ticketId}
            </Text>
          )}
          {workspaceBadge ? <WorkspaceBadge {...workspaceBadge} /> : null}
        </HStack>
      )}

      <HStack align="start" gap="2xs" flexWrap="wrap" minW="0">
        <Text textStyle="label/S/regular" flex="1" minW="0" overflowWrap="anywhere">
          {title}
        </Text>
        {!hasTicketHeader && workspaceBadge ? <WorkspaceBadge {...workspaceBadge} /> : null}
      </HStack>

      {hasBadges && (
        <Wrap gap="2xs">
          {badges.map((badge) => (
            <Badge
              key={badge.attributeId}
              variant="subtle"
              colorPalette={badge.color ?? "gray"}
              textStyle="label/XS/medium"
            >
              {badge.label}
            </Badge>
          ))}
          {customSlots}
        </Wrap>
      )}
    </Stack>
  );
};
