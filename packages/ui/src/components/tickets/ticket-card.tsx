import { Badge, HStack, Stack, Text, Wrap } from "@chakra-ui/react";
import type { DragEventHandler, KeyboardEvent, MouseEvent } from "react";
import type { WorkspaceBadgeProps } from "@/components/workspace-badge";
import { WorkspaceBadge } from "@/components/workspace-badge";

export interface TicketCardBadge {
  id?: string;
  label: string;
  color?: string;
  onClick?: () => void;
}

interface TicketCardProps {
  ticketId: string;
  parentPath?: string[];
  title: string;
  badges?: TicketCardBadge[];
  workspaceBadge?: WorkspaceBadgeProps;
  isSelected?: boolean;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
  onClick?: () => void;
}

export const TicketCard = (props: TicketCardProps) => {
  const {
    ticketId,
    parentPath = [],
    title,
    badges = [],
    workspaceBadge,
    isSelected = false,
    draggable,
    onDragStart,
    onDragEnd,
    onClick,
  } = props;

  return (
    <Stack
      gap="xs"
      padding="sm"
      borderRadius="sm"
      borderWidth="1px"
      width="100%"
      background="bg"
      transition="box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out"
      _hover={{
        borderColor: "border.blue",
        boxShadow: "mid",
      }}
      cursor={draggable ? "grab" : onClick ? "pointer" : "default"}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      data-selected={isSelected ? "true" : undefined}
      data-testid="ticket-card"
    >
      <HStack gap="2xs" flexWrap="wrap" alignItems="center">
        <HStack gap="2xs" flexShrink={0}>
          <Text textStyle="label/S/regular" flexShrink={0}>
            {parentPath.length > 0 && (
              <Text as="span" color="subtle">
                {parentPath.join(" / ")} /{" "}
              </Text>
            )}
            {ticketId}
          </Text>
          {workspaceBadge ? <WorkspaceBadge {...workspaceBadge} /> : null}
        </HStack>
      </HStack>

      <HStack align="start" gap="2xs" flexWrap="wrap" minW="0">
        <Text textStyle="label/S/regular" flex="1" minW="0" overflowWrap="anywhere">
          {title}
        </Text>
      </HStack>

      {badges.length > 0 && (
        <Wrap gap="2xs">
          {badges.map((badge, index) => (
            <Badge
              key={badge.id ?? `${badge.label}-${index}`}
              variant="subtle"
              colorPalette={badge.color ?? "gray"}
              textStyle="label/XS/medium"
              cursor={badge.onClick ? "pointer" : undefined}
              _hover={badge.onClick ? { opacity: 0.8 } : undefined}
              role={badge.onClick ? "button" : undefined}
              tabIndex={badge.onClick ? 0 : undefined}
              onClick={
                badge.onClick
                  ? (event: MouseEvent) => {
                      event.stopPropagation();
                      badge.onClick?.();
                    }
                  : undefined
              }
              onKeyDown={
                badge.onClick
                  ? (event: KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        badge.onClick?.();
                      }
                    }
                  : undefined
              }
            >
              {badge.label}
            </Badge>
          ))}
        </Wrap>
      )}
    </Stack>
  );
};
