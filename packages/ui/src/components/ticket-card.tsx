import { Badge, HStack, Stack, Text, Wrap } from "@chakra-ui/react";
import { GitBranchIcon } from "lucide-react";
import type { DragEventHandler, MouseEvent } from "react";
import { DiffBubble } from "@/components/diff-bubble";
import { Tooltip } from "@/components/tooltip";
import { type SessionCompletionStatus, SessionIndicator } from "./session-indicator";

export interface TicketCardBadge {
  label: string;
  color?: string;
}

interface TicketCardProps {
  ticketId: string;
  sessionIndicatorLabel?: string;
  sessionIndicatorStatus?: SessionCompletionStatus;
  title: string;
  badges?: TicketCardBadge[];
  diffAdditions?: number;
  diffDeletions?: number;
  isSelected?: boolean;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
  onClick?: () => void;
  onDiffBadgeClick?: () => void;
  onSessionIndicatorClick?: () => void;
}

export const TicketCard = (props: TicketCardProps) => {
  const {
    ticketId,
    sessionIndicatorLabel,
    sessionIndicatorStatus,
    title,
    badges = [],
    diffAdditions,
    diffDeletions,
    isSelected = false,
    draggable,
    onDragStart,
    onDragEnd,
    onClick,
    onDiffBadgeClick,
    onSessionIndicatorClick,
  } = props;

  const handleDiffBadgeClick = (event: MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    onDiffBadgeClick?.();
  };

  const handleSessionIndicatorClick = (event: MouseEvent<SVGSVGElement>) => {
    event.stopPropagation();
    onSessionIndicatorClick?.();
  };

  return (
    <Stack
      gap="xs"
      padding="sm"
      borderRadius="sm"
      borderWidth="1px"
      borderColor={isSelected ? "border.accent" : "border.secondary"}
      background="background.primary"
      boxShadow={isSelected ? "mid" : "none"}
      transition="box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out"
      _hover={{
        borderColor: isSelected ? "border.accent" : "border.primary",
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
            {ticketId}
          </Text>
          {sessionIndicatorLabel ? (
            <Tooltip content={`Session ${sessionIndicatorLabel}`}>
              <SessionIndicator
                status={sessionIndicatorStatus}
                boxSize="12px"
                aria-label={`Session ${sessionIndicatorLabel}`}
                cursor={onSessionIndicatorClick ? "pointer" : "default"}
                onClick={onSessionIndicatorClick ? handleSessionIndicatorClick : undefined}
              />
            </Tooltip>
          ) : null}
        </HStack>
        {typeof diffAdditions === "number" && typeof diffDeletions === "number" ? (
          <DiffBubble
            additions={diffAdditions}
            deletions={diffDeletions}
            variant="ghost"
            size="small"
            label={<GitBranchIcon size="12" />}
            onClick={handleDiffBadgeClick}
            data-testid="ticket-diff-badge"
          />
        ) : null}
      </HStack>

      <HStack align="start" gap="2xs" flexWrap="wrap">
        <Text textStyle="label/S/regular" flex="1" minW="0">
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
