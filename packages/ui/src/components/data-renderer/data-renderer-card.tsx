import { Badge, HStack, Stack, Text, Wrap } from "@chakra-ui/react";
import type { DragEventHandler } from "react";
import type { WorkspaceBadgeProps } from "@/components/workspace-badge";
import { WorkspaceBadge } from "@/components/workspace-badge";
import { TagBadge } from "./tag-badge";
import type { DataRendererTagOption } from "./types";

export interface DataRendererCardBadge {
  label: string;
  color?: string;
}

export interface DataRendererCardTagBadge {
  tagName: string;
  label: string;
  value: string | null;
  color?: string;
  options: DataRendererTagOption[];
}

interface DataRendererCardProps {
  ticketId: string;
  parentPath?: string[];
  title: string;
  badges?: DataRendererCardBadge[];
  tagBadges?: DataRendererCardTagBadge[];
  workspaceBadge?: WorkspaceBadgeProps;
  isSelected?: boolean;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  onDragEnd?: DragEventHandler<HTMLDivElement>;
  onClick?: () => void;
  onTagChange?: (tagName: string, newValue: string) => void;
}

export const DataRendererCard = (props: DataRendererCardProps) => {
  const {
    ticketId,
    parentPath = [],
    title,
    badges = [],
    tagBadges = [],
    workspaceBadge,
    isSelected = false,
    draggable,
    onDragStart,
    onDragEnd,
    onClick,
    onTagChange,
  } = props;

  const hasBadges = badges.length > 0 || tagBadges.length > 0;

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

      {hasBadges && (
        <Wrap gap="2xs">
          {badges.map((badge) => (
            <Badge key={badge.label} variant="subtle" colorPalette={badge.color ?? "gray"} textStyle="label/XS/medium">
              {badge.label}
            </Badge>
          ))}
          {tagBadges.map((tag) => (
            <TagBadge
              key={tag.tagName}
              value={tag.value}
              label={tag.label}
              color={tag.value ? tag.color : "gray"}
              options={tag.options}
              onValueChange={onTagChange ? (newValue) => onTagChange(tag.tagName, newValue) : undefined}
            />
          ))}
        </Wrap>
      )}
    </Stack>
  );
};
