import { Badge, HStack, Stack, Text, Wrap } from "@chakra-ui/react";
import type { DragEventHandler, KeyboardEvent, MouseEvent } from "react";
import type { WorkspaceBadgeProps } from "@/components/workspace-badge";
import { WorkspaceBadge } from "@/components/workspace-badge";

export interface TicketCardBadge {
  label: string;
  color?: string;
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

  const hasWorkspaceBadgeAction = Boolean(workspaceBadge?.onClick) || Boolean(workspaceBadge?.onWorkspaceOptionSelect);

  const stopWorkspaceBadgeClickPropagation = (event: MouseEvent<HTMLDivElement>) => {
    if (!hasWorkspaceBadgeAction) return;
    event.stopPropagation();
  };

  const stopWorkspaceBadgeKeyPropagation = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!hasWorkspaceBadgeAction) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.stopPropagation();
  };

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
    >
      <HStack justifyContent={"space-between"} gap="2xs" flexWrap="wrap">
        <HStack gap="2xs" flexShrink={0}>
          <Text textStyle="label/S/regular" flexShrink={0}>
            {parentPath.length > 0 && (
              <Text as="span" color="subtle">
                {parentPath.join(" / ")} /{" "}
              </Text>
            )}
            {ticketId}
          </Text>
        </HStack>
        {workspaceBadge ? (
          <HStack
            gap="0"
            onClick={stopWorkspaceBadgeClickPropagation}
            onKeyDown={stopWorkspaceBadgeKeyPropagation}
            alignItems="center"
          >
            <WorkspaceBadge {...workspaceBadge} />
          </HStack>
        ) : null}
      </HStack>

      <HStack align="start" gap="2xs" flexWrap="wrap" minW="0">
        <Text textStyle="label/S/regular" flex="1" minW="0" overflowWrap="anywhere">
          {title}
        </Text>
      </HStack>

      {badges.length > 0 && (
        <Wrap gap="2xs">
          {badges.map((badge) => (
            <Badge key={badge.label} variant="subtle" colorPalette={badge.color ?? "gray"} textStyle="label/XS/medium">
              {badge.label}
            </Badge>
          ))}
        </Wrap>
      )}
    </Stack>
  );
};
